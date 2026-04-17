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


def _normalize_language(value: Optional[str]) -> str:
    language = (value or "en").strip().lower()
    if language in {"bn", "bangla", "bengali"}:
        return "bn"
    if language == "auto":
        return "auto"
    return "en"


def _normalize_response_mode(value: Optional[str]) -> str:
    mode = (value or "learn").strip().lower()
    if mode in {"summary", "exam", "practice"}:
        return mode
    return "learn"


def _normalize_explanation_level(value: Optional[str]) -> str:
    level = (value or "balanced").strip().lower()
    if level in {"simple", "deep"}:
        return level
    return "balanced"


def _normalize_retrieval_scope(value: Optional[str]) -> str:
    scope = (value or "whole_document").strip().lower()
    if scope in {"current_page", "selected_pages", "current_section", "whole_course"}:
        return scope
    return "whole_document"


def _sanitize_pages(values: Optional[List[int]]) -> List[int]:
    if not values:
        return []
    pages: List[int] = []
    for value in values:
        if isinstance(value, int) and value > 0 and value not in pages:
            pages.append(value)
    return pages[:20]


def _pick_top_k(response_mode: str, explanation_level: str, document_ids: Optional[List[str]]) -> int:
    top_k = 5 if document_ids else 6

    if response_mode == "summary":
        top_k += 1
    elif response_mode == "practice":
        top_k += 1

    if explanation_level == "deep":
        top_k += 1
    elif explanation_level == "simple":
        top_k -= 1

    return max(4, min(top_k, 8))


def _build_excerpt(text: Optional[str], limit: int = 160) -> str:
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def _build_follow_up_questions(response_mode: str) -> List[str]:
    mapping = {
        "learn": [
            "Want a simpler explanation?",
            "Want a real-world example from this topic?",
            "Want a 2-minute recap?",
        ],
        "summary": [
            "Want this turned into revision bullets?",
            "Want key formulas and definitions only?",
            "Want a quick exam checklist?",
        ],
        "exam": [
            "Want viva-style Q&A from this topic?",
            "Want likely exam questions next?",
            "Want the most important memorization points?",
        ],
        "practice": [
            "Want 3 more practice questions?",
            "Want mixed-difficulty questions?",
            "Want model answers after you attempt?",
        ],
    }
    return mapping.get(response_mode, mapping["learn"])


def _build_suggested_actions(response_mode: str, no_evidence: bool, document_scope: bool) -> List[str]:
    if no_evidence and document_scope:
        return [
            "Search this topic in whole course",
            "Answer from general knowledge",
            "Ask a narrower question",
        ]

    action_map = {
        "learn": ["Make it simpler", "Give one concrete example", "Create a 2-minute recap"],
        "summary": ["Turn into quick notes", "Give keyword list", "Make last-minute revision points"],
        "exam": ["Generate viva questions", "Give exam-focused bullet answers", "List high-priority topics"],
        "practice": ["Generate quiz", "Check my understanding", "Give model answers"],
    }
    return action_map.get(response_mode, action_map["learn"])


def _build_response_meta(
    response_mode: str,
    document_scope: bool,
    no_evidence: bool,
    confidence: Optional[float] = None,
) -> dict:
    return {
        "mode": response_mode,
        "document_scope": document_scope,
        "no_evidence": no_evidence,
        "confidence": round(float(confidence), 3) if confidence is not None else None,
        "follow_up_questions": _build_follow_up_questions(response_mode),
        "suggested_actions": _build_suggested_actions(response_mode, no_evidence, document_scope),
    }


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
    language = _normalize_language(data.language)
    response_mode = _normalize_response_mode(data.response_mode)
    explanation_level = _normalize_explanation_level(data.explanation_level)
    retrieval_scope = _normalize_retrieval_scope(data.retrieval_scope)

    page_numbers: List[int] = []
    section_anchor_page: Optional[int] = None
    scoped_document_ids = data.document_ids

    if retrieval_scope == "whole_course":
        scoped_document_ids = None
    elif retrieval_scope == "current_page" and isinstance(data.current_page, int) and data.current_page > 0:
        page_numbers = [data.current_page]
    elif retrieval_scope == "selected_pages":
        page_numbers = _sanitize_pages(data.selected_pages)
    elif retrieval_scope == "current_section":
        anchor = data.section_anchor_page if isinstance(data.section_anchor_page, int) else data.current_page
        if isinstance(anchor, int) and anchor > 0:
            section_anchor_page = anchor

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
        document_ids=scoped_document_ids,
        page_numbers=page_numbers or None,
        section_anchor_page=section_anchor_page,
        top_k=_pick_top_k(response_mode, explanation_level, scoped_document_ids),
    )

    # Get conversation history
    history_result = db.table("chat_messages").select("role, content").eq("session_id", session_id).order("created_at").limit(6).execute()
    conversation_history = history_result.data or []

    document_scoped = bool(scoped_document_ids)
    confidence_values = [c.get("similarity") for c in chunks if isinstance(c.get("similarity"), (int, float))]
    confidence = (sum(confidence_values) / len(confidence_values)) if confidence_values else None

    no_evidence = document_scoped and len(chunks) == 0
    if no_evidence:
        if language == "bn":
            ai_response = (
                "এই প্রশ্নের জন্য আপনার এই ডকুমেন্টে পর্যাপ্ত প্রমাণ পাইনি।\n\n"
                "আপনি চাইলে আমি পরের ধাপে সাহায্য করতে পারি:\n"
                "1. পুরো কোর্স থেকে খুঁজে দেখি\n"
                "2. সাধারণ জ্ঞান থেকে ব্যাখ্যা দিই\n"
                "3. প্রশ্নটা আরেকটু নির্দিষ্ট করি"
            )
        else:
            ai_response = (
                "I could not find enough evidence in this document for that question.\n\n"
                "I can help you with one of these next steps:\n"
                "1. Search across the whole course\n"
                "2. Answer from general knowledge\n"
                "3. Narrow the question"
            )
    else:
        # Generate AI response
        ai_response = await generate_chat_response(
            question=data.content,
            context_chunks=chunks,
            conversation_history=conversation_history,
            language=language,
            response_mode=response_mode,
            explanation_level=explanation_level,
            document_scope=document_scoped,
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
                "excerpt": _build_excerpt(chunk.get("content")),
            })

    # Save AI message
    ai_msg = db.table("chat_messages").insert({
        "session_id": session_id,
        "role": "assistant",
        "content": ai_response,
        "source_docs": source_docs,
    }).execute()

    response_meta = _build_response_meta(
        response_mode=response_mode,
        document_scope=document_scoped,
        no_evidence=no_evidence,
        confidence=confidence,
    )

    # Update session timestamp
    db.table("chat_sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()

    # Auto-rename first message
    if len(conversation_history) <= 1:
        title = _build_auto_title(session.data.get("title", ""), data.content)
        db.table("chat_sessions").update({"title": title}).eq("id", session_id).execute()

    payload = ai_msg.data[0]
    payload["response_meta"] = response_meta
    return payload


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
