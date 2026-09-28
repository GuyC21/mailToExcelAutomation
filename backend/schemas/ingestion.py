"""API response shapes for ingestion results."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ExcelWriteResult(BaseModel):
    written: bool
    message: Optional[str] = None


class IngestionResult(BaseModel):
    """What the Sandbox UI renders for one processed document."""

    ingestion_id: Optional[int] = None
    filename: str
    channel: str
    status: str  # VALID | NEEDS_REVIEW | EXTRACTION_FAILED | SKIPPED
    provider: Optional[str] = None
    model: Optional[str] = None
    prompt_version_id: Optional[int] = None
    prompt_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    issues: List[Dict[str, Any]] = []
    error: Optional[str] = None
    attempts: List[Dict[str, Any]] = []
    excel: Optional[ExcelWriteResult] = None
    # True when this attachment was already ingested from an earlier delivery
    # of the same email: the fields describe that original record, and no new
    # record was created.
    duplicate: bool = False


class EmailAttachmentInfo(BaseModel):
    filename: str
    content_type: str
    size_bytes: int


class EmailInfo(BaseModel):
    """The inbound email exactly as the system received it (minus file bytes)."""

    id: int
    source_format: str
    message_id: Optional[str]
    sender: str
    recipients: str
    subject: str
    sent_at: Optional[str]
    body_text: str
    headers: Dict[str, str]
    attachments: List[EmailAttachmentInfo]


class EmailIngestionResponse(BaseModel):
    email: EmailInfo
    results: List[IngestionResult]
