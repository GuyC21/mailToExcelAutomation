"""Async SQLAlchemy engine, session factory and FastAPI session dependency."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from config import get_settings

_settings = get_settings()

engine = create_async_engine(_settings.database_url, echo=_settings.sql_echo)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    """Yields a request-scoped database session."""
    async with async_session() as session:
        yield session
