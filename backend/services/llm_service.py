"""'Enhance with AI' helper for the prompt editor (text-only LLM call)."""
import asyncio
import logging

import google.generativeai as genai
from openai import AsyncOpenAI

from config import get_settings
from services.extraction.providers.base import short_error

logger = logging.getLogger(__name__)

_SYSTEM_INSTRUCTION = (
    "You are an expert AI prompt engineer. A non-technical finance worker wrote a rough instruction for an AI "
    "that extracts data from Hebrew supplier settlement forms and invoices. Rewrite it into a clear, professional "
    "and complete set of BUSINESS instructions, in Hebrew. Do not include a JSON schema or output-format rules – "
    "the system adds those automatically."
)


def _gemini_enhance(rough_text: str) -> str:
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)
    last_error: Exception | None = None
    for model_name in settings.gemini_model_chain:
        try:
            model = genai.GenerativeModel(model_name, system_instruction=_SYSTEM_INSTRUCTION)
            return model.generate_content(rough_text).text.strip()
        except Exception as error:  # try the next model on quota / availability errors
            last_error = error
            logger.warning("Enhance with %s failed: %s", model_name, short_error(error, 120))
    raise RuntimeError(short_error(last_error)) if last_error else RuntimeError("no Gemini model configured")


async def _openai_enhance(rough_text: str) -> str:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "system", "content": _SYSTEM_INSTRUCTION}, {"role": "user", "content": rough_text}],
    )
    return (response.choices[0].message.content or "").strip()


def _offline_enhance(rough_text: str) -> str:
    return (
        "אתה מנתח טופסי התחשבנות וחשבוניות של ספקים עבור מחלקת הכספים של גולדנקייר.\n"
        "פעל לפי ההנחיות הבאות בדיוק מירבי:\n\n"
        f"{rough_text}\n\n"
        "סרוק את כל המסמך, התעלם ממידע שאינו רלוונטי וחלץ את הערכים בדיוק כפי שהם מופיעים."
    )


async def enhance_prompt_text(rough_text: str) -> str:
    """Expands a rough business prompt; degrades gracefully to a template."""
    settings = get_settings()
    try:
        if settings.gemini_api_key.strip():
            return await asyncio.to_thread(_gemini_enhance, rough_text)
        if settings.openai_api_key.strip():
            return await _openai_enhance(rough_text)
    except Exception as error:
        logger.error("Prompt enhancement failed: %s", short_error(error))
    return _offline_enhance(rough_text)
