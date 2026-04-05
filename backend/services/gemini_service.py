from google import genai
from typing import List, Optional
from core.config import get_settings
import time

settings = get_settings()
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

MODEL = "gemini-2.0-flash"


SYSTEM_PROMPT = """You are an academic AI assistant for university students named Mentora.
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


def _generate_with_retry(prompt: str, max_retries: int = 3) -> str:
    """Generate content with retry logic for rate limits."""
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                wait_time = (2 ** attempt) * 5  # 5, 10, 20 seconds
                print(f"Rate limited, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                print(f"Gemini API Error: {e}")
                raise
    raise Exception("Max retries exceeded due to rate limiting")


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
        return _generate_with_retry(prompt)
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return "Sorry, I'm currently experiencing technical difficulties connecting to the AI. Please try again in a moment."


async def generate_summary(text: str, summary_type: str = "full", language: str = "en") -> str:
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
        return _generate_with_retry(prompt)
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
        return _generate_with_retry(prompt)
    except Exception as e:
        print(f"Question generation error: {e}")
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
        return _generate_with_retry(prompt)
    except Exception as e:
        print(f"Exam prediction error: {e}")
        return "[]"

