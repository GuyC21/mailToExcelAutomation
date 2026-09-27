from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List
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
async def get_prompts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptVersion).order_by(PromptVersion.id.desc()))
    return result.scalars().all()

@router.get("/active", response_model=PromptResponse)
async def get_active_prompt(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptVersion).where(PromptVersion.is_active == True))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="No active prompt found")
    return prompt

@router.post("/", response_model=PromptResponse)
async def create_prompt(prompt: PromptCreate, db: AsyncSession = Depends(get_db)):
    if prompt.is_active:
        await db.execute(update(PromptVersion).values(is_active=False))
        
    db_prompt = PromptVersion(**prompt.model_dump())
    db.add(db_prompt)
    await db.commit()
    await db.refresh(db_prompt)
    return db_prompt

@router.post("/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    await db.execute(update(PromptVersion).values(is_active=False))
    prompt.is_active = True
    await db.commit()
    return {"status": "success", "message": f"Prompt {prompt_id} activated"}

@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
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
async def get_technical_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    """Returns the exact system instruction the LLM receives for this prompt.

    Built by the same function the extractor uses, so the Backoffice preview can
    never drift from what is actually sent to the model.
    """
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"technical_prompt": build_system_envelope(prompt.content)}

class EnhanceRequest(BaseModel):
    text: str

@router.post("/enhance")
async def enhance_prompt(request: EnhanceRequest):
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text is required")
        
    from services.llm_service import enhance_prompt_text
    enhanced_text = await enhance_prompt_text(request.text)
    return {"enhanced_text": enhanced_text}
