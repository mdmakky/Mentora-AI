from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional
import json
import re
import uuid
import ast
from datetime import datetime, timezone
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


def _extract_json_candidates(raw: str) -> List[str]:
    text = (raw or "").strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()

    candidates = [text]

    arr_start = text.find("[")
    arr_end = text.rfind("]")
    if arr_start != -1 and arr_end > arr_start:
        candidates.append(text[arr_start:arr_end + 1])

    obj_start = text.find("{")
    obj_end = text.rfind("}")
    if obj_start != -1 and obj_end > obj_start:
        candidates.append(text[obj_start:obj_end + 1])

    # Deduplicate while preserving order
    unique = []
    seen = set()
    for c in candidates:
        if c and c not in seen:
            unique.append(c)
            seen.add(c)
    return unique


def _parse_practice_json(raw: str) -> List[dict]:
    """Best-effort parse for model output that may be almost-JSON."""
    candidates = _extract_json_candidates(raw)
    decoder = json.JSONDecoder()
    last_error = None

    for candidate in candidates:
        # 1) Strict JSON
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, list):
                return parsed
        except Exception as err:
            last_error = err

        # 2) JSON prefix (ignores trailing commentary)
        try:
            parsed, _ = decoder.raw_decode(candidate)
            if isinstance(parsed, list):
                return parsed
        except Exception as err:
            last_error = err

        # 3) Normalize stray backslashes + trailing commas
        try:
            normalized = re.sub(r"\\(?![\"\\/bfnrtu])", r"\\\\", candidate)
            normalized = re.sub(r",\s*([}\]])", r"\1", normalized)
            parsed = json.loads(normalized)
            if isinstance(parsed, list):
                return parsed
        except Exception as err:
            last_error = err

        # 4) Python-literal style fallback (single quotes etc.)
        try:
            py_style = candidate
            py_style = re.sub(r"\bnull\b", "None", py_style)
            py_style = re.sub(r"\btrue\b", "True", py_style)
            py_style = re.sub(r"\bfalse\b", "False", py_style)
            parsed = ast.literal_eval(py_style)
            if isinstance(parsed, list):
                return parsed
        except Exception as err:
            last_error = err

        # 5) Bracket-counting: extract the longest balanced [...] array
        try:
            depth = 0
            start_idx = None
            for char_idx, ch in enumerate(candidate):
                if ch == "[" and depth == 0:
                    start_idx = char_idx
                    depth = 1
                elif ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
                    if depth == 0 and start_idx is not None:
                        extracted = candidate[start_idx: char_idx + 1]
                        parsed = json.loads(extracted)
                        if isinstance(parsed, list):
                            return parsed
                        break
        except Exception as err:
            last_error = err

    raise last_error or ValueError("Could not parse practice JSON")


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
                "generation_id": row.get("generation_run_id"),
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
                "options": row.get("options") or None,  # carry MCQ options from DB
            }
        )

    ordered = sorted(grouped.values(), key=lambda item: item.get("set_number", 1))
    return ordered


def _create_generation_run(
    db,
    course_id: str,
    user_id: str,
    question_type: str,
    requested_count: int,
    hot_topics: List[str],
    pattern_data: dict,
) -> Optional[str]:
    """Create generation cluster row. Returns run id if feature is available."""
    run_id = str(uuid.uuid4())
    minimal_payload = {
        "id": run_id,
        "course_id": course_id,
        "user_id": user_id,
        "question_type": question_type,
        "requested_count": requested_count,
        "generated_sets_count": 0,
        "saved_rows_count": 0,
        "failed_rows_count": 0,
        "status": "running",
        "source": "question_lab",
        "hot_topics": hot_topics or [],
        "pattern_snapshot": pattern_data or {},
    }

    extended_payload = dict(minimal_payload)

    try:
        db.table("question_generation_runs").insert(extended_payload).execute()
        return run_id
    except Exception as e:
        print(f"[generate_practice] generation run extended insert failed, retrying minimal payload: {e}")
        try:
            db.table("question_generation_runs").insert(minimal_payload).execute()
            return run_id
        except Exception as e2:
            print(f"[generate_practice] generation run table unavailable, fallback to legacy save: {e2}")
            return None


def _finalize_generation_run(db, run_id: Optional[str], generated_sets_count: int, saved_rows_count: int, failed_rows_count: int):
    if not run_id:
        return
    try:
        label = f"Run {run_id[:8]}"
        if generated_sets_count <= 0 or saved_rows_count <= 0:
            status = "failed"
        elif failed_rows_count > 0:
            status = "partial"
        else:
            status = "completed"
        patch = {
            "generated_sets_count": generated_sets_count,
            "saved_rows_count": saved_rows_count,
            "failed_rows_count": failed_rows_count,
            "status": status,
        }
        try:
            db.table("question_generation_runs").update(patch).eq("id", run_id).execute()
        except Exception:
            pass
    except Exception as e:
        print(f"[generate_practice] generation run finalize failed: {e}")


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



