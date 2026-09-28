"""Sandbox ("Sample Runner") endpoint: upload one document and run the pipeline.

This module provides the sandbox upload route, which allows users to test
the extraction pipeline against a single uploaded document. Results are sent to
the "sandbox" channel to preview the exact output the finance team would see,
facilitating testing and prompt engineering without affecting the main inbox.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from api.uploads import MB, read_upload_or_413
from config import get_settings
from database import get_db
from schemas.ingestion import IngestionResult
from services.file_storage import UnsupportedDocumentError
from services.ingestion_pipeline import NoActivePromptError, ingest_document

router = APIRouter()


@router.post("/upload", response_model=IngestionResult)
async def ingest_sample(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)) -> IngestionResult:
    """Runs a single uploaded PDF or image through the production pipeline.

    The result is written to the Excel source of truth (channel = sandbox) so
    testers see exactly what the finance team will see. This isolated channel
    helps users safely preview changes to extraction prompts or logic.

    Args:
        file (UploadFile): The document file (PDF or image) uploaded by the user.
        db (AsyncSession): The database session dependency.

    Returns:
        IngestionResult: A structured result containing the extraction status,
            extracted data fields, and any validation warnings.

    Raises:
        HTTPException: If the document type is unsupported (415) or if there
            is no active prompt (409) available to perform the extraction.
    """
    content = await read_upload_or_413(file, get_settings().max_upload_mb * MB)
    try:
        return await ingest_document(db, filename=file.filename or "document", content=content, channel="sandbox")
    except UnsupportedDocumentError as error:
        raise HTTPException(status_code=415, detail=str(error)) from error
    except NoActivePromptError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
