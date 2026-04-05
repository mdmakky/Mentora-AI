import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


PASSWORD_POLICY_MESSAGE = (
    "Password must be 8-64 characters and include at least one uppercase letter, "
    "one lowercase letter, one digit, and one special character."
)


def validate_password_strength(value: str) -> str:
    if len(value) < 8 or len(value) > 64:
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if re.search(r"\s", value):
        raise ValueError("Password must not contain spaces")
    if not re.search(r"[A-Z]", value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if not re.search(r"[a-z]", value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if not re.search(r"\d", value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if not re.search(r"[^A-Za-z0-9]", value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return value


class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=64, description="Strong password (8-64 chars)")
    full_name: str = Field(..., min_length=2, description="Full name")
    university: Optional[str] = None
    department: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


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
    email: str
    token: str
    new_password: str = Field(..., min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class VerifyEmailRequest(BaseModel):
    email: str
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
