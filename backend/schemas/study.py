from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class StudySessionStart(BaseModel):
    course_id: Optional[str] = None
    document_id: Optional[str] = None
    session_type: str = "reading"


class StudySessionEnd(BaseModel):
    pass


class StudySessionResponse(BaseModel):
    id: str
    user_id: str
    course_id: Optional[str] = None
    document_id: Optional[str] = None
    started_at: str
    ended_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    session_type: str
    created_at: Optional[str] = None


class StudyStatsResponse(BaseModel):
    total_minutes: int = 0
    goal_minutes: int = 120
    goal_achieved: bool = False


class WeeklyStatsResponse(BaseModel):
    date: str
    total_minutes: int


class CourseStatsResponse(BaseModel):
    course_id: str
    course_name: str
    total_minutes: int
    color: str


class StreakResponse(BaseModel):
    current_streak: int = 0
    longest_streak: int = 0
    history: list = []
