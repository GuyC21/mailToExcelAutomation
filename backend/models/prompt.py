"""SQLAlchemy model for versioned extraction business prompts."""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from database import Base


class PromptVersion(Base):
    """One versioned business instruction prompt managed in the Backoffice."""

    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    content = Column(Text, nullable=False)
    version_notes = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
