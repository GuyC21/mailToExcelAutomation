"""Async SQLAlchemy engine, session factory and FastAPI session dependency.

Adapts automatically between asyncpg (standard in Docker/Linux) and psycopg (standard
on Windows hosts) to provide zero-friction local execution without installing extra drivers.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from config import get_settings

_settings = get_settings()

_db_url = _settings.database_url
# Self-healing PostgreSQL driver selection: use asyncpg in Linux/Docker, fallback to psycopg if on Windows host
if _db_url.startswith("postgresql+asyncpg://"):
    try:
        import asyncpg  # noqa: F401
    except ImportError:
        try:
            import psycopg  # noqa: F401
            _db_url = _db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        except ImportError:
            pass

engine = create_async_engine(_db_url, echo=_settings.sql_echo)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    """Yields a request-scoped database session."""
    async with async_session() as session:
        yield session
