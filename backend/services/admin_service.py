from datetime import datetime, timezone
from core.database import get_supabase_admin
from services.notification_service import create_notification, notify_admins


def log_admin_action(
    admin_id: str,
    action_type: str,
    target_type: str,
    target_id: str,
    details: dict = None,
):
    """Log an admin action to the audit trail."""
    db = get_supabase_admin()
    db.table("admin_activity_logs").insert({
        "admin_id": admin_id,
        "action_type": action_type,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
    }).execute()


def get_system_stats() -> dict:
    """Get system-wide statistics for admin dashboard."""
    db = get_supabase_admin()

    # Total users — need row data to compute verified/suspended counts
    users_result = db.table("users").select("id, email_verified, is_upload_suspended", count="exact").execute()
    total_users = users_result.count or 0
    verified = sum(1 for u in (users_result.data or []) if u.get("email_verified"))
    suspended = sum(1 for u in (users_result.data or []) if u.get("is_upload_suspended"))

    # Total documents — count only via HEAD request
    docs_result = db.table("documents").select("id", count="exact", head=True).eq("is_deleted", False).execute()
    total_docs = docs_result.count or 0

    # Quarantined pending — count only
    quarantined = db.table("documents").select("id", count="exact", head=True).eq("processing_status", "quarantined").eq("is_deleted", False).execute()
    quarantined_count = quarantined.count or 0

    # Pending manual review requests — count only
    try:
        review_pending = db.table("documents").select("id", count="exact", head=True).eq("review_status", "pending").eq("is_deleted", False).execute()
        pending_reviews = review_pending.count or 0
    except Exception:
        pending_reviews = 0

    # Total knowledge chunks — count only
    try:
        chunks_result = db.table("document_chunks").select("id", count="exact", head=True).execute()
        total_chunks = chunks_result.count or 0
    except Exception:
        total_chunks = 0

    # Total courses — count only
    try:
        courses_result = db.table("courses").select("id", count="exact", head=True).execute()
        total_courses = courses_result.count or 0
    except Exception:
        total_courses = 0

    # Active sessions in last 24 hours — count only
    try:
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        sessions_result = db.table("chat_sessions").select("user_id", count="exact", head=True).gte("created_at", cutoff).execute()
        active_sessions_24h = sessions_result.count or 0
    except Exception:
        active_sessions_24h = 0

    return {
        "total_users": total_users,
        "verified_users": verified,
        "unverified_users": total_users - verified,
        "total_documents": total_docs,
        "quarantined_pending": quarantined_count,
        "pending_reviews": pending_reviews,
        "suspended_users": suspended,
        "total_chunks": total_chunks,
        "total_courses": total_courses,
        "active_sessions_24h": active_sessions_24h,
    }


