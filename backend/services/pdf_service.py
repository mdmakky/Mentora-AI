import fitz  # PyMuPDF
import hashlib
import io
from typing import List, Tuple, Optional


def extract_text_from_pdf(file_bytes: bytes) -> List[dict]:
    """Extract text from PDF page by page."""
    pages = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text.strip():
            pages.append({
                "page_number": page_num + 1,
                "content": text.strip(),
            })

    doc.close()
    return pages


def get_pdf_page_count(file_bytes: bytes) -> int:
    """Get the number of pages in a PDF."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    count = len(doc)
    doc.close()
    return count


def get_pdf_metadata(file_bytes: bytes) -> dict:
    """Extract PDF metadata for copyright check."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    metadata = doc.metadata or {}
    doc.close()
    return metadata


def extract_text_from_docx(file_bytes: bytes) -> List[dict]:
    """Extract text from DOCX file."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        pages = []
        current_text = []
        page_num = 1

        for para in doc.paragraphs:
            current_text.append(para.text)
            # Approximate page breaks every ~3000 chars
            if len("\n".join(current_text)) > 3000:
                pages.append({
                    "page_number": page_num,
                    "content": "\n".join(current_text).strip(),
                })
                current_text = []
                page_num += 1

        if current_text:
            pages.append({
                "page_number": page_num,
                "content": "\n".join(current_text).strip(),
            })

        return pages
    except Exception as e:
        return [{"page_number": 1, "content": f"Error extracting DOCX: {str(e)}"}]


def extract_text_from_pptx(file_bytes: bytes) -> List[dict]:
    """Extract text from PPTX file."""
    try:
        from pptx import Presentation
        prs = Presentation(io.BytesIO(file_bytes))
        slides = []

        for slide_num, slide in enumerate(prs.slides, 1):
            texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    texts.append(shape.text)
            if texts:
                slides.append({
                    "page_number": slide_num,
                    "content": "\n".join(texts).strip(),
                    "slide_number": slide_num,
                })

        return slides
    except Exception as e:
        return [{"page_number": 1, "content": f"Error extracting PPTX: {str(e)}"}]


def calculate_file_hash(file_bytes: bytes) -> str:
    """Calculate SHA-256 hash of file content."""
    return hashlib.sha256(file_bytes).hexdigest()
