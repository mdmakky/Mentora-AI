from fastapi import APIRouter, Depends
from core.dependencies import get_current_user
from services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(user: dict = Depends(get_current_user)):
    """Get the authenticated user's notifications (newest first)."""
    return get_user_notifications(user["id"])


@router.put("/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    mark_all_notifications_read(user["id"])
    return {"ok": True}


@router.put("/{notif_id}/read")
async def read_one_notification(notif_id: str, user: dict = Depends(get_current_user)):
    """Mark a single notification as read."""
    mark_notification_read(user["id"], notif_id)
    return {"ok": True}
