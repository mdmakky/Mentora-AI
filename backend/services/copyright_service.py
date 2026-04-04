import re
from typing import Tuple
from services.pdf_service import get_pdf_metadata


# Known publisher/copyright keywords
COPYRIGHT_KEYWORDS = [
    "all rights reserved",
    "isbn",
    "published by",
    "copyright ©",
    "copyright (c)",
    "pearson",
    "mcgraw-hill",
    "mcgraw hill",
    "wiley",
    "springer",
    "elsevier",
    "o'reilly",
    "oreilly",
    "cambridge university press",
    "oxford university press",
    "addison-wesley",
    "prentice hall",
    "cengage",
    "taylor & francis",
]


def scan_metadata(file_bytes: bytes) -> Tuple[bool, str]:
    """
    Scan PDF metadata for copyright indicators.
    Returns (is_flagged, reason).
    """
    metadata = get_pdf_metadata(file_bytes)

    fields_to_check = ["title", "author", "producer", "creator", "subject"]
    for field in fields_to_check:
        value = metadata.get(field, "")
        if value:
            value_lower = value.lower()
            for keyword in COPYRIGHT_KEYWORDS:
                if keyword in value_lower:
                    return True, f"Copyright keyword '{keyword}' found in metadata field '{field}'"

    return False, ""


def scan_content_pages(pages: list) -> Tuple[bool, str]:
    """
    Scan first and last 3 pages for copyright keywords.
    Returns (is_flagged, reason).
    """
    pages_to_check = []

    # First 3 pages
    pages_to_check.extend(pages[:3])

    # Last 3 pages
    if len(pages) > 3:
        pages_to_check.extend(pages[-3:])

    for page_data in pages_to_check:
        content_lower = page_data.get("content", "").lower()
        for keyword in COPYRIGHT_KEYWORDS:
            if keyword in content_lower:
                page_num = page_data.get("page_number", "?")
                return True, f"Copyright keyword '{keyword}' found on page {page_num}"

    return False, ""


def check_duplicate_hash(file_hash: str, user_id: str, db) -> Tuple[bool, str]:
    """
    Check if a file with the same hash already exists.
    Returns (is_duplicate, reason).
    """
    result = (
        db.table("documents")
        .select("id, file_name")
        .eq("file_hash", file_hash)
        .eq("user_id", user_id)
        .eq("is_deleted", False)
        .execute()
    )

    if result.data and len(result.data) > 0:
        existing = result.data[0]
        return True, f"Duplicate file detected: '{existing['file_name']}'"

    return False, ""


def run_copyright_check(file_bytes: bytes, pages: list, file_hash: str, user_id: str, db) -> Tuple[bool, str]:
    """
    Run all copyright checks.
    Returns (should_quarantine, reason).
    """
    # Check metadata
    flagged, reason = scan_metadata(file_bytes)
    if flagged:
        return True, reason

    # Check content pages
    flagged, reason = scan_content_pages(pages)
    if flagged:
        return True, reason

    # Check duplicate hash
    is_dup, reason = check_duplicate_hash(file_hash, user_id, db)
    if is_dup:
        return True, reason

    return False, ""
