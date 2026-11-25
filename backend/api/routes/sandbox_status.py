"""Sandbox Job Status API — persistent in-flight tracking for the Sandbox UI.

Provides endpoints that allow the Sandbox frontend to poll the processing
status of ingestion jobs initiated by the **current user**.  Every query is
strictly scoped to ``created_by_id == current_user.id`` to prevent BOLA/IDOR
attacks: a user can never observe, poll, or enumerate another user's jobs.

Security invariants:
  * ``GET /active-job``: Returns at most one PROCESSING record owned by the
    caller, ignoring any record older than the staleness window (5 min).
  * ``GET /job-result/{document_id}``: Returns the full result only if the
    record's ``created_by_id`` matches the caller.
  * Production-webhook ingestions (``created_by_id IS NULL``) are invisible
    to both endpoints.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import require_approved_user
from database import get_db
from models.ingestion import DocumentIngestion, STATUS_PROCESSING
from models.user import UserProfile
from repositories import ingestion_repository as ingestion_repo
from schemas.sandbox import ActiveJobResponse, JobResultResponse  # noqa: F401 (re-exported for tests)

logger = logging.getLogger("billingstream.sandbox_status")
router = APIRouter()

# A PROCESSING job older than this is treated as stale (the worker likely
# crashed).  The frontend should stop showing a spinner for it.
_STALENESS_WINDOW = timedelta(minutes=5)


# ── Endpoints ──────────────────────────────────────────────────────────

@router.get("/active-job", response_model=ActiveJobResponse)
async def get_active_job(
    current_user: UserProfile = Depends(require_approved_user),
    db: AsyncSession = Depends(get_db),
) -> ActiveJobResponse:
    """Checks whether the caller has a PROCESSING job in-flight.

    Only returns jobs that are (a) owned by the current user and (b) created
    within the staleness window.  This is the entry point the frontend calls
    on page load to decide whether to show a spinner.

    Args:
        current_user: The verified, approved Backoffice user.
        db: The database session dependency.

    Returns:
        ActiveJobResponse with ``active=True`` and job metadata when a
        PROCESSING job exists, or ``active=False`` otherwise.
    """
    cutoff = datetime.now(timezone.utc) - _STALENESS_WINDOW
    user_id = str(current_user.id)
    record = await ingestion_repo.get_active_user_job(db, user_id=user_id, cutoff=cutoff)

    if record:
        return ActiveJobResponse(
            active=True,
            document_id=record.id,
            filename=record.original_filename,
            channel=record.channel,
            email_id=record.email_id,
        )

    # If no job is currently PROCESSING, check if an ingestion completed
    # recently for this user (within the staleness window) so that refreshing
    # right after extraction finishes can restore the full results.
    recent = await ingestion_repo.get_recent_user_job(db, user_id=user_id, cutoff=cutoff)
    if recent:
        return ActiveJobResponse(
            active=False,
            document_id=recent.id,
            filename=recent.original_filename,
            channel=recent.channel,
            email_id=recent.email_id,
        )

    return ActiveJobResponse(active=False)


def _serialize_single_doc(rec: DocumentIngestion) -> Dict[str, Any]:
    """Serializes a DocumentIngestion row into a clean public dictionary."""
    return {
        "document_id": rec.id,
        "ingestion_id": rec.id,
        "filename": rec.original_filename,
        "channel": rec.channel,
        "status": rec.status,
        "provider": rec.provider,
        "model": rec.model,
        "prompt_version_id": rec.prompt_version_id,
        "prompt_name": rec.prompt_name,
        "data": rec.extracted_data,
        "issues": rec.issues or [],
        "error": rec.error,
        "email_id": rec.email_id,
    }


@router.get("/job-result/{document_id}", response_model=JobResultResponse)
async def get_job_result(
    document_id: int,
    current_user: UserProfile = Depends(require_approved_user),
    db: AsyncSession = Depends(get_db),
) -> JobResultResponse:
    """Returns the extraction result for a specific job.

    When the document is part of a multi-file email (``email_id`` is not None),
    this endpoint automatically gathers **all attachments** belonging to that
    email, ensuring the UI restores all cards after a page refresh.

    Args:
        document_id: The primary key of the DocumentIngestion record.
        current_user: The verified, approved Backoffice user.
        db: The database session dependency.

    Returns:
        JobResultResponse with the extraction result and any sibling documents.

    Raises:
        HTTPException: 404 if the document does not exist or is not owned by the caller.
    """
    user_id = str(current_user.id)
    record = await ingestion_repo.get_owned_document(db, document_id=document_id, user_id=user_id)

    if not record:
        raise HTTPException(status_code=404, detail="המסמך לא נמצא.")

    # Multi-file email handling: gather all sibling documents belonging to this email & user
    all_results: List[Dict[str, Any]] = []
    all_completed = True
    email_data: Optional[Dict[str, Any]] = None

    if record.email_id is not None:
        siblings = await ingestion_repo.list_owned_email_siblings(
            db,
            email_id=record.email_id,
            user_id=user_id,
        )
        all_results = [_serialize_single_doc(s) for s in siblings]
        all_completed = not any(s.status == STATUS_PROCESSING for s in siblings)

        if record.email:
            email_data = {
                "id": record.email.id,
                "source_format": record.email.source_format,
                "message_id": record.email.message_id,
                "sender": record.email.sender or "",
                "recipients": record.email.recipients or "",
                "subject": record.email.subject or "",
                "sent_at": record.email.sent_at,
                "body_text": record.email.body_text or "",
                "headers": record.email.headers or {},
                "attachments": [
                    {"filename": s.original_filename, "content_type": s.content_type, "size_bytes": s.size_bytes or 0}
                    for s in siblings
                ],
            }
    else:
        all_results = [_serialize_single_doc(record)]
        all_completed = (record.status != STATUS_PROCESSING)

    base = _serialize_single_doc(record)
    return JobResultResponse(
        **base,
        all_completed=all_completed,
        email=email_data,
        all_results=all_results,
    )