def suspend_user(admin_id: str, user_id: str, reason: str = None):
    """Suspend a user account."""
    db = get_supabase_admin()

    # Prevent self-suspension
    if admin_id == user_id:
        raise ValueError("Cannot suspend your own account")

    from datetime import datetime, timezone
    db.table("users").update({
        "is_upload_suspended": True,
        "upload_suspended_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user_id).execute()

    log_admin_action(admin_id, "suspend_user", "user", user_id, {"reason": reason})


def unsuspend_user(admin_id: str, user_id: str):
    """Unsuspend a user account."""
    db = get_supabase_admin()
    db.table("users").update({
        "is_upload_suspended": False,
        "upload_suspended_at": None,
    }).eq("id", user_id).execute()
    log_admin_action(admin_id, "unsuspend_user", "user", user_id)


def reset_user_warnings(admin_id: str, user_id: str):
    """Reset a user's warning count to 0."""
    db = get_supabase_admin()
    db.table("users").update({"warning_count": 0}).eq("id", user_id).execute()
    log_admin_action(admin_id, "reset_warnings", "user", user_id)


def verify_user_email(admin_id: str, user_id: str):
    """Manually verify a user's email."""
    db = get_supabase_admin()
    db.table("users").update({"email_verified": True}).eq("id", user_id).execute()
    log_admin_action(admin_id, "verify_email", "user", user_id)


def warn_user(admin_id: str, user_id: str, reason: str = None):
    """Add a warning to user. Auto-suspend at 3 warnings."""
    db = get_supabase_admin()

    # Get current warning count
    user = db.table("users").select("warning_count, is_upload_suspended, upload_suspended_at").eq("id", user_id).single().execute()
    user_data = user.data or {}
    current_warnings = user_data.get("warning_count", 0)
    new_count = current_warnings + 1

    update_data = {"warning_count": new_count}
    if new_count >= 3:
        update_data["is_upload_suspended"] = True
        # Ensure suspension window can be calculated reliably on the client.
        if not user_data.get("is_upload_suspended") or not user_data.get("upload_suspended_at"):
            update_data["upload_suspended_at"] = datetime.now(timezone.utc).isoformat()

    db.table("users").update(update_data).eq("id", user_id).execute()
    log_admin_action(admin_id, "warn_user", "user", user_id, {
        "reason": reason,
        "new_warning_count": new_count,
        "auto_suspended": new_count >= 3,
    })


def approve_document(admin_id: str, doc_id: str):
    """Approve a quarantined document for processing."""
    db = get_supabase_admin()

    doc = db.table("documents").select("user_id, file_name, course_id, cloudinary_public_id, file_type").eq("id", doc_id).single().execute()
    if not doc.data:
        raise ValueError("Document not found")

    db.table("documents").update({
        "copyright_flag": False,
        "processing_status": "pending",
    }).eq("id", doc_id).execute()

    log_admin_action(admin_id, "approve_document", "document", doc_id)

    file_name = doc.data.get("file_name", "your document")
    create_notification(
        doc.data["user_id"],
        "review_approved",
        "Document Approved",
        f'Your document "{file_name}" has been reviewed by an admin and approved. It will be processed shortly.',
        {"doc_id": doc_id},
    )

    # Kick off RAG pipeline in a background thread
    try:
        import threading
        from services.rag_service import process_document_pipeline
        import asyncio

        def _run_pipeline():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    process_document_pipeline(
                        doc_id,
                        doc.data["course_id"],
                        doc.data["user_id"],
                        None,  # file_bytes will be fetched inside pipeline via storage
                        doc.data.get("file_type", "pdf"),
                        file_name,
                    )
                )
            finally:
                loop.close()

        # Fetch file bytes first (needed by pipeline)
        file_bytes = db.storage.from_("mentora-docs").download(doc.data["cloudinary_public_id"])

        def _run_pipeline_with_bytes():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    process_document_pipeline(
                        doc_id,
                        doc.data["course_id"],
                        doc.data["user_id"],
                        file_bytes,
                        doc.data.get("file_type", "pdf"),
                        file_name,
                    )
                )
            finally:
                loop.close()

        threading.Thread(target=_run_pipeline_with_bytes, daemon=True).start()
    except Exception as pipeline_err:
        import logging
        logging.getLogger(__name__).warning(
            "[approve_document] could not start RAG pipeline for doc=%s: %s", doc_id, pipeline_err
        )


def reject_document(admin_id: str, doc_id: str, warn_user_flag: bool = False, suspend_user_flag: bool = False):
    """Reject a quarantined document."""
    db = get_supabase_admin()

    # Get document info
    doc = db.table("documents").select("user_id, file_name").eq("id", doc_id).single().execute()
    if not doc.data:
        raise ValueError("Document not found")

    uploader_id = doc.data["user_id"]

    # Soft-delete the document
    db.table("documents").update({
        "is_deleted": True,
        "processing_status": "rejected",
    }).eq("id", doc_id).execute()

    action_type = "reject_document"
    details = {"file_name": doc.data.get("file_name")}

    if warn_user_flag:
        warn_user(admin_id, uploader_id, f"Document rejected: {doc.data.get('file_name')}")
        action_type = "reject_document_warn"

    if suspend_user_flag:
        suspend_user(admin_id, uploader_id, f"Serious violation: {doc.data.get('file_name')}")
        action_type = "reject_document_suspend"

    log_admin_action(admin_id, action_type, "document", doc_id, details)

    file_name = doc.data.get("file_name", "your document")
    notif_body = f'Your document "{file_name}" was rejected due to a copyright violation and has been removed.'
    if warn_user_flag:
        notif_body += " A warning has been added to your account."
    if suspend_user_flag:
        notif_body += " Your upload access has been suspended."
    create_notification(
        uploader_id,
        "review_rejected",
        "Document Rejected",
        notif_body,
        {"doc_id": doc_id},
    )


