from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date, timedelta
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.study_service import calculate_streak

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_user_stats(user: dict = Depends(get_current_user)):
    """Get aggregated dashboard statistics for the current user."""
    db = get_supabase_admin()
    user_id = user["id"]

    # Document count
    docs = db.table("documents").select("id", count="exact").eq("user_id", user_id).eq("is_deleted", False).execute()
    doc_count = docs.count or 0

    # Chat session count
    sessions = db.table("chat_sessions").select("id", count="exact").eq("user_id", user_id).execute()
    session_count = sessions.count or 0

    # Today's study minutes
    today_str = date.today().isoformat()
    today_streak = db.table("study_streaks").select("total_minutes, goal_achieved").eq("user_id", user_id).eq("date", today_str).execute()
    today_minutes = today_streak.data[0]["total_minutes"] if today_streak.data else 0

    # Current streak
    streak_info = calculate_streak(user_id)

    # Course count
    courses = db.table("courses").select("id", count="exact").eq("user_id", user_id).eq("is_archived", False).execute()
    course_count = courses.count or 0

    return {
        "document_count": doc_count,
        "chat_session_count": session_count,
        "course_count": course_count,
        "today_minutes": today_minutes,
        "goal_minutes": user.get("study_goal_minutes", 120),
        "current_streak": streak_info.get("current_streak", 0),
        "longest_streak": streak_info.get("longest_streak", 0),
    }


@router.get("/search")
async def global_search(
    q: str = Query(..., min_length=1, max_length=200),
    user: dict = Depends(get_current_user),
):
    """Search across courses and documents for the current user."""
    db = get_supabase_admin()
    user_id = user["id"]
    search_term = f"%{q}%"

    # Search courses
    courses = db.table("courses").select("id, course_code, course_name, color, semester_id").eq("user_id", user_id).eq("is_archived", False).or_(
        f"course_code.ilike.{search_term},course_name.ilike.{search_term},instructor.ilike.{search_term}"
    ).limit(10).execute()

    # Search documents
    documents = db.table("documents").select("id, file_name, file_type, course_id, processing_status").eq("user_id", user_id).eq("is_deleted", False).ilike("file_name", search_term).limit(10).execute()

    return {
        "courses": courses.data or [],
        "documents": documents.data or [],
    }
