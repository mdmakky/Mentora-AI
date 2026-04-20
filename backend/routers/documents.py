from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Body, Request
from fastapi.responses import StreamingResponse
import logging
from typing import List, Optional
from datetime import datetime, timezone
from schemas.document import DocumentUpdate, DocumentResponse
from core.database import get_supabase_admin
from core.dependencies import get_current_user, check_upload_allowed
from services.supabase_storage_service import (
    upload_document as upload_file,
    delete_document as delete_file,
    upload_thumbnail,
    delete_thumbnail,
)
from services.pdf_service import (
    extract_text_from_pdf, extract_text_from_docx, extract_text_from_pptx, extract_text_from_image,
    calculate_file_hash, get_pdf_page_count,
)
from services.copyright_service import run_copyright_check
from services.rag_service import process_document_pipeline
from services.notification_service import create_notification, notify_admins
from services.conversion_service import convert_to_pdf
from slowapi import Limiter
from slowapi.util import get_remote_address
import uuid
import io
import httpx

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "ppt",
    "image/jpeg": "jpg",
    "image/png": "png",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
REVIEW_COLUMNS = {
    "flag_reason",
    "review_requested",
    "review_status",
    "review_note",
    "review_requested_at",
    "review_decided_at",
    "review_decided_by",
    "rescan_count",
    "last_rescanned_at",
}


def _is_missing_documents_column_error(exc: Exception) -> bool:
    msg = str(exc)
    return "PGRST204" in msg and "documents" in msg and "column" in msg


def _strip_review_columns(payload: dict) -> dict:
    return {k: v for k, v in payload.items() if k not in REVIEW_COLUMNS}


def _extract_pages_for_scan(file_bytes: bytes, file_type: str):
    if file_type == "pdf":
        return extract_text_from_pdf(file_bytes)
    if file_type == "docx":
        return extract_text_from_docx(file_bytes)
    if file_type in ("pptx", "ppt"):
        return extract_text_from_pptx(file_bytes)
    if file_type in ("jpg", "png"):
        pages, _ = extract_text_from_image(file_bytes, file_type)
        return pages
    return []


