import base64
import time
from typing import List, Optional

import httpx

from core.config import get_settings


settings = get_settings()
GROQ_API_BASE = "https://api.groq.com/openai/v1"


def _parse_model_candidates(raw: str, default_csv: str) -> List[str]:
    source = raw or default_csv
    models = [model.strip() for model in source.split(",") if model.strip()]
    return models or [model.strip() for model in default_csv.split(",") if model.strip()]


GROQ_CHAT_MODEL_CANDIDATES = _parse_model_candidates(
    settings.GROQ_CHAT_MODELS,
    "llama-3.3-70b-versatile,llama-3.1-8b-instant",
)

GROQ_TASK_MODEL_CANDIDATES = _parse_model_candidates(
    settings.GROQ_TASK_MODELS,
    "llama-3.3-70b-versatile,llama-3.1-8b-instant",
)

GROQ_VISION_MODEL_CANDIDATES = _parse_model_candidates(
    settings.GROQ_VISION_MODELS,
    "meta-llama/llama-4-maverick-17b-128e-instruct,meta-llama/llama-4-scout-17b-16e-instruct",
)


def _is_retryable_status(status_code: int) -> bool:
    return status_code in {429, 500, 502, 503, 504}


def _to_data_uri(image_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def generate_groq_completion(
    prompt: str,
    model_candidates: List[str],
    system_prompt: Optional[str] = None,
    image_bytes_list: Optional[List[bytes]] = None,
    image_mime_type: str = "image/png",
    max_tokens: int = 4096,
) -> str:
    """Generate text from Groq using the OpenAI-compatible API."""
    api_key = (settings.GROQ_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("Groq API key is not configured")

    if not model_candidates:
        raise RuntimeError("No Groq model candidates configured")

    messages: list[dict] = []
    if system_prompt:
                messages.append({"role": "system", "content": system_prompt})

    if image_bytes_list:
        content = [{"type": "text", "text": prompt}]
        for image_bytes in image_bytes_list:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": _to_data_uri(image_bytes, image_mime_type)},
                }
            )
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    retries_per_model = max(1, settings.GROQ_MAX_RETRIES_PER_MODEL)
    base_wait = max(0.5, settings.GROQ_RETRY_BASE_SECONDS)
    last_error: Optional[Exception] = None

    with httpx.Client(timeout=90.0) as client:
        for model_name in model_candidates:
            for attempt in range(retries_per_model):
                try:
                    response = client.post(
                        f"{GROQ_API_BASE}/chat/completions",
                        headers=headers,
                        json={
                            "model": model_name,
                            "messages": messages,
                            "temperature": 0.2,
                            "max_tokens": max(256, min(int(max_tokens), 4096)),
                        },
                    )

                    if response.status_code == 200:
                        data = response.json()
                        choices = data.get("choices") or []
                        if choices:
                            content = choices[0].get("message", {}).get("content", "")
                            if content:
                                return str(content).strip()
                        raise ValueError(f"Groq model {model_name} returned an empty response")

                    error_text = response.text
                    last_error = RuntimeError(
                        f"Groq API error {response.status_code} for model {model_name}: {error_text}"
                    )

                    if _is_retryable_status(response.status_code) and attempt < retries_per_model - 1:
                        time.sleep(base_wait * (2 ** attempt))
                        continue

                    break
                except Exception as err:
                    last_error = err
                    if attempt < retries_per_model - 1:
                        continue
                    break

    raise RuntimeError(f"All Groq models failed. Last error: {last_error}")