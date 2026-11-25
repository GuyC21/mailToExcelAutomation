"""Audit-trail table for inbound emails received by the ingestion webhook."""
from sqlalchemy import JSON, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class InboundEmail(Base):
    """One email received by the inbound webhook (headers + body).

    Attributes:
        id: Primary key identifier.
        source_format: Ingestion wire format (``multipart``, ``json``, or ``eml``).
        message_id: RFC 5322 Message-ID header.
        sender: Email ``From`` header string.
        recipients: Email ``To`` header string.
        subject: Email subject line.
        sent_at: Raw ``Date`` header as received.
        body_text: Extracted plain/HTML body text.
        headers: Full email header dictionary.
        received_at: UTC timestamp when the email was persisted.
        documents: Linked ``DocumentIngestion`` attachments extracted from this email.
    """

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
