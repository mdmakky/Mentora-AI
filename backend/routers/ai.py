from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import json
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.gemini_service import generate_summary, generate_questions, predict_exam_questions

router = APIRouter(prefix="/ai", tags=["AI Features"])


@router.post("/summarize/{doc_id}")
async def summarize_document(
    doc_id: str,
    summary_type: str = "full",
    language: str = "bn",
    user: dict = Depends(get_current_user),
):
    """Generate a summary for a document."""
    db = get_supabase_admin()

    # Get document chunks
    chunks = db.table("document_chunks").select("content, page_number").eq("document_id", doc_id).order("chunk_index").execute()

    if not chunks.data:
        raise HTTPException(status_code=400, detail="Document has not been processed yet")

    # Combine chunks
    full_text = "\n\n".join([c["content"] for c in chunks.data])

    # Generate summary
    summary = await generate_summary(full_text, summary_type, language)

    # Save summary
    result = db.table("document_summaries").insert({
        "document_id": doc_id,
        "user_id": user["id"],
        "summary_type": summary_type,
        "language": language,
        "content": summary,
    }).execute()

    return result.data[0]


@router.get("/summaries/{doc_id}")
async def get_summaries(doc_id: str, user: dict = Depends(get_current_user)):
    """Get saved summaries for a document."""
    db = get_supabase_admin()
    result = db.table("document_summaries").select("*").eq("document_id", doc_id).eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return result.data or []


@router.post("/generate-questions")
async def generate_doc_questions(
    document_id: str,
    question_type: str = "mcq",
    difficulty: str = "medium",
    count: int = 5,
    user: dict = Depends(get_current_user),
):
    """Generate questions from a document."""
    db = get_supabase_admin()

    # Get document chunks
    chunks = db.table("document_chunks").select("content, page_number").eq("document_id", document_id).order("chunk_index").execute()

    if not chunks.data:
        raise HTTPException(status_code=400, detail="Document has not been processed yet")

    full_text = "\n\n".join([c["content"] for c in chunks.data])

    # Get course_id from document
    doc = db.table("documents").select("course_id").eq("id", document_id).single().execute()
    course_id = doc.data["course_id"]

    # Generate questions
    questions_text = await generate_questions(full_text, question_type, difficulty, count)

    # Parse and save questions
    saved_questions = []
    try:
        # Try to parse JSON from response
        questions_json = questions_text
        if "```json" in questions_json:
            questions_json = questions_json.split("```json")[1].split("```")[0]
        elif "```" in questions_json:
            questions_json = questions_json.split("```")[1].split("```")[0]

        questions_list = json.loads(questions_json)

        for q in questions_list:
            saved = db.table("question_banks").insert({
                "document_id": document_id,
                "course_id": course_id,
                "user_id": user["id"],
                "question_type": question_type,
                "difficulty": difficulty,
                "question_text": q.get("question_text", ""),
                "answer_text": q.get("answer_text", ""),
                "options": q.get("options"),
                "source_page": q.get("source_page"),
            }).execute()
            saved_questions.append(saved.data[0])
    except (json.JSONDecodeError, IndexError):
        # If parsing fails, save as single question
        saved = db.table("question_banks").insert({
            "document_id": document_id,
            "course_id": course_id,
            "user_id": user["id"],
            "question_type": question_type,
            "difficulty": difficulty,
            "question_text": questions_text,
            "answer_text": "",
        }).execute()
        saved_questions.append(saved.data[0])

    return saved_questions


@router.post("/predict-questions/{course_id}")
async def predict_course_questions(
    course_id: str,
    user: dict = Depends(get_current_user),
):
    """Predict exam questions from previous year papers and course material."""
    db = get_supabase_admin()

    # Get all document chunks for the course
    chunks = db.table("document_chunks").select("content").eq("course_id", course_id).eq("user_id", user["id"]).order("chunk_index").execute()

    if not chunks.data:
        raise HTTPException(status_code=400, detail="No processed documents in this course")

    # Get course name
    course = db.table("courses").select("course_name").eq("id", course_id).single().execute()
    course_name = course.data.get("course_name", "Course")

    texts = [c["content"] for c in chunks.data]
    predictions = await predict_exam_questions(texts, course_name)

    return {"predictions": predictions, "course_name": course_name}


@router.get("/questions/{course_id}")
async def list_questions(
    course_id: str,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List questions in the question bank."""
    db = get_supabase_admin()
    query = db.table("question_banks").select("*").eq("course_id", course_id).eq("user_id", user["id"])

    if question_type:
        query = query.eq("question_type", question_type)
    if difficulty:
        query = query.eq("difficulty", difficulty)

    result = query.order("created_at", desc=True).execute()
    return result.data or []


@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, user: dict = Depends(get_current_user)):
    """Delete a question from the bank."""
    db = get_supabase_admin()
    db.table("question_banks").delete().eq("id", question_id).eq("user_id", user["id"]).execute()
    return {"message": "Question deleted"}
