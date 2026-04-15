from google import genai
from typing import List, Optional
from core.config import get_settings
from services.groq_service import (
    generate_groq_completion,
    GROQ_CHAT_MODEL_CANDIDATES,
    GROQ_TASK_MODEL_CANDIDATES,
)
import time

settings = get_settings()
client = genai.Client(api_key=settings.GOOGLE_API_KEY)


def _parse_model_candidates(raw: str, default_csv: str) -> List[str]:
    source = raw or default_csv
    models = [m.strip() for m in source.split(",") if m.strip()]
    return models or [m.strip() for m in default_csv.split(",") if m.strip()]


CHAT_MODEL_CANDIDATES = _parse_model_candidates(
    settings.GEMINI_CHAT_MODELS,
    "gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash",
)

TASK_MODEL_CANDIDATES = _parse_model_candidates(
    settings.GEMINI_TASK_MODELS,
    "gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash",
)


SYSTEM_PROMPT = """You are an academic AI assistant for university students named Mentora.
DEFAULT LANGUAGE:
- Always respond in Bengali (বাংলা) by default.
- Only switch to another language if the student explicitly requests it.

Your PRIMARY knowledge source is the provided course material context below.
RESPONSE STRATEGY — follow in order:
STEP 1 — CHECK COURSE MATERIAL:
Search the provided context for a relevant answer.
STEP 2 — DECIDE RESPONSE MODE:
Use one of three modes based on what you find:

MODE A — "FULLY COVERED":
The context contains a clear, sufficient answer.
→ Answer entirely from context. Cite every statement.

MODE B — "PARTIALLY COVERED":
The context has some relevant info but is incomplete,
or the student asked for a deeper explanation.
→ Start with what the course material says (with citations).
→ Then add a clearly labeled section:
"📘 Additional Explanation (General Knowledge):"
→ Provide the deeper explanation from your own knowledge.
→ Make clear this part is NOT from their uploaded material.

MODE C — "NOT IN MATERIAL":
The context has nothing relevant.
→ Say: 'এই টপিকটি আপনার uploaded materials-এ পাওয়া যায়নি।'
→ Then offer: 'তবে আমি এটি সাধারণ জ্ঞান থেকে ব্যাখ্যা করতে পারি:'
→ Provide a full explanation from general knowledge.
→ Remind the student to verify with their actual course notes.

FORMATTING RULES:
1. Course material content → always cite: [Source: {doc_name}, Page {page_no}]
2. General knowledge content → label with 📘 and NO citation
3. Never mix cited and uncited content in the same sentence
4. Structure with clear headings and bullet points
5. End every response with a "Sources" section:
   📄 From your materials: [list cited docs]
   📘 From general knowledge: [yes/no, brief note]
"""


def build_context(chunks: List[dict]) -> str:
    """Build context string from retrieved chunks."""
    context_parts = []
    for chunk in chunks:
        source_info = f"[Source: {chunk.get('doc_name', 'Unknown')}, Page {chunk.get('page_number', '?')}]"
        if chunk.get("section_title"):
            source_info = f"[Source: {chunk.get('doc_name', 'Unknown')}, Page {chunk.get('page_number', '?')}, Section: {chunk['section_title']}]"
        context_parts.append(f"{chunk['content']} {source_info}")
    return "\n---\n".join(context_parts)


def build_conversation_history(messages: List[dict], limit: int = 5) -> str:
    """Build conversation history string from recent messages."""
    recent = messages[-limit:] if len(messages) > limit else messages
    history_parts = []
    for msg in recent:
        role = "Student" if msg["role"] == "user" else "Assistant"
        history_parts.append(f"{role}: {msg['content'][:500]}")
    return "\n".join(history_parts)


def _is_retryable_error(error: Exception) -> bool:
    msg = str(error).upper()
    retry_tokens = [
        "429",
        "RESOURCE_EXHAUSTED",
        "RATE_LIMIT",
        "UNAVAILABLE",
        "TIMEOUT",
        "DEADLINE_EXCEEDED",
        "INTERNAL",
        "500",
        "503",
    ]
    return any(token in msg for token in retry_tokens)


