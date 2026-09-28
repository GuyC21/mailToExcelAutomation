"""Prompt management endpoints for the Backoffice.

Provides CRUD operations for system prompts. Allows administrators to create new
prompts, view their history, and activate a specific prompt version to be used
in the ingestion pipeline.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List, Dict, Any
from pydantic import BaseModel
from database import get_db
from models.prompt import PromptVersion
from services.extraction.system_envelope import build_system_envelope

router = APIRouter()

class PromptCreate(BaseModel):
    name: str
    content: str
    version_notes: str | None = None
    is_active: bool = False

class PromptResponse(PromptCreate):
    id: int
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[PromptResponse])
async def get_prompts(db: AsyncSession = Depends(get_db)) -> List[PromptVersion]:
    """Retrieves all prompt versions, ordered newest first.

    This is used by the prompt history view in the Backoffice to show the full
    audit trail of prompt modifications.

    Args:
        db (AsyncSession): The database session dependency.

    Returns:
        List[PromptVersion]: A list of all prompts in the database.
    """
    result = await db.execute(select(PromptVersion).order_by(PromptVersion.id.desc()))
    return list(result.scalars().all())

@router.get("/active", response_model=PromptResponse)
async def get_active_prompt(db: AsyncSession = Depends(get_db)) -> PromptVersion:
    """Retrieves the currently active prompt version.

    The active prompt is the one actively used by the ingestion pipeline to
    process incoming documents.

    Args:
        db (AsyncSession): The database session dependency.

    Returns:
        PromptVersion: The single active prompt.

    Raises:
        HTTPException: If no active prompt exists (404).
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.is_active == True))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="No active prompt found")
    return prompt

@router.post("/", response_model=PromptResponse)
async def create_prompt(prompt: PromptCreate, db: AsyncSession = Depends(get_db)) -> PromptVersion:
    """Creates a new prompt version.

    If the new prompt is marked as active, any previously active prompt is deactivated
    to ensure only one prompt is active at any time. This immutable versioning 
    approach allows rolling back safely.

    Args:
        prompt (PromptCreate): The prompt data to create.
        db (AsyncSession): The database session dependency.

    Returns:
        PromptVersion: The newly created prompt record.
    """
    if prompt.is_active:
        await db.execute(update(PromptVersion).values(is_active=False))
        
    db_prompt = PromptVersion(**prompt.model_dump())
    db.add(db_prompt)
    await db.commit()
    await db.refresh(db_prompt)
    return db_prompt

@router.post("/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, str]:
    """Activates a specific prompt version.

    Deactivates the current active prompt (if any) and sets the requested prompt
    as active.

    Args:
        prompt_id (int): The ID of the prompt to activate.
        db (AsyncSession): The database session dependency.

    Returns:
        Dict[str, str]: A status message confirming activation.

    Raises:
        HTTPException: If the prompt ID is not found (404).
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    await db.execute(update(PromptVersion).values(is_active=False))
    prompt.is_active = True
    await db.commit()
    return {"status": "success", "message": f"Prompt {prompt_id} activated"}

@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, str]:
    """Deletes a specific prompt version.

    Active prompts cannot be deleted to prevent breaking the ingestion pipeline.
    The user must activate another prompt first.

    Args:
        prompt_id (int): The ID of the prompt to delete.
        db (AsyncSession): The database session dependency.

    Returns:
        Dict[str, str]: A status message confirming deletion.

    Raises:
        HTTPException: If the prompt is not found (404) or if it is currently active (400).
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if prompt.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete active prompt")
        
    await db.delete(prompt)
    await db.commit()
    
    return {"status": "success", "message": f"Prompt {prompt_id} deleted"}

@router.get("/{prompt_id}/technical")
async def get_technical_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, str]:
    """Returns the exact system instruction the LLM receives for this prompt.

    Built by the same function the extractor uses, so the Backoffice preview can
    never drift from what is actually sent to the model.

    Args:
        prompt_id (int): The ID of the prompt.
        db (AsyncSession): The database session dependency.

    Returns:
        Dict[str, str]: A dictionary containing the 'technical_prompt' string.

    Raises:
        HTTPException: If the prompt is not found (404).
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"technical_prompt": build_system_envelope(prompt.content)}

class EnhanceRequest(BaseModel):
    text: str

@router.post("/enhance")
async def enhance_prompt(request: EnhanceRequest) -> Dict[str, str]:
    """Enhances a user-provided prompt using an LLM.

    Uses an LLM to rewrite a basic prompt instruction into a more detailed,
    robust set of guidelines suitable for extraction tasks.

    Args:
        request (EnhanceRequest): A payload containing the original prompt text.

    Returns:
        Dict[str, str]: A dictionary containing the 'enhanced_text'.

    Raises:
        HTTPException: If the text is empty or missing (400).
    """
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text is required")
        
    from services.llm_service import enhance_prompt_text
    enhanced_text = await enhance_prompt_text(request.text)
    return {"enhanced_text": enhanced_text}
