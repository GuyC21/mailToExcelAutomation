"""Extraction orchestrator: envelope -> provider chain -> JSON -> schema.

Fallback policy (a design decision - see README):
    1. Gemini (each configured model in order), then OpenAI if a key exists.
    2. The first provider whose answer parses into the schema wins.
    3. If every provider fails, the outcome is EXTRACTION_FAILED with the full
       list of attempts - it is persisted and written to Excel like any other
       document, so a failure is always visible and traceable, never swallowed.
    4. The mock provider is used only when no real provider is configured.
"""
import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from pydantic import ValidationError

from config import Settings, get_settings
from schemas.extraction import DocumentExtraction
from services.extraction.providers.base import ExtractionProvider, ProviderError, short_error
from services.extraction.providers.gemini_provider import GeminiProvider
from services.extraction.providers.mock_provider import MockProvider
from services.extraction.providers.openai_provider import OpenAIProvider
from services.extraction.system_envelope import build_system_envelope

logger = logging.getLogger(__name__)
_RAW_LIMIT = 20_000  # Cap stored raw responses to keep the audit table lean.


@dataclass
class ExtractionOutcome:
    """Result of one extraction run, successful or not.
    
    Attributes:
        data: The validated data extraction, or None if extraction failed.
        provider: The provider that succeeded, or None if all failed.
        model: The model that succeeded, or None if all failed.
        raw_response: The raw response from the provider, truncated.
        error: A summary of errors if extraction failed.
        attempts: Audit trail of all provider attempts.
    """

    data: Optional[DocumentExtraction]
    provider: Optional[str] = None
    model: Optional[str] = None
    raw_response: str = ""
    error: str = ""
    attempts: List[dict] = field(default_factory=list)

    @property
    def succeeded(self) -> bool:
        """Returns whether the extraction produced valid data."""
        return self.data is not None


def _strip_fences(text: str) -> str:
    """Removes ```json fences some models add despite instructions.

    Models occasionally add Markdown formatting around their JSON payload
    even when instructed to return pure JSON, so this strips it out.

    Args:
        text: The raw text returned by the LLM.

    Returns:
        The cleaned text containing only the JSON payload.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


def mask_api_key(key: Optional[str]) -> str:
    """Masks an API key for safe logging, exposing only prefix and suffix.

    Args:
        key: Raw API key string.

    Returns:
        A masked string like 'AIzaSy...7890' or '(empty)'.
    """
    if not key or not key.strip():
        return "(empty)"
    s = key.strip()
    if len(s) <= 8:
        return "***"
    return f"{s[:6]}...{s[-4:]}"


class DocumentExtractor:
    """Runs a document through the configured provider chain."""

    def __init__(self, providers: List[ExtractionProvider]) -> None:
        """Initializes the DocumentExtractor with an ordered list of providers.

        Args:
            providers: A list of provider implementations to attempt in sequence.
        """
        self._providers = providers

    @classmethod
    def from_settings(cls, settings: Optional[Settings] = None) -> "DocumentExtractor":
        """Builds the provider chain from configuration.

        Args:
            settings: Optional explicit settings to use; defaults to the global settings.

        Returns:
            A fully configured DocumentExtractor instance.
        """
        settings = settings or get_settings()
        real: List[ExtractionProvider] = [
            GeminiProvider(settings.gemini_api_key, settings.gemini_model_chain),
            OpenAIProvider(settings.openai_api_key, settings.openai_model),
        ]
        configured = [p for p in real if p.is_configured()]
        return cls(configured or [MockProvider()])

    @classmethod
    def create_scoped(
        cls,
        settings: Optional[Settings] = None,
        user_gemini_key: Optional[str] = None,
        user_openai_key: Optional[str] = None,
    ) -> "DocumentExtractor":
        """Builds a scoped extractor honoring user BYOK keys.

        Strict 2-tier security rule:
        If user BYOK keys are provided, configure the extractor using ONLY those keys.
        If NO user keys are provided, fall back directly to MockProvider() so that
        the author's server-side quota is never consumed by guest/demo users.

        Args:
            settings: Optional explicit settings; defaults to global settings for model lists.
            user_gemini_key: Ephemeral Gemini key provided in request headers.
            user_openai_key: Ephemeral OpenAI key provided in request headers.

        Returns:
            DocumentExtractor instance tailored for the current request.
        """
        settings = settings or get_settings()
        gemini_k = (user_gemini_key or "").strip()
        openai_k = (user_openai_key or "").strip()

        providers: List[ExtractionProvider] = []
        if gemini_k:
            providers.append(GeminiProvider(gemini_k, settings.gemini_model_chain))
        if openai_k:
            providers.append(OpenAIProvider(openai_k, settings.openai_model))

        if not providers:
            return cls([MockProvider()])

        return cls(providers)

    @property
    def provider_names(self) -> List[str]:
        """Gets the names of the providers configured for this extractor."""
        return [p.name for p in self._providers]

    async def extract(self, business_prompt: str, file_path: str, mime_type: str) -> ExtractionOutcome:
        """Extracts structured data; never raises – failures are returned.

        This method coordinates the system prompt building, attempts extraction
        with each provider in turn, handles transient and permanent failures,
        and ensures the output conforms to the Pydantic schema.

        Args:
            business_prompt: The dynamic instructions authored by the user.
            file_path: Path to the local file to process.
            mime_type: The MIME type of the document.

        Returns:
            An ExtractionOutcome capturing either the successfully validated data
            or the consolidated failure reasons from all attempts.
        """
        system_prompt = build_system_envelope(business_prompt)
        attempts: List[dict] = []
        last_raw = ""
        for provider in self._providers:
            try:
                response = await asyncio.to_thread(provider.extract, system_prompt, file_path, mime_type)
            except ProviderError as error:
                attempts.extend(error.attempts)
                continue
            except Exception as error:  # e.g. upload/network failure before any model ran
                attempts.append({"provider": provider.name, "model": None, "error": short_error(error)})
                continue
            last_raw = response.raw_text[:_RAW_LIMIT]
            try:
                data = DocumentExtraction.model_validate(json.loads(_strip_fences(response.raw_text)))
            except (json.JSONDecodeError, ValidationError, TypeError) as error:
                attempts.append({"provider": provider.name, "model": response.model,
                                 "error": f"תשובה לא תקינה מהמודל: {short_error(error)}"})
                continue
            return ExtractionOutcome(data=data, provider=provider.name, model=response.model,
                                     raw_response=last_raw, attempts=attempts)
        logger.error("Extraction failed for %s after %d attempts", file_path, len(attempts))
        return ExtractionOutcome(data=None, raw_response=last_raw, attempts=attempts,
                                 error=self._summarise(attempts))

    @staticmethod
    def _summarise(attempts: List[dict]) -> str:
        """Human-readable Hebrew summary of why every attempt failed.

        Args:
            attempts: A list of dicts describing the failure details per model attempted.

        Returns:
            A combined error summary string intended for end-user display.
        """
        if not attempts:
            return "לא הוגדר אף ספק AI זמין"
        text = " | ".join(f"{a['provider']}/{a.get('model') or '-'}: {a['error'][:140]}" for a in attempts)
        if any("429" in a["error"] or "quota" in a["error"].lower() for a in attempts):
            return f"חריגה ממכסת ה-API של ספק ה-AI. פרטים: {text}"
        return f"החילוץ נכשל בכל ספקי ה-AI. פרטים: {text}"
