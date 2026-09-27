import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ...models.prompt import PromptVersion
from ...database import get_db
from ...services.llm_extractor import llm_extractor
from ...repositories.excel_repository import excel_repo

router = APIRouter()

UPLOAD_DIR = "data/samples"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def ingest_sample(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests a single file, processes it via LLM using the active prompt,
    writes the result to Excel, and returns the response for the UI.
    """
    # 1. Save file locally
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")

    # 2. Get the ACTIVE prompt
    result = await db.execute(select(PromptVersion).where(PromptVersion.is_active == True))
    active_prompt = result.scalars().first()
    
    if not active_prompt:
        raise HTTPException(status_code=400, detail="No active prompt found. Please set a prompt as active in the Backoffice.")

    # 3. Process via LLM Extractor
    extraction_result = llm_extractor.extract_from_file(active_prompt.content, file_path)

    # 4. Write to Excel Source of Truth
    excel_repo.write_extraction(
        source_file=file.filename,
        data=extraction_result["data"],
        status=extraction_result["status"],
        error_notes=extraction_result["error"]
    )

    # 5. Return result for the Sample Runner UI
    return {
        "filename": file.filename,
        "extraction": extraction_result
    }

@router.get("/stats")
async def get_excel_stats():
    """Returns basic stats from the Excel repository for the dashboard."""
    return excel_repo.get_stats()
