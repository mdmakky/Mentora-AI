from fastapi import APIRouter, Depends, HTTPException, Request
import logging
from typing import List, Optional
from schemas.chat import ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse, ChatMessageCreate, ChatMessageResponse
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.rag_service import search_similar_chunks
from services.gemini_service import generate_chat_response
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/chat", tags=["Chat"])


def _build_auto_title(existing_title: str, user_content: str) -> str:
    """Preserve document prefix format when auto-generating first-message titles."""
    raw_title = user_content[:50] + ("..." if len(user_content) > 50 else "")
    if isinstance(existing_title, str) and existing_title.startswith("DOC::"):
        parts = existing_title.split("::", 2)
        if len(parts) == 3:
            return f"DOC::{parts[1]}::{raw_title}"
    return raw_title


@router.post("/sessions", response_model=ChatSessionResponse, status_code=201)
async def create_session(data: ChatSessionCreate, user: dict = Depends(get_current_user)):
    """Create a new chat session."""
    db = get_supabase_admin()
    result = db.table("chat_sessions").insert({
        "user_id": user["id"],
        "course_id": data.course_id,
        "title": data.title,
    }).execute()
    return result.data[0]


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(
    course_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List chat sessions."""
    db = get_supabase_admin()
    query = db.table("chat_sessions").select("*").eq("user_id", user["id"])
    if course_id:
        query = query.eq("course_id", course_id)
    result = query.order("updated_at", desc=True).execute()
    return result.data or []


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    """Get session with messages."""
    db = get_supabase_admin()

    session = db.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", user["id"]).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.table("chat_messages").select("*").eq("session_id", session_id).order("created_at").limit(200).execute()

    return {
        "session": session.data,
        "messages": messages.data or [],
    }


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(session_id: str, data: ChatSessionUpdate, user: dict = Depends(get_current_user)):
    """Rename a session."""
    db = get_supabase_admin()
    result = db.table("chat_sessions").update({"title": data.title}).eq("id", session_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data[0]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(get_current_user)):
    """Delete a chat session."""
    db = get_supabase_admin()
    db.table("chat_sessions").delete().eq("id", session_id).eq("user_id", user["id"]).execute()
    return {"message": "Session deleted"}


@router.post("/{session_id}/message", response_model=ChatMessageResponse)
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    session_id: str,
    data: ChatMessageCreate,
    user: dict = Depends(get_current_user),
):
    """Send a message and get AI response via RAG pipeline."""
    db = get_supabase_admin()

    # Verify session ownership
    session = db.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", user["id"]).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    course_id = session.data["course_id"]

    # Save user message
    user_msg = db.table("chat_messages").insert({
        "session_id": session_id,
        "role": "user",
        "content": data.content,
    }).execute()

    # Search similar chunks (RAG retrieval)
    chunks = await search_similar_chunks(
        query=data.content,
        user_id=user["id"],
        course_id=course_id,
        document_ids=data.document_ids,
    )

    # Get conversation history
    history_result = db.table("chat_messages").select("role, content").eq("session_id", session_id).order("created_at").limit(10).execute()
    conversation_history = history_result.data or []

    # Generate AI response
    ai_response = await generate_chat_response(
        question=data.content,
        context_chunks=chunks,
        conversation_history=conversation_history,
    )

    # Extract source docs for citation
    source_docs = []
    seen_docs = set()
    for chunk in chunks:
        doc_key = chunk.get("document_id", "")
        if doc_key not in seen_docs:
            seen_docs.add(doc_key)
            source_docs.append({
                "document_id": chunk.get("document_id"),
                "doc_name": chunk.get("doc_name"),
                "page_number": chunk.get("page_number"),
            })

    # Save AI message
    ai_msg = db.table("chat_messages").insert({
        "session_id": session_id,
        "role": "assistant",
        "content": ai_response,
        "source_docs": source_docs,
    }).execute()

    # Update session timestamp
    db.table("chat_sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()

    # Auto-rename first message
    if len(conversation_history) <= 1:
        title = _build_auto_title(session.data.get("title", ""), data.content)
        db.table("chat_sessions").update({"title": title}).eq("id", session_id).execute()

    return ai_msg.data[0]


@router.get("/{session_id}/export")
async def export_chat(session_id: str, user: dict = Depends(get_current_user)):
    """Export chat session as markdown."""
    db = get_supabase_admin()

    session = db.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", user["id"]).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.table("chat_messages").select("role, content").eq("session_id", session_id).order("created_at").limit(500).execute()

    markdown = f"# {session.data['title']}\n\n"
    for msg in (messages.data or []):
        role = "**You**" if msg["role"] == "user" else "**Mentora AI**"
        markdown += f"### {role}\n{msg['content']}\n\n---\n\n"

    return {"content": markdown, "title": session.data["title"]}