def _extract_target_set_marks(pattern_data: dict, question_type: str) -> int:
    exam_format = pattern_data.get("exam_format", {}) if isinstance(pattern_data, dict) else {}
    total_marks = exam_format.get("total_marks")
    answer_required = exam_format.get("answer_required")

    def _to_int(value):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        text = str(value)
        import re
        match = re.search(r"(\d+)", text)
        if not match:
            return None
        try:
            return int(match.group(1))
        except Exception:
            return None

    total_marks = _to_int(total_marks)
    answer_required = _to_int(answer_required)

    if question_type == "mcq":
        return 1

    marks_distribution = exam_format.get("marks_distribution")
    marks_distribution_text = str(marks_distribution or "")

    import re

    # Handles strings like "each set 12 marks" or "12 marks per question"
    each_match = re.search(r"(\d+)\s*marks?\s*(each|per)", marks_distribution_text, re.IGNORECASE)
    if each_match:
        try:
            return max(1, int(each_match.group(1)))
        except Exception:
            pass

    if total_marks and answer_required and answer_required > 0:
        return max(1, round(total_marks / answer_required))

    # Try deriving from the first set's explicit sub-part marks from format text.
    first_set_text = marks_distribution_text
    if first_set_text:
        split = re.split(r"\n\s*2[\.)]", first_set_text, maxsplit=1)
        first_set_text = split[0] if split else first_set_text
        marks = [int(m) for m in re.findall(r"\[(\d+)\]", first_set_text)]
        if marks:
            return max(1, sum(marks))

    sample_format = str(pattern_data.get("sample_question_format", "")) if isinstance(pattern_data, dict) else ""
    first_sample_set = re.split(r"\n\s*2[\.)]", sample_format, maxsplit=1)[0] if sample_format else ""
    matches = re.findall(r"\[(\d+)\]", first_sample_set or sample_format)
    if matches:
        try:
            return max(1, sum(int(m) for m in matches))
        except Exception:
            pass

    return 10 if question_type == "short" else 15


def _normalize_practice_sets(questions_list: list, pattern_data: dict, question_type: str) -> list:
    if not isinstance(questions_list, list):
        return []

    target_set_marks = _extract_target_set_marks(pattern_data, question_type)
    normalized_sets = []

    for index, item in enumerate(questions_list, start=1):
        if not isinstance(item, dict):
            continue

        parts = item.get("parts") or []
        if not isinstance(parts, list) or not parts:
            parts = [{"label": "a", "question": str(item.get("question", item.get("question_text", ""))), "marks": target_set_marks}]

        weights = []
        for part in parts:
            try:
                weights.append(max(1, int(part.get("marks") or 1)))
            except Exception:
                weights.append(1)

        weight_total = sum(weights) or len(parts) or 1
        allocated = []
        remaining = target_set_marks

        for part_index, part in enumerate(parts):
            if part_index == len(parts) - 1:
                mark_value = max(1, remaining)
            else:
                mark_value = max(1, round(target_set_marks * weights[part_index] / weight_total))
                remaining -= mark_value

            allocated.append({
                "label": part.get("label") or part.get("part_label") or chr(97 + part_index),
                "question": part.get("question") or part.get("question_text") or "",
                "answer": part.get("answer", ""),
                "marks": mark_value,
            })

        normalized_sets.append({
            "set_number": item.get("set_number") or index,
            "probability": item.get("probability", "medium"),
            "topic": item.get("topic", ""),
            "parts": allocated,
        })

    return normalized_sets


