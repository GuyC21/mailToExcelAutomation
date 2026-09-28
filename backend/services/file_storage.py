"""Safe persistence of incoming documents.

Untrusted filenames are never used as paths: files are stored under a random
prefix inside a dated inbox folder, and the content type is verified from the
file's magic bytes rather than trusted from the client.
"""
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from config import get_settings

# extension -> (mime type, magic-byte prefix check)
_SUPPORTED = {
    ".pdf": ("application/pdf", lambda b: b.startswith(b"%PDF")),
    ".png": ("image/png", lambda b: b.startswith(b"\x89PNG")),
    ".jpg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".webp": ("image/webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}
_UNSAFE_CHARS = re.compile(r"[^\w.\- ()]", re.UNICODE)


class UnsupportedDocumentError(ValueError):
    """The file is not a supported, well-formed document (HTTP 400/415)."""


@dataclass
class StoredDocument:
    """A document saved in the inbox."""

    original_filename: str
    stored_path: str
    mime_type: str
    size_bytes: int


def safe_filename(filename: Optional[str]) -> str:
    """Strips directories and unsafe characters; keeps Hebrew letters.

    Security measure: Prevents directory traversal attacks and sanitizes 
    untrusted user input before writing to the filesystem.

    Args:
        filename (Optional[str]): The original filename provided by the client.

    Returns:
        str: A sanitized, safe filename string.
    """
    base = os.path.basename((filename or "").replace("\\", "/")).strip()
    cleaned = _UNSAFE_CHARS.sub("_", base).strip(". ")
    return cleaned[:120] or "document"


def detect_document_type(filename: str, content: bytes) -> Optional[str]:
    """Returns the MIME type if the file is a supported document, else None."""
    extension = os.path.splitext(filename.lower())[1]
    spec = _SUPPORTED.get(extension)
    if spec and spec[1](content[:16]):
        return spec[0]
    return None


def store_document(filename: str, content: bytes) -> StoredDocument:
    """Validates and saves a document to ``<inbox>/<date>/<uuid>_<name>``.

    We isolate files by date to prevent directories from getting too large and 
    prepend UUIDs to prevent filename collisions. It verifies mime-type against 
    magic bytes rather than trusting the client's extension for security.

    Args:
        filename (str): The untrusted original filename.
        content (bytes): The raw file data.

    Returns:
        StoredDocument: Metadata describing the successfully stored document.

    Raises:
        UnsupportedDocumentError: For empty, oversized, or unsupported file formats.
    """
    settings = get_settings()
    name = safe_filename(filename)
    if not content:
        raise UnsupportedDocumentError(f"הקובץ '{name}' ריק")
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise UnsupportedDocumentError(f"הקובץ '{name}' גדול מ-{settings.max_upload_mb}MB")
    mime_type = detect_document_type(name, content)
    if not mime_type:
        raise UnsupportedDocumentError(f"הקובץ '{name}' אינו PDF או תמונה נתמכת")
    folder = os.path.join(settings.inbox_dir, datetime.now().strftime("%Y-%m-%d"))
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{uuid.uuid4().hex[:12]}_{name}")
    with open(path, "wb") as handle:
        handle.write(content)
    return StoredDocument(original_filename=name, stored_path=path, mime_type=mime_type, size_bytes=len(content))
