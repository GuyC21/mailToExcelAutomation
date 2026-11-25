"""Data access repository for versioned extraction prompts."""
from typing import List, Optional

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.prompt import PromptVersion


async def get_active_prompt(db: AsyncSession) -> Optional[PromptVersion]:
    """Returns the prompt currently used by the pipeline, if any.

    Args:
        db: Active asynchronous database session.

    Returns:
        The active ``PromptVersion`` instance or ``None``.
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.is_active.is_(True)))
    return result.scalars().first()


async def list_prompts(db: AsyncSession) -> List[PromptVersion]:
    """Lists all prompt versions ordered newest first.

    Args:
        db: Active asynchronous database session.

    Returns:
        A list of ``PromptVersion`` rows ordered by descending ID.
    """
    result = await db.execute(select(PromptVersion).order_by(PromptVersion.id.desc()))
    return list(result.scalars().all())


async def get_prompt_by_id(db: AsyncSession, prompt_id: int) -> Optional[PromptVersion]:
    """Retrieves a single prompt version by primary key.

    Args:
        db: Active asynchronous database session.
        prompt_id: Unique identifier of the prompt version.

    Returns:
        The matching ``PromptVersion`` or ``None`` if not found.
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    return result.scalars().first()


async def create_prompt_version(
    db: AsyncSession,
    *,
    name: str,
    content: str,
    version_notes: Optional[str],
    is_active: bool,
) -> PromptVersion:
    """Persists a new immutable prompt version, optionally activating it.

    Args:
        db: Active asynchronous database session.
        name: Human-readable prompt label.
        content: Business instruction text.
        version_notes: Optional release changelog notes.
        is_active: Whether to activate this version immediately.

    Returns:
        The newly persisted ``PromptVersion`` record.
    """
    if is_active:
        await db.execute(update(PromptVersion).values(is_active=False))
    db_prompt = PromptVersion(
        name=name,
        content=content,
        version_notes=version_notes,
        is_active=is_active,
    )
    db.add(db_prompt)
    await db.commit()
    await db.refresh(db_prompt)
    return db_prompt


async def activate_prompt_version(db: AsyncSession, prompt: PromptVersion) -> PromptVersion:
    """Marks ``prompt`` as the sole active prompt version.

    Args:
        db: Active asynchronous database session.
        prompt: The existing ``PromptVersion`` instance to activate.

    Returns:
        The refreshed active ``PromptVersion``.
    """
    await db.execute(update(PromptVersion).values(is_active=False))
    prompt.is_active = True
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def delete_prompt_version(db: AsyncSession, prompt: PromptVersion) -> None:
    """Deletes an inactive prompt version from the database.

    Args:
        db: Active asynchronous database session.
        prompt: The inactive ``PromptVersion`` record to remove.
    """
    await db.delete(prompt)
    await db.commit()
