from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from routers import auth, semesters, courses, folders, documents, chat, ai, study, admin, dashboard

settings = get_settings()

app = FastAPI(
    title="Mentora API",
    description="University Student-Centric AI Learning Platform — RAG-Based Intelligent Study Assistant",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

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
