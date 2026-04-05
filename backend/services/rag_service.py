import json
from typing import List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from google import genai
from core.config import get_settings
from core.database import get_supabase_admin

settings = get_settings()
genai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

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
    """Generate embedding using Google text-embedding-004."""
    result = genai_client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return result.embeddings[0].values


def generate_query_embedding(text: str) -> List[float]:
    """Generate embedding for a query."""
    result = genai_client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return result.embeddings[0].values


async def store_chunks_with_embeddings(
    chunks: List[dict],
    course_id: str,
    user_id: str,
) -> int:
    """Store document chunks with their embeddings in the database."""
    db = get_supabase_admin()
    stored_count = 0

    for chunk in chunks:
        try:
            embedding = generate_embedding(chunk["content"])

            db.table("document_chunks").insert({
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
            }).execute()

            stored_count += 1
        except Exception as e:
            print(f"Error storing chunk {chunk['chunk_index']}: {e}")
            continue

    return stored_count


async def search_similar_chunks(
    query: str,
    user_id: str,
    course_id: str,
    document_ids: Optional[List[str]] = None,
    top_k: int = 7,
) -> List[dict]:
    """Search for similar chunks using pgvector cosine similarity."""
    db = get_supabase_admin()

    try:
        query_embedding = generate_query_embedding(query)

        # Use Supabase RPC for vector similarity search
        params = {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_course_id": course_id,
            "match_count": top_k,
        }

        if document_ids:
            params["match_document_ids"] = document_ids

        result = db.rpc("match_document_chunks", params).execute()
        return result.data or []
    except Exception as e:
        print(f"Vector search or embedding error: {e}")
        # Fallback: basic text search
        return []


async def process_document_pipeline(
    doc_id: str,
    course_id: str,
    user_id: str,
    file_bytes: bytes,
    file_type: str,
    file_name: str,
):
    """Full document processing pipeline: extract → chunk → embed → store."""
    db = get_supabase_admin()

    try:
        # Update status to processing
        db.table("documents").update({"processing_status": "processing"}).eq("id", doc_id).execute()

        # Extract text based on file type
        from services.pdf_service import extract_text_from_pdf, extract_text_from_docx, extract_text_from_pptx

        if file_type == "pdf":
            pages = extract_text_from_pdf(file_bytes)
        elif file_type == "docx":
            pages = extract_text_from_docx(file_bytes)
        elif file_type == "pptx":
            pages = extract_text_from_pptx(file_bytes)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        if not pages:
            db.table("documents").update({"processing_status": "failed"}).eq("id", doc_id).execute()
            return

        # Chunk the document
        chunks = chunk_document(pages, doc_id, file_name)

        # Store chunks with embeddings
        stored_count = await store_chunks_with_embeddings(chunks, course_id, user_id)

        # Update document status
        db.table("documents").update({
            "processing_status": "ready",
            "chunk_count": stored_count,
            "page_count": len(pages),
        }).eq("id", doc_id).execute()

    except Exception as e:
        print(f"Document processing error for {doc_id}: {e}")
        db.table("documents").update({"processing_status": "failed"}).eq("id", doc_id).execute()
