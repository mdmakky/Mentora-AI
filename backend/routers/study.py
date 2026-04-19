from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime, date, timedelta, timezone
from schemas.study import StudySessionStart, StudyStatsResponse, StreakResponse
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.study_service import (
    DEFAULT_MAX_SESSION_MINUTES,
    calculate_streak,
    reconcile_recent_streaks,
    update_daily_streak_for_date,
)

router = APIRouter(prefix="/study", tags=["Study Tracking"])

MIN_TRACKED_MINUTES = 1
MAX_TRACKED_MINUTES = DEFAULT_MAX_SESSION_MINUTES


def _split_duration_by_date(started_at_iso: str, ended_at_dt: datetime) -> List[tuple]:
    """Split a session's credited minutes across UTC calendar days."""
    started_at = datetime.fromisoformat(started_at_iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    raw_ended_at = ended_at_dt.astimezone(timezone.utc)
    capped_ended_at = min(raw_ended_at, started_at + timedelta(minutes=MAX_TRACKED_MINUTES))

    if capped_ended_at <= started_at:
        return []

    total_minutes = int((capped_ended_at - started_at).total_seconds() // 60)
    if total_minutes < MIN_TRACKED_MINUTES:
        return []

    allocations = []
    allocated = 0
    cursor = started_at

    while cursor.date() < capped_ended_at.date():
        next_midnight = datetime.combine(cursor.date() + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        segment_minutes = int((next_midnight - cursor).total_seconds() // 60)
        if segment_minutes > 0:
            allocations.append((cursor.date(), segment_minutes))
            allocated += segment_minutes
        cursor = next_midnight

    remaining = total_minutes - allocated
    if remaining >= MIN_TRACKED_MINUTES:
        allocations.append((cursor.date(), remaining))

    return allocations


def _apply_session_minutes(user_id: str, started_at_iso: str, ended_at_dt: datetime, goal_minutes: int) -> int:
    """Persist session duration and add its minutes into per-day streak buckets."""
    allocations = _split_duration_by_date(started_at_iso, ended_at_dt)
    total = 0
    for target_date, minutes in allocations:
        if minutes < MIN_TRACKED_MINUTES:
            continue
        update_daily_streak_for_date(user_id, target_date, minutes, goal_minutes)
        total += minutes
    return total


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
        duration = _apply_session_minutes(user["id"], row["started_at"], ended_at, user_goal)
        db.table("study_sessions").update({
            "ended_at": ended_at.isoformat(),
            "duration_minutes": duration,
        }).eq("id", row["id"]).eq("user_id", user["id"]).execute()

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
    duration = _apply_session_minutes(user["id"], session.data["started_at"], ended_at, user.get("study_goal_minutes", 120))

    result = db.table("study_sessions").update({
        "ended_at": ended_at.isoformat(),
        "duration_minutes": duration,
    }).eq("id", session_id).execute()

    return result.data[0]


@router.get("/stats/today", response_model=StudyStatsResponse)
async def get_today_stats(user: dict = Depends(get_current_user)):
    """Get today's study stats."""
    db = get_supabase_admin()
    reconcile_recent_streaks(user["id"], user.get("study_goal_minutes", 120))
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
    reconcile_recent_streaks(user["id"], user.get("study_goal_minutes", 120))
    today = date.today()
    week_start = (today - timedelta(days=6)).isoformat()

    result = db.table("study_streaks").select("*").eq("user_id", user["id"]).gte("date", week_start).lte("date", today.isoformat()).order("date").execute()
    return result.data or []


@router.get("/stats/by-course")
async def get_course_stats(user: dict = Depends(get_current_user)):
    """Get study time by course from session timestamps (capped per session)."""
    db = get_supabase_admin()

    sessions = db.table("study_sessions") \
        .select("course_id, started_at, ended_at") \
        .eq("user_id", user["id"]) \
        .not_.is_("ended_at", "null") \
        .not_.is_("started_at", "null") \
        .execute()

    # Aggregate by course using the same midnight-split / cap logic
    course_totals: dict = {}
    for s in (sessions.data or []):
        cid = s.get("course_id")
        if not cid:
            continue
        try:
            allocations = _split_duration_by_date(s["started_at"], datetime.fromisoformat(s["ended_at"].replace("Z", "+00:00")))
        except Exception:
            continue
        for _date, minutes in allocations:
            if minutes >= MIN_TRACKED_MINUTES:
                course_totals[cid] = course_totals.get(cid, 0) + minutes

    if not course_totals:
        return []

    # Batch fetch all course info in one query
    course_ids = list(course_totals.keys())
    courses_result = db.table("courses").select("id, course_name, color").in_("id", course_ids).execute()
    course_map = {c["id"]: c for c in (courses_result.data or [])}

    results = []
    for cid, total in course_totals.items():
        course = course_map.get(cid)
        if course:
            results.append({
                "course_id": cid,
                "course_name": course["course_name"],
                "total_minutes": total,
                "color": course.get("color") or "#2563EB",
            })

    return results


@router.get("/streak", response_model=StreakResponse)
async def get_streak(user: dict = Depends(get_current_user)):
    """Get current streak info."""
    return calculate_streak(user["id"])


@router.get("/stats/session-types")
async def get_session_type_stats(user: dict = Depends(get_current_user)):
    """Get total study minutes broken down by session type (chat, document, quiz)."""
    db = get_supabase_admin()
    sessions = (
        db.table("study_sessions")
        .select("session_type, duration_minutes")
        .eq("user_id", user["id"])
        .not_.is_("ended_at", "null")
        .execute()
    )
    type_map: dict = {}
    for s in sessions.data or []:
        t = s.get("session_type") or "document"
        type_map[t] = type_map.get(t, 0) + (s.get("duration_minutes") or 0)

    label_map = {"chat": "Study Coach", "document": "Reading", "quiz": "Practice"}
    return [
        {"session_type": k, "label": label_map.get(k, k.title()), "total_minutes": v}
        for k, v in type_map.items()
        if v > 0
    ]


@router.get("/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    """Get all analytics data for the dashboard."""
    db = get_supabase_admin()
    reconcile_recent_streaks(user["id"], user.get("study_goal_minutes", 120))
    today = date.today()

    # Today stats
    today_streak = db.table("study_streaks").select("*").eq("user_id", user["id"]).eq("date", today.isoformat()).execute()
    today_minutes = today_streak.data[0]["total_minutes"] if today_streak.data else 0

    # Weekly stats — one batched query instead of 7
    week_start = today - timedelta(days=6)
    streaks_result = db.table("study_streaks") \
        .select("date, total_minutes, goal_achieved") \
        .eq("user_id", user["id"]) \
        .gte("date", week_start.isoformat()) \
        .lte("date", today.isoformat()) \
        .execute()
    streaks_map = {row["date"]: row for row in (streaks_result.data or [])}

    week_data = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        row = streaks_map.get(d.isoformat())
        week_data.append({
            "date": d.isoformat(),
            "day": d.strftime("%a"),
            "total_minutes": row["total_minutes"] if row else 0,
            "goal_achieved": row["goal_achieved"] if row else False,
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