def decide_review_request(admin_id: str, doc_id: str, decision: str, note: str = None):
    """Approve or reject a user-submitted review request for a flagged document."""
    db = get_supabase_admin()

    doc = db.table("documents").select("id, user_id, file_name, review_status, processing_status, doc_category, course_id, cloudinary_public_id, file_type").eq("id", doc_id).single().execute()
    if not doc.data:
        raise ValueError("Document not found")

    if doc.data.get("review_status") != "pending":
        raise ValueError("Document does not have a pending review request")

    decision = (decision or "").strip().lower()
    if decision not in {"approve", "reject"}:
        raise ValueError("Invalid review decision")

    now_iso = datetime.now(timezone.utc).isoformat()

    file_name = doc.data.get("file_name", "your document")

    if decision == "approve":
        db.table("documents").update({
            "copyright_flag": False,
            "flag_reason": None,
            "processing_status": "pending",
            "review_requested": False,
            "review_status": "approved",
            "review_decided_at": now_iso,
            "review_decided_by": admin_id,
            "review_note": note or None,
        }).eq("id", doc_id).execute()

        log_admin_action(admin_id, "review_approve", "document", doc_id, {
            "file_name": file_name,
            "note": note,
        })

        create_notification(
            doc.data["user_id"],
            "review_approved",
            "Review Request Approved ",
            f'Great news! Your review request for "{file_name}" was approved. Your document is now being processed.',
            {"doc_id": doc_id},
        )

        # Start RAG pipeline in background thread
        try:
            import threading, asyncio
            from services.rag_service import process_document_pipeline
            _db = get_supabase_admin()
            file_bytes = _db.storage.from_("mentora-docs").download(doc.data["cloudinary_public_id"])

            def _run():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(
                        process_document_pipeline(
                            doc_id,
                            doc.data["course_id"],
                            doc.data["user_id"],
                            file_bytes,
                            doc.data.get("file_type", "pdf"),
                            file_name,
                        )
                    )
                finally:
                    loop.close()

            threading.Thread(target=_run, daemon=True).start()
        except Exception as pipeline_err:
            import logging
            logging.getLogger(__name__).warning(
                "[decide_review] could not start RAG pipeline for doc=%s: %s", doc_id, pipeline_err
            )

        return {"decision": "approved", "penalty_applied": False}

    # Reject path: keep inaccessible + apply penalty warning.
    warn_user(admin_id, doc.data["user_id"], f"Review rejected for document: {file_name}")
    db.table("documents").update({
        "copyright_flag": True,
        "processing_status": "quarantined",
        "review_requested": False,
        "review_status": "rejected",
        "review_decided_at": now_iso,
        "review_decided_by": admin_id,
        "review_note": note or None,
    }).eq("id", doc_id).execute()

    log_admin_action(admin_id, "review_reject_with_penalty", "document", doc_id, {
        "file_name": file_name,
        "note": note,
    })

    create_notification(
        doc.data["user_id"],
        "review_rejected",
        "Review Request Rejected",
        f'Your review request for "{file_name}" was rejected. The document remains flagged and a warning has been added to your account.',
        {"doc_id": doc_id},
    )

    return {"decision": "rejected", "penalty_applied": True}
