from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import logging
from core.config import get_settings
from routers import auth, semesters, courses, folders, documents, chat, ai, study, admin, dashboard, notifications

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# Suppress noisy internal HTTP client logs from Supabase calls
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Mentora API",
    description="University Student-Centric AI Learning Platform — RAG-Based Intelligent Study Assistant",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

frontend_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
if settings.FRONTEND_URL:
    frontend_origins.add(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(semesters.router, prefix="/api/v1")
app.include_router(courses.router, prefix="/api/v1")
app.include_router(folders.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(study.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")


@app.on_event("startup")
async def validate_config():
    required = {
        "SUPABASE_URL": settings.SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": settings.SUPABASE_SERVICE_ROLE_KEY,
        "GOOGLE_API_KEY": settings.GOOGLE_API_KEY,
        "JWT_SECRET_KEY": settings.JWT_SECRET_KEY,
    }
    placeholders = {"your-gemini-api-key", "your-super-secret-jwt-key-change-this",
                    "your-service-role-key", "https://your-project.supabase.co"}
    missing = [k for k, v in required.items() if not v or v in placeholders]
    if missing:
        logger.error("[startup] Missing or placeholder config keys: %s", missing)
    else:
        logger.info("[startup] Config validated OK")


@app.get("/")
async def root():
    return {
        "app": "Mentora API",
        "version": "3.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
