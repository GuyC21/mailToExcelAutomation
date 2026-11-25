"""Prompt management endpoints for the Backoffice.

Provides CRUD operations for system prompts. Allows approved backoffice operators
to create new prompt versions, view their history, enhance drafts using BYOK AI,
and activate a specific prompt version to be used in the ingestion pipeline.
"""
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.byok import BYOKCredentials, get_byok_credentials
from api.rate_limit import RateLimiter
from database import get_db
from models.prompt import PromptVersion
from repositories import prompt_repository as prompt_repo
from schemas.prompt import EnhanceRequest, PromptCreate, PromptResponse
from services.extraction.system_envelope import build_system_envelope
from services.llm_service import enhance_prompt_text

router = APIRouter()
_enhance_rate_limit = RateLimiter(max_requests=20, window_seconds=60)


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
    return await prompt_repo.list_prompts(db)


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
    prompt = await prompt_repo.get_active_prompt(db)
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
    return await prompt_repo.create_prompt_version(
        db,
        name=prompt.name,
        content=prompt.content,
        version_notes=prompt.version_notes,
        is_active=prompt.is_active,
    )


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
    prompt = await prompt_repo.get_prompt_by_id(db, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    await prompt_repo.activate_prompt_version(db, prompt)
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
    prompt = await prompt_repo.get_prompt_by_id(db, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if prompt.is_active:
        raise HTTPException(status_code=400, detail="לא ניתן למחוק את הפרומפט הפעיל. יש להפעיל פרומפט אחר תחילה.")

    await prompt_repo.delete_prompt_version(db, prompt)
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
    prompt = await prompt_repo.get_prompt_by_id(db, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"technical_prompt": build_system_envelope(prompt.content)}


@router.post("/enhance", dependencies=[Depends(_enhance_rate_limit)])
async def enhance_prompt(
    request: EnhanceRequest,
    byok: BYOKCredentials = Depends(get_byok_credentials),
) -> Dict[str, str]:
    """Enhances a user-provided prompt using caller BYOK credentials or offline template.

    Strictly honors BYOK isolation so enhancing prompts in the Backoffice never
    consumes server-side production LLM quotas.

    Args:
        request (EnhanceRequest): A payload containing the original prompt text.
        byok (BYOKCredentials): Ephemeral API keys extracted from request headers.

    Returns:
        Dict[str, str]: A dictionary containing the 'enhanced_text'.
    """
    enhanced_text = await enhance_prompt_text(
        request.text,
        gemini_api_key=byok.gemini_api_key,
        openai_api_key=byok.openai_api_key,
    )
    return {"enhanced_text": enhanced_text}
