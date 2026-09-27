import os
import google.generativeai as genai
from openai import AsyncOpenAI

# Initialize clients if keys are available
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

async def enhance_prompt_text(rough_text: str) -> str:
    """
    Takes a rough prompt written by a non-technical user and uses an LLM
    to expand it into a highly professional extraction prompt.
    """
    system_instruction = (
        "You are an expert AI Prompt Engineer. A non-technical finance worker has written "
        "a rough instruction for an AI to extract data from invoices/receipts. "
        "Your job is to rewrite and enhance this instruction into a highly clear, professional, "
        "and comprehensive prompt. Keep the output in Hebrew. Do not include JSON structures, "
        "just the behavioral instructions."
    )

    try:
        if GEMINI_API_KEY:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(f"{system_instruction}\n\nUser's rough prompt:\n{rough_text}")
            return response.text.strip()
            
        elif OPENAI_API_KEY:
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": rough_text}
                ]
            )
            return response.choices[0].message.content.strip()
            
        else:
            # Fallback mock mode if no API keys are configured yet
            return (
                f"אתה עוזר בינה מלאכותית מומחה לחילוץ נתונים פיננסיים.\n"
                f"תפקידך לנתח מסמכי התחשבנות ולפעול לפי ההנחיות הבאות בדיוק מירבי:\n\n"
                f"{rough_text}\n\n"
                f"אנא ודא כי אתה סורק את כל המסמך, מתעלם ממידע לא רלוונטי, ומחלץ את הערכים במדויק."
            )
    except Exception as e:
        print(f"Error enhancing prompt: {e}")
        # Return something gracefully if API fails
        return f"{rough_text}\n\n(שים לב: פעל בדיוק ובקפדנות על פי הנחיות אלו לחילוץ הנתונים מהמסמך)."
