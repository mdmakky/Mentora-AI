from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from core.database import get_supabase_admin
from pydantic import BaseModel, Field
from services.notification_service import notify_admins

router = APIRouter(prefix="/appeals", tags=["Appeals"])


class AppealRequest(BaseModel):
    message: str = Field(..., min_length=10, max_length=1000)


@router.post("/suspension")
async def submit_suspension_appeal(
    body: AppealRequest,
    user: dict = Depends(get_current_user),
):
    """Submit an appeal to lift upload suspension."""
    if not user.get("is_upload_suspended"):
        raise HTTPException(status_code=400, detail="Your account is not currently suspended")

    db = get_supabase_admin()

    # Only one pending appeal allowed at a time
    existing = (
        db.table("suspension_appeals")
        .select("id")
        .eq("user_id", user["id"])
        .eq("status", "pending")
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="You already have a pending appeal")

    db.table("suspension_appeals").insert({
        "user_id": user["id"],
        "message": body.message.strip(),
    }).execute()

    # Notify all admins about the new appeal
    name = user.get("full_name") or user.get("email", "A user")
    notify_admins(
        "review_submitted",
        "New Suspension Appeal",
        f"{name} has submitted a suspension appeal. Review it in User Management -> Suspension Appeals.",
        {
            "user_id": user["id"],
            "kind": "suspension_appeal",
        },
    )

    return {"message": "Appeal submitted successfully"}


@router.get("/suspension/my")
async def get_my_appeal(user: dict = Depends(get_current_user)):
    """Get the most recent suspension appeal for the current user."""
    db = get_supabase_admin()
    result = (
        db.table("suspension_appeals")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None
