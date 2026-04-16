import re
from pydantic import BaseModel, Field, field_validator, model_validator
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


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
OTP_REGEX = re.compile(r"^\d{6}$")


def normalize_email(value: str) -> str:
    email = (value or "").strip().lower()
    if not EMAIL_REGEX.match(email):
        raise ValueError("Enter a valid email address")
    return email


def validate_otp_token(value: str) -> str:
    token = (value or "").strip()
    if not OTP_REGEX.match(token):
        raise ValueError("Token must be a 6-digit code")
    return token


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

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class UserProfile(BaseModel):
    full_name: Optional[str] = None
    university: Optional[str] = None
    department: Optional[str] = None
    current_semester: Optional[int] = None
    study_goal_minutes: Optional[int] = None


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str = Field(..., min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        return validate_otp_token(value)


class VerifyEmailRequest(BaseModel):
    email: str
    token: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        return validate_otp_token(value)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    access_token: Optional[str] = None

    @model_validator(mode="after")
    def validate_auth_payload(self):
        if not self.credential and not self.access_token:
            raise ValueError("Either credential or access_token is required")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="The user's existing password")
    new_password: str = Field(..., min_length=8, max_length=64, description="Strong new password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


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
    upload_suspended_at: Optional[str] = None
    is_admin: bool = False
    email_verified: bool = False
    created_at: Optional[str] = None
