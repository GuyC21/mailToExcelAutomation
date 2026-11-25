"""Pydantic request schemas for reviewed document updates."""
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class DocumentUpdateRequest(BaseModel):
    """Payload accepted by ``PATCH /api/documents/{id}``.

    Attributes:
        extracted_data: Optional updated invoice extraction payload verified against
            ``DocumentExtraction`` and re-checked by deterministic business rules.
        status: Optional explicit review lifecycle status override
            (``VALID``, ``NEEDS_REVIEW``, or ``EXTRACTION_FAILED``).
    """

    extracted_data: Optional[Dict[str, Any]] = Field(
        None,
        description="Updated extracted invoice fields conforming to DocumentExtraction.",
    )
    status: Optional[str] = Field(
        None,
        description="Target review status: VALID, NEEDS_REVIEW, or EXTRACTION_FAILED.",
    )
