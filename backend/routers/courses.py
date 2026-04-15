from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List
from schemas.course import CourseCreate, CourseUpdate, CourseResponse, ReorderRequest
from core.database import get_supabase_admin
from core.dependencies import get_current_user

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.post("", response_model=CourseResponse, status_code=201)
async def create_course(data: CourseCreate, user: dict = Depends(get_current_user)):
    """Create a new course."""
    db = get_supabase_admin()
    result = db.table("courses").insert({
        "semester_id": data.semester_id,
        "user_id": user["id"],
        "course_code": data.course_code,
        "course_name": data.course_name,
        "instructor": data.instructor,
        "credit_hours": data.credit_hours,
        "color": data.color,
    }).execute()
    return result.data[0]


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str, user: dict = Depends(get_current_user)):
    """Get a single course."""
    db = get_supabase_admin()
    result = db.table("courses").select("*").eq("id", course_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return result.data


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(course_id: str, data: CourseUpdate, user: dict = Depends(get_current_user)):
    """Update a course."""
    db = get_supabase_admin()
    update_data = data.model_dump(exclude_none=True)
    result = db.table("courses").update(update_data).eq("id", course_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return result.data[0]


@router.delete("/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(get_current_user)):
    """Delete a course (soft delete by archiving)."""
    db = get_supabase_admin()
    db.table("courses").delete().eq("id", course_id).eq("user_id", user["id"]).execute()
    return {"message": "Course deleted"}


@router.post("/{course_id}/archive")
async def toggle_archive(course_id: str, user: dict = Depends(get_current_user)):
    """Archive/unarchive a course."""
    db = get_supabase_admin()
    course = db.table("courses").select("is_archived").eq("id", course_id).eq("user_id", user["id"]).single().execute()
    if not course.data:
        raise HTTPException(status_code=404, detail="Course not found")

    new_status = not course.data["is_archived"]
    db.table("courses").update({"is_archived": new_status}).eq("id", course_id).execute()
    return {"is_archived": new_status}


@router.put("/reorder", status_code=200)
async def reorder_courses(data: ReorderRequest, user: dict = Depends(get_current_user)):
    """Update sort order for courses."""
    db = get_supabase_admin()
    for item in data.items:
        db.table("courses").update({"sort_order": item["sort_order"]}).eq("id", item["id"]).eq("user_id", user["id"]).execute()
    return {"message": "Courses reordered"}


# ─────────────────────────────────────────────────────────────────────────────
# HOT TOPICS (per course, for Question Lab)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{course_id}/hot-topics")
async def get_hot_topics(course_id: str, user: dict = Depends(get_current_user)):
    """Get all hot topics for a course."""
    db = get_supabase_admin()
    result = db.table("course_hot_topics") \
        .select("*") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .order("created_at") \
        .execute()
    return result.data or []


@router.post("/{course_id}/hot-topics", status_code=201)
async def add_hot_topic(
    course_id: str,
    topic: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
):
    """Add a hot topic to a course."""
    db = get_supabase_admin()
    # Verify course ownership
    course = db.table("courses").select("id").eq("id", course_id).eq("user_id", user["id"]).single().execute()
    if not course.data:
        raise HTTPException(status_code=404, detail="Course not found")

    result = db.table("course_hot_topics").insert({
        "course_id": course_id,
        "user_id": user["id"],
        "topic": topic.strip(),
    }).execute()
    return result.data[0]


@router.delete("/{course_id}/hot-topics/{topic_id}")
async def delete_hot_topic(
    course_id: str,
    topic_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a hot topic from a course."""
    db = get_supabase_admin()
    db.table("course_hot_topics") \
        .delete() \
        .eq("id", topic_id) \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .execute()
    return {"message": "Topic deleted"}
