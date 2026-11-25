"""API routes for managing and reviewing document ingestions.

Provides endpoints to list ingested invoices, download physical document files for
in-browser preview, update extracted invoice fields with human reviewer attribution,
and delete records with automatic synchronization to the master Excel workbook.
"""
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import require_approved_user
from config import get_settings
from database import get_db
from models.ingestion import STATUS_PROCESSING
from models.user import UserProfile
from repositories import ingestion_repository as ingestion_repo
from schemas.document import DocumentUpdateRequest
from schemas.extraction import DocumentExtraction
from services.extraction.providers.base import short_error
from services.file_storage import delete_stored_document, resolve_inbox_file
from services.validation.business_rules import (
    STATUS_FAILED,
    STATUS_NEEDS_REVIEW,
    STATUS_VALID,
    derive_status,
    validate_document,
)
from services.excel_sync import sync_pending, get_excel_repository

logger = logging.getLogger(__name__)
router = APIRouter()
_EDITABLE_STATUSES = {STATUS_VALID, STATUS_NEEDS_REVIEW, STATUS_FAILED}


def _serialize_user_identity(user: Optional[UserProfile], user_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Serializes a reviewer user profile into a safe response dictionary.

    Args:
        user: The resolved UserProfile model instance (if joined/available).
        user_id: The raw updated_by_id foreign key string.

    Returns:
        A dictionary containing id, email, and full_name, or None if unedited.
    """
    if user:
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        }
    if user_id == "system-api-key":
        return {
            "id": "system-api-key",
            "email": "system@billingstream.local",
            "full_name": "System API Key",
        }
    return None


@router.get("", response_model=List[Dict[str, Any]], summary="List recent ingested documents")
async def list_documents(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Lists recent ingested documents with optional status filtering.

    Excludes in-flight ``PROCESSING`` placeholders and includes reviewer audit
    attribution (who last updated the document and when).

    Args:
        status: Optional lifecycle status filter (VALID, NEEDS_REVIEW, EXTRACTION_FAILED).
        limit: Maximum number of records to return (1–500). Defaults to 50.
        db: Active asynchronous database session.

    Returns:
        List of serialized document dictionaries.
    """
    records = await ingestion_repo.list_completed_documents(db, status=status, limit=limit)

    docs = []
    for r in records:
        docs.append({
            "id": r.id,
            "filename": r.original_filename,
            "content_type": r.content_type,
            "status": r.status,
            "channel": r.channel,
            "created_at": r.created_at,
            "extracted_data": r.extracted_data,
            "issues": r.issues,
            "error": r.error,
            "provider": r.provider,
            "model": r.model,
            "updated_at": r.updated_at,
            "updated_by": _serialize_user_identity(r.updated_by, r.updated_by_id),
        })
    return docs


@router.get("/{id}/file", summary="Serve physical document for preview")
async def get_document_file(id: int, db: AsyncSession = Depends(get_db)) -> FileResponse:
    """Serves the physical invoice file for in-browser preview or iframe rendering.

    Args:
        id: Ingestion ID of the document.
        db: Active asynchronous database session.

    Returns:
        FileResponse streaming the stored document bytes inline.

    Raises:
        HTTPException: 404 if the document record or physical file is missing.
    """
    record = await ingestion_repo.get_document_by_id(db, id)

    if not record or not record.stored_path:
        raise HTTPException(status_code=404, detail="Document file not found")

    safe_path = await asyncio.to_thread(resolve_inbox_file, record.stored_path)
    if not safe_path:
        raise HTTPException(status_code=404, detail="Document file not found")

    return FileResponse(
        safe_path,
        media_type=record.content_type,
        filename=record.original_filename,
        content_disposition_type="inline",
    )


@router.patch("/{id}", summary="Update extracted document fields or verification status")
async def update_document(
    id: int,
    updates: DocumentUpdateRequest,
    current_user: UserProfile = Depends(require_approved_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Updates extracted invoice data or review status with reviewer audit attribution.

    Captures the authenticated caller's identity (UUID and name) and timestamp on the
    underlying SQL record, recalculates deterministic business-rule issues whenever
    ``extracted_data`` changes, clears resolved extraction error banners, and triggers
    synchronization to the master Excel file.

    Args:
        id: Unique ingestion ID of the document to update.
        updates: Validated payload containing optional ``extracted_data`` and/or ``status``.
        current_user: The verified, approved UserProfile resolved from the caller session.
        db: Active asynchronous database session.

    Returns:
        Confirmation dictionary containing status, message, and the updated document summary.

    Raises:
        HTTPException: 404 if missing, 409 if still PROCESSING, 422 if validation fails.
    """
    record = await ingestion_repo.get_document_by_id(db, id)

    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    if record.status == STATUS_PROCESSING:
        raise HTTPException(status_code=409, detail="המסמך עדיין נמצא בעיבוד ולא ניתן לעריכה כרגע")

    provided_fields = updates.model_fields_set
    if "extracted_data" in provided_fields:
        # Same contract as the model's output: numbers normalised, NaN/Infinity
        # and malformed shapes rejected, so a manual edit can't poison totals.
        try:
            validated = DocumentExtraction.model_validate(updates.extracted_data or {})
        except ValidationError as error:
            raise HTTPException(status_code=422, detail=f"מבנה הנתונים אינו תקין: {short_error(error)}") from error
        record.extracted_data = validated.model_dump()
        settings = get_settings()
        findings = validate_document(validated, settings.default_vat_rate, settings.amount_tolerance)
        record.issues = [f.to_dict() for f in findings]
        record.error = None
        if "status" not in provided_fields or updates.status is None:
            record.status = derive_status(findings)

    if "status" in provided_fields and updates.status is not None:
        if updates.status not in _EDITABLE_STATUSES:
            raise HTTPException(status_code=422, detail=f"סטטוס לא חוקי: {updates.status}")
        record.status = updates.status
        if updates.status != STATUS_FAILED:
            record.error = None

    # Record human-in-the-loop reviewer attribution
    now_utc = datetime.now(timezone.utc)
    record.updated_by_id = current_user.id
    record.updated_at = now_utc
    record.excel_synced = False
    await db.commit()

    # Capture snapshot values before sync_pending commits and expires session objects,
    # preventing SQLAlchemy MissingGreenlet errors from post-commit lazy attribute access.
    doc_id = record.id
    doc_status = record.status
    doc_extracted_data = record.extracted_data
    doc_issues = record.issues or []
    doc_error = record.error

    # Trigger excel sync
    await sync_pending(db)

    return {
        "status": "ok",
        "message": "Document updated and Excel sync triggered.",
        "document": {
            "id": doc_id,
            "status": doc_status,
            "extracted_data": doc_extracted_data,
            "issues": doc_issues,
            "error": doc_error,
            "updated_at": now_utc.isoformat(),
            "updated_by": _serialize_user_identity(current_user, current_user.id),
        },
    }


@router.delete("/{id}", response_model=Dict[str, str], summary="Delete a document record")
async def delete_document(id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, str]:
    """Deletes a document from the database, Excel workbook, and inbox storage.

    Args:
        id: Unique ingestion ID of the document to delete.
        db: Active asynchronous database session.

    Returns:
        Confirmation dictionary indicating successful deletion.

    Raises:
        HTTPException: 404 if the document record does not exist.
    """
    record = await ingestion_repo.get_document_by_id(db, id)

    if not record:
        raise HTTPException(status_code=404, detail="Document not found")

    stored_path = record.stored_path

    # Delete from DB (and its email idempotency claim, so the same email can
    # be re-ingested deliberately; SQLite does not enforce the FK cascade).
    await ingestion_repo.delete_document_and_claims(db, record)

    # Best-effort cleanup of the physical inbox file and Excel projection
    try:
        await asyncio.to_thread(delete_stored_document, stored_path)
    except Exception as exc:
        logger.warning("Failed to delete stored document file %s: %s", stored_path, exc)

    try:
        await asyncio.to_thread(get_excel_repository().delete_record, id)
    except Exception as exc:
        logger.warning("Failed to delete from Excel: %s", exc)

    return {"status": "ok", "message": "Document deleted"}
