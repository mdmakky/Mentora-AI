import logging
from core.database import get_supabase_admin

logger = logging.getLogger(__name__)


def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    data: dict = None,
) -> None:
    """Insert a notification for a user. Never raises — failures are logged only."""
    try:
        db = get_supabase_admin()
        db.table("notifications").insert({
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "body": body,
            "data": data or {},
        }).execute()
    except Exception as exc:
        logger.warning("[notifications] failed to create notification user=%s type=%s: %s", user_id, notif_type, exc)


def get_user_notifications(user_id: str, limit: int = 40) -> list:
    """Return the most recent notifications for a user, newest first."""
    try:
        db = get_supabase_admin()
        result = (
            db.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.warning("[notifications] failed to fetch notifications user=%s: %s", user_id, exc)
        return []


def mark_notification_read(user_id: str, notif_id: str) -> None:
    try:
        db = get_supabase_admin()
        db.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
    except Exception as exc:
        logger.warning("[notifications] failed to mark read notif=%s: %s", notif_id, exc)


def mark_all_notifications_read(user_id: str) -> None:
    try:
        db = get_supabase_admin()
        db.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
    except Exception as exc:
        logger.warning("[notifications] failed to mark all read user=%s: %s", user_id, exc)


def notify_admins(notif_type: str, title: str, body: str, data: dict = None) -> None:
    """Send a notification to every admin user."""
    try:
        db = get_supabase_admin()
        admins = db.table("users").select("id").eq("is_admin", True).execute()
        for admin in (admins.data or []):
            create_notification(admin["id"], notif_type, title, body, data)
    except Exception as exc:
        logger.warning("[notifications] failed to notify admins type=%s: %s", notif_type, exc)
