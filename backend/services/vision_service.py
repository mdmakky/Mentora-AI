"""
vision_service.py
-----------------
Renders scanned PDF pages as PNG images (via PyMuPDF) and sends them
to the Gemini vision/multimodal API for structured question-paper analysis.

Key design decisions:
  - Max MAX_PAGES_PER_PAPER pages per document to stay within free-tier limits.
  - Pages rendered at 150 DPI (good quality vs. token cost balance).
  - Returns a structured dict with pattern info, repeat topics, and extracted questions.
"""

import io
import json
import time
import re
from typing import List, Any

import fitz  # PyMuPDF
from google import genai
from google.genai import types as genai_types

from core.config import get_settings
from services.groq_service import (
    generate_groq_completion,
    GROQ_VISION_MODEL_CANDIDATES,
    GROQ_TASK_MODEL_CANDIDATES,
)

settings = get_settings()
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

# Vision model — multimodal, free-tier friendly
VISION_MODEL = "gemini-2.0-flash"

# Hard cap: max pages per paper to keep within rate limits
MAX_PAGES_PER_PAPER = 10

# Resolution for image rendering (DPI)
RENDER_DPI = 150


def render_pdf_pages_as_images(file_bytes: bytes) -> List[bytes]:
    """
    Render each page of a PDF as a PNG image (bytes).
    Caps at MAX_PAGES_PER_PAPER pages.
    Returns a list of PNG byte strings.
    """
    images: List[bytes] = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = min(len(doc), MAX_PAGES_PER_PAPER)

        mat = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)  # scale from 72 DPI

        for page_index in range(page_count):
            page = doc[page_index]
            pixmap = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            png_bytes = pixmap.tobytes("png")
            images.append(png_bytes)

        doc.close()
    except Exception as e:
        print(f"[vision_service] PDF render error: {e}")

    return images


def _build_vision_prompt(course_name: str, paper_index: int, total_papers: int) -> str:
    return f"""You are an academic exam-pattern analyzer for the course: "{course_name}".
This is past question paper {paper_index} of {total_papers}.

Analyze ALL pages of this question paper carefully. Pay special attention to:
- Tables, boxes, and formatted structures
- Marks distribution per question (numbers in right margin)
- Question numbering style (1a, 1b, Q1, Set-1, etc.)
- Instructions at the top (e.g., "Answer any 6 of 8 sets")
- Sub-question structure (a, b, c parts)

Return a JSON object with this EXACT structure (no markdown, just raw JSON):
{{
  "detected_subject": "the actual academic subject/discipline of this paper e.g. Chemistry, Mathematics, Computer Science",
  "paper_title": "short title or exam session e.g. Final Exam 2023",
  "total_marks": 72,
  "total_questions": 8,
  "answer_required": 6,
  "time_hours": 3.0,
  "question_format": "short description of format e.g. 8 sets, answer any 6, sub-parts a/b/c",
  "marks_per_part": {{
    "typical_short": 3,
    "typical_long": 5
  }},
  "question_types_seen": ["theoretical", "numerical", "diagram", "proof"],
  "extracted_questions": [
    {{
      "set_number": 1,
      "parts": [
        {{
          "part_label": "a",
          "question_text": "exact or close paraphrase of the question",
          "marks": 3,
          "topic": "topic keyword e.g. SQL Injection",
          "type": "theoretical"
        }}
      ]
    }}
  ]
}}

Return ONLY the JSON. No explanation, no markdown fences."""


PATTERN_ANALYSIS_SYSTEM = """You are an expert exam-pattern-analysis AI. You receive structured question data from multiple past papers for the same course. Synthesize them into a single comprehensive analysis."""

