"""Read access to the Excel source of truth for the Backoffice.

Provides endpoints to preview the final Excel structure and to download the
master workbook. The Excel file acts as the primary data hand-off to the finance team.
"""
import os
from datetime import datetime
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.excel_sync import get_excel_repository, sync_pending

router = APIRouter()
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/preview")
async def preview_workbook(limit: int = Query(10, ge=1, le=100)) -> Dict[str, Any]:
    """Fetches a preview of the latest document rows plus per-status counts.

    Allows the frontend to show a quick glimpse of what is currently written in
    the Excel file without having to download and parse the entire file.

    Args:
        limit (int): Maximum number of rows to return (default 10).

    Returns:
        Dict[str, Any]: Dictionary containing status counts and a list of the latest rows.
    """
    return get_excel_repository().preview(limit)


@router.get("/download")
async def download_workbook() -> FileResponse:
    """Downloads the current master workbook.

    Provides the finance team with the actual Excel file containing all extracted
    and validated invoices. The filename is timestamped for convenience.

    Returns:
        FileResponse: The Excel file with the correct MIME type.

    Raises:
        HTTPException: If the Excel file does not exist yet (404).
    """
    path = get_excel_repository().file_path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="קובץ האקסל טרם נוצר")
    filename = f"GoldenCare_Master_{datetime.now():%Y-%m-%d_%H%M}.xlsx"
    return FileResponse(path, media_type=_XLSX_MIME, filename=filename)


@router.post("/sync")
async def retry_sync(db: AsyncSession = Depends(get_db)) -> Dict[str, int]:
    """Flushes ingestions that could not be written earlier.

    When the finance team has the Excel file open, writing to it may fail due to
    file locks. This endpoint provides a manual trigger to retry writing any
    pending ingestion records to the Excel file.

    Args:
        db (AsyncSession): The database session dependency.

    Returns:
        Dict[str, int]: A summary of the sync operation, including the number
            of flushed records.
    """
    return await sync_pending(db)
