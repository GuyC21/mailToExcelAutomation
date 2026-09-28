"""Keeps the Excel workbook in sync with the ingestion audit table.

Every ingestion is first committed to the DB with ``excel_synced = False`` and
then pushed to Excel. If Excel is locked, the rows simply stay pending and are
flushed on the next ingestion, on startup, or via ``POST /api/excel/sync`` – a
temporary Excel problem can never lose a document.
"""
import asyncio
import logging
from datetime import datetime, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import get_settings
from models.ingestion import DocumentIngestion
from repositories.excel_repository import ExcelLockedError, ExcelRepository

logger = logging.getLogger(__name__)


@lru_cache
def get_excel_repository() -> ExcelRepository:
    """Process-wide repository (its lock must be shared by all requests)."""
    return ExcelRepository(get_settings().excel_path)


def _local_naive(moment: datetime | None) -> datetime:
    """Excel cannot store tz-aware datetimes; convert to local wall time.

    By stripping timezone info after converting to the local timezone, we
    ensure that Excel displays the time exactly as it occurred locally,
    avoiding UI confusion for end-users who do not expect UTC in spreadsheets.

    Args:
        moment (datetime | None): The datetime to convert. Defaults to current UTC.

    Returns:
        datetime: A timezone-naive datetime representing local time.
    """
    moment = moment or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(ZoneInfo(get_settings().timezone)).replace(tzinfo=None)


def to_excel_record(row: DocumentIngestion) -> dict:
    """Flattens an ingestion (+ its email) into the layout's record shape.

    We decouple the database schema from the Excel export format here to
    allow independent evolution of both. This prepares a flat dictionary
    that easily maps to Excel columns.

    Args:
        row (DocumentIngestion): The database ingestion record.

    Returns:
        dict: A flattened dictionary representing a single Excel row.
    """
    return {
        "ingestion_id": row.id,
        "ingested_at": _local_naive(row.created_at),
        "status": row.status,
        "issues": row.issues or [],
        "error": row.error,
        "channel": row.channel,
        "sender": row.email.sender if row.email else None,
        "subject": row.email.subject if row.email else None,
        "filename": row.original_filename,
        "provider": row.provider,
        "model": row.model,
        "prompt_name": row.prompt_name,
        "data": row.extracted_data,
    }


async def sync_pending(db: AsyncSession) -> dict:
    """Writes every not-yet-synced ingestion to Excel, oldest first.

    This function implements a resilient synchronization mechanism. Since Excel files 
    can be locked by users, it processes pending records in a batch and gracefully 
    handles locks by keeping records as 'pending' to retry later, ensuring zero data loss.

    Args:
        db (AsyncSession): The database session.

    Returns:
        dict: A dictionary containing:
            - 'synced' (List[int]): IDs of successfully synced records.
            - 'pending' (int): Number of records remaining unsynced.
            - 'error' (str | None): Any error message if sync was locked or failed.
    """
    result = await db.execute(
        select(DocumentIngestion).where(DocumentIngestion.excel_synced.is_(False)).order_by(DocumentIngestion.id)
    )
    pending = result.unique().scalars().all()
    if not pending:
        return {"synced": [], "pending": 0, "error": None}
    records = [to_excel_record(row) for row in pending]
    try:
        await asyncio.to_thread(get_excel_repository().append_records, records)
    except ExcelLockedError as error:
        logger.warning("Excel sync postponed: %s", error)
        return {"synced": [], "pending": len(pending), "error": str(error)}
    for row in pending:
        row.excel_synced = True
    await db.commit()
    return {"synced": [row.id for row in pending], "pending": 0, "error": None}
