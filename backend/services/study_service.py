from datetime import datetime, date, timedelta, timezone
from core.database import get_supabase_admin


def calculate_streak(user_id: str) -> dict:
    """Calculate current and longest study streak for a user."""
    db = get_supabase_admin()

    result = db.table("study_streaks").select("*").eq("user_id", user_id).order("date", desc=True).execute()
    records = result.data or []

    if not records:
        return {"current_streak": 0, "longest_streak": 0, "history": []}

    # Calculate current streak
    current_streak = 0
    today = date.today()

    for record in records:
        record_date = date.fromisoformat(record["date"])
        expected_date = today - timedelta(days=current_streak)

        if record_date == expected_date and record.get("goal_achieved"):
            current_streak += 1
        else:
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


def update_daily_streak(user_id: str, minutes: int, goal_minutes: int):
    """Update or create daily study streak record."""
    db = get_supabase_admin()
    today_str = date.today().isoformat()

    # Check if record exists
    existing = db.table("study_streaks").select("*").eq("user_id", user_id).eq("date", today_str).execute()

    if existing.data:
        record = existing.data[0]
        new_total = record["total_minutes"] + minutes
        db.table("study_streaks").update({
            "total_minutes": new_total,
            "goal_achieved": new_total >= goal_minutes,
        }).eq("id", record["id"]).execute()
    else:
        db.table("study_streaks").insert({
            "user_id": user_id,
            "date": today_str,
            "total_minutes": minutes,
            "goal_achieved": minutes >= goal_minutes,
        }).execute()
