"""Dependency for resolving Bring-Your-Own-Key (BYOK) LLM credentials.

This module extracts ephemeral AI provider API keys supplied in HTTP headers
(e.g., ``X-Gemini-API-Key``, ``X-OpenAI-API-Key``) to enable guest/evaluator usage
without persisting keys to disk or consuming the host system's quotas.
"""
from typing import Optional

from fastapi import Header

from services.extraction.extractor import DocumentExtractor


class BYOKCredentials:
    """Encapsulates ephemeral user-supplied LLM API credentials.

    Attributes:
        gemini_api_key: Ephemeral Google Gemini key provided in headers.
        openai_api_key: Ephemeral OpenAI key provided in headers.
    """

    def __init__(
        self,
        gemini_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
    ) -> None:
        """Initializes BYOK credentials.

        Args:
            gemini_api_key: Raw header value for Gemini.
            openai_api_key: Raw header value for OpenAI.
        """
        self.gemini_api_key = (gemini_api_key or "").strip() or None
        self.openai_api_key = (openai_api_key or "").strip() or None

    @property
    def has_user_key(self) -> bool:
        """Indicates whether the user supplied at least one active API key."""
        return bool(self.gemini_api_key or self.openai_api_key)

    def get_extractor(self) -> DocumentExtractor:
        """Constructs a single-use DocumentExtractor bound to these credentials.

        Strict 2-tier enforcement:
        If user keys are supplied, uses them.
        If no user keys are supplied, routes strictly to MockProvider().

        Returns:
            A DocumentExtractor configured for this request.
        """
        return DocumentExtractor.create_scoped(
            user_gemini_key=self.gemini_api_key,
            user_openai_key=self.openai_api_key,
        )


async def get_byok_credentials(
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key"),
) -> BYOKCredentials:
    """FastAPI dependency to extract BYOK credentials from HTTP headers.

    Args:
        x_gemini_api_key: Value of the ``X-Gemini-API-Key`` header.
        x_openai_api_key: Value of the ``X-OpenAI-API-Key`` header.

    Returns:
        A BYOKCredentials instance containing sanitized keys.
    """
    return BYOKCredentials(
        gemini_api_key=x_gemini_api_key,
        openai_api_key=x_openai_api_key,
    )
