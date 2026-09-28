"""Data access for prompt versions."""
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.prompt import PromptVersion


async def get_active_prompt(db: AsyncSession) -> Optional[PromptVersion]:
    """Returns the prompt currently used by the pipeline, if any."""
    result = await db.execute(select(PromptVersion).where(PromptVersion.is_active.is_(True)))
    return result.scalars().first()
