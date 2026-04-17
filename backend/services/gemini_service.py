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


def _filter_supported_gemini_models(models: List[str]) -> List[str]:
    """Drop deprecated/invalid model ids that still appear in old env values."""
    blocked = {
        "gemini-1.5-flash",
    }
    filtered = [m for m in models if m not in blocked]
    return filtered or ["gemini-2.5-flash", "gemini-2.0-flash"]


CHAT_MODEL_CANDIDATES = _filter_supported_gemini_models(
    _parse_model_candidates(
        settings.GEMINI_CHAT_MODELS,
        "gemini-2.5-flash,gemini-2.0-flash",
    )
)

TASK_MODEL_CANDIDATES = _filter_supported_gemini_models(
    _parse_model_candidates(
        settings.GEMINI_TASK_MODELS,
        "gemini-2.5-flash,gemini-2.0-flash",
    )
)


BASE_SYSTEM_PROMPT = """You are Mentora, an academic AI study assistant for university students.

Core behavior:
- Be accurate, clear, and student-friendly.
- Teach first, do not just dump information.
- Prefer short, useful answers unless the student asked for more depth.
- Use the provided course material as the primary source when relevant.
- If the material is incomplete, clearly separate material-backed claims from general explanation.
- Never invent citations.

Material handling:
- Statements grounded in course material must include citations in this format: [Source: {doc_name}, Page {page_no}]
- If the material is insufficient, explicitly say so before adding general knowledge.
- Never mix cited and uncited claims in the same sentence.

Teaching style:
- Use simple wording first, then add depth only if needed.
- When helpful, include: direct answer, simple explanation, quick example, exam tip, or next-step questions.
- Keep formatting compact and scannable.
"""


def _build_language_instruction(language: str) -> str:
    if language == "bn":
        return "Respond in Bengali (বাংলা). Keep the wording natural and easy for students to follow."
    if language == "auto":
        return "Match the student's language. If mixed or unclear, prefer English."
    return "Respond in English. Use natural, student-friendly wording."


def _build_mode_instruction(response_mode: str, explanation_level: str, document_scope: bool) -> str:
    mode_map = {
        "learn": "Focus on teaching the concept clearly and interactively.",
        "summary": "Focus on compressing the important points into a useful study summary.",
        "exam": "Focus on exam-oriented explanation, likely important points, and what to remember.",
        "practice": "Focus on helping the student practice. Include up to 3 short practice questions or checks when useful.",
    }
    detail_map = {
        "simple": "Keep the answer brief and simple. Avoid unnecessary detail.",
        "balanced": "Give a balanced answer: clear core idea plus a small amount of supporting detail.",
        "deep": "Give a deeper explanation, but stay organized and avoid padding.",
    }
    scope_text = "The question is scoped to a single document." if document_scope else "The question may span broader course material."
    return "\n".join([
        mode_map.get(response_mode, mode_map["learn"]),
        detail_map.get(explanation_level, detail_map["balanced"]),
        scope_text,
    ])


def _build_response_contract(language: str, response_mode: str) -> str:
    if language == "bn":
        no_material = "এই বিষয়ে আপনার uploaded materials-এ যথেষ্ট তথ্য পাইনি।"
        general_label = "📘 সাধারণ ব্যাখ্যা"
        next_label = "Next steps"
    else:
        no_material = "I could not find enough support for this in your uploaded materials."
        general_label = "📘 General explanation"
        next_label = "Next steps"

    practice_line = "- If useful, end with up to 3 short practice questions." if response_mode == "practice" else ""

    return f"""
Response rules:
- Start with a direct answer.
- If useful, add a short section like Simple explanation, Key points, Exam focus, or Quick example.
- If the material is insufficient, say exactly: {no_material}
- Then add a clearly labeled section: {general_label}
- End with a short {next_label} section containing 2 or 3 actionable follow-up ideas.
- Keep the full answer concise unless the student explicitly asks for detail.
{practice_line}
""".strip()


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
                "options": part.get("options") or None,  # preserve MCQ options
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
    groq_max_tokens: Optional[int] = None,
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
                max_tokens=max(256, min(int(groq_max_tokens), 4096)) if groq_max_tokens else 4096,
            )
        except Exception as groq_error:
            last_error = groq_error

    raise Exception(f"All Gemini/Groq models failed. Last error: {last_error}")


