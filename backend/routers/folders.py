from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas.document import FolderCreate, FolderUpdate, FolderResponse
from core.database import get_supabase_admin
from core.dependencies import get_current_user

router = APIRouter(prefix="/folders", tags=["Folders"])


@router.get("/course/{course_id}", response_model=List[FolderResponse])
async def list_folders(course_id: str, user: dict = Depends(get_current_user)):
    """Get all folders for a course."""
    db = get_supabase_admin()
    result = (
        db.table("folders")
        .select("*")
        .eq("course_id", course_id)
        .eq("user_id", user["id"])
        .order("sort_order")
        .execute()
    )
    return result.data or []


@router.post("", response_model=FolderResponse, status_code=201)
async def create_folder(data: FolderCreate, user: dict = Depends(get_current_user)):
    """Create a new folder."""
    db = get_supabase_admin()

    # Prevent duplicate folder names in the same course + parent scope
    existing = (
        db.table("folders")
        .select("id")
        .eq("course_id", data.course_id)
        .eq("user_id", user["id"])
        .eq("name", data.name)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A folder named '{data.name}' already exists in this course.",
        )

    result = db.table("folders").insert({
        "course_id": data.course_id,
        "user_id": user["id"],
        "name": data.name,
        "parent_id": data.parent_id,
    }).execute()
    return result.data[0]


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(folder_id: str, data: FolderUpdate, user: dict = Depends(get_current_user)):
    """Update a folder."""
    db = get_supabase_admin()
    update_data = data.model_dump(exclude_none=True)
    result = db.table("folders").update(update_data).eq("id", folder_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result.data[0]


@router.delete("/{folder_id}")
async def delete_folder(folder_id: str, user: dict = Depends(get_current_user)):
    """Delete a folder and its contents."""
    db = get_supabase_admin()
    db.table("folders").delete().eq("id", folder_id).eq("user_id", user["id"]).execute()
    return {"message": "Folder deleted"}
