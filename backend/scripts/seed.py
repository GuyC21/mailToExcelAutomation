"""Seeds the recommended business prompt.

The prompt contains BUSINESS instructions only – the JSON contract lives in the
system envelope (``services/extraction/system_envelope.py``).

* Fresh database  -> the recommended prompt is created and activated.
* Existing data   -> it is added (inactive) if missing, so the finance team can
                     compare and activate it from the Backoffice. Existing
                     prompts are never modified.
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.future import select  # noqa: E402

from database import Base, async_session, engine  # noqa: E402
from models.prompt import PromptVersion  # noqa: E402

RECOMMENDED_PROMPT_NAME = "פרומפט מומלץ – טופסי התחשבנות v2"

RECOMMENDED_PROMPT = """אתה מנתח טופסי התחשבנות, ריכוזי חיובים וחשבוניות של ספקים עבור מחלקת הכספים של גולדנקייר.

הנחיות עסקיות:
1. הספק הוא העסק שהנפיק את המסמך (לפי הכותרת, הלוגו, ח.פ או עוסק מורשה). גולדנקייר היא תמיד הלקוח – לעולם לא הספק.
2. מספר המסמך יכול להופיע כ"מספר טופס", "מספר חשבונית", "אסמכתא" או "ריכוז חיובים מס'".
3. תאריך המסמך הוא תאריך ההפקה של הטופס – לא תאריכי השירות בשורות.
4. אם מופיע "חודש פעילות", "חודש התחשבנות" או "תקופת חיוב" – זו תקופת החיוב של המסמך.
5. חלץ כל שורת חיוב בנפרד: תיאור מלא (כולל שורות ההמשך של אותו פריט, כגון מספר תעודת משלוח), כמות, מחיר יחידה וסה"כ שורה.
6. העתק סכומים בדיוק כפי שהם מודפסים, גם אם נראה שיש בהם טעות – בדיקת החישובים מתבצעת במערכת בנפרד.
7. ערכים כמו "טרם תומחר", "לא חושב", "ממתין לאישור" או שדה ריק – השאר ריקים וציין זאת בהערות.
8. שיעור המע"מ – כפי שהוא מודפס בטופס (למשל 17 או 18).
9. התעלם מפרטי חשבון בנק, חתימות והערות שיווקיות – הם אינם נדרשים."""


async def seed_db() -> None:
    """Ensures the recommended prompt exists (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        prompts = (await session.execute(select(PromptVersion))).scalars().all()
        if any(p.name == RECOMMENDED_PROMPT_NAME for p in prompts):
            return
        session.add(PromptVersion(
            name=RECOMMENDED_PROMPT_NAME,
            content=RECOMMENDED_PROMPT,
            version_notes="הנחיות עסקיות בלבד; מבנה ה-JSON נאכף ע\"י מעטפת המערכת. כולל העתקה נאמנה של סכומים לצורך בדיקות חישוב.",
            is_active=not prompts,
        ))
        await session.commit()
        print(f"Seeded recommended prompt (active={not prompts}).")


if __name__ == "__main__":
    asyncio.run(seed_db())
