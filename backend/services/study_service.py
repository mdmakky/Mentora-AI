from datetime import datetime, date, time, timedelta, timezone
from core.database import get_supabase_admin

# In-memory cooldown: user_id -> datetime of last reconcile.
# Prevents hammering the DB when multiple endpoints fire in the same page load.
_RECONCILE_COOLDOWN_SECONDS = 60
_last_reconcile: dict = {}

DEFAULT_MAX_SESSION_MINUTES = 180


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _effective_end_time(started_at: datetime, ended_at: datetime, max_session_minutes: int) -> datetime:
    capped_end = started_at + timedelta(minutes=max_session_minutes)
    return min(ended_at, capped_end)


def _split_minutes_by_date(started_at: datetime, ended_at: datetime) -> dict:
    if ended_at <= started_at:
        return {}

    total_minutes = int((ended_at - started_at).total_seconds() // 60)
    if total_minutes <= 0:
        return {}

    by_date = {}
    allocated = 0
    cursor = started_at

    while cursor.date() < ended_at.date():
        next_midnight = datetime.combine(cursor.date() + timedelta(days=1), time.min, tzinfo=timezone.utc)
        segment_minutes = int((next_midnight - cursor).total_seconds() // 60)
        if segment_minutes > 0:
            by_date[cursor.date().isoformat()] = by_date.get(cursor.date().isoformat(), 0) + segment_minutes
            allocated += segment_minutes
        cursor = next_midnight

    remaining = total_minutes - allocated
    if remaining > 0:
        by_date[cursor.date().isoformat()] = by_date.get(cursor.date().isoformat(), 0) + remaining

    return by_date


def calculate_streak(user_id: str) -> dict:
    """Calculate current and longest study streak for a user."""
    db = get_supabase_admin()

    result = db.table("study_streaks").select("*").eq("user_id", user_id).order("date", desc=True).execute()
    records = result.data or []

    if not records:
        return {"current_streak": 0, "longest_streak": 0, "history": []}

    records_by_date = {record["date"]: record for record in records}

    # Calculate current streak. If today's goal isn't completed yet, keep the streak
    # anchored to yesterday so users don't lose streak visibility early in the day.
    today = date.today()
    today_record = records_by_date.get(today.isoformat())
    anchor_date = today if (today_record and today_record.get("goal_achieved")) else (today - timedelta(days=1))

    current_streak = 0
    while True:
        expected = (anchor_date - timedelta(days=current_streak)).isoformat()
        record = records_by_date.get(expected)
        if record and record.get("goal_achieved"):
            current_streak += 1
            continue
        break

    # Calculate longest streak
    longest = 0
    current = 0
    sorted_records = sorted(records, key=lambda x: x["date"])

    for i, record in enumerate(sorted_records):
        if record.get("goal_achieved"):
            current += 1
            if i > 0:
                prev_date = date.fromisoformat(sorted_records[i - 1]["date"])
                curr_date = date.fromisoformat(record["date"])
                if (curr_date - prev_date).days != 1:
                    current = 1
        else:
            current = 0
        longest = max(longest, current)

    return {
        "current_streak": current_streak,
        "longest_streak": longest,
        "history": records[:90],  # last 90 days
    }


def update_daily_streak_for_date(user_id: str, target_date: date, minutes: int, goal_minutes: int):
    """Add minutes to the streak bucket for a specific day."""
    db = get_supabase_admin()
    if minutes <= 0:
        return

    target_date_str = target_date.isoformat()
    existing = db.table("study_streaks").select("*").eq("user_id", user_id).eq("date", target_date_str).execute()

    if existing.data:
        record = existing.data[0]
        new_total = (record.get("total_minutes") or 0) + minutes
        db.table("study_streaks").update({
            "total_minutes": new_total,
            "goal_achieved": new_total >= goal_minutes,
        }).eq("id", record["id"]).execute()
    else:
        db.table("study_streaks").insert({
            "user_id": user_id,
            "date": target_date_str,
            "total_minutes": minutes,
            "goal_achieved": minutes >= goal_minutes,
        }).execute()


def update_daily_streak(user_id: str, minutes: int, goal_minutes: int):
    """Update or create daily study streak record."""
    update_daily_streak_for_date(user_id, date.today(), minutes, goal_minutes)


def reconcile_recent_streaks(user_id: str, goal_minutes: int, days: int = 14, max_session_minutes: int = DEFAULT_MAX_SESSION_MINUTES):
    """Rebuild recent streak totals from session timestamps for realistic analytics."""
    now = datetime.now(timezone.utc)
    last = _last_reconcile.get(user_id)
    if last and (now - last).total_seconds() < _RECONCILE_COOLDOWN_SECONDS:
        return
    _last_reconcile[user_id] = now

    db = get_supabase_admin()
    today = date.today()
    start_day = today - timedelta(days=max(days - 1, 0))
    window_start = datetime.combine(start_day, time.min, tzinfo=timezone.utc)
    window_end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)

    sessions = db.table("study_sessions") \
        .select("started_at, ended_at") \
        .eq("user_id", user_id) \
        .not_.is_("ended_at", "null") \
        .lt("started_at", window_end.isoformat()) \
        .gte("ended_at", window_start.isoformat()) \
        .execute()

    totals_by_date = {}
    for row in (sessions.data or []):
        try:
            started_at = _parse_timestamp(row["started_at"])
            ended_at = _parse_timestamp(row["ended_at"])
        except Exception:
            continue

        if ended_at <= started_at:
            continue

        effective_end = _effective_end_time(started_at, ended_at, max_session_minutes)
        if effective_end <= started_at:
            continue

        split = _split_minutes_by_date(started_at, effective_end)
        for day_str, minutes in split.items():
            day_obj = date.fromisoformat(day_str)
            if day_obj < start_day or day_obj > today or minutes <= 0:
                continue
            totals_by_date[day_str] = totals_by_date.get(day_str, 0) + minutes

    existing = db.table("study_streaks") \
        .select("id, date") \
        .eq("user_id", user_id) \
        .gte("date", start_day.isoformat()) \
        .lte("date", today.isoformat()) \
        .execute()
    existing_map = {row["date"]: row["id"] for row in (existing.data or [])}

    for offset in range(days):
        day_obj = start_day + timedelta(days=offset)
        day_str = day_obj.isoformat()
        total = totals_by_date.get(day_str, 0)
        goal_achieved = total >= goal_minutes
        row_id = existing_map.get(day_str)

        if total <= 0:
            if row_id:
                db.table("study_streaks").delete().eq("id", row_id).execute()
            continue

        if row_id:
            db.table("study_streaks").update({
                "total_minutes": total,
                "goal_achieved": goal_achieved,
            }).eq("id", row_id).execute()
        else:
            db.table("study_streaks").insert({
                "user_id": user_id,
                "date": day_str,
                "total_minutes": total,
                "goal_achieved": goal_achieved,
            }).execute()
