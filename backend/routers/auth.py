from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from datetime import datetime, timezone
from schemas.auth import (
    UserRegister, UserLogin, UserProfile, ForgotPasswordRequest,
    ResetPasswordRequest, VerifyEmailRequest, TokenResponse, RefreshTokenRequest,
)
from core.security import create_access_token, create_refresh_token, get_password_hash, verify_password, decode_token
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.cloudinary_service import upload_avatar

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister):
    """Register a new user."""
    db = get_supabase_admin()

    # Check if email exists
    existing = db.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Register with Supabase Auth
    try:
        auth_result = db.auth.sign_up({
            "email": data.email,
            "password": data.password,
        })
        user_id = auth_result.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

    # Create user profile
    db.table("users").insert({
        "id": user_id,
        "email": data.email,
        "full_name": data.full_name,
        "university": data.university,
        "department": data.department,
        "email_verified": False,
    }).execute()

    return {
        "message": "Registration successful. Please check your email to verify your account.",
        "user_id": user_id,
    }


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

    # Authenticate with Supabase
    try:
        auth_result = db.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password,
        })
    except Exception:
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
    """Send password reset email."""
    db = get_supabase_admin()
    try:
        db.auth.reset_password_email(data.email)
    except Exception:
        pass  # Don't reveal if email exists
    return {"message": "If the email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password with token."""
    db = get_supabase_admin()
    try:
        db.auth.update_user({"password": data.new_password})
        return {"message": "Password changed successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password reset failed: {str(e)}")


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest):
    """Verify email with token."""
    db = get_supabase_admin()
    try:
        # Verify with Supabase Auth
        result = db.auth.verify_otp({"token_hash": data.token, "type": "email"})
        if result and result.user:
            db.table("users").update({"email_verified": True}).eq("id", result.user.id).execute()
            return {"message": "Email verified successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification failed: {str(e)}")


@router.post("/resend-verification")
async def resend_verification(data: ForgotPasswordRequest):
    """Resend verification email."""
    db = get_supabase_admin()
    try:
        db.auth.resend({"type": "signup", "email": data.email})
        return {"message": "Verification email sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to resend: {str(e)}")
