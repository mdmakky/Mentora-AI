from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas.course import (
    SemesterCreate, SemesterUpdate, SemesterResponse,
    CourseCreate, CourseUpdate, CourseResponse, ReorderRequest,
)
from core.database import get_supabase_admin
from core.dependencies import get_current_user

router = APIRouter(tags=["Semesters"])


def _extract_semester_number(term: str, name: str) -> int | None:
    import re

    text = f"{term or ''} {name or ''}".lower()
    match = re.search(r"\b([1-8])(?:st|nd|rd|th)?\b", text)
    if not match:
        return None
    value = int(match.group(1))
    return value if 1 <= value <= 8 else None


@router.get("/semesters", response_model=List[SemesterResponse])
async def list_semesters(user: dict = Depends(get_current_user)):
    """Get all semesters for the current user."""
    db = get_supabase_admin()
    result = db.table("semesters").select("*").eq("user_id", user["id"]).order("sort_order").execute()
    return result.data or []


@router.post("/semesters", response_model=SemesterResponse, status_code=201)
async def create_semester(data: SemesterCreate, user: dict = Depends(get_current_user)):
    """Create a new semester."""
    db = get_supabase_admin()

    incoming_num = _extract_semester_number(data.term, data.name)
    if incoming_num is None:
        raise HTTPException(status_code=400, detail="Semester must be a number from 1st to 8th")

    existing = db.table("semesters").select("id, term, name").eq("user_id", user["id"]).execute()
    existing_rows = existing.data or []

    if len(existing_rows) >= 8:
        raise HTTPException(status_code=400, detail="You can create a maximum of 8 semesters")

    existing_nums = {
        num for num in (
            _extract_semester_number(row.get("term", ""), row.get("name", ""))
            for row in existing_rows
        ) if num is not None
    }
    if incoming_num in existing_nums:
        raise HTTPException(status_code=400, detail=f"Semester {incoming_num} already exists")

    # If setting as current, unset other current
    if data.is_current:
        db.table("semesters").update({"is_current": False}).eq("user_id", user["id"]).execute()

    result = db.table("semesters").insert({
        "user_id": user["id"],
        "name": data.name,
        "year": data.year,
        "term": data.term,
        "is_current": data.is_current,
    }).execute()

    return result.data[0]


@router.put("/semesters/{semester_id}", response_model=SemesterResponse)
async def update_semester(semester_id: str, data: SemesterUpdate, user: dict = Depends(get_current_user)):
    """Update a semester."""
    db = get_supabase_admin()
    update_data = data.model_dump(exclude_none=True)

    if "term" in update_data or "name" in update_data:
        current = db.table("semesters").select("id, term, name").eq("id", semester_id).eq("user_id", user["id"]).single().execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Semester not found")

        next_term = update_data.get("term", current.data.get("term"))
        next_name = update_data.get("name", current.data.get("name"))
        next_num = _extract_semester_number(next_term, next_name)
        if next_num is None:
            raise HTTPException(status_code=400, detail="Semester must be a number from 1st to 8th")

        others = db.table("semesters").select("id, term, name").eq("user_id", user["id"]).neq("id", semester_id).execute()
        other_nums = {
            num for num in (
                _extract_semester_number(row.get("term", ""), row.get("name", ""))
                for row in (others.data or [])
            ) if num is not None
        }
        if next_num in other_nums:
            raise HTTPException(status_code=400, detail=f"Semester {next_num} already exists")

    if data.is_current:
        db.table("semesters").update({"is_current": False}).eq("user_id", user["id"]).execute()

    result = db.table("semesters").update(update_data).eq("id", semester_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Semester not found")
    return result.data[0]


@router.delete("/semesters/{semester_id}")
async def delete_semester(semester_id: str, user: dict = Depends(get_current_user)):
    """Delete a semester and all its courses."""
    db = get_supabase_admin()
    db.table("semesters").delete().eq("id", semester_id).eq("user_id", user["id"]).execute()
    return {"message": "Semester deleted"}


@router.get("/semesters/{semester_id}/courses", response_model=List[CourseResponse])
async def list_courses(semester_id: str, user: dict = Depends(get_current_user)):
    """Get all courses for a semester."""
    db = get_supabase_admin()
    result = (
        db.table("courses")
        .select("*")
        .eq("semester_id", semester_id)
        .eq("user_id", user["id"])
        .order("sort_order")
        .execute()
    )
    return result.data or []
