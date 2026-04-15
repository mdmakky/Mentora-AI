from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
import json
import re
from core.database import get_supabase_admin
from core.dependencies import get_current_user
from services.gemini_service import (
    generate_summary, generate_questions,
    predict_exam_questions, generate_practice_from_analysis,
)
from services.vision_service import (
    render_pdf_pages_as_images,
    analyze_question_paper_vision,
    merge_paper_analyses,
)

router = APIRouter(prefix="/ai", tags=["AI Features"])


def _group_practice_rows(rows: List[dict]) -> List[dict]:
    """Convert flattened question_banks rows into Question Lab set format."""
    grouped = {}

    for row in rows or []:
        set_number = row.get("set_number") or 1
        try:
            set_number = int(set_number)
        except Exception:
            set_number = 1

        key = (
            set_number,
            row.get("topic") or "",
            row.get("probability") or "medium",
        )

        if key not in grouped:
            grouped[key] = {
                "set_number": set_number,
                "probability": row.get("probability") or "medium",
                "topic": row.get("topic") or "General",
                "parts": [],
            }

        raw_text = (row.get("question_text") or "").strip()
        label = None
        question_text = raw_text
        match = re.match(r"^\(([^)]+)\)\s*(.*)$", raw_text)
        if match:
            label = (match.group(1) or "").strip()
            question_text = (match.group(2) or "").strip()

        if not label:
            label = chr(97 + len(grouped[key]["parts"]))

        marks = row.get("marks")
        try:
            marks = int(marks) if marks is not None else None
        except Exception:
            marks = None

        grouped[key]["parts"].append(
            {
                "label": label,
                "question": question_text,
                "answer": row.get("answer_text") or "",
                "marks": marks,
            }
        )

    ordered = sorted(grouped.values(), key=lambda item: item.get("set_number", 1))
    return ordered


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


# ─────────────────────────────────────────────────────────────────────────────
# QUESTION LAB — New Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/analyze-papers/{course_id}")
async def analyze_past_papers(course_id: str, user: dict = Depends(get_current_user)):
    """
    Analyze all question_paper documents in a course using multimodal vision AI.
    Renders PDF pages as images so tables, boxes, and scanned content are readable.
    Stores parsed pattern in paper_analyses table (upsert).
    """
    db = get_supabase_admin()

    # Fetch all question_paper docs in this course
    docs_result = db.table("documents") \
        .select("id, file_name, cloudinary_public_id") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .eq("doc_category", "question_paper") \
        .eq("is_deleted", False) \
        .eq("processing_status", "ready") \
        .execute()

    docs = docs_result.data or []
    if not docs:
        raise HTTPException(
            status_code=400,
            detail="No processed question papers found in this course. Upload past papers with category 'Past Question Paper'."
        )

    # Get course name
    course = db.table("courses").select("course_name").eq("id", course_id).single().execute()
    course_name = course.data.get("course_name", "Course") if course.data else "Course"

    # Analyze each paper via vision
    paper_results = []
    paper_doc_ids = []
    rate_limited_docs = 0

    for idx, doc in enumerate(docs):
        public_id = doc.get("cloudinary_public_id")
        if not public_id:
            continue
        try:
            file_bytes = db.storage.from_("mentora-docs").download(public_id)
            if not file_bytes:
                continue
            doc_name = doc.get("file_name", "").lower()
            if doc_name.endswith((".png", ".jpg", ".jpeg")):
                images = [file_bytes]
            else:
                images = render_pdf_pages_as_images(file_bytes)  # max 10 pages cap inside
            
            if not images:
                continue
            analysis = analyze_question_paper_vision(
                images, course_name, paper_index=idx + 1, total_papers=len(docs)
            )
            if analysis:
                if analysis.get("error") == "RATE_LIMIT_EXCEEDED":
                    rate_limited_docs += 1
                    continue
                analysis["_doc_name"] = doc["file_name"]
                paper_results.append(analysis)
                paper_doc_ids.append(doc["id"])
        except HTTPException:
            raise
        except Exception as e:
            print(f"[analyze_past_papers] Error on doc {doc['id']}: {e}")
            continue

    if not paper_results:
        if rate_limited_docs > 0:
            raise HTTPException(
                status_code=429,
                detail="Google AI API quota exceeded. Please wait and try again, or configure fallback models."
            )
        raise HTTPException(status_code=500, detail="Could not extract data from the question papers. Make sure they are valid PDF files.")

    # Merge all papers into a unified pattern summary
    merged = merge_paper_analyses(paper_results, course_name)
    if not isinstance(merged, dict):
        merged = {
            "course_name": course_name,
            "papers_analyzed": len(paper_results),
            "exam_format": {},
            "repeat_topics": [],
            "question_type_breakdown": {},
            "high_probability_topics": [],
            "sample_question_format": "",
            "error": "Invalid merged analysis format",
        }
    if merged and merged.get("error") == "RATE_LIMIT_EXCEEDED":
        raise HTTPException(
            status_code=429,
            detail="Google AI API quota exceeded during final analysis. You have reached the free-tier limits. Please wait a minute and try again."
        )

    # Upsert into paper_analyses table
    existing = db.table("paper_analyses") \
        .select("id") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .execute()

    record = {
        "course_id": course_id,
        "user_id": user["id"],
        "pattern_json": merged,
        "repeat_topics": merged.get("repeat_topics", []),
        "paper_doc_ids": paper_doc_ids,
        "analyzed_at": "now()",
    }

    if existing.data:
        db.table("paper_analyses").update(record).eq("id", existing.data[0]["id"]).execute()
    else:
        db.table("paper_analyses").insert(record).execute()

    return {
        "status": "ok",
        "papers_analyzed": len(paper_results),
        "pattern": merged,
    }


