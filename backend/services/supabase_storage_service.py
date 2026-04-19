import re
from core.database import get_supabase_admin

def upload_document(file_bytes: bytes, user_id: str, course_id: str, document_id: str, filename: str) -> dict:
    """Upload a document to Supabase storage."""
    db = get_supabase_admin()
    
    # Sanitize the filename to avoid InvalidKey errors in Supabase storage
    safe_filename = re.sub(r'[^a-zA-Z0-9.\-_]', '_', filename)
    path = f"{user_id}/{course_id}/{document_id}_{safe_filename}"
    bucket = "mentora-docs"
    
    # Infer basic content-types from extension
    content_type = "application/pdf"
    lower_name = safe_filename.lower()
    if lower_name.endswith(".png"):
        content_type = "image/png"
    elif lower_name.endswith(".jpg") or lower_name.endswith(".jpeg"):
        content_type = "image/jpeg"
    elif lower_name.endswith(".docx"):
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower_name.endswith(".pptx"):
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

    # Upload bytes to Supabase storage
    db.storage.from_(bucket).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type}
    )
    
    return {
        "secure_url": f"supabase://{bucket}/{path}", # We don't expose public Supabase URLs, we just need a placeholder
        "public_id": path,
    }

def delete_document(path: str) -> bool:
    """Delete a document from Supabase storage."""
    try:
        db = get_supabase_admin()
        db.storage.from_("mentora-docs").remove([path])
        return True
    except Exception:
        return False


def upload_thumbnail(jpeg_bytes: bytes, doc_id: str) -> str:
    """
    Store a pre-rendered JPEG thumbnail in Supabase at a predictable path.
    Returns the storage path, or empty string on failure.
    The thumbnail endpoint downloads this tiny file (~10-20 KB) instead of
    the full PDF, so the backend never has to download the whole document
    again just to show a card preview.
    """
    db = get_supabase_admin()
    path = f"thumbnails/{doc_id}.jpg"
    try:
        db.storage.from_("mentora-docs").upload(
            path=path,
            file=jpeg_bytes,
            file_options={"content-type": "image/jpeg"},
        )
        return path
    except Exception:
        return ""


def delete_thumbnail(doc_id: str) -> None:
    """Remove thumbnail when the parent document is deleted."""
    try:
        db = get_supabase_admin()
        db.storage.from_("mentora-docs").remove([f"thumbnails/{doc_id}.jpg"])
    except Exception:
        pass
