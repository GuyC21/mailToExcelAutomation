"""Audit-trail table for per-document ingestions.

The Excel workbook is the finance team's source of truth; this table is the
operational log behind it: every attempt (including failures) is recorded,
together with the raw model answer, so any Excel row can be traced back.
"""
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base
from models.inbound_email import InboundEmail  # noqa: F401  (backward-compatible re-export)

# Pre-LLM status assigned when a document enters the pipeline but extraction
# has not yet completed.  Allows the Sandbox UI to display a persistent
# loading spinner even after a browser refresh.
STATUS_PROCESSING = "PROCESSING"


class DocumentIngestion(Base):
    """One document run through the extraction pipeline."""

    __tablename__ = "document_ingestions"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("inbound_emails.id"), nullable=True, index=True)
    channel = Column(String(20), nullable=False)  # email | sandbox
    original_filename = Column(String(500))
    stored_path = Column(String(1000))
    content_type = Column(String(100))
    size_bytes = Column(Integer)
    # SET NULL: deleting an old prompt must not be blocked by (or erase) its history.
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id", ondelete="SET NULL"), nullable=True)
    prompt_name = Column(String(500))
    provider = Column(String(50))
    model = Column(String(100))
    status = Column(String(30), index=True)  # PROCESSING | VALID | NEEDS_REVIEW | EXTRACTION_FAILED
    issues = Column(JSON)
    extracted_data = Column(JSON, nullable=True)
    attempts = Column(JSON)
    raw_response = Column(Text)
    error = Column(Text)
    excel_synced = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Human-in-the-loop reviewer attribution: tracks who modified or verified the document
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
        comment="UTC timestamp of the latest manual review or modification",
    )
    updated_by_id = Column(
        String(36),
        ForeignKey("user_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="UUID of the user who performed the latest manual review or modification",
    )
    # Sandbox job ownership: tracks who initiated this ingestion so the UI can
    # poll only the current user's in-flight jobs (BOLA/IDOR protection).
    created_by_id = Column(
        String(36),
        ForeignKey("user_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="UUID of the user who initiated this ingestion (Sandbox only; NULL for production webhooks)",
    )

    email = relationship("InboundEmail", back_populates="documents", lazy="joined")
    updated_by = relationship("UserProfile", foreign_keys=[updated_by_id], lazy="joined")
    created_by = relationship("UserProfile", foreign_keys=[created_by_id], lazy="joined")
