"""Google Gemini provider (primary) with an ordered per-model fallback chain."""
import logging
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
# (404) and transient overload (500/503). Anything else (bad request, safety
# block) would fail identically on a sibling model, so we stop early.
_FALLBACK_MARKERS = ("429", "quota", "resource_exhausted", "404", "not found", "500", "503", "unavailable", "overloaded")
_USER_PROMPT = "Extract the data from the attached document according to the system instructions."


def _is_retryable(error: Exception) -> bool:
    text = str(error).lower()
    return any(marker in text for marker in _FALLBACK_MARKERS)


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
        uploaded = genai.upload_file(file_path, mime_type=mime_type)
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
