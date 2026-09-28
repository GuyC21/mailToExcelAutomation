"""Provider abstraction for multimodal LLM extraction (Strategy pattern).

This module defines the interface for AI models to act interchangeably
within the extraction pipeline. By using the Strategy pattern, we ensure
the pipeline logic is completely decoupled from any specific vendor's SDK
or prompt requirements.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ProviderResponse:
    """Raw text returned by a provider plus the concrete model that produced it.

    Attributes:
        raw_text: The literal text (expected to be JSON) returned by the model.
        model: The specific model version that produced the response (e.g., 'gemini-1.5-pro').
    """

    raw_text: str
    model: str


class ProviderError(Exception):
    """Raised when a provider could not produce a response.

    Attributes:
        attempts: Per-model failure descriptions, kept for the audit trail.
    """

    def __init__(self, message: str, attempts: Optional[List[dict]] = None) -> None:
        """Initializes the ProviderError.

        Args:
            message: The human-readable error description.
            attempts: A list of dicts describing the failure details per model attempted.
        """
        super().__init__(message)
        self.attempts: List[dict] = attempts or []


class ExtractionProvider(ABC):
    """A multimodal LLM able to read a document and answer with JSON text.

    Implementations are synchronous (vendor SDKs are blocking); the extractor
    runs them in a worker thread so the API event loop never blocks.
    """

    name: str = "base"

    @abstractmethod
    def is_configured(self) -> bool:
        """Whether credentials for this provider are available.

        Returns:
            True if the provider is fully configured and ready, False otherwise.
        """

    @abstractmethod
    def extract(self, system_prompt: str, file_path: str, mime_type: str) -> ProviderResponse:
        """Sends the document to the model and returns its raw JSON text.

        Args:
            system_prompt: The complete prompt envelope enforcing rules and schema.
            file_path: The absolute path to the local document file.
            mime_type: The MIME type of the document.

        Returns:
            A ProviderResponse containing the model's raw output.

        Raises:
            ProviderError: When every model of this provider failed to produce a valid response.
        """


def short_error(error: Exception, limit: int = 300) -> str:
    """Compact, log-safe error text (vendor errors can be very long).

    Args:
        error: The exception to format.
        limit: The maximum string length to return.

    Returns:
        A single-line string representation of the error, truncated to the limit.
    """
    text = " ".join(str(error).split())
    return text[:limit]
