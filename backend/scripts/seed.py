import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, Base, async_session
from models.prompt import PromptVersion

DEFAULT_PROMPT = """אתה עוזר בינה מלאכותית של חברת GoldenCare.
תפקידך לחלץ נתונים מתוך טופסי התחשבנות (קבלות/חשבוניות) המצורפים.
אנא החזר את המידע בפורמט JSON בלבד, ללא טקסט נוסף, לפי המבנה הבא:
{
  "supplier_name": "שם הספק",
  "document_date": "תאריך המסמך (YYYY-MM-DD)",
  "total_amount": "סכום כולל (מספר)",
  "line_items": [
    {
      "description": "תיאור הפריט",
      "quantity": "כמות",
      "unit_price": "מחיר יחידה",
      "total_price": "מחיר כולל"
    }
  ]
}
"""

async def seed_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        # Check if prompts exist
        from sqlalchemy.future import select
        result = await session.execute(select(PromptVersion))
        if not result.scalars().first():
            print("Seeding default Hebrew prompt...")
            default_prompt = PromptVersion(
                name="Default Extraction Prompt v1",
                content=DEFAULT_PROMPT,
                version_notes="Initial prompt for Hebrew invoices.",
                is_active=True
            )
            session.add(default_prompt)
            await session.commit()
            print("Seed complete.")
        else:
            print("Prompts already exist, skipping seed.")

if __name__ == "__main__":
    asyncio.run(seed_db())
