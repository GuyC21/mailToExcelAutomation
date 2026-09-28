"""Read access to the Excel source of truth for the Backoffice."""
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.excel_sync import get_excel_repository, sync_pending

router = APIRouter()
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/preview")
async def preview_workbook(limit: int = Query(10, ge=1, le=100)):
    """Latest document rows (newest first) plus per-status counts."""
    return get_excel_repository().preview(limit)


@router.get("/download")
async def download_workbook():
    """Downloads the current master workbook."""
    path = get_excel_repository().file_path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="קובץ האקסל טרם נוצר")
    filename = f"GoldenCare_Master_{datetime.now():%Y-%m-%d_%H%M}.xlsx"
    return FileResponse(path, media_type=_XLSX_MIME, filename=filename)


@router.post("/sync")
async def retry_sync(db: AsyncSession = Depends(get_db)):
    """Flushes ingestions that could not be written earlier (e.g. file was open)."""
    return await sync_pending(db)