PATTERN_MERGE_PROMPT = """Below is structured JSON data extracted from {n} past question papers for the course "{course_name}".

Paper data:
{papers_json}

Analyze and return a SINGLE merged JSON with this EXACT structure (no markdown):
{{
  "course_name": "{course_name}",
  "papers_analyzed": {n},
  "exam_format": {{
    "total_marks": 72,
    "total_sets": 8,
    "answer_required": 6,
    "time_hours": 3.0,
    "sub_question_style": "a/b/c",
    "marks_distribution": "description"
  }},
  "repeat_topics": [
    {{
      "topic": "topic name",
      "frequency": 3,
      "years_appeared": ["2021", "2022", "2023"],
      "typical_marks": 5,
      "typical_type": "theoretical"
    }}
  ],
  "question_type_breakdown": {{
    "theoretical": 60,
    "numerical": 25,
    "diagram": 10,
    "proof": 5
  }},
  "high_probability_topics": ["topic1", "topic2"],
  "sample_question_format": "1. a) <short question> [3]\\n   b) <long question> [5]"
}}"""

MERGE_INPUT_MAX_CHARS = 8000
MERGE_INPUT_MAX_CHARS_ULTRA = 4200


def _clean_model_json_text(raw: str) -> str:
    text = (raw or "").strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()
    return text


def _try_parse_json(raw: str):
    """Parse model output with defensive cleanup for common invalid escapes."""
    text = _clean_model_json_text(raw)
    if not text:
        raise ValueError("Empty model response")

    candidates = [text]

    array_start = text.find("[")
    array_end = text.rfind("]")
    if array_start != -1 and array_end > array_start:
        candidates.append(text[array_start:array_end + 1])

    obj_start = text.find("{")
    obj_end = text.rfind("}")
    if obj_start != -1 and obj_end > obj_start:
        candidates.append(text[obj_start:obj_end + 1])

    decoder = json.JSONDecoder()
    last_error = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception as err:
            last_error = err

        # Accept responses that contain valid JSON followed by extra text.
        try:
            parsed, _ = decoder.raw_decode(candidate)
            return parsed
        except Exception as err:
            last_error = err

        # Escape stray backslashes (e.g. \- \_ \* ) that break strict JSON parsing
        try:
            normalized = re.sub(r"\\(?![\"\\/bfnrtu])", r"\\\\", candidate)
            return json.loads(normalized)
        except Exception as err:
            last_error = err

        # Retry first-value decode after normalizing invalid escapes.
        try:
            normalized = re.sub(r"\\(?![\"\\/bfnrtu])", r"\\\\", candidate)
            parsed, _ = decoder.raw_decode(normalized)
            return parsed
        except Exception as err:
            last_error = err

    raise last_error or ValueError("Failed to parse model JSON output")


def _is_prompt_too_large_error(err: Exception) -> bool:
    text = str(err).lower()
    return (
        "request too large" in text
        or "413" in text
        or ("tokens per minute" in text and "limit" in text and "requested" in text)
    )


def _truncate_text(value: Any, max_chars: int) -> str:
    text = str(value or "").strip()
    return text[:max_chars]


def _compact_paper_for_merge(paper: dict, ultra: bool = False) -> dict:
    max_sets = 8 if ultra else 14
    max_parts_per_set = 1 if ultra else 2
    max_question_chars = 90 if ultra else 160

    compact_sets = []
    for q in (paper.get("extracted_questions") or [])[:max_sets]:
        compact_parts = []
        for part in (q.get("parts") or [])[:max_parts_per_set]:
            compact_parts.append(
                {
                    "part_label": part.get("part_label", ""),
                    "question_text": _truncate_text(part.get("question_text", ""), max_question_chars),
                    "marks": part.get("marks", 0),
                    "topic": _truncate_text(part.get("topic", ""), 64),
                    "type": _truncate_text(part.get("type", ""), 32),
                }
            )
        compact_sets.append({"set_number": q.get("set_number", 0), "parts": compact_parts})

    return {
        "paper_title": _truncate_text(paper.get("paper_title", ""), 64),
        "total_marks": paper.get("total_marks", 0),
        "total_questions": paper.get("total_questions", 0),
        "answer_required": paper.get("answer_required", 0),
        "time_hours": paper.get("time_hours", 0),
        "question_format": _truncate_text(paper.get("question_format", ""), 180 if ultra else 280),
        "question_types_seen": (paper.get("question_types_seen") or [])[:6],
        "extracted_questions": compact_sets,
    }


