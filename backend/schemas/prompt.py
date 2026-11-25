"""Pydantic schemas for prompt version management and AI prompt enhancement."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PromptCreate(BaseModel):
    """Payload for creating a new versioned extraction business prompt."""

    name: str = Field(..., min_length=1, max_length=200, description="Human-readable version name.")
    content: str = Field(..., min_length=1, max_length=50_000, description="Business extraction instructions.")
    version_notes: Optional[str] = Field(None, max_length=1000, description="Optional release notes.")
    is_active: bool = False

    @field_validator("name", "content")
    @classmethod
    def _reject_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("השדה אינו יכול להיות ריק")
        return cleaned


class PromptResponse(BaseModel):
    """Serialized prompt version returned by the Backoffice API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    content: str
    version_notes: Optional[str] = None
    is_active: bool = False


class EnhanceRequest(BaseModel):
    """Payload for AI-assisted prompt enhancement."""

    text: str = Field(..., min_length=1, max_length=20_000, description="Draft prompt instructions to refine.")

    @field_validator("text")
    @classmethod
    def _reject_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Text is required")
        return cleaned
