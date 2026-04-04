from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from core.database import get_supabase_admin
from core.dependencies import get_current_admin
from services.admin_service import (
    get_system_stats, suspend_user, unsuspend_user, reset_user_warnings,
    verify_user_email, approve_document, reject_document, log_admin_action,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    """Get system-wide statistics."""
    stats = get_system_stats()

    # Daily registrations (last 30 days)
    db = get_supabase_admin()
    from datetime import date, timedelta
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    users = db.table("users").select("created_at").gte("created_at", thirty_days_ago).execute()

    daily_counts = {}
    for u in (users.data or []):
        d = u["created_at"][:10]
        daily_counts[d] = daily_counts.get(d, 0) + 1

    stats["daily_registrations"] = [
        {"date": k, "count": v} for k, v in sorted(daily_counts.items())
    ]

    return stats


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    filter: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
):
    """List all users with pagination and filtering."""
    db = get_supabase_admin()
    query = db.table("users").select("*", count="exact")

    if search:
        query = query.or_(f"email.ilike.%{search}%,full_name.ilike.%{search}%")

    if filter == "suspended":
        query = query.eq("is_upload_suspended", True)
    elif filter == "high_warning":
        query = query.gte("warning_count", 2)
    elif filter == "unverified":
        query = query.eq("email_verified", False)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "users": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(get_current_admin)):
    """Get detailed user info."""
    db = get_supabase_admin()
    user = db.table("users").select("*").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's document count
    docs = db.table("documents").select("id", count="exact").eq("user_id", user_id).eq("is_deleted", False).execute()

    return {
        **user.data,
        "document_count": docs.count or 0,
    }


@router.put("/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, reason: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """Suspend a user."""
    try:
        suspend_user(admin["id"], user_id, reason)
        return {"message": "User suspended"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}/unsuspend")
async def admin_unsuspend_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Unsuspend a user."""
    unsuspend_user(admin["id"], user_id)
    return {"message": "User unsuspended"}


@router.put("/users/{user_id}/reset-warnings")
async def admin_reset_warnings(user_id: str, admin: dict = Depends(get_current_admin)):
    """Reset user warning count."""
    reset_user_warnings(admin["id"], user_id)
    return {"message": "Warnings reset"}


@router.put("/users/{user_id}/verify-email")
async def admin_verify_email(user_id: str, admin: dict = Depends(get_current_admin)):
    """Manually verify user email."""
    verify_user_email(admin["id"], user_id)
    return {"message": "Email verified"}


@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Permanently delete a user and all their data."""
    if admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db = get_supabase_admin()
    log_admin_action(admin["id"], "delete_user", "user", user_id)
    db.table("users").delete().eq("id", user_id).execute()
    return {"message": "User deleted"}


@router.get("/documents/quarantined")
async def list_quarantined(admin: dict = Depends(get_current_admin)):
    """List quarantined documents."""
    db = get_supabase_admin()
    result = (
        db.table("documents")
        .select("*, users(email, full_name)")
        .eq("processing_status", "quarantined")
        .eq("is_deleted", False)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/documents")
async def list_all_documents(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
):
    """List all documents with optional filtering."""
    db = get_supabase_admin()
    query = db.table("documents").select("*, users(email, full_name)", count="exact").eq("is_deleted", False)

    if status:
        query = query.eq("processing_status", status)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "documents": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.put("/documents/{doc_id}/approve")
async def admin_approve_document(doc_id: str, admin: dict = Depends(get_current_admin)):
    """Approve a quarantined document."""
    approve_document(admin["id"], doc_id)
    return {"message": "Document approved for processing"}


@router.put("/documents/{doc_id}/reject")
async def admin_reject_document(
    doc_id: str,
    warn_user: bool = False,
    suspend_user_flag: bool = False,
    admin: dict = Depends(get_current_admin),
):
    """Reject a quarantined document."""
    try:
        reject_document(admin["id"], doc_id, warn_user, suspend_user_flag)
        return {"message": "Document rejected"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/documents/{doc_id}/force-delete")
async def admin_force_delete(doc_id: str, admin: dict = Depends(get_current_admin)):
    """Force delete a document from DB and Cloudinary."""
    db = get_supabase_admin()
    doc = db.table("documents").select("cloudinary_public_id").eq("id", doc_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    from services.cloudinary_service import delete_file
    delete_file(doc.data["cloudinary_public_id"])

    db.table("document_chunks").delete().eq("document_id", doc_id).execute()
    db.table("documents").delete().eq("id", doc_id).execute()

    log_admin_action(admin["id"], "force_delete_document", "document", doc_id)
    return {"message": "Document permanently deleted"}


@router.get("/logs")
async def get_admin_logs(
    action_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
):
    """Get admin activity logs."""
    db = get_supabase_admin()
    query = db.table("admin_activity_logs").select("*, users!admin_activity_logs_admin_id_fkey(email)", count="exact")

    if action_type:
        query = query.eq("action_type", action_type)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "logs": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/logs/{admin_id}")
async def get_admin_user_logs(admin_id: str, admin: dict = Depends(get_current_admin)):
    """Get logs for a specific admin."""
    db = get_supabase_admin()
    result = db.table("admin_activity_logs").select("*").eq("admin_id", admin_id).order("created_at", desc=True).limit(100).execute()
    return result.data or []
