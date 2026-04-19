from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from datetime import datetime, timezone, timedelta
import secrets
import uuid
import logging
import threading
import time
import httpx
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from schemas.auth import (
    UserRegister, UserLogin, UserProfile, ForgotPasswordRequest,
    ResetPasswordRequest, VerifyEmailRequest, TokenResponse, RefreshTokenRequest,
    ChangePasswordRequest, SetPasswordRequest, GoogleAuthRequest, normalize_email,
)
from core.security import create_access_token, create_refresh_token, get_password_hash, verify_password, decode_token
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from core.config import get_settings
from services.cloudinary_service import upload_avatar
from services.email_service import send_auth_email

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()

_rate_lock = threading.Lock()
_attempt_timestamps: dict[str, list[float]] = {}
_last_action_timestamp: dict[str, float] = {}

VERIFY_MAX_ATTEMPTS = 6
VERIFY_WINDOW_SECONDS = 10 * 60
RESEND_MAX_ATTEMPTS = 5
RESEND_WINDOW_SECONDS = 60 * 60
RESEND_COOLDOWN_SECONDS = 60


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    now = time.time()
    cutoff = now - window_seconds
    with _rate_lock:
        attempts = _attempt_timestamps.get(key, [])
        attempts = [ts for ts in attempts if ts > cutoff]
        if len(attempts) >= max_attempts:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        attempts.append(now)
        _attempt_timestamps[key] = attempts


def _enforce_cooldown(key: str, cooldown_seconds: int) -> None:
    now = time.time()
    with _rate_lock:
        last = _last_action_timestamp.get(key)
        if last and now - last < cooldown_seconds:
            raise HTTPException(status_code=429, detail="Please wait before requesting another code.")
        _last_action_timestamp[key] = now


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


async def _fetch_google_userinfo(access_token: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Google sign-in is temporarily unavailable. Please try again.")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Could not reach Google sign-in service. Please try again.")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google access token")

    return response.json()


def _build_token_response(user: dict) -> TokenResponse:
    token_data = {"sub": user["id"], "email": user["email"]}
    access_token = create_access_token(token_data, is_admin=user.get("is_admin", False))
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


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

    return _build_token_response(user)


@router.post("/google-login", response_model=TokenResponse)
async def google_login(data: GoogleAuthRequest):
    """Login or create a user using a Google ID token."""
    if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.startswith("your-"):
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    if data.access_token:
        payload = await _fetch_google_userinfo(data.access_token)
    else:
        try:
            payload = id_token.verify_oauth2_token(
                data.credential or "",
                GoogleRequest(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid Google sign-in token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account email is missing")
    is_verified = payload.get("email_verified")
    if is_verified is None:
        is_verified = payload.get("verified_email")
    if not bool(is_verified):
        raise HTTPException(status_code=400, detail="Google account email is not verified")

    normalized_email = normalize_email(email)
    full_name = payload.get("name")
    avatar_url = payload.get("picture")

    db = get_supabase_admin()
    user_result = db.table("users").select("*").eq("email", normalized_email).execute()
    user = user_result.data[0] if user_result.data else None
    now_iso = datetime.now(timezone.utc).isoformat()

    if user:
        updates = {
            "email_verified": True,
            "last_login_at": now_iso,
        }
        if full_name and not user.get("full_name"):
            updates["full_name"] = full_name
        if avatar_url and not user.get("avatar_url"):
            updates["avatar_url"] = avatar_url

        db.table("users").update(updates).eq("id", user["id"]).execute()
        user.update(updates)
    else:
        user = {
            "id": str(uuid.uuid4()),
            "email": normalized_email,
            "password_hash": None,
            "verification_code": None,
            "verification_code_expires_at": None,
            "reset_code": None,
            "reset_code_expires_at": None,
            "full_name": full_name,
            "university": None,
            "department": None,
            "current_semester": 1,
            "avatar_url": avatar_url,
            "study_goal_minutes": 120,
            "warning_count": 0,
            "is_upload_suspended": False,
            "is_admin": False,
            "email_verified": True,
            "last_login_at": now_iso,
        }

        insert_result = db.table("users").insert(user).execute()
        if insert_result.data:
            user = insert_result.data[0]

    return _build_token_response(user)


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


@router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
):
    """Change the authenticated user's password after verifying the current one."""
    db = get_supabase_admin()

    # Re-fetch the full user row to get the current password hash
    user_result = db.table("users").select("password_hash").eq("id", user["id"]).single().execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    stored_hash = user_result.data.get("password_hash")
    if not stored_hash or not verify_password(data.current_password, stored_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = get_password_hash(data.new_password)
    db.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
    return {"message": "Password changed successfully"}


@router.post("/set-password")
async def set_password(
    data: SetPasswordRequest,
    user: dict = Depends(get_current_user),
):
    """Allow a Google-authenticated user to add a password to their account for the first time."""
    db = get_supabase_admin()

    user_result = db.table("users").select("password_hash").eq("id", user["id"]).single().execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    if user_result.data.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account already has a password. Use change-password instead.")

    new_hash = get_password_hash(data.new_password)
    db.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
    return {"message": "Password set successfully"}


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
async def verify_email(data: VerifyEmailRequest, request: Request):
    """Verify signup email using OTP code sent to email."""
    ip = _client_ip(request)
    _enforce_rate_limit(f"verify:{ip}:{data.email}", VERIFY_MAX_ATTEMPTS, VERIFY_WINDOW_SECONDS)

    admin_db = get_supabase_admin()
    try:
        user_result = admin_db.table("users").select("id, verification_code, verification_code_expires_at, email_verified").eq("email", data.email).single().execute()
        user = user_result.data

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        if user.get("email_verified"):
            return {"message": "Email verified successfully"}

        stored_code = str(user.get("verification_code") or "")
        is_token_valid = bool(stored_code) and secrets.compare_digest(stored_code, data.token)
        if not is_token_valid or _is_expired(user.get("verification_code_expires_at")):
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
        logging.error("Verification failure for %s: %s", data.email, str(e))
        raise HTTPException(status_code=400, detail="Verification failed")


@router.post("/resend-verification")
async def resend_verification(data: ForgotPasswordRequest, request: Request):
    """Resend verification email."""
    ip = _client_ip(request)
    _enforce_rate_limit(f"resend:{ip}:{data.email}", RESEND_MAX_ATTEMPTS, RESEND_WINDOW_SECONDS)
    _enforce_cooldown(f"resend-cooldown:{ip}:{data.email}", RESEND_COOLDOWN_SECONDS)

    db = get_supabase_admin()
    try:
        user_result = db.table("users").select("id, email_verified").eq("email", data.email).single().execute()
        user = user_result.data
        if not user:
            return {"message": "If the account is eligible, a verification code has been sent."}

        if user.get("email_verified"):
            return {"message": "If the account is eligible, a verification code has been sent."}

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

        return {"message": "If the account is eligible, a verification code has been sent."}
    except Exception as e:
        logging.error("Resend verification failure for %s: %s", data.email, str(e))
        raise HTTPException(status_code=503, detail="Unable to process request right now")