@router.get("/analyze-papers/{course_id}")
async def get_paper_analysis(course_id: str, user: dict = Depends(get_current_user)):
    """Return cached pattern analysis for a course (if it exists)."""
    db = get_supabase_admin()
    result = db.table("paper_analyses") \
        .select("*") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not result.data:
        return {"pattern": None}
    return {"pattern": result.data[0]["pattern_json"], "analyzed_at": result.data[0]["analyzed_at"]}


@router.post("/generate-practice/{course_id}")
async def generate_practice_questions(
    course_id: str,
    hot_topics: List[str] = Body(default=[]),
    count: int = Body(default=8),
    question_type: str = Body(default="broad"),
    user: dict = Depends(get_current_user),
):
    """
    Generate exam-style practice questions from:
      - Pattern analysis stored in paper_analyses
      - Teacher hot topics (provided by user)
      - RAG chunks from course documents
    """
    db = get_supabase_admin()
    count = max(5, min(int(count or 8), 8))

    # Load cached analysis
    analysis_row = db.table("paper_analyses") \
        .select("pattern_json") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not analysis_row.data or not analysis_row.data[0].get("pattern_json"):
        raise HTTPException(
            status_code=400,
            detail="No question paper analysis found. Please run 'Analyze Papers' first."
        )

    pattern_data = analysis_row.data[0]["pattern_json"]

    # Fetch course name
    course = db.table("courses").select("course_name").eq("id", course_id).single().execute()
    course_name = course.data.get("course_name", "Course") if course.data else "Course"

    # Fetch RAG chunks for course context (exclude question_paper docs)
    qp_doc_ids_row = db.table("paper_analyses") \
        .select("paper_doc_ids") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .execute()
    qp_doc_ids = qp_doc_ids_row.data[0].get("paper_doc_ids", []) if qp_doc_ids_row.data else []

    chunks_query = db.table("document_chunks") \
        .select("content") \
        .eq("course_id", course_id) \
        .eq("user_id", user["id"]) \
        .order("chunk_index") \
        .limit(50)

    chunks_result = chunks_query.execute()
    course_content = "\n\n".join(c["content"] for c in (chunks_result.data or []))

    # Generate
    raw = await generate_practice_from_analysis(
        pattern_data=pattern_data,
        hot_topics=hot_topics,
        course_content=course_content,
        course_name=course_name,
        count=count,
        question_type=question_type,
    )

    # Parse JSON response
    questions_list = []
    try:
        clean = raw
        if "```json" in clean:
            clean = clean.split("```json")[1].split("```")[0]
        elif "```" in clean:
            clean = clean.split("```")[1].split("```")[0]
        questions_list = json.loads(clean.strip())
    except Exception as e:
        print(f"[generate_practice] JSON parse error: {e}")
        return {"questions": [], "raw": raw, "error": "Could not parse AI response"}

    # Save to question_banks
    saved = []
    insert_failed_count = 0
    for q in questions_list:
        parts = q.get("parts") or []
        if not isinstance(parts, list) or not parts:
            parts = [{"label": "a", "question": q.get("question", ""), "answer": "", "marks": None}]

        # Flatten parts into individual question_banks rows
        for part in parts:
            full_row = {
                "course_id": course_id,
                "user_id": user["id"],
                "document_id": None,
                "question_type": question_type,
                "difficulty": "medium",
                "question_text": f"({part.get('label', '')}) {part.get('question', '')}",
                "answer_text": part.get("answer", ""),
                "options": None,
                "source_page": None,
                "is_prediction": True,
                "source_type": "practice_generated",
                "topic": q.get("topic", ""),
                "probability": q.get("probability", "medium"),
                "set_number": q.get("set_number"),
                "marks": part.get("marks"),
            }

            legacy_row = {
                "course_id": course_id,
                "user_id": user["id"],
                "document_id": None,
                "question_type": question_type,
                "difficulty": "medium",
                "question_text": full_row["question_text"],
                "answer_text": full_row["answer_text"],
                "options": None,
                "source_page": None,
                "is_prediction": True,
            }

            try:
                res = db.table("question_banks").insert(full_row).execute()
                saved.append(res.data[0] if res.data else full_row)
            except Exception as e:
                print(f"[generate_practice] DB insert error (extended row): {e}")
                try:
                    res = db.table("question_banks").insert(legacy_row).execute()
                    saved.append(res.data[0] if res.data else legacy_row)
                except Exception as fallback_error:
                    print(f"[generate_practice] DB insert error (legacy row): {fallback_error}")
                    insert_failed_count += 1

    return {
        "questions": questions_list,
        "saved_count": len(saved),
        "insert_failed_count": insert_failed_count,
        "course_name": course_name,
    }


@router.get("/practice-questions/{course_id}")
async def list_practice_questions(course_id: str, user: dict = Depends(get_current_user)):
    """List saved practice questions for a course (source_type = practice_generated)."""
    db = get_supabase_admin()
    try:
        result = db.table("question_banks") \
            .select("*") \
            .eq("course_id", course_id) \
            .eq("user_id", user["id"]) \
            .eq("source_type", "practice_generated") \
            .order("created_at", desc=False) \
            .execute()
        return _group_practice_rows(result.data or [])
    except Exception:
        # source_type column may not exist yet; fall back to legacy marker.
        try:
            legacy_result = db.table("question_banks") \
                .select("*") \
                .eq("course_id", course_id) \
                .eq("user_id", user["id"]) \
                .eq("is_prediction", True) \
                .order("created_at", desc=False) \
                .execute()
            return _group_practice_rows(legacy_result.data or [])
        except Exception:
            return []