async def generate_chat_response(
    question: str,
    context_chunks: List[dict],
    conversation_history: List[dict] = None,
    language: str = "en",
    response_mode: str = "learn",
    explanation_level: str = "balanced",
    document_scope: bool = False,
) -> str:
    """Generate a RAG-powered response using Gemini."""
    context = build_context(context_chunks)
    history = build_conversation_history(conversation_history or [])
    system_prompt = "\n\n".join([
        BASE_SYSTEM_PROMPT,
        _build_language_instruction(language),
        _build_mode_instruction(response_mode, explanation_level, document_scope),
        _build_response_contract(language, response_mode),
    ])

    prompt = f"""{system_prompt}

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
            system_prompt=system_prompt,
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

    def _is_payload_too_large_error(err: Exception) -> bool:
        text = str(err).lower()
        return (
            "request too large" in text
            or "413" in text
            or "tokens per minute" in text
            or ("requested" in text and "limit" in text)
        )

    def _build_practice_prompt(
        content_limit: int,
        repeat_limit: int,
        high_prob_limit: int,
        hot_topics_limit: int,
    ) -> str:
        repeat_topics_str = "\n".join(
            f"  - {t['topic']}: appeared {t['frequency']} times (marks: {t.get('typical_marks', '?')})"
            for t in (repeat_topics or [])[:repeat_limit]
        ) or "  (not yet analyzed — use course content topics)"

        hot_topics_str = (
            "\n".join(f"  - {t}" for t in hot_topics[:hot_topics_limit])
            if hot_topics else "  (none provided — rely on repeat topics and course content)"
        )

        high_prob_str = ", ".join(high_prob[:high_prob_limit]) if high_prob else "refer to repeat topics above"

        if question_type == "mcq":
            return f"""You are a university MCQ exam question generator for the course: "{course_name}".

PAST PAPER ANALYSIS:
- Repeat topics (high-frequency in past exams):
{repeat_topics_str}
- Teacher hot topics (HIGHEST priority — must include):
{hot_topics_str}
- High probability topics: {high_prob_str}

COURSE CONTENT (use for accuracy of options and answers):
---
{course_content[:content_limit]}
---

TASK: Generate exactly {count} university-level MCQ questions.

STRICT REQUIREMENTS:
1. Each question must be a standalone MCQ with EXACTLY 4 options (A, B, C, D)
2. Questions test UNDERSTANDING — ask about applications, comparisons, mechanisms, formulas (NOT trivial recall)
3. All 4 options must be academically plausible; only ONE is clearly correct
4. Questions must match university final exam difficulty
5. Cover REPEAT TOPICS and HOT TOPICS with highest priority
6. "question" field: clear, specific question ending with "?"
7. "options" field: array of exactly 4 strings [ "A. ...", "B. ...", "C. ...", "D. ..." ]
8. "answer" field: FULL TEXT of the correct option (e.g. "B. The gradient descent algorithm")
9. Each question is 1 mark; wrap it in a single-item "parts" array

Return ONLY a raw JSON array with no markdown, no code block, no text before or after:
[
  {{
    "set_number": 1,
    "probability": "high",
    "topic": "specific topic name",
    "parts": [
      {{
        "label": "Q1",
        "question": "Which of the following best describes the role of a loss function in supervised learning?",
        "options": ["A. It selects the model architecture", "B. It measures the difference between predictions and actual values", "C. It initializes the model weights", "D. It defines the number of training epochs"],
        "answer": "B. It measures the difference between predictions and actual values",
        "marks": 1
      }}
    ]
  }}
]"""

        # broad / short
        if question_type == "short":
            verb_guide = (
                "short-answer questions (2–5 marks each). "
                "Use action verbs: Define, State, List, Differentiate, Briefly explain."
            )
            parts_guide = "1–2 sub-parts per set, 2–5 marks each. Keep answers concise (2–4 lines)."
            marks_per_set = "5–8 marks per set"
        else:  # broad
            verb_guide = (
                "broad/essay questions with 2–3 sub-parts (a, b, c) that mirror real exam style. "
                "Use application verbs: Explain & Apply, Derive, Calculate, Compare & Contrast, "
                "Illustrate with example, Design, Analyze, Justify, Discuss."
            )
            parts_guide = (
                "2–3 sub-parts per set (a, b, c). Each sub-part must use a DIFFERENT action verb "
                "and test a different depth (e.g., a=explain concept, b=apply to example, c=derive/compare)."
            )
            marks_per_set = f"{exam_format.get('marks_distribution', '~12 marks per set')}"

        return f"""You are an expert university exam question generator for the course: "{course_name}".

