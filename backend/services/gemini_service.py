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


BASE_SYSTEM_PROMPT = """You are Mentora, an academic AI tutor for university students. Think and respond like a knowledgeable professor, not a search engine.

Core teaching principles:
- Answer the student's question directly and completely. Never leave a student without a full, useful answer.
- Use the provided course material as your primary source. Where course material covers the topic, teach from it.
- Where the course material is sparse or silent on a detail, fill in naturally from your academic knowledge — this is what professors do. Do NOT announce the gap.
- Never invent citations. Only use [Source: doc_name, Page X] for content that is literally present in the provided course material chunks.
- Uncited sentences are implicitly from general academic knowledge — this is normal and expected, no disclaimer needed.

Response quality:
- Give a complete, coherent answer in one single flow.
- Use simple wording first, then add depth if the question warrants it.
- Be concrete: real examples, clear analogies, exam-relevant details.
- Stay focused. Do not pad with generic encouragement or filler.

Format:
- Keep it compact and scannable. Use short paragraphs or bullets where they genuinely help.
- Do not add boilerplate sections unless they add real value for this specific question.

STRICTLY FORBIDDEN — never output any of the following:
- "I could not find enough support" or any variation
- "I couldn't find" / "not found in your materials" / "not mentioned in the materials"
- "📘 General explanation" or any section header that separates course content from general knowledge
- "The materials do not contain" / "your uploaded materials don't cover"
- Any sentence that tells the student what is missing from the course material
- "Next steps:" as a boilerplate closing section — only suggest follow-ups if they are genuinely useful for this specific question
"""


def _build_language_instruction(language: str) -> str:
    if language == "bn":
        return "Respond in Bengali (বাংলা). Keep the wording natural and easy for students to follow."
    if language == "auto":
        return "Match the student's language. If mixed or unclear, prefer English."
    return "Respond in English. Use natural, student-friendly wording."


def _build_mode_instruction(response_mode: str, explanation_level: str, document_scope: bool) -> str:
    # Each combination should produce a noticeably different response style and length.

    level_contracts = {
        "simple": (
            "DEPTH: Simple / beginner. "
            "Use plain everyday language — no jargon, no formulas unless essential. "
            "Maximum 120 words. One idea at a time. Think: explain to a first-year student who has never seen this before. "
            "End with one very short sentence that ties it together."
        ),
        "balanced": (
            "DEPTH: Balanced. "
            "Core concept in plain language + one concrete example or analogy. "
            "150–250 words. Include a citation from course material if present. "
            "Do not over-explain — stop when the key idea is clear."
        ),
        "deep": (
            "DEPTH: Deep / detailed. "
            "Full explanation: define the concept precisely, explain how and why it works, show the mechanism or math if relevant, "
            "give a worked example, and connect it to a broader context (e.g., why it matters in this course or field). "
            "300–500 words. Use headers or bullets if the answer has multiple distinct parts. "
            "This student wants to fully understand, not just skim."
        ),
    }

    mode_contracts = {
        "learn": (
            "MODE: Explain / Teach. Build understanding from the ground up. "
            "Start with the core idea, then add layers. Prioritize clarity and intuition over completeness."
        ),
        "summary": (
            "MODE: Summary. Compress into the most important points only. "
            "Use a tight bullet list: key terms, key ideas, key relationships. "
            "Strip all filler — every bullet must be exam-worthy."
        ),
        "exam": (
            "MODE: Exam prep. Frame everything from an examiner's perspective. "
            "State what is most likely to be tested, give a clean model answer a student could write in an exam, "
            "and flag 1–2 common mistakes. Use the course material's exact terminology."
        ),
        "assignment": (
            "MODE: Assignment help. Clarify the concept, suggest how to structure an answer or section, "
            "and point to the most relevant course material as evidence."
        ),
        "practice": (
            "MODE: Practice. Give a brief explanation first, then end with 2–3 short practice questions "
            "of increasing difficulty. Do not give answers — let the student try."
        ),
    }

    scope_note = "Scoped to one document." if document_scope else "May draw across course materials."

    return "\n".join([
        level_contracts.get(explanation_level, level_contracts["balanced"]),
        mode_contracts.get(response_mode, mode_contracts["learn"]),
        scope_note,
    ])


def _build_response_contract(language: str, response_mode: str) -> str:
    lang_note = (
        "Respond in Bengali (বাংলা)." if language == "bn"
        else "Respond in English."
    )

    mode_notes = {
        "learn": "Teach the concept step by step. Use a concrete example if it helps understanding.",
        "summary": "Give a tight, exam-ready summary: key definitions, key points, nothing extra.",
        "exam": "Focus on what examiners test. Highlight likely questions, marks-worthy points, and common mistakes.",
        "assignment": "Help structure the student's thinking: clarify the topic, suggest an outline, and point to relevant course content.",
        "practice": "After answering, include 2–3 short practice questions at the end to check understanding.",
    }

    return f"""
Response contract:
- {lang_note}
- {mode_notes.get(response_mode, mode_notes['learn'])}
- Give one complete, flowing answer. Do not split into 'from material' vs 'from general knowledge' sections.
- Cite course material inline where it applies: [Source: doc_name, Page X]. Everything else needs no label.
- Only suggest follow-up questions or next steps if they are genuinely useful for THIS specific question — not as a boilerplate ending.
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
    no_material: bool = False,
) -> str:
    """Generate a RAG-powered response using Gemini."""
    context = build_context(context_chunks)
    history = build_conversation_history(conversation_history or [])

    # When no course material was found, block citation fabrication but still give a full answer.
    if no_material or not context_chunks:
        no_material_block = (
            "\nIMPORTANT: No course material was retrieved. "
            "You MUST NOT fabricate any [Source: ...] citation. "
            "Teach from general academic knowledge as a professor would — give a complete, useful answer without mentioning the absence of material.\n"
        )
    else:
        no_material_block = ""

    system_prompt = "\n\n".join([
        BASE_SYSTEM_PROMPT,
        _build_language_instruction(language),
        _build_mode_instruction(response_mode, explanation_level, document_scope),
        _build_response_contract(language, response_mode),
    ])

    context_section = (
        f"CONTEXT FROM COURSE MATERIALS:\n---\n{context}\n---"
        if context_chunks
        else "CONTEXT FROM COURSE MATERIALS:\n--- (none) ---"
    )

    prompt = f"""{system_prompt}{no_material_block}

{context_section}

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

