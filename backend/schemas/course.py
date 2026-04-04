from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SemesterCreate(BaseModel):
    name: str = Field(..., description="e.g., Spring 2025")
    year: int
    term: str = Field(..., description="Spring | Fall | Summer")
    is_current: bool = False


class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    year: Optional[int] = None
    term: Optional[str] = None
    is_current: Optional[bool] = None
    sort_order: Optional[int] = None


class SemesterResponse(BaseModel):
    id: str
    user_id: str
    name: str
    year: int
    term: str
    is_current: bool
    sort_order: int
    created_at: Optional[str] = None


class CourseCreate(BaseModel):
    semester_id: str
    course_code: str
    course_name: str
    instructor: Optional[str] = None
    credit_hours: Optional[float] = None
    color: str = "#2563EB"


class CourseUpdate(BaseModel):
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    instructor: Optional[str] = None
    credit_hours: Optional[float] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_archived: Optional[bool] = None


class CourseResponse(BaseModel):
    id: str
    semester_id: str
    user_id: str
    course_code: str
    course_name: str
    instructor: Optional[str] = None
    credit_hours: Optional[float] = None
    color: str
    sort_order: int
    is_archived: bool
    created_at: Optional[str] = None


class ReorderRequest(BaseModel):
    items: List[dict] = Field(..., description="List of {id, sort_order}")