@router.post("/practice-generations/{generation_id}/rename")
async def rename_practice_generation(
    generation_id: str,
    generation_label: str = Body(default="", embed=True),
    user: dict = Depends(get_current_user),
):
    """Compatibility endpoint for renaming generation runs when PATCH is unavailable."""
    db = get_supabase_admin()

    label = str(generation_label or "").strip()
    if len(label) == 0:
        label = None
    if label and len(label) > 120:
        raise HTTPException(status_code=400, detail="Generation label must be 120 chars or less")

    try:
        result = db.table("question_generation_runs") \
            .update({"generation_label": label}) \
            .eq("id", generation_id) \
            .eq("user_id", user["id"]) \
            .execute()
    except Exception as e:
        msg = str(e)
        # Old schemas may not have generation_label yet.
        if "generation_label" in msg or "PGRST204" in msg:
            raise HTTPException(
                status_code=409,
                detail="Database migration required: missing question_generation_runs.generation_label. Run database/question_generation_runs_hotfix.sql in Supabase SQL editor, then retry.",
            )
        raise HTTPException(status_code=500, detail=f"Rename failed: {msg}")

    if not result.data:
        raise HTTPException(status_code=404, detail="Generation run not found")

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
        questions_list = _parse_practice_json(raw)
    except Exception as e:
        print(f"[generate_practice] JSON parse error: {e}")
        print(f"[generate_practice] raw output snippet: {(raw or '')[:300]}")
        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid format. Please retry with fewer questions or different type."
        )

    if not isinstance(questions_list, list) or len(questions_list) == 0:
        raise HTTPException(
            status_code=422,
            detail=f"No {question_type} questions could be generated right now (likely quota/size issue). Please retry or choose another type."
        )

    # Save to question_banks
    saved = []
    insert_failed_count = 0
    generation_run_id = _create_generation_run(
        db=db,
        course_id=course_id,
        user_id=user["id"],
        question_type=question_type,
        requested_count=count,
        hot_topics=hot_topics,
        pattern_data=pattern_data,
    )

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
                "options": part.get("options") or None,
                "source_page": None,
                "is_prediction": True,
                "source_type": "practice_generated",
                "topic": q.get("topic", ""),
                "probability": q.get("probability", "medium"),
                "set_number": q.get("set_number"),
                "generation_run_id": generation_run_id,
                "part_label": part.get("label"),
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
                "options": part.get("options") or None,
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

    _finalize_generation_run(
        db=db,
        run_id=generation_run_id,
        generated_sets_count=len(questions_list),
        saved_rows_count=len(saved),
        failed_rows_count=insert_failed_count,
    )

    return {
        "questions": questions_list,
        "saved_count": len(saved),
        "insert_failed_count": insert_failed_count,
        "generation_id": generation_run_id,
        "course_name": course_name,
    }


@router.get("/practice-questions/{course_id}")
async def list_practice_questions(
    course_id: str,
    question_type: Optional[str] = Query(default=None),
    generation_id: Optional[str] = Query(default=None),
    include_all: bool = Query(default=False),
    user: dict = Depends(get_current_user),
):
    """List saved practice questions for a course; defaults to latest generation cluster."""
    db = get_supabase_admin()

    active_generation_id = generation_id
    if not include_all and not active_generation_id:
        try:
            runs_query = db.table("question_generation_runs") \
                .select("id") \
                .eq("course_id", course_id) \
                .eq("user_id", user["id"]) \
                .order("created_at", desc=True)
            if question_type:
                runs_query = runs_query.eq("question_type", question_type)
            run_ids = [r.get("id") for r in (runs_query.execute().data or []) if r.get("id")]

            # Choose the newest run that actually has rows.
            for run_id in run_ids:
                check_query = db.table("question_banks") \
                    .select("id") \
                    .eq("course_id", course_id) \
                    .eq("user_id", user["id"]) \
                    .eq("source_type", "practice_generated") \
                    .eq("generation_run_id", run_id) \
                    .limit(1)
                if question_type:
                    check_query = check_query.eq("question_type", question_type)
                check = check_query.execute()
                if check.data:
                    active_generation_id = run_id
                    break
        except Exception as e:
            print(f"[practice_questions] run lookup fallback: {e}")

    try:
        query = db.table("question_banks") \
            .select("*") \
            .eq("course_id", course_id) \
            .eq("user_id", user["id"]) \
            .eq("source_type", "practice_generated")

        if question_type:
            query = query.eq("question_type", question_type)
        if active_generation_id:
            query = query.eq("generation_run_id", active_generation_id)

        result = query.order("created_at", desc=False).execute()
        rows = result.data or []

        # If no linked-run rows found, fallback to legacy unlinked generated rows.
        if not rows and not generation_id and not include_all:
            legacy_query = db.table("question_banks") \
                .select("*") \
                .eq("course_id", course_id) \
                .eq("user_id", user["id"])
            if question_type:
                legacy_query = legacy_query.eq("question_type", question_type)

            legacy_rows_all = legacy_query.order("created_at", desc=False).execute().data or []
            legacy_rows = [
                r for r in legacy_rows_all
                if not r.get("generation_run_id")
                and (
                    r.get("source_type") == "practice_generated"
                    or bool(r.get("is_prediction"))
                )
            ]
            if legacy_rows:
                return _group_practice_rows(legacy_rows)

        return _group_practice_rows(rows)
    except Exception:
        # source_type column may not exist yet; fall back to legacy marker.
        try:
            legacy_query = db.table("question_banks") \
                .select("*") \
                .eq("course_id", course_id) \
                .eq("user_id", user["id"]) \
                .eq("is_prediction", True)
            if question_type:
                legacy_query = legacy_query.eq("question_type", question_type)

            legacy_result = legacy_query.order("created_at", desc=False).execute()
            return _group_practice_rows(legacy_result.data or [])
        except Exception:
            return []


