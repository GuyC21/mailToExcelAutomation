"""Google Gemini provider (primary) with an ordered per-model fallback chain."""
import logging
import time
from typing import List

import google.generativeai as genai

from services.extraction.providers.base import (
    ExtractionProvider,
    ProviderError,
    ProviderResponse,
    short_error,
)

logger = logging.getLogger(__name__)

# Errors worth trying the next model for: quota (429), unknown/retired model
# (404), transient overload (500/503), and dropped-connection errors (SSL/EOF/
# broken pipe/reset) — these are transport hiccups, not a verdict on the model,
# so a fresh request (to the same or the next model) can simply succeed.
# Anything else (bad request, safety block) would fail identically again, so
# we stop early instead of burning the whole fallback chain on it.
_FALLBACK_MARKERS = (
    "429", "quota", "resource_exhausted", "404", "not found", "500", "503", "unavailable", "overloaded",
    "ssl", "eof", "broken pipe", "connection reset", "connection aborted", "remotedisconnected",
    "connectionerror", "timed out", "timeout",
)
_USER_PROMPT = "Extract the data from the attached document according to the system instructions."
_UPLOAD_RETRIES = 3
_UPLOAD_BACKOFF_SECONDS = 1.5


def _is_retryable(error: Exception) -> bool:
    text = str(error).lower()
    return any(marker in text for marker in _FALLBACK_MARKERS)


def _upload_with_retry(file_path: str, mime_type: str):
    """Uploads the file, retrying transient network drops.

    The upload happens once, before any model is tried, so without its own
    retry a single dropped connection (SSL EOF, broken pipe) would fail the
    whole document before the model-fallback chain even starts.
    """
    last_error: Exception | None = None
    for attempt in range(1, _UPLOAD_RETRIES + 1):
        try:
            return genai.upload_file(file_path, mime_type=mime_type)
        except Exception as error:
            last_error = error
            if attempt == _UPLOAD_RETRIES or not _is_retryable(error):
                raise
            logger.warning("Gemini upload attempt %d/%d failed (%s), retrying...",
                           attempt, _UPLOAD_RETRIES, short_error(error, 120))
            time.sleep(_UPLOAD_BACKOFF_SECONDS * attempt)
    raise last_error  # pragma: no cover - loop always returns or raises above


class GeminiProvider(ExtractionProvider):
    """Uploads the file to the Gemini File API and asks for JSON output."""

    name = "gemini"

    def __init__(self, api_key: str, models: List[str]):
        self._api_key = (api_key or "").strip()
        self._models = models
        if self._api_key:
            genai.configure(api_key=self._api_key)

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def extract(self, system_prompt: str, file_path: str, mime_type: str) -> ProviderResponse:
        uploaded = _upload_with_retry(file_path, mime_type)
        attempts = []
        try:
            for model_name in self._models:
                try:
                    model = genai.GenerativeModel(model_name, system_instruction=system_prompt)
                    response = model.generate_content(
                        [_USER_PROMPT, uploaded],
                        generation_config=genai.types.GenerationConfig(
                            response_mime_type="application/json",
                            temperature=0,
                        ),
                    )
                    return ProviderResponse(raw_text=response.text, model=model_name)
                except Exception as error:  # vendor SDK raises many types
                    attempts.append({"provider": self.name, "model": model_name, "error": short_error(error)})
                    logger.warning("Gemini model %s failed: %s", model_name, short_error(error, 120))
                    if not _is_retryable(error):
                        break
            raise ProviderError("כל מודלי Gemini נכשלו", attempts)
        finally:
            self._delete_quietly(uploaded)

    @staticmethod
    def _delete_quietly(uploaded) -> None:
        """Best-effort cleanup: the document holds supplier PII."""
        try:
            genai.delete_file(uploaded.name)
        except Exception as error:
            logger.warning("Could not delete Gemini file: %s", short_error(error, 120))
