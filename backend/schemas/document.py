from pydantic import BaseModel, Field
from typing import Optional, List


class FolderCreate(BaseModel):
    course_id: str
    name: str
    parent_id: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class FolderResponse(BaseModel):
    id: str
    course_id: str
    user_id: str
    name: str
    parent_id: Optional[str] = None
    sort_order: int
    created_at: Optional[str] = None


class DocumentUploadMeta(BaseModel):
    course_id: str
    folder_id: Optional[str] = None
    doc_category: str = "lecture"
    declaration_accepted: bool = False


class DocumentUpdate(BaseModel):
    file_name: Optional[str] = None
    folder_id: Optional[str] = None
    doc_category: Optional[str] = None


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    course_id: str
    folder_id: Optional[str] = None
    file_name: str
    original_name: str
    cloudinary_url: str
    file_size: Optional[int] = None
    file_type: str
    page_count: int = 0
    doc_category: str
    processing_status: str
    copyright_flag: bool = False
    flag_reason: Optional[str] = None
    review_requested: bool = False
    review_status: Optional[str] = None
    review_note: Optional[str] = None
    review_requested_at: Optional[str] = None
    review_decided_at: Optional[str] = None
    chunk_count: int = 0
    is_deleted: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