@router.get("/practice-generations/{course_id}")
async def list_practice_generations(
    course_id: str,
    question_type: Optional[str] = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """List generation clusters for practice questions in a course."""
    db = get_supabase_admin()
    try:
        query = db.table("question_generation_runs") \
            .select("id, generation_label, question_type, generated_sets_count, saved_rows_count, failed_rows_count, status, created_at, source") \
            .eq("course_id", course_id) \
            .eq("user_id", user["id"]) \
            .order("created_at", desc=True)
        if question_type:
            query = query.eq("question_type", question_type)
        result = query.execute()
        return result.data or []
    except Exception as e:
        print(f"[list_practice_generations] error: {e}")
        return []
@router.delete("/practice-questions/{course_id}/legacy")
async def delete_legacy_practice_questions(
    course_id: str,
    question_type: Optional[str] = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """Delete legacy generated practice rows that are not linked to a generation run."""
    db = get_supabase_admin()

    try:
        query = db.table("question_banks") \
            .select("id, generation_run_id, source_type, is_prediction, question_type") \
            .eq("course_id", course_id) \
            .eq("user_id", user["id"])

        if question_type:
            query = query.eq("question_type", question_type)

        result = query.execute()
        rows = result.data or []

        legacy_ids = []
        for row in rows:
            generation_run_id = row.get("generation_run_id")
            source_type = row.get("source_type")
            is_prediction = bool(row.get("is_prediction"))

            # Legacy means it is not attached to any generation cluster.
            if generation_run_id:
                continue

            # Keep this scoped to generated practice-like rows only.
            if source_type == "practice_generated" or is_prediction:
                legacy_ids.append(row.get("id"))

        legacy_ids = [row_id for row_id in legacy_ids if row_id]
        if not legacy_ids:
            return {"deleted_count": 0}

        chunk_size = 200
        deleted_count = 0
        for index in range(0, len(legacy_ids), chunk_size):
            chunk = legacy_ids[index:index + chunk_size]
            db.table("question_banks").delete().in_("id", chunk).execute()
            deleted_count += len(chunk)

        return {"deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete legacy practice questions: {e}")



@router.delete("/practice-generations/{generation_id}")
async def delete_practice_generation(
    generation_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Permanently delete a generation run and every question_banks row linked to it.
    Ownership is verified before any deletion occurs.
    """
    db = get_supabase_admin()

    # Verify the run belongs to this user
    run_check = (
        db.table("question_generation_runs")
        .select("id")
        .eq("id", generation_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not run_check.data:
        raise HTTPException(status_code=404, detail="Generation run not found")

    # Delete all question_banks rows linked to this run
    try:
        db.table("question_banks") \
            .delete() \
            .eq("generation_run_id", generation_id) \
            .eq("user_id", user["id"]) \
            .execute()
    except Exception as e:
        print(f"[delete_generation] question_banks cleanup error: {e}")

    # Delete the generation run record itself
    try:
        db.table("question_generation_runs") \
            .delete() \
            .eq("id", generation_id) \
            .eq("user_id", user["id"]) \
            .execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete generation run: {e}")

    return {"deleted": True, "generation_id": generation_id}
