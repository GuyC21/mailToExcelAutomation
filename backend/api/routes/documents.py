"""API routes for managing and reviewing document ingestions.
"""
from typing import Any, Dict, List
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models.ingestion import DocumentIngestion
from models.processed_attachment import ProcessedAttachment
from schemas.extraction import DocumentExtraction
from services.extraction.providers.base import short_error
from services.validation.business_rules import STATUS_FAILED, STATUS_NEEDS_REVIEW, STATUS_VALID
from services.excel_sync import sync_pending, get_excel_repository

router = APIRouter()
_EDITABLE_STATUSES = {STATUS_VALID, STATUS_NEEDS_REVIEW, STATUS_FAILED}

@router.get("", response_model=List[Dict[str, Any]])
async def list_documents(status: str = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """List recent documents, optionally filtering by status."""
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
            "model": r.model
        })
    return docs

@router.get("/{id}/file")
async def get_document_file(id: int, db: AsyncSession = Depends(get_db)):
    """Serve the physical document file for preview."""
    result = await db.execute(select(DocumentIngestion).where(DocumentIngestion.id == id))
    record = result.scalars().first()
    
    if not record or not record.stored_path:
        raise HTTPException(status_code=404, detail="Document file not found")
        
    return FileResponse(record.stored_path, media_type=record.content_type)

@router.patch("/{id}")
async def update_document(id: int, updates: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Update extracted data or status for a document."""
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
        
    record.excel_synced = False
    await db.commit()
    await db.refresh(record)
    
    # Trigger excel sync
    await sync_pending(db)
    
    return {"status": "ok", "message": "Document updated and Excel sync triggered."}

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
