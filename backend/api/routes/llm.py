"""LLM Provider and Key Verification endpoints.

Enables users to verify their personal API keys (Google Gemini / OpenAI)
before triggering resource-intensive document extraction workflows.
"""
import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import get_settings
from services.extraction.extractor import mask_api_key
from services.extraction.providers.base import short_error

router = APIRouter()
logger = logging.getLogger("billingstream.llm")


class KeyVerifyRequest(BaseModel):
    """Payload for verifying an LLM API key."""

    provider: Literal["gemini", "openai"] = Field(
        ...,
        description="Target LLM provider ('gemini' or 'openai')",
    )
    api_key: str = Field(
        ...,
        min_length=5,
        max_length=256,
        description="The raw API key to test.",
    )


class KeyVerifyResponse(BaseModel):
    """Response payload detailing verification outcome."""

    valid: bool
    provider: str
    model: str
    message: str


def _verify_gemini_sync(api_key: str) -> str:
    """Synchronously verifies a Gemini API key via the official SDK.

    Args:
        api_key: The Google Generative AI key to test.

    Returns:
        The primary model name confirmed.

    Raises:
        Exception: If key authentication or network ping fails.
    """
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    # list_models() performs an authenticated query against the Google API
    # without consuming generation tokens.
    model_iter = genai.list_models()
    # Pull first model name to verify response is accessible
    first_model = next(iter(model_iter))
    settings = get_settings()
    primary = settings.gemini_model_chain[0] if settings.gemini_model_chain else first_model.name
    return primary


def _verify_openai_sync(api_key: str) -> str:
    """Synchronously verifies an OpenAI API key via client.models.list().

    Args:
        api_key: The OpenAI API key to test.

    Returns:
        The primary model name confirmed.

    Raises:
        Exception: If key authentication or network ping fails.
    """
    from openai import OpenAI

    client = OpenAI(api_key=api_key, timeout=8.0)
    client.models.list()
    return get_settings().openai_model


@router.post("/verify-key", response_model=KeyVerifyResponse)
async def verify_llm_key(payload: KeyVerifyRequest) -> KeyVerifyResponse:
    """Validates an LLM API key by performing an authenticated metadata ping.

    Args:
        payload: KeyVerifyRequest specifying provider and candidate API key.

    Returns:
        KeyVerifyResponse confirming valid status and detected model.

    Raises:
        HTTPException: 400 Bad Request if the key is rejected, expired, or invalid.
    """
    raw_key = payload.api_key.strip()
    provider = payload.provider.lower()
    masked = mask_api_key(raw_key)

    logger.info("Verifying %s API key: %s", provider, masked)

    try:
        if provider == "gemini":
            confirmed_model = await asyncio.to_thread(_verify_gemini_sync, raw_key)
            msg = "מפתח Google Gemini אומת בהצלחה מוכן לשימוש בחילוץ מסמכים"
        elif provider == "openai":
            confirmed_model = await asyncio.to_thread(_verify_openai_sync, raw_key)
            msg = "מפתח OpenAI אומת בהצלחה מוכן לשימוש בחילוץ מסמכים"
        else:
            raise HTTPException(status_code=400, detail="ספק לא נתמך")

        return KeyVerifyResponse(
            valid=True,
            provider=provider,
            model=confirmed_model,
            message=msg,
        )
    except Exception as exc:
        err_text = short_error(exc)
        logger.warning("Key verification failed for %s (%s): %s", provider, masked, err_text)
        
        detail_msg = f"אימות מפתח {provider.capitalize()} נכשל: {err_text}"
        if "401" in err_text or "unauthenticated" in err_text.lower() or "invalid_api_key" in err_text.lower():
            detail_msg = f"מפתח {provider.capitalize()} אינו תקין או שפג תוקפו. נא לוודא שהעתקת את המפתח הנכון."
        elif "429" in err_text or "quota" in err_text.lower():
            detail_msg = f"המפתח תקין אך חרג ממכסת ה-API (Quota Exceeded / 429)."

        raise HTTPException(status_code=400, detail=detail_msg) from exc