@router.post("/upload", response_model=DocumentResponse, status_code=201)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    course_id: str = Form(...),
    folder_id: Optional[str] = Form(None),
    doc_category: str = Form("lecture"),
    declaration_accepted: bool = Form(False),
    user: dict = Depends(check_upload_allowed),
):
    """Upload a document with anti-piracy checks."""
    # Validate declaration
    if not declaration_accepted:
        raise HTTPException(status_code=400, detail="You must accept the anti-piracy declaration")

    # Validate file type
    file_type = ALLOWED_TYPES.get(file.content_type)
    if not file_type:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, PPTX, PPT, JPG, and PNG files are allowed")

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    db = get_supabase_admin()
    doc_id = str(uuid.uuid4())

    # Calculate file hash
    file_hash = calculate_file_hash(file_bytes)

    # Check for duplicates only within the same course.
    # Users may legitimately reuse the same file across different courses.
    dup_check = (
        db.table("documents")
        .select("id")
        .eq("file_hash", file_hash)
        .eq("user_id", user["id"])
        .eq("course_id", course_id)
        .eq("is_deleted", False)
        .execute()
    )
    if dup_check.data:
        raise HTTPException(status_code=400, detail="This file has already been uploaded to this course")

    # Auto-convert DOCX, PPTX, and PPT files to PDF using LibreOffice
    if file_type in ["docx", "pptx", "ppt"]:
        try:
            file_bytes = convert_to_pdf(file_bytes, file_type)
            file_type = "pdf"
            # Switch filename extension cleanly
            import os
            base_name, _ = os.path.splitext(file.filename)
            file.filename = f"{base_name}.pdf"
            # Re-calculate hash based on the new PDF binary
            file_hash = calculate_file_hash(file_bytes)

            # Re-check duplicates in the same course after conversion changed the binary/hash.
            dup_after_convert = (
                db.table("documents")
                .select("id")
                .eq("file_hash", file_hash)
                .eq("user_id", user["id"])
                .eq("course_id", course_id)
                .eq("is_deleted", False)
                .execute()
            )
            if dup_after_convert.data:
                raise HTTPException(status_code=400, detail="This file has already been uploaded to this course")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to auto-convert document to PDF format: {str(e)}")

    # Get page count for PDF
    page_count = 0
    if file_type == "pdf":
        page_count = get_pdf_page_count(file_bytes)
    elif file_type in ["jpg", "png"]:
        page_count = 1

    # Upload to Supabase Storage
    cloud_result = upload_file(file_bytes, user["id"], course_id, doc_id, file.filename)

    # Generate a thumbnail for PDFs right now — the bytes are already in memory.
    # This tiny JPEG (~10–20 KB) is stored in Supabase so thumbnail requests
    # never need to download the full PDF again.
    if file_type == "pdf":
        try:
            import fitz
            _pdf = fitz.open(stream=file_bytes, filetype="pdf")
            _pix = _pdf[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
            _pdf.close()
            _buf = io.BytesIO()
            _buf.write(_pix.tobytes("jpeg", jpg_quality=75))
            upload_thumbnail(_buf.getvalue(), doc_id)  # fire-and-forget; failure is non-fatal
        except Exception as _thumb_err:
            logger.warning("Thumbnail generation failed for %s: %s", doc_id, _thumb_err)
    elif file_type in ["jpg", "png"]:
        try:
            import fitz
            _img = fitz.open(stream=file_bytes, filetype="jpeg" if file_type == "jpg" else "png")
            _pix = _img[0].get_pixmap(matrix=fitz.Matrix(1.0, 1.0), alpha=False)
            _img.close()
            _buf = io.BytesIO()
            _buf.write(_pix.tobytes("jpeg", jpg_quality=75))
            upload_thumbnail(_buf.getvalue(), doc_id)
        except Exception as _thumb_err:
            logger.warning("Image thumbnail generation failed for %s: %s", doc_id, _thumb_err)

    # Run copyright check (skip entirely for question_paper)
    pages = []
    is_flagged = False
    flag_reason = ""

    if doc_category != "question_paper":
        # Extract text once and reuse for both copyright check and pipeline
        if file_type == "pdf":
            pages = extract_text_from_pdf(file_bytes)
        elif file_type == "docx":
            pages = extract_text_from_docx(file_bytes)
        elif file_type in ("pptx", "ppt"):
            pages = extract_text_from_pptx(file_bytes)
        # jpg/png: skip pre-extraction here; the pipeline will run OCR in the background

        is_flagged, flag_reason = run_copyright_check(file_bytes, pages, file_hash, user["id"], db)
        if is_flagged:
            logger.info("[copyright_check] quarantined doc=%s user=%s course=%s reason=%s", file.filename, user["id"], course_id, flag_reason)

    processing_status = "quarantined" if is_flagged else ("ready" if doc_category == "question_paper" else "pending")

    # Save document record
    doc_data = {
        "id": doc_id,
        "user_id": user["id"],
        "course_id": course_id,
        "folder_id": folder_id,
        "file_name": file.filename,
        "original_name": file.filename,
        "cloudinary_url": cloud_result["secure_url"],
        "cloudinary_public_id": cloud_result["public_id"],
        "file_size": len(file_bytes),
        "file_type": file_type,
        "page_count": page_count,
        "doc_category": doc_category,
        "processing_status": processing_status,
        "copyright_flag": is_flagged,
        "flag_reason": flag_reason if is_flagged else None,
        "review_requested": False,
        "review_status": "none",
        "review_note": None,
        "review_requested_at": None,
        "review_decided_at": None,
        "review_decided_by": None,
        "file_hash": file_hash,
    }

    try:
        result = db.table("documents").insert(doc_data).execute()
    except Exception as e:
        if _is_missing_documents_column_error(e):
            result = db.table("documents").insert(_strip_review_columns(doc_data)).execute()
        else:
            raise

    # If not quarantined, start RAG processing pipeline (skip for question_paper)
    # Pass pre-extracted pages to avoid re-extracting in the background task
    if not is_flagged and doc_category != "question_paper":
        background_tasks.add_task(
            process_document_pipeline,
            doc_id, course_id, user["id"], file_bytes, file_type, file.filename,
            pages if pages else None,
        )
    elif is_flagged:
        create_notification(
            user["id"],
            "document_flagged",
            "Document Flagged for Review",
            f'Your document "{file.filename}" was flagged for a potential copyright concern. '
            f'You can request a manual admin review from the document card.',
            {"doc_id": doc_id},
        )

    return result.data[0]


@router.put("/{doc_id}/rescan", response_model=DocumentResponse)
async def rescan_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Re-run copyright checks on a flagged/failed document."""
    db = get_supabase_admin()

    doc = db.table("documents") \
        .select("*") \
        .eq("id", doc_id) \
        .eq("user_id", user["id"]) \
        .eq("is_deleted", False) \
        .single() \
        .execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    row = doc.data
    if row.get("doc_category") == "question_paper":
        qp_update = {
            "processing_status": "ready",
            "copyright_flag": False,
            "flag_reason": None,
            "review_requested": False,
            "review_status": "none",
            "review_note": None,
            "review_requested_at": None,
            "review_decided_at": None,
            "review_decided_by": None,
            "rescan_count": (row.get("rescan_count") or 0) + 1,
            "last_rescanned_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            result = db.table("documents").update(qp_update).eq("id", doc_id).eq("user_id", user["id"]).execute()
        except Exception as e:
            if _is_missing_documents_column_error(e):
                result = db.table("documents").update(_strip_review_columns(qp_update)).eq("id", doc_id).eq("user_id", user["id"]).execute()
            else:
                raise
        return result.data[0]

    try:
        file_bytes = db.storage.from_("mentora-docs").download(row.get("cloudinary_public_id"))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch file for rescan: {e}")

    pages = _extract_pages_for_scan(file_bytes, row.get("file_type", "pdf"))
    is_flagged, flag_reason = run_copyright_check(file_bytes, pages, row.get("file_hash"), user["id"], db)

    update_data = {
        "copyright_flag": is_flagged,
        "flag_reason": flag_reason if is_flagged else None,
        "review_requested": False,
        "review_status": "none",
        "review_note": None,
        "review_requested_at": None,
        "review_decided_at": None,
        "review_decided_by": None,
        "rescan_count": (row.get("rescan_count") or 0) + 1,
        "last_rescanned_at": datetime.now(timezone.utc).isoformat(),
    }

    if is_flagged:
        update_data["processing_status"] = "quarantined"
    else:
        update_data["processing_status"] = "pending"

    try:
        result = db.table("documents").update(update_data).eq("id", doc_id).eq("user_id", user["id"]).execute()
    except Exception as e:
        if _is_missing_documents_column_error(e):
            result = db.table("documents").update(_strip_review_columns(update_data)).eq("id", doc_id).eq("user_id", user["id"]).execute()
        else:
            raise
    updated = result.data[0]

    if not is_flagged:
        background_tasks.add_task(
            process_document_pipeline,
            doc_id,
            row.get("course_id"),
            user["id"],
            file_bytes,
            row.get("file_type", "pdf"),
            row.get("file_name", "document.pdf"),
        )

    return updated


@router.post("/{doc_id}/review-request", response_model=DocumentResponse)
async def request_document_review(
    doc_id: str,
    note: str = Body(default="", embed=True),
    user: dict = Depends(get_current_user),
):
    """Submit a manual admin review request for a flagged document."""
    db = get_supabase_admin()
    doc = db.table("documents") \
        .select("id, processing_status, copyright_flag, review_status") \
        .eq("id", doc_id) \
        .eq("user_id", user["id"]) \
        .eq("is_deleted", False) \
        .single() \
        .execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.data.get("copyright_flag") and doc.data.get("processing_status") != "quarantined":
        raise HTTPException(status_code=400, detail="Only flagged documents can be sent for manual review")

    if doc.data.get("review_status") == "pending":
        raise HTTPException(status_code=400, detail="Review request already pending")

    cleaned_note = (note or "").strip()[:500]
    review_update = {
        "review_requested": True,
        "review_status": "pending",
        "review_note": cleaned_note or None,
        "review_requested_at": datetime.now(timezone.utc).isoformat(),
        "review_decided_at": None,
        "review_decided_by": None,
    }

    try:
        result = db.table("documents").update(review_update).eq("id", doc_id).eq("user_id", user["id"]).execute()
    except Exception as e:
        if _is_missing_documents_column_error(e):
            raise HTTPException(
                status_code=409,
                detail="Database migration required for review requests. Run database/document_review_flow_migration.sql.",
            )
        raise

    # Notify all admins that a review has been requested
    doc_name = doc.data.get("file_name", "a document")
    notify_admins(
        "review_submitted",
        "New Admin Review Request",
        f'A user has submitted a review request for "{doc_name}". Check the Admin → Review Queue.',
        {"doc_id": doc_id},
    )

    return result.data[0]


@router.get("/{course_id}", response_model=List[DocumentResponse])
async def list_documents(
    course_id: str,
    folder_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List documents for a course, optionally filtered by folder."""
    db = get_supabase_admin()
    query = db.table("documents").select("*").eq("course_id", course_id).eq("user_id", user["id"]).eq("is_deleted", False)

    if folder_id:
        query = query.eq("folder_id", folder_id)

    result = query.order("created_at", desc=True).execute()
    return result.data or []


@router.get("/{doc_id}/detail", response_model=DocumentResponse)
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Get a single document detail."""
    db = get_supabase_admin()
    result = db.table("documents").select("*").eq("id", doc_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data


@router.get("/{doc_id}/status")
async def get_document_status(doc_id: str, user: dict = Depends(get_current_user)):
    """Poll document processing status."""
    db = get_supabase_admin()
    result = db.table("documents").select("processing_status, chunk_count").eq("id", doc_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data


@router.get("/{doc_id}/url")
async def get_document_url(doc_id: str, user: dict = Depends(get_current_user)):
    """Return the secure URL for document access."""
    db = get_supabase_admin()
    result = db.table("documents").select("cloudinary_url").eq("id", doc_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"url": result.data["cloudinary_url"]}


@router.get("/{doc_id}/proxy")
async def proxy_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Stream the document binary from Cloudinary with correct headers for in-browser PDF rendering."""
    db = get_supabase_admin()
    result = db.table("documents").select("cloudinary_url, cloudinary_public_id, file_type, file_name").eq("id", doc_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    file_type = result.data.get("file_type", "pdf")
    file_name = result.data.get("file_name", "document")
    public_id = result.data.get("cloudinary_public_id")

    content_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "ppt": "application/vnd.ms-powerpoint",
        "jpg": "image/jpeg",
        "png": "image/png",
    }

    # Download document from Supabase storage using the path (stored in public_id)
    PROXY_SIZE_LIMIT = 50 * 1024 * 1024  # 50 MB
    try:
        if public_id:
            file_bytes = db.storage.from_("mentora-docs").download(public_id)
        else:
            # Fallback for old cloudinary documents (which might fail, but added for safety)
            raise HTTPException(status_code=502, detail="Document format not supported for delivery. Please re-upload.")

        if not file_bytes or len(file_bytes) == 0:
            raise HTTPException(status_code=502, detail="Document storage returned empty file")
        if len(file_bytes) > PROXY_SIZE_LIMIT:
            raise HTTPException(status_code=413, detail="Document too large to proxy; please download directly")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch document from storage: {str(e)}")

    from fastapi.responses import Response
    return Response(
        content=file_bytes,
        media_type=content_types.get(file_type, "application/octet-stream"),
        headers={
            "Content-Disposition": f'inline; filename="{file_name}"',
            "Content-Length": str(len(file_bytes)),
            "Cache-Control": "private, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


@router.get("/{doc_id}/thumbnail")
async def get_document_thumbnail(doc_id: str, user: dict = Depends(get_current_user)):
    """
    Serve the pre-rendered JPEG thumbnail of page 1.
    The JPEG (~10-20 KB) was generated at upload time and stored in Supabase.
    This endpoint never downloads the full PDF.
    """
    db = get_supabase_admin()
    result = (
        db.table("documents")
        .select("file_type, processing_status")
        .eq("id", doc_id)
        .eq("user_id", user["id"])
        .eq("is_deleted", False)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    row = result.data
    # Thumbnails are generated for both PDFs and images (jpg/png)
    if row.get("file_type") not in ("pdf", "jpg", "png"):
        raise HTTPException(status_code=415, detail="Thumbnail not available for this file type")
    if row.get("processing_status") not in ("ready", "pending", "processing"):
        raise HTTPException(status_code=409, detail="Document not available")

    thumb_path = f"thumbnails/{doc_id}.jpg"
    try:
        jpeg_bytes = db.storage.from_("mentora-docs").download(thumb_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Thumbnail not yet available")

    if not jpeg_bytes:
        raise HTTPException(status_code=404, detail="Thumbnail not yet available")

    from fastapi.responses import Response
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={
            # Tiny file — cache aggressively in browser
            "Cache-Control": "private, max-age=604800, immutable",
            "Content-Length": str(len(jpeg_bytes)),
        },
    )


@router.put("/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, data: DocumentUpdate, user: dict = Depends(get_current_user)):
    """Rename or move a document."""
    db = get_supabase_admin()
    update_data = data.model_dump(exclude_none=True)
    result = db.table("documents").update(update_data).eq("id", doc_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data[0]


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Soft delete a document."""
    db = get_supabase_admin()

    # Get cloudinary public_id
    doc = db.table("documents").select("cloudinary_public_id").eq("id", doc_id).eq("user_id", user["id"]).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Soft delete
    db.table("documents").update({"is_deleted": True}).eq("id", doc_id).execute()

    # Delete chunks
    db.table("document_chunks").delete().eq("document_id", doc_id).execute()

    # Delete from Supabase Storage (document + thumbnail)
    delete_file(doc.data["cloudinary_public_id"])
    delete_thumbnail(doc_id)

    return {"message": "Document deleted"}

