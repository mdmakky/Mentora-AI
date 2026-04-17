from pydantic import BaseModel, Field
from typing import Optional, List


class ChatSessionCreate(BaseModel):
    course_id: str
    title: str = "New Chat"
    document_ids: Optional[List[str]] = None


class ChatSessionUpdate(BaseModel):
    title: str


class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    course_id: str
    title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    document_ids: Optional[List[str]] = None
    language: Optional[str] = "en"
    response_mode: Optional[str] = "learn"
    explanation_level: Optional[str] = "balanced"
    retrieval_scope: Optional[str] = "whole_document"
    current_page: Optional[int] = None
    selected_pages: Optional[List[int]] = None
    section_anchor_page: Optional[int] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    source_chunks: Optional[List[str]] = None
    source_docs: Optional[list] = None
    response_meta: Optional[dict] = None
    created_at: Optional[str] = None
