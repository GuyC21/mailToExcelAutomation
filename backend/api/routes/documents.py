"""API routes for managing and reviewing document ingestions.

Provides endpoints to list ingested invoices, download physical document files for
in-browser preview, update extracted invoice fields with human reviewer attribution,
and delete records with automatic synchronization to the master Excel workbook.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.dependencies.auth import get_current_user
from database import get_db
from models.ingestion import DocumentIngestion
from models.processed_attachment import ProcessedAttachment
from models.user import UserProfile
from schemas.extraction import DocumentExtraction
from services.extraction.providers.base import short_error
from services.validation.business_rules import STATUS_FAILED, STATUS_NEEDS_REVIEW, STATUS_VALID
from services.excel_sync import sync_pending, get_excel_repository

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
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Lists recent ingested documents with optional status filtering.

    Includes full reviewer audit attribution (who last updated the document and when).

    Args:
        status: Optional lifecycle status filter (VALID, NEEDS_REVIEW, EXTRACTION_FAILED).
        limit: Maximum number of records to return. Defaults to 50.
        db: Active asynchronous database session.

    Returns:
        List of serialized document dictionaries.
    """
    query = select(DocumentIngestion).order_by(DocumentIngestion.created_at.desc())
    if status:
        query = query.where(DocumentIngestion.status == status)
    
    result = await db.execute(query.limit(limit))
    records = result.scalars().all()
    
    docs = []
    for r in records:
        docs.append({
            "id": r.id,
            "filename": r.original_filename,
            "status": r.status,
            "channel": r.channel,
            "created_at": r.created_at,
            "extracted_data": r.extracted_data,
            "issues": r.issues,
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
        FileResponse streaming the stored document bytes.

    Raises:
        HTTPException: 404 if the document record or physical file is missing.
    """
    result = await db.execute(select(DocumentIngestion).where(DocumentIngestion.id == id))
    record = result.scalars().first()
    
    if not record or not record.stored_path:
        raise HTTPException(status_code=404, detail="Document file not found")
        
    return FileResponse(record.stored_path, media_type=record.content_type)


@router.patch("/{id}", summary="Update extracted document fields or verification status")
async def update_document(
    id: int,
    updates: Dict[str, Any],
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Updates extracted invoice data or review status with reviewer audit attribution.

    Captures the authenticated caller's identity (UUID and name) and timestamp on the
    underlying SQL record, then triggers background synchronization to the master Excel file.

    Args:
        id: Unique ingestion ID of the document to update.
        updates: Payload containing optional 'extracted_data' dictionary and/or 'status'.
        current_user: The authenticated UserProfile resolved from the Supabase JWT Bearer token.
        db: Active asynchronous database session.

    Returns:
        Confirmation dictionary containing status, message, and the updated document summary.

    Raises:
        HTTPException: 404 if document does not exist, 422 if payload fails business validation.
    """
    result = await db.execute(select(DocumentIngestion).where(DocumentIngestion.id == id))
    record = result.scalars().first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if "extracted_data" in updates:
        # Same contract as the model's output: numbers normalised, NaN/Infinity
        # and malformed shapes rejected, so a manual edit can't poison totals.
        try:
            record.extracted_data = DocumentExtraction.model_validate(updates["extracted_data"] or {}).model_dump()
        except ValidationError as error:
            raise HTTPException(status_code=422, detail=f"מבנה הנתונים אינו תקין: {short_error(error)}") from error

    if "status" in updates:
        if updates["status"] not in _EDITABLE_STATUSES:
            raise HTTPException(status_code=422, detail=f"סטטוס לא חוקי: {updates['status']}")
        record.status = updates["status"]
        
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

    # Trigger excel sync
    await sync_pending(db)

    return {
        "status": "ok",
        "message": "Document updated and Excel sync triggered.",
        "document": {
            "id": doc_id,
            "status": doc_status,
            "extracted_data": doc_extracted_data,
            "updated_at": now_utc.isoformat(),
            "updated_by": _serialize_user_identity(current_user, current_user.id),
        },
    }

@router.delete("/{id}")
async def delete_document(id: int, db: AsyncSession = Depends(get_db)):
    """Delete a document from DB and Excel."""
    result = await db.execute(select(DocumentIngestion).where(DocumentIngestion.id == id))
    record = result.scalars().first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete from DB (and its email idempotency claim, so the same email can
    # be re-ingested deliberately; SQLite does not enforce the FK cascade).
    await db.execute(delete(ProcessedAttachment).where(ProcessedAttachment.ingestion_id == id))
    await db.delete(record)
    await db.commit()
    
    # Try deleting from Excel
    try:
        await asyncio.to_thread(get_excel_repository().delete_record, id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to delete from Excel: %s", e)
        
    return {"status": "ok", "message": "Document deleted"}
