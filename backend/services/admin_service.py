from datetime import datetime, timezone
from core.database import get_supabase_admin


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

    # Total users
    users_result = db.table("users").select("id, email_verified, is_upload_suspended", count="exact").execute()
    total_users = users_result.count or 0
    verified = sum(1 for u in (users_result.data or []) if u.get("email_verified"))
    suspended = sum(1 for u in (users_result.data or []) if u.get("is_upload_suspended"))

    # Total documents
    docs_result = db.table("documents").select("id, processing_status, copyright_flag", count="exact").eq("is_deleted", False).execute()
    total_docs = docs_result.count or 0

    # Quarantined pending
    quarantined = db.table("documents").select("id", count="exact").eq("processing_status", "quarantined").eq("is_deleted", False).execute()
    quarantined_count = quarantined.count or 0

    return {
        "total_users": total_users,
        "verified_users": verified,
        "unverified_users": total_users - verified,
        "total_documents": total_docs,
        "quarantined_pending": quarantined_count,
        "suspended_users": suspended,
    }


def suspend_user(admin_id: str, user_id: str, reason: str = None):
    """Suspend a user account."""
    db = get_supabase_admin()

    # Prevent self-suspension
    if admin_id == user_id:
        raise ValueError("Cannot suspend your own account")

    db.table("users").update({"is_upload_suspended": True}).eq("id", user_id).execute()

    log_admin_action(admin_id, "suspend_user", "user", user_id, {"reason": reason})


def unsuspend_user(admin_id: str, user_id: str):
    """Unsuspend a user account."""
    db = get_supabase_admin()
    db.table("users").update({"is_upload_suspended": False}).eq("id", user_id).execute()
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
    user = db.table("users").select("warning_count").eq("id", user_id).single().execute()
    current_warnings = (user.data or {}).get("warning_count", 0)
    new_count = current_warnings + 1

    update_data = {"warning_count": new_count}
    if new_count >= 3:
        update_data["is_upload_suspended"] = True

    db.table("users").update(update_data).eq("id", user_id).execute()
    log_admin_action(admin_id, "warn_user", "user", user_id, {
        "reason": reason,
        "new_warning_count": new_count,
        "auto_suspended": new_count >= 3,
    })


def approve_document(admin_id: str, doc_id: str):
    """Approve a quarantined document for processing."""
    db = get_supabase_admin()
    db.table("documents").update({
        "copyright_flag": False,
        "processing_status": "pending",
    }).eq("id", doc_id).execute()
    log_admin_action(admin_id, "approve_document", "document", doc_id)


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
