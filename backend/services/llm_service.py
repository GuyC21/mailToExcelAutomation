"""'Enhance with AI' helper for the prompt editor (text-only LLM call)."""
import asyncio
import logging
from typing import Optional

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover
    genai = None

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None

from config import get_settings
from services.extraction.providers.base import short_error
from services.extraction.providers.gemini_provider import _GENAI_LOCK

logger = logging.getLogger(__name__)

_SYSTEM_INSTRUCTION = (
    "You are an expert AI prompt engineer. A non-technical finance worker wrote a rough instruction for an AI "
    "that extracts data from Hebrew supplier settlement forms and invoices. Rewrite it into a clear, professional "
    "and complete set of BUSINESS instructions, in Hebrew. Do not include a JSON schema or output-format rules – "
    "the system adds those automatically."
)


def _gemini_enhance(rough_text: str, api_key: str) -> str:
    """Enhances a rough business prompt synchronously via the Gemini model chain.

    Args:
        rough_text: User-supplied rough instruction text.
        api_key: Ephemeral BYOK Google Gemini API key.

    Returns:
        Refined Hebrew business prompt text.

    Raises:
        RuntimeError: When all configured Gemini models fail or SDK is absent.
    """
    if genai is None:
        raise RuntimeError("google-generativeai package is not installed")
    settings = get_settings()
    last_error: Exception | None = None
    with _GENAI_LOCK:
        genai.configure(api_key=api_key)
        for model_name in settings.gemini_model_chain:
            try:
                model = genai.GenerativeModel(model_name, system_instruction=_SYSTEM_INSTRUCTION)
                return model.generate_content(rough_text).text.strip()
            except Exception as error:  # try the next model on quota / availability errors
                last_error = error
                logger.warning("Enhance with %s failed: %s", model_name, short_error(error, 120))
    raise RuntimeError(short_error(last_error)) if last_error else RuntimeError("no Gemini model configured")


async def _openai_enhance(rough_text: str, api_key: str) -> str:
    """Enhances a rough business prompt asynchronously via OpenAI chat completions.

    Args:
        rough_text: User-supplied rough instruction text.
        api_key: Ephemeral BYOK OpenAI API key.

    Returns:
        Refined Hebrew business prompt text.

    Raises:
        RuntimeError: When the OpenAI SDK is unavailable.
    """
    if AsyncOpenAI is None:
        raise RuntimeError("openai package is not installed")
    settings = get_settings()
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "system", "content": _SYSTEM_INSTRUCTION}, {"role": "user", "content": rough_text}],
    )
    return (response.choices[0].message.content or "").strip()


def _offline_enhance(rough_text: str) -> str:
    """Builds a structured Hebrew prompt template when no BYOK LLM key is provided.

    Args:
        rough_text: User-supplied rough instruction text.

    Returns:
        Formatted business instruction template in Hebrew.
    """
    return (
        "אתה מנתח טופסי התחשבנות וחשבוניות של ספקים עבור מחלקת הכספים של בילינגסטרים (BillingStream).\n"
        "פעל לפי ההנחיות הבאות בדיוק מירבי:\n\n"
        f"{rough_text}\n\n"
        "סרוק את כל המסמך, התעלם ממידע שאינו רלוונטי וחלץ את הערכים בדיוק כפי שהם מופיעים."
    )


async def enhance_prompt_text(
    rough_text: str,
    *,
    gemini_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
) -> str:
    """Expands a rough business prompt using user BYOK keys or an offline template.

    Strictly honors BYOK isolation: only caller-supplied keys are ever used,
    preventing backoffice UI interactions from consuming production server quotas.

    Args:
        rough_text: The basic instructions provided by the user.
        gemini_api_key: Optional ephemeral Google Gemini key supplied via BYOK.
        openai_api_key: Optional ephemeral OpenAI key supplied via BYOK.

    Returns:
        The enhanced prompt text or an offline fallback template.
    """
    clean_gemini = (gemini_api_key or "").strip()
    clean_openai = (openai_api_key or "").strip()
    try:
        if clean_gemini:
            return await asyncio.to_thread(_gemini_enhance, rough_text, clean_gemini)
        if clean_openai:
            return await _openai_enhance(rough_text, clean_openai)
    except Exception as error:
        logger.error("Prompt enhancement failed: %s", short_error(error))
    return _offline_enhance(rough_text)
