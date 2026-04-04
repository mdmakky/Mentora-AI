from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas.course import (
    SemesterCreate, SemesterUpdate, SemesterResponse,
    CourseCreate, CourseUpdate, CourseResponse, ReorderRequest,
)
from core.database import get_supabase_admin
from core.dependencies import get_current_user

router = APIRouter(tags=["Semesters"])


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
