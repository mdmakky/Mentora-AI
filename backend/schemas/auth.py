from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    full_name: str = Field(..., min_length=2, description="Full name")
    university: Optional[str] = None
    department: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserProfile(BaseModel):
    full_name: Optional[str] = None
    university: Optional[str] = None
    department: Optional[str] = None
    current_semester: Optional[int] = None
    study_goal_minutes: Optional[int] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class VerifyEmailRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    university: Optional[str] = None
    department: Optional[str] = None
    current_semester: Optional[int] = None
    avatar_url: Optional[str] = None
    study_goal_minutes: int = 120
    warning_count: int = 0
    is_upload_suspended: bool = False
    is_admin: bool = False
    email_verified: bool = False
    created_at: Optional[str] = None
