"""Provider abstraction for multimodal LLM extraction (Strategy pattern)."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProviderResponse:
    """Raw text returned by a provider plus the concrete model that produced it."""

    raw_text: str
    model: str


class ProviderError(Exception):
    """Raised when a provider could not produce a response.

    Attributes:
        attempts: Per-model failure descriptions, kept for the audit trail.
    """

    def __init__(self, message: str, attempts: list | None = None):
        super().__init__(message)
        self.attempts = attempts or []


class ExtractionProvider(ABC):
    """A multimodal LLM able to read a document and answer with JSON text.

    Implementations are synchronous (vendor SDKs are blocking); the extractor
    runs them in a worker thread so the API event loop never blocks.
    """

    name: str = "base"

    @abstractmethod
    def is_configured(self) -> bool:
        """Whether credentials for this provider are available."""

    @abstractmethod
    def extract(self, system_prompt: str, file_path: str, mime_type: str) -> ProviderResponse:
        """Sends the document to the model and returns its raw JSON text.

        Raises:
            ProviderError: When every model of this provider failed.
        """


def short_error(error: Exception, limit: int = 300) -> str:
    """Compact, log-safe error text (vendor errors can be very long)."""
    text = " ".join(str(error).split())
    return text[:limit]
