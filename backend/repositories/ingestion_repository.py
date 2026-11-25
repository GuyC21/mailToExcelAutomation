"""Data access repository for ingested document queries and cleanup."""
from datetime import datetime
from typing import Any, List, Optional, Sequence

from sqlalchemy import Row, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.ingestion import DocumentIngestion, STATUS_PROCESSING
from models.processed_attachment import ProcessedAttachment


async def list_completed_documents(
    db: AsyncSession,
    *,
    status: Optional[str] = None,
    limit: int = 50,
) -> List[DocumentIngestion]:
    """Lists completed document ingestions newest first, excluding ``PROCESSING``.

    Args:
        db: Active asynchronous database session.
        status: Optional document status filter.
        limit: Maximum number of records to return.

    Returns:
        Matching ``DocumentIngestion`` ORM rows.
    """
    query = (
        select(DocumentIngestion)
        .where(DocumentIngestion.status != STATUS_PROCESSING)
        .order_by(DocumentIngestion.created_at.desc())
    )
    if status:
        query = query.where(DocumentIngestion.status == status)
    result = await db.execute(query.limit(limit))
    return list(result.scalars().all())


async def get_document_by_id(db: AsyncSession, document_id: int) -> Optional[DocumentIngestion]:
    """Retrieves a single document ingestion by primary key.

    Args:
        db: Active asynchronous database session.
        document_id: Primary key identifier of the document.

    Returns:
        The matching ``DocumentIngestion`` or ``None``.
    """
    result = await db.execute(select(DocumentIngestion).where(DocumentIngestion.id == document_id))
    return result.scalars().first()


async def delete_document_and_claims(db: AsyncSession, record: DocumentIngestion) -> None:
    """Deletes a document record and its associated attachment idempotency claims.

    Args:
        db: Active asynchronous database session.
        record: Persisted ``DocumentIngestion`` entity to delete.
    """
    await db.execute(delete(ProcessedAttachment).where(ProcessedAttachment.ingestion_id == record.id))
    await db.delete(record)
    await db.commit()


async def list_dashboard_records(db: AsyncSession) -> Sequence[Row[Any]]:
    """Projects only the columns needed for dashboard aggregation, excluding ``PROCESSING``.

    Args:
        db: Active asynchronous database session.

    Returns:
        Rows with ``(channel, provider, status, extracted_data, created_by_id)``.
    """
    result = await db.execute(
        select(
            DocumentIngestion.channel,
            DocumentIngestion.provider,
            DocumentIngestion.status,
            DocumentIngestion.extracted_data,
            DocumentIngestion.created_by_id,
        ).where(DocumentIngestion.status != STATUS_PROCESSING)
    )
    return result.all()


async def get_active_user_job(
    db: AsyncSession,
    *,
    user_id: str,
    cutoff: datetime,
) -> Optional[DocumentIngestion]:
    """Finds the latest in-flight ``PROCESSING`` sandbox job owned by ``user_id``.

    Args:
        db: Active asynchronous database session.
        user_id: Authenticated user identifier.
        cutoff: Earliest ``created_at`` timestamp not yet considered stale.

    Returns:
        Most recent matching ``DocumentIngestion`` or ``None``.
    """
    stmt = (
        select(DocumentIngestion)
        .where(
            and_(
                DocumentIngestion.created_by_id == user_id,
                DocumentIngestion.status == STATUS_PROCESSING,
                DocumentIngestion.created_at >= cutoff,
            )
        )
        .order_by(DocumentIngestion.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalars().first()


async def get_recent_user_job(
    db: AsyncSession,
    *,
    user_id: str,
    cutoff: datetime,
) -> Optional[DocumentIngestion]:
    """Finds the most recent sandbox job (completed or failed) owned by ``user_id``.

    Args:
        db: Active asynchronous database session.
        user_id: Authenticated user identifier.
        cutoff: Earliest ``created_at`` timestamp within the recovery window.

    Returns:
        Most recent matching ``DocumentIngestion`` or ``None``.
    """
    stmt = (
        select(DocumentIngestion)
        .where(
            and_(
                DocumentIngestion.created_by_id == user_id,
                DocumentIngestion.created_at >= cutoff,
            )
        )
        .order_by(DocumentIngestion.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalars().first()


async def get_owned_document(
    db: AsyncSession,
    *,
    document_id: int,
    user_id: str,
) -> Optional[DocumentIngestion]:
    """Retrieves a document ingestion only if ``created_by_id`` matches ``user_id``.

    Args:
        db: Active asynchronous database session.
        document_id: Target ingestion primary key.
        user_id: Authenticated caller identifier.

    Returns:
        Owned ``DocumentIngestion`` or ``None`` if absent or owned elsewhere.
    """
    stmt = select(DocumentIngestion).where(
        and_(
            DocumentIngestion.id == document_id,
            DocumentIngestion.created_by_id == user_id,
        )
    )
    return (await db.execute(stmt)).scalars().first()


async def list_owned_email_siblings(
    db: AsyncSession,
    *,
    email_id: int,
    user_id: str,
) -> List[DocumentIngestion]:
    """Lists all sibling attachments for ``email_id`` owned by ``user_id``.

    Args:
        db: Active asynchronous database session.
        email_id: Parent inbound email primary key.
        user_id: Authenticated caller identifier.

    Returns:
        Ordered list of sibling ``DocumentIngestion`` rows owned by the caller.
    """
    stmt = (
        select(DocumentIngestion)
        .where(
            and_(
                DocumentIngestion.email_id == email_id,
                DocumentIngestion.created_by_id == user_id,
            )
        )
        .order_by(DocumentIngestion.id.asc())
    )
    return list((await db.execute(stmt)).scalars().all())