def _generate_with_fallback(
    prompt: str,
    model_candidates: List[str],
    groq_model_candidates: Optional[List[str]] = None,
    system_prompt: Optional[str] = None,
) -> str:
    """Generate with retries and multi-model failover to avoid single-point failure."""
    retries_per_model = max(1, settings.GEMINI_MAX_RETRIES_PER_MODEL)
    base_wait = max(0.5, settings.GEMINI_RETRY_BASE_SECONDS)
    last_error: Optional[Exception] = None

    for model_name in model_candidates:
        for attempt in range(retries_per_model):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = getattr(response, "text", None)
                if response_text and response_text.strip():
                    return response_text.strip()
                raise ValueError(f"Model {model_name} returned an empty response")
            except Exception as err:
                last_error = err
                can_retry = _is_retryable_error(err)
                is_last_attempt = attempt >= retries_per_model - 1

                if can_retry and not is_last_attempt:
                    wait_time = base_wait * (2 ** attempt)
                    print(
                        f"Gemini retry on {model_name} in {wait_time:.1f}s "
                        f"(attempt {attempt + 1}/{retries_per_model})"
                    )
                    time.sleep(wait_time)
                    continue

                print(f"Gemini model {model_name} failed: {err}")
                break

    if settings.GROQ_API_KEY:
        try:
            return generate_groq_completion(
                prompt=prompt,
                model_candidates=groq_model_candidates or GROQ_TASK_MODEL_CANDIDATES,
                system_prompt=system_prompt,
            )
        except Exception as groq_error:
            last_error = groq_error

    raise Exception(f"All Gemini/Groq models failed. Last error: {last_error}")


async def generate_chat_response(
    question: str,
    context_chunks: List[dict],
    conversation_history: List[dict] = None,
) -> str:
    """Generate a RAG-powered response using Gemini."""
    context = build_context(context_chunks)
    history = build_conversation_history(conversation_history or [])

    prompt = f"""{SYSTEM_PROMPT}

CONTEXT FROM COURSE MATERIALS:
---
{context}
---

CONVERSATION HISTORY:
{history}

STUDENT'S QUESTION: {question}"""

    try:
        return _generate_with_fallback(
            prompt,
            CHAT_MODEL_CANDIDATES,
            groq_model_candidates=GROQ_CHAT_MODEL_CANDIDATES,
            system_prompt=SYSTEM_PROMPT,
        )
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return "Sorry, I'm currently experiencing technical difficulties connecting to the AI. Please try again in a moment."


async def generate_summary(text: str, summary_type: str = "full", language: str = "bn") -> str:
    """Generate a document summary."""
    lang_instruction = "Respond in English." if language == "en" else "Respond in Bengali (বাংলা)."

    if summary_type == "key_points":
        prompt = f"""Extract the key points from the following academic content as a bullet-point list.
{lang_instruction}

Content:
{text[:15000]}"""
    else:
        prompt = f"""Provide a comprehensive summary of the following academic content.
Include main topics, key concepts, and important details.
{lang_instruction}

Content:
{text[:15000]}"""

    try:
        return _generate_with_fallback(prompt, TASK_MODEL_CANDIDATES, groq_model_candidates=GROQ_TASK_MODEL_CANDIDATES)
    except Exception as e:
        print(f"Summary generation error: {e}")
        return "Failed to generate summary. Please try again."


async def generate_questions(
    text: str,
    question_type: str = "mcq",
    difficulty: str = "medium",
    count: int = 5,
) -> str:
    """Generate questions from document content."""
    type_instruction = {
        "mcq": "Generate multiple-choice questions with 4 options (A, B, C, D) and mark the correct answer.",
        "short": "Generate short-answer questions.",
        "broad": "Generate broad/essay-type questions.",
    }.get(question_type, "Generate questions.")

    prompt = f"""You are an academic question generator.
{type_instruction}
Difficulty level: {difficulty}
Generate exactly {count} questions.

Format each question as JSON:
{{
    "question_text": "...",
    "answer_text": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  // only for MCQ
    "source_page": null
}}

Return a JSON array of questions.

Content:
{text[:15000]}"""

    try:
        return _generate_with_fallback(prompt, TASK_MODEL_CANDIDATES, groq_model_candidates=GROQ_TASK_MODEL_CANDIDATES)
    except Exception as e:
        print(f"Question generation error: {e}")
        return "[]"


