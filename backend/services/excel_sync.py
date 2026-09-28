"""Keeps the Excel workbook in sync with the ingestion audit table.

Every ingestion is first committed to the DB with ``excel_synced = False`` and
then pushed to Excel. If Excel is locked, the rows simply stay pending and are
flushed on the next ingestion, on startup, or via ``POST /api/excel/sync`` – a
temporary Excel problem can never lose a document.

The workbook is a projection of the database. Before every sync the workbook
is checked against the database identity (see ``ExcelRepository``): if it is
missing, was archived for an outdated layout, or belongs to another database
(e.g. a fresh clone next to a workbook with old ids), a new workbook is
created and *every* ingestion is replayed into it – not just the pending ones.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import get_settings
from database import async_session
from models.app_metadata import AppMetadata
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


_IDENTITY_KEY = "database_identity"
_identity_cache: Optional[str] = None


async def get_database_identity() -> str:
    """Returns this database's identity token, creating it on first use.

    Uses its own short-lived session so a creation race (rollback) can never
    expire objects held by the caller's session.
    """
    global _identity_cache
    if _identity_cache:
        return _identity_cache
    async with async_session() as session:
        row = await session.get(AppMetadata, _IDENTITY_KEY)
        if row is None:
            session.add(AppMetadata(key=_IDENTITY_KEY, value=uuid.uuid4().hex))
            try:
                await session.commit()
            except IntegrityError:  # another worker created it first
                await session.rollback()
            row = await session.get(AppMetadata, _IDENTITY_KEY)
        _identity_cache = row.value
    return _identity_cache


def _bind_workbook(repository: ExcelRepository, identity: str) -> bool:
    """Makes sure the workbook exists and belongs to this database.

    Returns:
        True if a new, empty workbook was created and must be repopulated.

    Raises:
        ExcelLockedError: A foreign/outdated workbook is locked and cannot be archived.
    """
    if repository.ensure_workbook(identity):
        return True
    if repository.read_identity() != identity:
        archived = repository.replace_with_new(identity, "orphan")
        logger.warning("Workbook did not belong to this database; archived to %s and rebuilding", archived)
        return True
    return False


async def _pending_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(DocumentIngestion)
                              .where(DocumentIngestion.excel_synced.is_(False)))
    return int(result.scalar() or 0)


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
    repository = get_excel_repository()
    identity = await get_database_identity()
    try:
        rebuilt = await asyncio.to_thread(_bind_workbook, repository, identity)
    except ExcelLockedError as error:
        logger.warning("Excel sync postponed: %s", error)
        return {"synced": [], "pending": await _pending_count(db), "error": str(error)}
    if rebuilt:
        # A new workbook starts empty: replay the whole history, not just
        # what happened to be pending (the old file was archived, not merged).
        await db.execute(update(DocumentIngestion).values(excel_synced=False))
        await db.commit()

    result = await db.execute(
        select(DocumentIngestion).where(DocumentIngestion.excel_synced.is_(False)).order_by(DocumentIngestion.id)
    )
    pending = result.unique().scalars().all()
    if not pending:
        return {"synced": [], "pending": 0, "error": None}
    records = [to_excel_record(row) for row in pending]
    try:
        await asyncio.to_thread(repository.upsert_records, records)
    except ExcelLockedError as error:
        logger.warning("Excel sync postponed: %s", error)
        return {"synced": [], "pending": len(pending), "error": str(error)}
    except FileNotFoundError:
        # Removed between the identity check and the write: the next sync
        # recreates and replays it.
        logger.warning("Workbook disappeared during sync; will rebuild on next sync")
        return {"synced": [], "pending": len(pending), "error": "קובץ האקסל לא נמצא – ייווצר מחדש בסנכרון הבא"}
    for row in pending:
        row.excel_synced = True
    await db.commit()
    return {"synced": [row.id for row in pending], "pending": 0, "error": None}
