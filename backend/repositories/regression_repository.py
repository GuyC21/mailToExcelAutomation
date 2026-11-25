"""Data access repository for persisted regression suite runs."""
from typing import Any, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.regression import RegressionRun


async def create_run(db: AsyncSession, **fields: Any) -> RegressionRun:
    """Persists a completed regression suite run snapshot.

    Args:
        db: Active asynchronous database session.
        **fields: Column values initializing ``RegressionRun``.

    Returns:
        Refreshed ``RegressionRun`` ORM instance with assigned primary key.
    """
    run = RegressionRun(**fields)
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def list_runs(
    db: AsyncSession,
    *,
    prompt_id: Optional[int] = None,
    limit: int = 50,
) -> List[RegressionRun]:
    """Lists persisted regression runs newest first.

    Args:
        db: Active asynchronous database session.
        prompt_id: Optional prompt version filter.
        limit: Maximum number of summary rows to return.

    Returns:
        Ordered list of ``RegressionRun`` records.
    """
    stmt = select(RegressionRun).order_by(RegressionRun.id.desc()).limit(limit)
    if prompt_id is not None:
        stmt = stmt.where(RegressionRun.prompt_version_id == prompt_id)
    return list((await db.execute(stmt)).scalars().all())


async def get_run_by_id(db: AsyncSession, run_id: int) -> Optional[RegressionRun]:
    """Retrieves one persisted regression run by primary key.

    Args:
        db: Active asynchronous database session.
        run_id: Primary key identifier of the regression run.

    Returns:
        The matching ``RegressionRun`` or ``None``.
    """
    stmt = select(RegressionRun).where(RegressionRun.id == run_id)
    return (await db.execute(stmt)).scalars().first()


async def delete_run(db: AsyncSession, run: RegressionRun) -> None:
    """Deletes a persisted regression run from the database.

    Args:
        db: Active asynchronous database session.
        run: Persisted ``RegressionRun`` entity to remove.
    """
    await db.delete(run)
    await db.commit()
