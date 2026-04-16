from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime, date, timedelta, timezone
from schemas.study import StudySessionStart, StudyStatsResponse, StreakResponse
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.study_service import calculate_streak, update_daily_streak

router = APIRouter(prefix="/study", tags=["Study Tracking"])

MIN_TRACKED_MINUTES = 1
MAX_TRACKED_MINUTES = 360


def _safe_duration_minutes(started_at_iso: str, ended_at_dt: datetime) -> int:
    started_at = datetime.fromisoformat(started_at_iso.replace("Z", "+00:00"))
    duration = int((ended_at_dt - started_at).total_seconds() / 60)
    duration = max(0, duration)
    return min(duration, MAX_TRACKED_MINUTES)


@router.post("/session/start")
async def start_session(data: StudySessionStart, user: dict = Depends(get_current_user)):
    """Start a new study session."""
    db = get_supabase_admin()

    # Close any stale open sessions first so users don't accumulate overlapping timers.
    open_sessions = db.table("study_sessions") \
        .select("id, started_at") \
        .eq("user_id", user["id"]) \
        .is_("ended_at", "null") \
        .execute()

    user_goal = user.get("study_goal_minutes", 120)
    for row in (open_sessions.data or []):
        ended_at = datetime.now(timezone.utc)
        duration = _safe_duration_minutes(row["started_at"], ended_at)
        db.table("study_sessions").update({
            "ended_at": ended_at.isoformat(),
            "duration_minutes": duration,
        }).eq("id", row["id"]).eq("user_id", user["id"]).execute()
        if duration >= MIN_TRACKED_MINUTES:
            update_daily_streak(user["id"], duration, user_goal)

    result = db.table("study_sessions").insert({
        "user_id": user["id"],
        "course_id": data.course_id,
        "document_id": data.document_id,
        "session_type": data.session_type,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return result.data[0]


@router.put("/session/{session_id}/end")
async def end_session(session_id: str, user: dict = Depends(get_current_user)):
    """End a study session and calculate duration."""
    db = get_supabase_admin()
    session = db.table("study_sessions").select("*").eq("id", session_id).eq("user_id", user["id"]).single().execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.data.get("ended_at"):
        return session.data

    ended_at = datetime.now(timezone.utc)
    duration = _safe_duration_minutes(session.data["started_at"], ended_at)

    result = db.table("study_sessions").update({
        "ended_at": ended_at.isoformat(),
        "duration_minutes": duration,
    }).eq("id", session_id).execute()

    # Update daily streak
    user_goal = user.get("study_goal_minutes", 120)
    if duration >= MIN_TRACKED_MINUTES:
        update_daily_streak(user["id"], duration, user_goal)

    return result.data[0]


@router.get("/stats/today", response_model=StudyStatsResponse)
async def get_today_stats(user: dict = Depends(get_current_user)):
    """Get today's study stats."""
    db = get_supabase_admin()
    today = date.today().isoformat()

    streak = db.table("study_streaks").select("*").eq("user_id", user["id"]).eq("date", today).execute()
    if streak.data:
        record = streak.data[0]
        return StudyStatsResponse(
            total_minutes=record["total_minutes"],
            goal_minutes=user.get("study_goal_minutes", 120),
            goal_achieved=record["goal_achieved"],
        )
    return StudyStatsResponse(goal_minutes=user.get("study_goal_minutes", 120))


@router.get("/stats/weekly")
async def get_weekly_stats(user: dict = Depends(get_current_user)):
    """Get last 7 days of study stats."""
    db = get_supabase_admin()
    week_ago = (date.today() - timedelta(days=7)).isoformat()

    result = db.table("study_streaks").select("*").eq("user_id", user["id"]).gte("date", week_ago).order("date").execute()
    return result.data or []


@router.get("/stats/by-course")
async def get_course_stats(user: dict = Depends(get_current_user)):
    """Get study time by course."""
    db = get_supabase_admin()

    sessions = db.table("study_sessions").select("course_id, duration_minutes").eq("user_id", user["id"]).not_.is_("duration_minutes", "null").execute()

    # Aggregate by course
    course_totals = {}
    for s in (sessions.data or []):
        cid = s.get("course_id")
        if cid:
            course_totals[cid] = course_totals.get(cid, 0) + (s.get("duration_minutes") or 0)

    # Get course info
    results = []
    for cid, total in course_totals.items():
        course = db.table("courses").select("course_name, color").eq("id", cid).single().execute()
        if course.data:
            results.append({
                "course_id": cid,
                "course_name": course.data["course_name"],
                "total_minutes": total,
                "color": course.data.get("color", "#2563EB"),
            })

    return results


@router.get("/streak", response_model=StreakResponse)
async def get_streak(user: dict = Depends(get_current_user)):
    """Get current streak info."""
    return calculate_streak(user["id"])


@router.get("/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    """Get all analytics data for the dashboard."""
    db = get_supabase_admin()
    today = date.today()

    # Today stats
    today_streak = db.table("study_streaks").select("*").eq("user_id", user["id"]).eq("date", today.isoformat()).execute()
    today_minutes = today_streak.data[0]["total_minutes"] if today_streak.data else 0

    # Weekly stats
    week_data = []
    for i in range(7):
        d = today - timedelta(days=6 - i)
        streak = db.table("study_streaks").select("total_minutes, goal_achieved").eq("user_id", user["id"]).eq("date", d.isoformat()).execute()
        week_data.append({
            "date": d.isoformat(),
            "day": d.strftime("%a"),
            "total_minutes": streak.data[0]["total_minutes"] if streak.data else 0,
            "goal_achieved": streak.data[0]["goal_achieved"] if streak.data else False,
        })

    # Streak
    streak_info = calculate_streak(user["id"])

    # Course breakdown
    course_stats = await get_course_stats(user)

    return {
        "today_minutes": today_minutes,
        "goal_minutes": user.get("study_goal_minutes", 120),
        "weekly_data": week_data,
        "streak": streak_info,
        "course_stats": course_stats,
    }
