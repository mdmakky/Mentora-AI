from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional
from schemas.document import DocumentUpdate, DocumentResponse
from core.database import get_supabase_admin
from core.dependencies import get_current_user, check_upload_allowed
from services.supabase_storage_service import upload_document as upload_file, delete_document as delete_file
from services.pdf_service import (
    extract_text_from_pdf, extract_text_from_docx, extract_text_from_pptx,
    calculate_file_hash, get_pdf_page_count,
)
from services.copyright_service import run_copyright_check
from services.rag_service import process_document_pipeline
import uuid
import httpx

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_TYPES = {"application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
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
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and PPTX files are allowed")

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")

    db = get_supabase_admin()
    doc_id = str(uuid.uuid4())

    # Calculate file hash
    file_hash = calculate_file_hash(file_bytes)

    # Check for duplicates
    dup_check = db.table("documents").select("id").eq("file_hash", file_hash).eq("user_id", user["id"]).eq("is_deleted", False).execute()
    if dup_check.data:
        raise HTTPException(status_code=400, detail="This file has already been uploaded")

    # Get page count for PDF
    page_count = 0
    if file_type == "pdf":
        page_count = get_pdf_page_count(file_bytes)

    # Upload to Supabase Storage
    cloud_result = upload_file(file_bytes, user["id"], course_id, doc_id, file.filename)

    # Run copyright check
    pages = []
    if file_type == "pdf":
        pages = extract_text_from_pdf(file_bytes)
    elif file_type == "docx":
        pages = extract_text_from_docx(file_bytes)
    elif file_type == "pptx":
        pages = extract_text_from_pptx(file_bytes)

    is_flagged, flag_reason = run_copyright_check(file_bytes, pages, file_hash, user["id"], db)

    processing_status = "quarantined" if is_flagged else "pending"

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
        "file_hash": file_hash,
    }

    result = db.table("documents").insert(doc_data).execute()

    # If not quarantined, start processing pipeline
    if not is_flagged:
        background_tasks.add_task(
            process_document_pipeline,
            doc_id, course_id, user["id"], file_bytes, file_type, file.filename,
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
async def proxy_document(doc_id: str, token: Optional[str] = None, user: dict = None):
    """Stream the document binary from Cloudinary with correct headers for in-browser PDF rendering."""
    # Support token via query param for react-pdf (can't set Authorization headers)
    if user is None:
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")
        from core.security import decode_token
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = {"id": user_id}

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
    }

    # Download document from Supabase storage using the path (stored in public_id)
    try:
        if public_id:
            file_bytes = db.storage.from_("mentora-docs").download(public_id)
        else:
            # Fallback for old cloudinary documents (which might fail, but added for safety)
            raise HTTPException(status_code=502, detail="Document format not supported for delivery. Please re-upload.")
            
        if not file_bytes or len(file_bytes) == 0:
             raise HTTPException(status_code=502, detail="Document storage returned empty file")
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

    # Delete from Supabase Storage
    delete_file(doc.data["cloudinary_public_id"])

    return {"message": "Document deleted"}

