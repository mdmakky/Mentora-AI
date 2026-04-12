from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from datetime import datetime, timezone, timedelta
import secrets
import uuid
import logging
from schemas.auth import (
    UserRegister, UserLogin, UserProfile, ForgotPasswordRequest,
    ResetPasswordRequest, VerifyEmailRequest, TokenResponse, RefreshTokenRequest,
)
from core.security import create_access_token, create_refresh_token, get_password_hash, verify_password, decode_token
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from core.config import get_settings
from services.cloudinary_service import upload_avatar
from services.email_service import send_auth_email

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _generate_otp() -> str:
    """Generate a 6-digit OTP code."""
    return f"{secrets.randbelow(900000) + 100000}"


def _otp_expiry(minutes: int = 10) -> str:
    """Generate OTP expiry timestamp in ISO format."""
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


def _is_expired(expiry_iso: str) -> bool:
    """Check if an ISO timestamp is already expired."""
    if not expiry_iso:
        return True
    return datetime.now(timezone.utc) > datetime.fromisoformat(expiry_iso.replace("Z", "+00:00"))


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister):
    """Register a new user."""
    db = get_supabase_admin()

    # Check if email exists
    existing = db.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    verification_code = _generate_otp()
    verification_expiry = _otp_expiry(10)

    # Create user profile
    try:
        db.table("users").insert({
            "id": user_id,
            "email": data.email,
            "full_name": data.full_name,
            "university": data.university,
            "department": data.department,
            "password_hash": get_password_hash(data.password),
            "email_verified": False,
            "verification_code": verification_code,
            "verification_code_expires_at": verification_expiry,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

    # Send OTP email (non-blocking for account creation)
    try:
        send_auth_email(
            to_email=data.email,
            subject="Mentora - Verify your email",
            title="Verify Your Email",
            intro="Use the following verification code to activate your Mentora account:",
            code=verification_code,
            note="This code expires in 10 minutes.",
        )
    except Exception as e:
        logging.error("Registration email send failed for %s: %s", data.email, str(e))
        try:
            # Roll back the unverified account so user can re-register cleanly.
            db.table("users").delete().eq("id", user_id).execute()
        except Exception as rollback_error:
            logging.error("Failed to rollback user %s after email send failure: %s", user_id, str(rollback_error))
        raise HTTPException(
            status_code=503,
            detail="Could not send verification email right now. Please try registering again in a minute.",
        )

    response = {
        "message": "Registration successful. Please check your email to verify your account.",
        "user_id": user_id,
    }
    return response


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Login with email and password."""
    db = get_supabase_admin()

    # Check user exists
    user_result = db.table("users").select("*").eq("email", data.email).single().execute()
    if not user_result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = user_result.data

    # Check email verified
    if not user.get("email_verified"):
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in. Check your inbox for verification link.",
        )

    stored_hash = user.get("password_hash")
    if not stored_hash or not verify_password(data.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last login
    db.table("users").update({
        "last_login_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user["id"]).execute()

    # Create tokens
    token_data = {"sub": user["id"], "email": user["email"]}
    access_token = create_access_token(token_data, is_admin=user.get("is_admin", False))
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Logout current user."""
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest):
    """Refresh access token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db = get_supabase_admin()
    user_result = db.table("users").select("*").eq("id", payload["sub"]).single().execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_result.data
    token_data = {"sub": user["id"], "email": user["email"]}
    access_token = create_access_token(token_data, is_admin=user.get("is_admin", False))
    new_refresh = create_refresh_token(token_data)

    return TokenResponse(access_token=access_token, refresh_token=new_refresh, user=user)


@router.get("/me")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user profile."""
    return user


@router.put("/profile")
async def update_profile(data: UserProfile, user: dict = Depends(get_current_user)):
    """Update user profile."""
    db = get_supabase_admin()
    update_data = data.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("users").update(update_data).eq("id", user["id"]).execute()
    return result.data[0] if result.data else user


@router.post("/avatar")
async def upload_user_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload user avatar to Cloudinary."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    file_bytes = await file.read()
    avatar_url = upload_avatar(file_bytes, user["id"])

    db = get_supabase_admin()
    db.table("users").update({"avatar_url": avatar_url}).eq("id", user["id"]).execute()

    return {"avatar_url": avatar_url}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Generate and send password reset code."""
    db = get_supabase_admin()
    user_result = db.table("users").select("id, email").eq("email", data.email).single().execute()

    if user_result.data:
        reset_code = _generate_otp()
        reset_expiry = _otp_expiry(10)

        db.table("users").update({
            "reset_code": reset_code,
            "reset_code_expires_at": reset_expiry,
        }).eq("id", user_result.data["id"]).execute()

        try:
            send_auth_email(
                to_email=data.email,
                subject="Mentora - Reset password",
                title="Reset Your Password",
                intro="Use the following code to reset your password:",
                code=reset_code,
                note="This code expires in 10 minutes.",
            )
        except Exception as e:
            import logging
            logging.error(f"Failed to send password reset email: {e}")
            raise HTTPException(status_code=500, detail="Failed to send reset email. Please try again later.")

    return {"message": "If the email is registered, a password reset code has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using recovery OTP code sent to email."""
    admin_db = get_supabase_admin()
    try:
        user_result = admin_db.table("users").select("id, reset_code, reset_code_expires_at").eq("email", data.email).single().execute()
        user = user_result.data

        if not user or user.get("reset_code") != data.token or _is_expired(user.get("reset_code_expires_at")):
            raise HTTPException(status_code=400, detail="Invalid or expired reset code")

        admin_db.table("users").update({
            "password_hash": get_password_hash(data.new_password),
            "reset_code": None,
            "reset_code_expires_at": None,
        }).eq("id", user["id"]).execute()
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password reset failed: {str(e)}")


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest):
    """Verify signup email using OTP code sent to email."""
    admin_db = get_supabase_admin()
    try:
        user_result = admin_db.table("users").select("id, verification_code, verification_code_expires_at, email_verified").eq("email", data.email).single().execute()
        user = user_result.data

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.get("email_verified"):
            return {"message": "Email is already verified"}

        if user.get("verification_code") != data.token or _is_expired(user.get("verification_code_expires_at")):
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        admin_db.table("users").update({
            "email_verified": True,
            "verification_code": None,
            "verification_code_expires_at": None,
        }).eq("id", user["id"]).execute()
        return {"message": "Email verified successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification failed: {str(e)}")


@router.post("/resend-verification")
async def resend_verification(data: ForgotPasswordRequest):
    """Resend verification email."""
    db = get_supabase_admin()
    try:
        user_result = db.table("users").select("id, email_verified").eq("email", data.email).single().execute()
        user = user_result.data
        if not user:
            return {"message": "If the email is registered, a verification code has been sent."}

        if user.get("email_verified"):
            return {"message": "Email is already verified"}

        verification_code = _generate_otp()
        verification_expiry = _otp_expiry(10)

        db.table("users").update({
            "verification_code": verification_code,
            "verification_code_expires_at": verification_expiry,
        }).eq("id", user["id"]).execute()

        send_auth_email(
            to_email=data.email,
            subject="Mentora - Verification code",
            title="Verify Your Email",
            intro="Use the following verification code:",
            code=verification_code,
            note="This code expires in 10 minutes.",
        )

        return {"message": "Verification email sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to resend: {str(e)}")