def _build_merge_prompt(paper_results: List[dict], course_name: str, ultra: bool = False) -> str:
    compact_payload = [_compact_paper_for_merge(p, ultra=ultra) for p in paper_results]
    raw_json = json.dumps(compact_payload, separators=(",", ":"))
    max_chars = MERGE_INPUT_MAX_CHARS_ULTRA if ultra else MERGE_INPUT_MAX_CHARS
    papers_json = raw_json[:max_chars]

    return PATTERN_MERGE_PROMPT.format(
        n=len(paper_results),
        course_name=course_name,
        papers_json=papers_json,
    )


def _normalize_merged_analysis(raw_result: Any, paper_results: List[dict], course_name: str) -> dict:
    """Ensure merge output is always a dict with the expected top-level keys."""
    base = {
        "course_name": course_name,
        "papers_analyzed": len(paper_results),
        "exam_format": {},
        "repeat_topics": [],
        "question_type_breakdown": {},
        "high_probability_topics": [],
        "sample_question_format": "",
    }

    if isinstance(raw_result, dict):
        normalized = dict(base)
        normalized.update(raw_result)
        if not isinstance(normalized.get("repeat_topics"), list):
            normalized["repeat_topics"] = []
        if not isinstance(normalized.get("exam_format"), dict):
            normalized["exam_format"] = {}
        if not isinstance(normalized.get("question_type_breakdown"), dict):
            normalized["question_type_breakdown"] = {}
        if not isinstance(normalized.get("high_probability_topics"), list):
            normalized["high_probability_topics"] = []
        return normalized

    if isinstance(raw_result, list):
        if raw_result and isinstance(raw_result[0], dict) and "repeat_topics" in raw_result[0]:
            return _normalize_merged_analysis(raw_result[0], paper_results, course_name)

        repeat_topics = []
        for item in raw_result:
            if not isinstance(item, dict):
                continue
            topic = str(item.get("topic", "")).strip()
            if not topic:
                continue
            repeat_topics.append(
                {
                    "topic": topic,
                    "frequency": int(item.get("frequency", 1) or 1),
                    "years_appeared": item.get("years_appeared", []),
                    "typical_marks": item.get("typical_marks", 0),
                    "typical_type": item.get("typical_type", "theoretical"),
                }
            )

        normalized = dict(base)
        normalized["repeat_topics"] = repeat_topics
        normalized["high_probability_topics"] = [t["topic"] for t in repeat_topics[:5]]
        return normalized

    return dict(base)


def analyze_question_paper_vision(
    image_bytes_list: List[bytes],
    course_name: str,
    paper_index: int = 1,
    total_papers: int = 1,
) -> dict:
    """
    Send rendered PDF page images to the Gemini vision model.
    Returns a structured dict with the extracted question pattern.
    """
    if not image_bytes_list:
        return {}

    # Build multimodal content parts: text prompt first, then images
    parts: List[Any] = [
        _build_vision_prompt(course_name, paper_index, total_papers)
    ]

    for png_bytes in image_bytes_list:
        parts.append(
            genai_types.Part.from_bytes(data=png_bytes, mime_type="image/png")
        )

    try:
        response = client.models.generate_content(
            model=VISION_MODEL,
            contents=parts,
        )
        raw = (response.text or "").strip()
        return _try_parse_json(raw)
    except json.JSONDecodeError as e:
        print(f"[vision_service] JSON parse error: {e} | raw: {raw[:300]}")
        return _groq_vision_fallback(image_bytes_list, course_name, paper_index, total_papers)
    except Exception as e:
        print(f"[vision_service] Vision API error: {e}")
        # Retry once after brief wait (handles transient rate limits)
        time.sleep(3)
        try:
            response = client.models.generate_content(
                model=VISION_MODEL,
                contents=parts,
            )
            raw = (response.text or "").strip()
            return _try_parse_json(raw)
        except Exception as e2:
            print(f"[vision_service] Retry also failed: {e2}")
            groq_result = _groq_vision_fallback(image_bytes_list, course_name, paper_index, total_papers)
            if groq_result:
                return groq_result
            if "429" in str(e2) or "RESOURCE_EXHAUSTED" in str(e2):
                return {"error": "RATE_LIMIT_EXCEEDED"}
            return {}