async def generate_practice_from_analysis(
    pattern_data: dict,
    hot_topics: List[str],
    course_content: str,
    course_name: str,
    count: int = 10,
    question_type: str = "broad",
) -> str:
    """
    Generate exam-style practice questions that mirror the real paper format.
    Uses the analyzed question pattern, teacher's hot topics, and RAG course content.
    """
    exam_format = pattern_data.get("exam_format", {})
    repeat_topics = pattern_data.get("repeat_topics", [])
    high_prob = pattern_data.get("high_probability_topics", [])
    sample_format = pattern_data.get("sample_question_format", "")

    repeat_topics_str = "\n".join(
        f"  - {t['topic']}: appeared {t['frequency']} times (marks: {t.get('typical_marks', '?')})"
        for t in repeat_topics[:20]
    )
    hot_topics_str = "\n".join(f"  - {t}" for t in hot_topics) if hot_topics else "  (none provided)"

    type_instruction = {
        "broad": "broad/essay-type questions with sub-parts (a, b, c) matching the real exam style",
        "short": "short-answer questions (2-4 marks each)",
        "mcq": "multiple-choice questions with 4 options (A, B, C, D) and mark the correct answer",
    }.get(question_type, "broad/essay-type questions")

    prompt = f"""You are an expert exam question generator for the course: "{course_name}".

REAL EXAM FORMAT (from past paper analysis):
- Total marks: {exam_format.get('total_marks', 72)}
- Total question sets: {exam_format.get('total_sets', 8)}, answer any {exam_format.get('answer_required', 6)}
- Time: {exam_format.get('time_hours', 3)} hours
- Sub-question style: {exam_format.get('sub_question_style', 'a/b/c')}
- Marks distribution: {exam_format.get('marks_distribution', 'varies')}
- Sample format from real paper: {sample_format}

REPEAT TOPICS (appeared in past papers — HIGH PRIORITY):
{repeat_topics_str}

HOT TOPICS (emphasized by teacher — HIGH PRIORITY):
{hot_topics_str}

HIGH PROBABILITY TOPICS: {', '.join(high_prob[:10]) if high_prob else 'see repeat topics'}

COURSE CONTENT CONTEXT (for factual accuracy):
---
{course_content[:8000]}
---

TASK:
Generate exactly {count} practice question SETS in {type_instruction}.

CRITICAL RULES:
1. EXACTLY mirror the real exam format — use the same set structure, sub-parts, and marks notation
2. Prioritize repeat topics and hot topics for question content
3. Each set should have 2-3 sub-parts (a, b, c) with marks like the real paper
4. Include a "probability" field: "high" (repeat + hot topic), "medium" (repeat OR hot), "low" (general)
5. Include a "topic" field for each set

Return ONLY a JSON array — no markdown, no explanation:
[
  {{
    "set_number": 1,
    "probability": "high",
    "topic": "main topic",
    "parts": [
      {{
        "label": "a",
        "question": "question text",
        "marks": 3,
        "type": "{question_type}"
      }},
      {{
        "label": "b",
        "question": "question text",
        "marks": 5,
        "type": "{question_type}"
      }}
    ]
  }}
]"""

    try:
        raw = _generate_with_fallback(prompt, TASK_MODEL_CANDIDATES, groq_model_candidates=GROQ_TASK_MODEL_CANDIDATES)
        try:
            import json
            target_count = max(1, int(count or 10))
            cleaned = raw
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0]
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0]
            questions_list = json.loads(cleaned.strip())
            normalized = _normalize_practice_sets(questions_list, pattern_data, question_type)
            return json.dumps(normalized[:target_count])
        except Exception:
            return raw
    except Exception as e:
        print(f"Practice generation error: {e}")
        return "[]"


async def predict_exam_questions(texts: List[str], course_name: str) -> str:
    """Predict exam questions based on previous year papers and course material."""
    combined = "\n\n---\n\n".join([t[:5000] for t in texts])

    prompt = f"""You are an academic exam prediction AI for the course: {course_name}.
Analyze the following previous year question papers and course materials.
Identify patterns, frequently asked topics, and predict the most likely questions for the next exam.

Generate 10 predicted questions with:
- Question text
- Predicted probability (High/Medium/Low)
- Related topic
- Reasoning for prediction

Format as JSON array.

Materials:
{combined}"""

    try:
        return _generate_with_fallback(prompt, TASK_MODEL_CANDIDATES, groq_model_candidates=GROQ_TASK_MODEL_CANDIDATES)
    except Exception as e:
        print(f"Exam prediction error: {e}")
        return "[]"

