"""Pydantic DTO schemas for Sandbox in-flight job tracking endpoints."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ActiveJobResponse(BaseModel):
    """Lightweight response indicating whether the caller has an in-flight job."""

    active: bool
    document_id: Optional[int] = None
    filename: Optional[str] = None
    channel: Optional[str] = None
    email_id: Optional[int] = None


class JobResultResponse(BaseModel):
    """Full extraction result for a completed (or failed) Sandbox job.

    Mirrors ``IngestionResult`` but is intentionally a separate schema so the
    status endpoint never accidentally leaks fields added to the ingestion
    response in the future.
    """

    document_id: int
    filename: str
    channel: str
    status: str
    provider: Optional[str] = None
    model: Optional[str] = None
    prompt_version_id: Optional[int] = None
    prompt_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    issues: List[Dict[str, Any]] = []
    error: Optional[str] = None
    email_id: Optional[int] = None
    all_completed: bool = True
    email: Optional[Dict[str, Any]] = None
    all_results: Optional[List[Dict[str, Any]]] = None