def _groq_vision_fallback(
    image_bytes_list: List[bytes],
    course_name: str,
    paper_index: int,
    total_papers: int,
) -> dict:
    """Use Groq vision models when Gemini hits quota or fails."""
    if not settings.GROQ_API_KEY:
        return {}

    prompt = _build_vision_prompt(course_name, paper_index, total_papers)
    try:
        raw = generate_groq_completion(
            prompt=prompt,
            model_candidates=GROQ_VISION_MODEL_CANDIDATES,
            image_bytes_list=image_bytes_list,
            image_mime_type="image/png",
        )
        return _try_parse_json(raw)
    except Exception as groq_error:
        print(f"[vision_service] Groq vision fallback failed: {groq_error}")
        return {}


def merge_paper_analyses(paper_results: List[dict], course_name: str) -> dict:
    """
    Send all individual paper analysis JSONs to the model to produce
    a single merged pattern summary with repeat-topic frequencies.
    """
    if not paper_results:
        return {}

    def _local_merge_fallback() -> dict:
        """Deterministic merge fallback when model-based merge fails."""
        p = paper_results[0] if paper_results else {}
        topics = []

        for paper in paper_results:
            paper_title = paper.get("paper_title", "Unknown")
            for q in paper.get("extracted_questions", []):
                for part in q.get("parts", []):
                    t = part.get("topic", "")
                    if not t:
                        continue
                    existing = next((x for x in topics if x["topic"] == t), None)
                    if existing:
                        existing["frequency"] += 1
                        if paper_title not in existing["years_appeared"]:
                            existing["years_appeared"].append(paper_title)
                    else:
                        topics.append(
                            {
                                "topic": t,
                                "frequency": 1,
                                "years_appeared": [paper_title],
                                "typical_marks": part.get("marks", 0),
                                "typical_type": part.get("type", "theoretical"),
                            }
                        )

        topics.sort(key=lambda item: item.get("frequency", 0), reverse=True)

        first_format = ""
        for paper in paper_results:
            fmt = str(paper.get("question_format") or "").strip()
            if fmt:
                first_format = fmt
                break

        return {
            "course_name": course_name,
            "papers_analyzed": len(paper_results),
            "exam_format": {
                "total_marks": p.get("total_marks", 72),
                "total_sets": p.get("total_questions", 8),
                "answer_required": p.get("answer_required", 6),
                "time_hours": p.get("time_hours", 3.0),
                "sub_question_style": "a/b/c",
                "marks_distribution": first_format,
            },
            "repeat_topics": topics,
            "question_type_breakdown": {},
            "high_probability_topics": [t["topic"] for t in topics[:10]],
            "sample_question_format": first_format,
            "fallback_used": "local_merge",
        }

    if len(paper_results) == 1:
        return _local_merge_fallback()

    prompt = _build_merge_prompt(paper_results, course_name, ultra=False)

    try:
        response = client.models.generate_content(
            model=VISION_MODEL,
            contents=prompt,
        )
        raw = (response.text or "").strip()
        return _normalize_merged_analysis(_try_parse_json(raw), paper_results, course_name)
    except Exception as e:
        print(f"[vision_service] merge_paper_analyses error: {e}")
        if settings.GROQ_API_KEY:
            try:
                raw = generate_groq_completion(
                    prompt=prompt,
                    model_candidates=GROQ_TASK_MODEL_CANDIDATES,
                    max_tokens=1200,
                )
                return _normalize_merged_analysis(_try_parse_json(raw), paper_results, course_name)
            except Exception as groq_error:
                print(f"[vision_service] merge_paper_analyses Groq fallback failed: {groq_error}")
                if _is_prompt_too_large_error(groq_error):
                    try:
                        ultra_prompt = _build_merge_prompt(paper_results, course_name, ultra=True)
                        raw = generate_groq_completion(
                            prompt=ultra_prompt,
                            model_candidates=GROQ_TASK_MODEL_CANDIDATES,
                            max_tokens=700,
                        )
                        return _normalize_merged_analysis(_try_parse_json(raw), paper_results, course_name)
                    except Exception as groq_error2:
                        print(f"[vision_service] merge_paper_analyses Groq ultra-compact retry failed: {groq_error2}")

        # Final fallback: never fail full analysis because merge model is rate-limited/parses badly.
        return _local_merge_fallback()
