from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "your-service-role-key"
    SUPABASE_DB_URL: str = "postgresql://postgres:password@localhost:5432/postgres"

    # JWT
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-this"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = "your-cloud-name"
    CLOUDINARY_API_KEY: str = "your-api-key"
    CLOUDINARY_API_SECRET: str = "your-api-secret"

    # Google AI
    GOOGLE_API_KEY: str = "your-gemini-api-key"
    GOOGLE_CLIENT_ID: str = "your-google-client-id.apps.googleusercontent.com"
    GEMINI_CHAT_MODELS: str = "gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash"
    GEMINI_TASK_MODELS: str = "gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash"
    GEMINI_MAX_RETRIES_PER_MODEL: int = 2
    GEMINI_RETRY_BASE_SECONDS: float = 2.0

    # App
    APP_NAME: str = "Mentora"
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # Brevo (transactional email via HTTP API — works on DigitalOcean)
    BREVO_API_KEY: str = ""
    SMTP_FROM_EMAIL: str = ""  # Must be a verified sender in Brevo

    # Debug (development only)
    DEBUG_OTP_IN_RESPONSE: bool = False

    class Config:
        env_file = BACKEND_ROOT / ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