REAL EXAM FORMAT (from past paper analysis):
- Total marks: {exam_format.get('total_marks', 72)}, Sets: {exam_format.get('total_sets', 8)}, Answer any: {exam_format.get('answer_required', 6)}
- Time: {exam_format.get('time_hours', 3)} hours | Sub-part style: {exam_format.get('sub_question_style', 'a/b/c')}
- Marks per set: {marks_per_set}
- Sample questions from REAL past paper: {sample_format}

REPEAT TOPICS from past papers (MUST appear — these are exam favorites):
{repeat_topics_str}

TEACHER HOT TOPICS (HIGHEST PRIORITY — emphasize these above all):
{hot_topics_str}

HIGH PROBABILITY TOPICS: {high_prob_str}

COURSE CONTENT (for factual grounding and specific scenarios):
---
{course_content[:content_limit]}
---

TASK: Generate exactly {count} {verb_guide}

CRITICAL QUALITY RULES (read carefully before generating):
1. NEVER write generic "What is X?" or "Define X" as the only question — add application context
2. Use SPECIFIC scenarios: "Consider a graph G with nodes...", "Given dataset with features X1, X2...", 
   "A company needs to predict...", "Apply DFS/BFS on the following example..."
3. Sub-parts MUST build progressively: (a) understand the concept → (b) apply to a scenario → (c) analyze/compare/derive
4. Include computational/algorithmic steps where relevant (trace an algorithm, calculate values, draw a graph)
5. {parts_guide}
6. PRIORITY ORDER: hot topics > repeat topics > high probability topics > general course topics
7. Include ALL hot topics if possible — these are emphasized by the teacher
8. "answer" field: write a complete model answer (3–6 sentences or steps) that a student should reproduce
9. "probability": "high" if topic is BOTH a repeat topic AND a hot topic, "medium" if repeat OR hot, "low" otherwise

Return ONLY a raw JSON array with no markdown, no code block, no text before or after:
[
  {{
    "set_number": 1,
    "probability": "high",
    "topic": "specific topic name from repeat/hot topics",
    "parts": [
      {{
        "label": "a",
        "question": "Explain [concept] and describe how it is applied in [specific context from course].",
        "answer": "Model answer with key points a student must cover (3–6 sentences).",
        "marks": 4
      }},
      {{
        "label": "b",
        "question": "Apply [algorithm/method] to the following example: [specific scenario]. Show each step.",
        "answer": "Step-by-step model answer showing the working.",
        "marks": 5
      }},
      {{
        "label": "c",
        "question": "Compare [X] and [Y] in terms of [specific criteria]. Which is more suitable for [scenario] and why?",
        "answer": "Comparison with justification covering the criteria mentioned.",
        "marks": 3
      }}
    ]
  }}
]"""
        
    prompt = _build_practice_prompt(
        content_limit=8000,
        repeat_limit=20,
        high_prob_limit=10,
        hot_topics_limit=20,
    )

    try:
        raw = _generate_with_fallback(
            prompt,
            TASK_MODEL_CANDIDATES,
            groq_model_candidates=GROQ_TASK_MODEL_CANDIDATES,
            groq_max_tokens=4096,
        )
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
        except Exception as parse_err:
            # Inner parse failed — log it and return raw so the router's
            # _parse_practice_json can attempt its own multi-strategy parse.
            print(f"[generate_practice_from_analysis] inner JSON parse failed: {parse_err}")
            print(f"[generate_practice_from_analysis] raw output (first 500 chars): {raw[:500]}")
            return raw
    except Exception as e:
        if _is_payload_too_large_error(e):
            try:
                compact_prompt = _build_practice_prompt(
                    content_limit=2600,
                    repeat_limit=10,
                    high_prob_limit=6,
                    hot_topics_limit=8,
                )
                raw = _generate_with_fallback(
                    compact_prompt,
                    TASK_MODEL_CANDIDATES,
                    groq_model_candidates=GROQ_TASK_MODEL_CANDIDATES,
                    groq_max_tokens=4096,
                )

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
            except Exception as e2:
                print(f"Practice generation compact-retry error: {e2}")

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

