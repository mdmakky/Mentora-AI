import json
import logging
from typing import List, Optional
import time
import re
import hashlib
import math
from functools import lru_cache
from langchain_text_splitters import RecursiveCharacterTextSplitter
from google import genai
from core.config import get_settings
from core.database import get_supabase_admin

logger = logging.getLogger(__name__)

settings = get_settings()
genai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 768
EMBEDDING_BATCH_SIZE = 24
EMBEDDING_MAX_RETRIES = 2
LOCAL_EMBEDDING_BATCH_SIZE = max(1, settings.LOCAL_EMBEDDING_BATCH_SIZE)

_local_model_unavailable_reason: Optional[str] = None

_TOKEN_RE = re.compile(r"[a-z0-9_]+")
_HASH_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "while",
    "for", "to", "of", "in", "on", "at", "by", "from", "with", "without", "as",
    "is", "are", "was", "were", "be", "been", "being", "do", "does", "did", "can",
    "could", "should", "would", "will", "just", "than", "that", "this", "these", "those",
    "it", "its", "into", "about", "over", "under", "up", "down", "out", "not",
}

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_document(pages: List[dict], doc_id: str, doc_name: str) -> List[dict]:
    """Split document pages into chunks with metadata."""
    chunks = []
    chunk_index = 0

    for page_data in pages:
        page_text = page_data["content"]
        page_number = page_data["page_number"]
        slide_number = page_data.get("slide_number")

        page_chunks = text_splitter.split_text(page_text)

        for chunk_text in page_chunks:
            chunks.append({
                "document_id": doc_id,
                "doc_name": doc_name,
                "chunk_index": chunk_index,
                "content": chunk_text,
                "page_number": page_number,
                "slide_number": slide_number,
                "section_title": None,
                "token_count": len(chunk_text.split()),
            })
            chunk_index += 1

    return chunks


def generate_embedding(text: str) -> List[float]:
    """Generate embedding using Google Gemini embedding model."""
    return _embed_batch([text])[0]


def _is_quota_exhausted_error(error: Exception) -> bool:
    msg = str(error).upper()
    quota_tokens = [
        "RESOURCE_EXHAUSTED",
        "EMBED_CONTENT_FREE_TIER_REQUESTS",
        "EMBEDCONTENTREQUESTSPERDAY",
        "429",
        "QUOTA EXCEEDED",
    ]
    return any(token in msg for token in quota_tokens)


def _embed_batch_with_retry(texts: List[str]) -> List[List[float]]:
    """Embed a batch of chunk texts, retrying transient failures briefly."""
    last_error: Optional[Exception] = None

    for attempt in range(EMBEDDING_MAX_RETRIES + 1):
        try:
            result = genai_client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config={"output_dimensionality": EMBEDDING_DIMENSION},
            )

            embeddings = getattr(result, "embeddings", None) or []
            if len(embeddings) != len(texts):
                raise ValueError(
                    f"Embedding response size mismatch: expected {len(texts)} got {len(embeddings)}"
                )

            return [item.values for item in embeddings]
        except Exception as e:
            last_error = e
            if _is_quota_exhausted_error(e):
                raise

            if attempt >= EMBEDDING_MAX_RETRIES:
                break

            wait_seconds = 1.5 * (2 ** attempt)
            time.sleep(wait_seconds)

    raise Exception(f"Embedding batch failed after retries: {last_error}")


