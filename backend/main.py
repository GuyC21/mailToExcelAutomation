"""FastAPI application entry point."""
import contextlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models.ingestion  # noqa: F401  (registers tables with Base.metadata)
import models.prompt  # noqa: F401
import models.regression  # noqa: F401
from api.routes import email, excel, ingestion, prompts
from database import Base, async_session, engine
from services.excel_sync import get_excel_repository, sync_pending
from services.ingestion_pipeline import get_extractor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("goldencare")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all is fine for this demo; production would use Alembic migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from scripts.seed import seed_db
    await seed_db()

    get_excel_repository().ensure_workbook()
    async with async_session() as db:
        await sync_pending(db)  # Flush rows left pending by a previous run.
    logger.info("Extraction providers: %s", get_extractor().provider_names)
    yield


app = FastAPI(title="GoldenCare AI Automation API", lifespan=lifespan)

# Local development only: the Vite dev server runs on another port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prompts.router, prefix="/api/prompts", tags=["Prompts"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Sandbox ingestion"])
app.include_router(email.router, prefix="/api/email", tags=["Inbound email"])
app.include_router(excel.router, prefix="/api/excel", tags=["Excel source of truth"])


@app.get("/")
async def root():
    return {"message": "Welcome to GoldenCare Backoffice API"}


@app.get("/api/health")
async def health():
    """Liveness + which extraction engines are active (mock means no API key)."""
    return {"status": "ok", "extraction_providers": get_extractor().provider_names}
