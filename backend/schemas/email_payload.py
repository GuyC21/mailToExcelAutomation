"""Normalised representation of an inbound email, whatever its wire format."""
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class EmailAttachment(BaseModel):
    """An attachment with its raw bytes (never serialised back to clients)."""

    filename: str
    content_type: str = "application/octet-stream"
    content: bytes = Field(repr=False)

    @property
    def size(self) -> int:
        return len(self.content)


class InboundEmailPayload(BaseModel):
    """An email as received by the webhook – the unit shown in the demo UI."""

    source_format: str
    message_id: Optional[str] = None
    sender: str = ""
    recipients: str = ""
    subject: str = ""
    sent_at: Optional[str] = None
    body_text: str = ""
    headers: Dict[str, str] = Field(default_factory=dict)
    attachments: List[EmailAttachment] = Field(default_factory=list)


class JsonAttachment(BaseModel):
    """Attachment inside a JSON webhook body (base64-encoded)."""

    filename: str
    content_type: str = "application/pdf"
    content_base64: str


class JsonEmailRequest(BaseModel):
    """JSON webhook body, similar to Postmark / Mailgun inbound formats."""

    sender: str = Field(..., alias="from", max_length=500)
    to: str = Field("", max_length=1000)
    subject: str = Field("", max_length=1000)
    text: str = Field("", max_length=100_000)
    message_id: Optional[str] = Field(None, max_length=500)
    date: Optional[str] = Field(None, max_length=100)
    headers: Dict[str, str] = Field(default_factory=dict)
    attachments: List[JsonAttachment] = Field(default_factory=list, max_length=20)

    model_config = {"populate_by_name": True}
