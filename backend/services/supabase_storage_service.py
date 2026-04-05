from core.database import get_supabase_admin

def upload_document(file_bytes: bytes, user_id: str, course_id: str, document_id: str, filename: str) -> dict:
    """Upload a document to Supabase storage."""
    db = get_supabase_admin()
    path = f"{user_id}/{course_id}/{document_id}_{filename}"
    bucket = "mentora-docs"
    
    # Upload bytes to Supabase storage
    db.storage.from_(bucket).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": "application/pdf"}
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
