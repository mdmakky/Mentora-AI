import cloudinary
import cloudinary.uploader
import cloudinary.utils
import time
from core.config import get_settings

settings = get_settings()

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_file(file_bytes: bytes, user_id: str, course_id: str, document_id: str, filename: str) -> dict:
    """Upload a file to Cloudinary."""
    result = cloudinary.uploader.upload(
        file_bytes,
        resource_type="raw",
        folder=f"mentora/{user_id}/{course_id}",
        public_id=f"{document_id}_{filename}",
    )
    return {
        "secure_url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "bytes": result.get("bytes"),
    }


def upload_avatar(file_bytes: bytes, user_id: str) -> str:
    """Upload an avatar image to Cloudinary."""
    result = cloudinary.uploader.upload(
        file_bytes,
        resource_type="image",
        folder=f"mentora/avatars",
        public_id=f"avatar_{user_id}",
        overwrite=True,
        transformation=[
            {"width": 200, "height": 200, "crop": "fill", "gravity": "face"},
        ],
    )
    return result.get("secure_url")


def get_signed_url(public_id: str, expires_in: int = 3600) -> str:
    """Generate a signed URL for secure file access."""
    signed_url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="raw",
        sign_url=True,
        type="upload",
        expires_at=int(time.time()) + expires_in,
    )
    return signed_url


def delete_file(public_id: str) -> bool:
    """Delete a file from Cloudinary."""
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="raw")
        return result.get("result") == "ok"
    except Exception:
        return False
