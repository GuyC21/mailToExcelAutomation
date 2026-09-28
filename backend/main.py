"""FastAPI application entry point."""
import contextlib
import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models.app_metadata  # noqa: F401  (registers tables with Base.metadata)
import models.ingestion  # noqa: F401
import models.processed_attachment  # noqa: F401
import models.prompt  # noqa: F401
import models.regression  # noqa: F401 (registers RegressionRun for Run History)
from api.routes import email, excel, ingestion, prompts, regression, dashboard, documents
from api.security import require_backoffice_key
from api.uploads import MB, BodySizeLimitMiddleware
from config import get_settings
from database import Base, async_session, engine
from services.excel_sync import sync_pending
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

    async with async_session() as db:
        # Creates / validates the workbook (rebuilding it from the DB if it is
        # missing or belongs to another database) and flushes pending rows.
        await sync_pending(db)
    if not get_settings().backoffice_api_key:
        logger.warning("BACKOFFICE_API_KEY is not set: the Backoffice API is open to anyone who can reach it. "
                       "Keep it bound to localhost (see docker-compose.yml) or set a key.")
    logger.info("Extraction providers: %s", get_extractor().provider_names)
    yield


app = FastAPI(title="GoldenCare AI Automation API", lifespan=lifespan)

# Added before CORS so CORS stays the outer layer and a 413 still carries CORS headers.
app.add_middleware(BodySizeLimitMiddleware, max_bytes=get_settings().max_request_mb * MB)

# Local development only: the Vite dev server runs on another port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_backoffice = [Depends(require_backoffice_key)]  # no-op unless BACKOFFICE_API_KEY is set
app.include_router(prompts.router, prefix="/api/prompts", tags=["Prompts"], dependencies=_backoffice)
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Sandbox ingestion"], dependencies=_backoffice)
# The webhook has its own check (inbound token or Backoffice key), see api.security.
app.include_router(email.router, prefix="/api/email", tags=["Inbound email"])
app.include_router(excel.router, prefix="/api/excel", tags=["Excel source of truth"], dependencies=_backoffice)
app.include_router(regression.router, prefix="/api/regression", tags=["Regression Testing"], dependencies=_backoffice)
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"], dependencies=_backoffice)
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"], dependencies=_backoffice)


@app.get("/")
async def root():
    return {"message": "Welcome to GoldenCare Backoffice API"}


@app.get("/api/health")
async def health():
    """Liveness + which extraction engines are active (mock means no API key)."""
    return {"status": "ok", "extraction_providers": get_extractor().provider_names}