@lru_cache(maxsize=1)
def _get_local_embedding_model():
    """Lazy-load local sentence-transformers model only when fallback is needed."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(
        settings.LOCAL_EMBEDDING_MODEL,
        device=settings.LOCAL_EMBEDDING_DEVICE or "cpu",
    )
    return model


def _is_memory_pressure_error(error: Exception) -> bool:
    msg = str(error).lower()
    markers = [
        "out of memory",
        "cannot allocate memory",
        "killed",
        "std::bad_alloc",
        "oom",
    ]
    return any(marker in msg for marker in markers)


def _encode_sentence_transformer_batched(model, texts: List[str]) -> List[List[float]]:
    vectors = []
    for i in range(0, len(texts), LOCAL_EMBEDDING_BATCH_SIZE):
        window = texts[i:i + LOCAL_EMBEDDING_BATCH_SIZE]
        batch_vectors = model.encode(
            window,
            batch_size=LOCAL_EMBEDDING_BATCH_SIZE,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        vectors.extend(batch_vectors)
    return vectors


def _embed_hash(text: str) -> List[float]:
    """Lightweight lexical embedding for low-memory deployments.

    This is a feature-hashing vectorizer, not a neural semantic model.
    It encodes normalized tokens, phrase patterns, and token-shape hints.
    """
    tokens = _TOKEN_RE.findall((text or "").lower())
    vec = [0.0] * EMBEDDING_DIMENSION

    if not tokens:
        return vec

    normalized = []
    for token in tokens:
        t = token
        if len(t) > 4 and t.endswith("ies"):
            t = t[:-3] + "y"
        elif len(t) > 5 and t.endswith("ing"):
            t = t[:-3]
        elif len(t) > 4 and t.endswith("ed"):
            t = t[:-2]
        elif len(t) > 3 and t.endswith("es"):
            t = t[:-2]
        elif len(t) > 3 and t.endswith("s"):
            t = t[:-1]
        normalized.append(t)

    features = []
    for idx, token in enumerate(normalized):
        base_weight = 0.2 if token in _HASH_STOPWORDS else 1.0

        # Unigram features carry most lexical signal.
        features.append((f"tok:{token}", base_weight))

        # Prefix/suffix features improve robustness for related word forms.
        if len(token) >= 4:
            features.append((f"pre:{token[:3]}", 0.35 * base_weight))
            features.append((f"suf:{token[-3:]}", 0.35 * base_weight))

        # Character trigrams improve matching across inflected/derived forms.
        if len(token) >= 6:
            trigrams = {token[j:j + 3] for j in range(len(token) - 2)}
            for trigram in trigrams:
                features.append((f"tri:{trigram}", 0.12 * base_weight))

        # Neighbor bigrams capture short phrase structure.
        if idx + 1 < len(normalized):
            nxt = normalized[idx + 1]
            features.append((f"bi:{token}_{nxt}", 0.8 * base_weight))

        # Number marker helps retrieval for formula-like and numbered content.
        if any(ch.isdigit() for ch in token):
            features.append(("shape:has_digit", 0.5))

    for feature, weight in features:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "big", signed=False)

        # Two hashed coordinates reduce collision impact versus a single bucket.
        idx_1 = value % EMBEDDING_DIMENSION
        idx_2 = (value >> 21) % EMBEDDING_DIMENSION
        sign_1 = -1.0 if ((value >> 8) & 1) else 1.0
        sign_2 = -1.0 if ((value >> 29) & 1) else 1.0

        vec[idx_1] += sign_1 * weight
        vec[idx_2] += sign_2 * (0.5 * weight)

    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _embed_batch_hash(texts: List[str]) -> List[List[float]]:
    return [_embed_hash(text) for text in texts]


def _embed_batch_local(texts: List[str]) -> List[List[float]]:
    global _local_model_unavailable_reason

    backend = (settings.LOCAL_EMBEDDING_BACKEND or "auto").strip().lower()

    if backend not in {"auto", "hash", "sentence-transformers"}:
        logger.warning("[embedding] invalid LOCAL_EMBEDDING_BACKEND=%s; using hash", settings.LOCAL_EMBEDDING_BACKEND)
        return _embed_batch_hash(texts)

    if backend == "hash":
        return _embed_batch_hash(texts)

    prefer_sentence_transformers = backend in {"auto", "sentence-transformers"}

    if prefer_sentence_transformers and not _local_model_unavailable_reason:
        try:
            model = _get_local_embedding_model()
            vectors = _encode_sentence_transformer_batched(model, texts)

            out: List[List[float]] = []
            for vec in vectors:
                values = vec.tolist()
                if len(values) == EMBEDDING_DIMENSION:
                    out.append(values)
                    continue

                # Dimension align for pgvector schema compatibility (pad/truncate).
                if len(values) > EMBEDDING_DIMENSION:
                    values = values[:EMBEDDING_DIMENSION]
                else:
                    values = values + [0.0] * (EMBEDDING_DIMENSION - len(values))
                out.append(values)
            return out
        except Exception as st_error:
            # Avoid repeated heavy retries on constrained boxes once local model fails.
            if backend == "sentence-transformers" or _is_memory_pressure_error(st_error):
                _local_model_unavailable_reason = str(st_error)

            logger.warning("[embedding] sentence-transformers unavailable, falling back to hash: %s", st_error)

            if backend == "sentence-transformers":
                # Strict mode requested; still degrade to hash to keep ingestion/search alive.
                return _embed_batch_hash(texts)

    if _local_model_unavailable_reason and backend == "auto":
        # Keep logs concise after first failure while preserving behavior.
        return _embed_batch_hash(texts)

    return _embed_batch_hash(texts)


def _embed_batch(texts: List[str]) -> List[List[float]]:
    """Primary Gemini embedding with automatic local fallback on failure."""
    try:
        return _embed_batch_with_retry(texts)
    except Exception as gemini_error:
        if not settings.ENABLE_LOCAL_EMBEDDING_FALLBACK:
            raise

        logger.warning("[embedding] Gemini failed, using local fallback: %s", gemini_error)
        try:
            return _embed_batch_local(texts)
        except Exception as local_error:
            raise Exception(f"Gemini embedding failed: {gemini_error}; local fallback failed: {local_error}")


def generate_query_embedding(text: str, course_context: Optional[str] = None) -> List[float]:
    """Generate embedding for a query, optionally prefixed with course context."""
    prefixed = f"[{course_context}] {text}" if course_context else text
    return _embed_batch([prefixed])[0]


async def store_chunks_with_embeddings(
    chunks: List[dict],
    course_id: str,
    user_id: str,
) -> dict:
    """Store document chunks with their embeddings in the database."""
    db = get_supabase_admin()
    stored_count = 0
    failed_count = 0
    quota_exhausted = False
    last_error = None

    # Deduplicate chunks within this document by content hash (in-memory)
    seen_content_hashes: set = set()
    deduped_chunks = []
    for chunk in chunks:
        content_hash = hashlib.md5(chunk["content"].encode()).hexdigest()
        if content_hash not in seen_content_hashes:
            seen_content_hashes.add(content_hash)
            deduped_chunks.append(chunk)
    chunks = deduped_chunks

    for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        batch = chunks[i:i + EMBEDDING_BATCH_SIZE]
        try:
            embeddings = _embed_batch([c["content"] for c in batch])

            # Batch insert all chunks in one DB round-trip
            insert_rows = [
                {
                    "document_id": chunk["document_id"],
                    "course_id": course_id,
                    "user_id": user_id,
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "page_number": chunk["page_number"],
                    "section_title": chunk.get("section_title"),
                    "slide_number": chunk.get("slide_number"),
                    "embedding": embedding,
                    "token_count": chunk.get("token_count", 0),
                }
                for chunk, embedding in zip(batch, embeddings)
            ]
            db.table("document_chunks").insert(insert_rows).execute()
            stored_count += len(insert_rows)
        except Exception as e:
            last_error = e
            failed_count += len(batch)
            first_chunk_idx = batch[0].get("chunk_index") if batch else "?"
            logger.error("Error storing chunk batch starting at %s: %s", first_chunk_idx, e)
            if _is_quota_exhausted_error(e):
                quota_exhausted = True
                break

    return {
        "stored_count": stored_count,
        "failed_count": failed_count,
        "quota_exhausted": quota_exhausted,
        "error": str(last_error) if last_error else None,
    }


SIMILARITY_THRESHOLD = 0.45  # Chunks below this score are excluded from LLM context

async def search_similar_chunks(
    query: str,
    user_id: str,
    course_id: str,
    document_ids: Optional[List[str]] = None,
    page_numbers: Optional[List[int]] = None,
    section_anchor_page: Optional[int] = None,
    top_k: int = 7,
    course_context: Optional[str] = None,
) -> List[dict]:
    """Search for similar chunks using pgvector cosine similarity."""
    db = get_supabase_admin()

    try:
        query_embedding = generate_query_embedding(query, course_context=course_context)

        # Use Supabase RPC for vector similarity search
        fetch_count = top_k
        if page_numbers:
            fetch_count = max(top_k * 2, top_k + 3)
        elif section_anchor_page:
            fetch_count = max(top_k * 2, top_k + 4)

        params = {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_course_id": course_id,
            "match_count": fetch_count,
        }

        if document_ids:
            params["match_document_ids"] = document_ids

        result = db.rpc("match_document_chunks", params).execute()
        chunks = result.data or []

        # Filter out low-relevance chunks to reduce LLM noise
        filtered = [c for c in chunks if c.get("similarity", 1.0) >= SIMILARITY_THRESHOLD]

        if page_numbers:
            page_set = {int(p) for p in page_numbers if isinstance(p, int)}
            scoped = [c for c in (filtered if filtered else chunks) if c.get("page_number") in page_set]
            if scoped:
                return scoped[:top_k]

        if isinstance(section_anchor_page, int) and section_anchor_page > 0:
            lower = max(1, section_anchor_page - 1)
            upper = section_anchor_page + 1
            scoped = [
                c for c in (filtered if filtered else chunks)
                if isinstance(c.get("page_number"), int) and lower <= c.get("page_number") <= upper
            ]
            if scoped:
                return scoped[:top_k]

        # Fall back to all chunks if filtering removes everything (e.g., hash backend)
        base = filtered if filtered else chunks
        return base[:top_k]
    except Exception as e:
        logger.error("Vector search or embedding error: %s", e)
        # Fallback: basic text search
        return []


async def process_document_pipeline(
    doc_id: str,
    course_id: str,
    user_id: str,
    file_bytes: bytes,
    file_type: str,
    file_name: str,
    preextracted_pages: Optional[List[dict]] = None,
):
    """Full document processing pipeline: extract → chunk → embed → store."""
    db = get_supabase_admin()

    try:
        # Update status to processing
        db.table("documents").update({"processing_status": "processing"}).eq("id", doc_id).execute()

        ocr_applied = False

        if file_type == "pdf":
            # Always re-extract PDFs with the OCR-aware function.
            # preextracted_pages (from upload) skips OCR on image pages, so we
            # do a fresh pass here to guarantee every page is covered.
            from services.pdf_service import extract_text_from_pdf_with_ocr
            pages, ocr_applied = extract_text_from_pdf_with_ocr(file_bytes)

        elif preextracted_pages is not None:
            # Non-PDF types: reuse pages already extracted at upload time
            # (avoids double extraction for DOCX/PPTX)
            pages = preextracted_pages

        else:
            from services.pdf_service import extract_text_from_docx, extract_text_from_pptx, extract_text_from_image
            if file_type == "docx":
                pages = extract_text_from_docx(file_bytes)
            elif file_type in ("pptx", "ppt"):
                pages = extract_text_from_pptx(file_bytes)
            elif file_type in ("jpg", "png"):
                pages, ocr_applied = extract_text_from_image(file_bytes, file_type)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")

        if not pages:
            db.table("documents").update({"processing_status": "failed"}).eq("id", doc_id).execute()
            return

        # Chunk the document
        chunks = chunk_document(pages, doc_id, file_name)

        # Store chunks with embeddings
        store_result = await store_chunks_with_embeddings(chunks, course_id, user_id)
        stored_count = store_result["stored_count"]
        failed_count = store_result["failed_count"]
        quota_exhausted = store_result["quota_exhausted"]

        if stored_count == 0 or failed_count > 0:
            fail_reason = "quota_exhausted" if quota_exhausted else "embedding_failed"
            # Remove partial chunk writes so failed documents don't pollute retrieval.
            try:
                db.table("document_chunks").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
            except Exception as cleanup_err:
                logger.error("[rag_pipeline] failed to clean up chunks for doc=%s: %s", doc_id, cleanup_err)
            db.table("documents").update({
                "processing_status": "failed",
                "chunk_count": 0,
                "page_count": len(pages),
            }).eq("id", doc_id).execute()
            if quota_exhausted:
                logger.warning(
                    "[rag_pipeline] embedding quota exhausted for doc=%s; stored=%d, failed=%d",
                    doc_id, stored_count, failed_count,
                )
            return

        # Build final status update
        status_update: dict = {
            "processing_status": "ready",
            "chunk_count": stored_count,
            "page_count": len(pages),
        }

        # Persist OCR flag so the UI can show the accuracy warning banner
        if ocr_applied:
            status_update["is_ocr_processed"] = True
            logger.info("[rag_pipeline] OCR was applied for doc=%s; flagging is_ocr_processed=true", doc_id)

        try:
            db.table("documents").update(status_update).eq("id", doc_id).execute()
        except Exception as upd_err:
            # is_ocr_processed column may not exist yet (migration not applied).
            # Fall back to updating without that field — document still marked ready.
            if "is_ocr_processed" in str(upd_err):
                status_update.pop("is_ocr_processed", None)
                db.table("documents").update(status_update).eq("id", doc_id).execute()
                logger.warning(
                    "[rag_pipeline] is_ocr_processed column missing — "
                    "run database/ocr_migration.sql to enable the UI banner. doc=%s", doc_id
                )
            else:
                raise

    except Exception as e:
        logger.error("Document processing error for %s: %s", doc_id, e)
        db.table("documents").update({"processing_status": "failed"}).eq("id", doc_id).execute()
