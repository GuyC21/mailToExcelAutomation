"""Seeds the recommended business prompt and the initial bootstrap administrator.

The prompt contains BUSINESS instructions only – the JSON contract lives in the
system envelope (``services/extraction/system_envelope.py``).

* Fresh database  -> the recommended prompt is created and activated.
* Existing data   -> it is added (inactive) if missing.
* Admin profile   -> seeds or upgrades the bootstrap admin user to APPROVED ADMIN.
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.future import select  # noqa: E402

from config import get_settings  # noqa: E402
from database import Base, async_session, engine  # noqa: E402
from models.prompt import PromptVersion  # noqa: E402
from models.user import UserProfile, UserRole, UserStatus  # noqa: E402

RECOMMENDED_PROMPT_NAME = "פרומפט מומלץ – טופסי התחשבנות v2"

RECOMMENDED_PROMPT = """אתה מנתח טופסי התחשבנות, ריכוזי חיובים וחשבוניות של ספקים עבור מחלקת הכספים של בילינגסטרים (BillingStream).

הנחיות עסקיות:
1. הספק הוא העסק שהנפיק את המסמך (לפי הכותרת, הלוגו, ח.פ או עוסק מורשה). בילינגסטרים היא תמיד הלקוח – לעולם לא הספק.
2. מספר המסמך יכול להופיע כ"מספר טופס", "מספר חשבונית", "אסמכתא" או "ריכוז חיובים מס'".
3. תאריך המסמך הוא תאריך ההפקה של הטופס – לא תאריכי השירות בשורות.
4. אם מופיע "חודש פעילות", "חודש התחשבנות" או "תקופת חיוב" – זו תקופת החיוב של המסמך.
5. חלץ כל שורת חיוב בנפרד: תיאור מלא (כולל שורות ההמשך של אותו פריט, כגון מספר תעודת משלוח), כמות, מחיר יחידה וסה"כ שורה.
6. העתק סכומים בדיוק כפי שהם מודפסים, גם אם נראה שיש בהם טעות – בדיקת החישובים מתבצעת במערכת בנפרד.
7. ערכים כמו "טרם תומחר", "לא חושב", "ממתין לאישור" או שדה ריק – השאר ריקים וציין זאת בהערות.
8. שיעור המע"מ – כפי שהוא מודפס בטופס (למשל 17 או 18).
9. התעלם מפרטי חשבון בנק, חתימות והערות שיווקיות – הם אינם נדרשים."""


async def seed_db() -> None:
    """Ensures the recommended prompt and initial admin profile exist (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Seed initial prompt if missing
        prompts = (await session.execute(select(PromptVersion))).scalars().all()
        if not any(p.name == RECOMMENDED_PROMPT_NAME for p in prompts):
            session.add(
                PromptVersion(
                    name=RECOMMENDED_PROMPT_NAME,
                    content=RECOMMENDED_PROMPT,
                    version_notes="הנחיות עסקיות בלבד; מבנה ה-JSON נאכף ע\"י מעטפת המערכת. כולל העתקה נאמנה של סכומים לצורך בדיקות חישוב.",
                    is_active=not prompts,
                )
            )
            print(f"Seeded recommended prompt (active={not prompts}).")

        # Seed initial admin user profile if configured and missing or unapproved
        admin_email = get_settings().initial_admin_email
        if admin_email:
            normalized_email = admin_email.strip().lower()
            existing_user = (
                await session.execute(
                    select(UserProfile).where(UserProfile.email == normalized_email)
                )
            ).scalars().first()
            if not existing_user:
                session.add(
                    UserProfile(
                        id="00000000-0000-0000-0000-000000000001",
                        email=normalized_email,
                        full_name="מנהל מערכת ראשי",
                        role=UserRole.ADMIN,
                        status=UserStatus.APPROVED,
                    )
                )
                print(f"Seeded initial admin user ({normalized_email}).")
            elif existing_user.status != UserStatus.APPROVED or existing_user.role != UserRole.ADMIN:
                existing_user.status = UserStatus.APPROVED
                existing_user.role = UserRole.ADMIN
                print(f"Upgraded initial admin user ({normalized_email}) to APPROVED ADMIN.")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_db())
