from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from api.routes import prompts, ingestion
import contextlib

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB (in production, use Alembic instead of this)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Auto-seed the database
    from scripts.seed import seed_db
    await seed_db()
    
    yield

app = FastAPI(title="GoldenCare AI Automation API", lifespan=lifespan)

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prompts.router, prefix="/api/prompts", tags=["Prompts"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Ingestion"])

@app.get("/")
async def root():
    return {"message": "Welcome to GoldenCare Backoffice API"}
