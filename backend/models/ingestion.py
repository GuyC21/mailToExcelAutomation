"""Audit-trail tables for inbound emails and per-document ingestions.

The Excel workbook is the finance team's source of truth; these tables are the
operational log behind it: every attempt (including failures) is recorded,
together with the raw model answer, so any Excel row can be traced back.
"""
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class InboundEmail(Base):
    """One email received by the inbound webhook (headers + body)."""

    __tablename__ = "inbound_emails"

    id = Column(Integer, primary_key=True, index=True)
    source_format = Column(String(20), nullable=False)  # multipart | json | eml
    message_id = Column(String(500), index=True)
    sender = Column(String(500))
    recipients = Column(String(1000))
    subject = Column(String(1000))
    sent_at = Column(String(100))  # Raw "Date" header, as sent
    body_text = Column(Text)
    headers = Column(JSON)
    received_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("DocumentIngestion", back_populates="email")


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
    status = Column(String(30), index=True)  # VALID | NEEDS_REVIEW | EXTRACTION_FAILED
    issues = Column(JSON)
    extracted_data = Column(JSON, nullable=True)
    attempts = Column(JSON)
    raw_response = Column(Text)
    error = Column(Text)
    excel_synced = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    email = relationship("InboundEmail", back_populates="documents", lazy="joined")
