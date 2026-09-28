"""Idempotency ledger for email attachments.

Mail providers retry webhooks (timeouts, 5xx) and people forward the same
email twice. Each (delivery identity, attachment content) pair may create at
most one financial record: the UNIQUE ``dedupe_key`` makes that hold even for
concurrent retries, because only one insert can win.

A row is written *before* extraction starts (``ingestion_id`` NULL = in
progress) and completed with the ingestion id afterwards; a claim left NULL
by a crashed worker is considered stale after a timeout and can be retaken.

New table (not a column on ``inbound_emails``) so existing databases pick it
up through ``create_all`` without a migration.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from database import Base


class ProcessedAttachment(Base):
    """One attachment that has been (or is being) ingested from an email."""

    __tablename__ = "processed_attachments"

    id = Column(Integer, primary_key=True)
    dedupe_key = Column(String(64), nullable=False, unique=True, index=True)
    ingestion_id = Column(Integer, ForeignKey("document_ingestions.id", ondelete="CASCADE"),
                          nullable=True, index=True)
    claimed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
