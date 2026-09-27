from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from database import Base

class IngestionRecord(Base):
    __tablename__ = "ingestion_records"

    id = Column(Integer, primary_key=True, index=True)
    sender_email = Column(String, index=True)
    subject = Column(String)
    attachment_path = Column(String)
    extracted_data = Column(JSON, nullable=True)
    validation_status = Column(String, default="PENDING") # PENDING, VALID, WARNING_MATH_MISMATCH, EXTRACTION_FAILED
    created_at = Column(DateTime(timezone=True), server_default=func.now())
