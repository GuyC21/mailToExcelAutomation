from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List
from pydantic import BaseModel
from database import get_db
from models.prompt import PromptVersion

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
    # If this is set to active, deactivate all others
    if prompt.is_active:
        await db.execute(update(PromptVersion).values(is_active=False))
        
    db_prompt = PromptVersion(**prompt.model_dump())
    db.add(db_prompt)
    await db.commit()
    await db.refresh(db_prompt)
    return db_prompt

@router.post("/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    # Verify it exists
    result = await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))
    prompt = result.scalars().first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    # Deactivate all
    await db.execute(update(PromptVersion).values(is_active=False))
    
    # Activate selected
    prompt.is_active = True
    await db.commit()
    
    return {"status": "success", "message": f"Prompt {prompt_id} activated"}
