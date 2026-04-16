from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.security import decode_token
from core.database import get_supabase_admin

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Extract and validate current user from JWT token."""
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )

    # Fetch user from database
    db = get_supabase_admin()
    result = db.table("users").select("*").eq("id", user_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user = result.data

    # Self-heal legacy suspended users missing a suspension timestamp.
    if user.get("is_upload_suspended") and not user.get("upload_suspended_at"):
        try:
            from datetime import datetime, timezone

            now_iso = datetime.now(timezone.utc).isoformat()
            get_supabase_admin().table("users").update({"upload_suspended_at": now_iso}).eq("id", user_id).execute()
            user["upload_suspended_at"] = now_iso
        except Exception:
            # If persistence fails, keep serving the user data without blocking auth.
            pass

    return user


async def check_upload_allowed(
    user: dict = Depends(get_current_user),
) -> dict:
    """Ensure the current user is not upload-suspended. Auto-lifts after 7 days."""
    if user.get("is_upload_suspended"):
        suspended_at = user.get("upload_suspended_at")
        if suspended_at:
            from datetime import datetime, timezone, timedelta
            try:
                suspended_dt = datetime.fromisoformat(suspended_at.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - suspended_dt > timedelta(days=7):
                    # Auto-lift: 7 days have passed
                    db = get_supabase_admin()
                    db.table("users").update({
                        "is_upload_suspended": False,
                        "upload_suspended_at": None,
                    }).eq("id", user["id"]).execute()
                    return user
            except (ValueError, TypeError):
                pass
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your upload access has been suspended. Contact admin for assistance.",
        )
    return user


async def get_current_admin(
    user: dict = Depends(get_current_user),
) -> dict:
    """Ensure the current user is an admin."""
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
