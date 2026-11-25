"""Pydantic schemas for LLM provider key verification endpoints."""
from typing import Literal

from pydantic import BaseModel, Field


class KeyVerifyRequest(BaseModel):
    """Payload for verifying a personal BYOK LLM API key."""

    provider: Literal["gemini", "openai"] = Field(
        ...,
        description="Target LLM provider ('gemini' or 'openai')",
    )
    api_key: str = Field(
        ...,
        min_length=5,
        max_length=256,
        description="The raw API key to test.",
    )


class KeyVerifyResponse(BaseModel):
    """Response payload detailing API key verification outcome."""

    valid: bool
    provider: str
    model: str
    message: str
