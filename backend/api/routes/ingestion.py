"""Sandbox ("Sample Runner") endpoint: upload one document and run the pipeline."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.ingestion import IngestionResult
from services.file_storage import UnsupportedDocumentError
from services.ingestion_pipeline import NoActivePromptError, ingest_document

router = APIRouter()


@router.post("/upload", response_model=IngestionResult)
async def ingest_sample(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Runs a single uploaded PDF / image through the production pipeline.

    The result is written to the Excel source of truth (channel = sandbox) so
    testers see exactly what the finance team will see.
    """
    content = await file.read()
    try:
        return await ingest_document(db, filename=file.filename or "document", content=content, channel="sandbox")
    except UnsupportedDocumentError as error:
        raise HTTPException(status_code=415, detail=str(error)) from error
    except NoActivePromptError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
