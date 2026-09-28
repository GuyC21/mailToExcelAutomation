"""OpenAI provider – secondary fallback when Gemini is unavailable.

Provides an alternative execution path using OpenAI's models to improve
system reliability if the primary provider experiences extended downtime.
"""
import base64
import os
from typing import Dict, Any

from openai import OpenAI

from services.extraction.providers.base import (
    ExtractionProvider,
    ProviderError,
    ProviderResponse,
    short_error,
)

_USER_PROMPT = "Extract the data from the attached document according to the system instructions."


class OpenAIProvider(ExtractionProvider):
    """Sends the document inline (base64) to a vision-capable chat model."""

    name: str = "openai"

    def __init__(self, api_key: str, model: str) -> None:
        """Initializes the OpenAI provider.

        Args:
            api_key: The OpenAI API key.
            model: The specific OpenAI model to use (e.g., 'gpt-4o').
        """
        self._api_key = (api_key or "").strip()
        self._model = model

    def is_configured(self) -> bool:
        """Checks if the OpenAI API key is configured.

        Returns:
            True if the API key is present, False otherwise.
        """
        return bool(self._api_key)

    def extract(self, system_prompt: str, file_path: str, mime_type: str) -> ProviderResponse:
        """Extracts JSON data from the document using the OpenAI API.

        Args:
            system_prompt: The detailed system instructions containing the JSON schema.
            file_path: Path to the local file to process.
            mime_type: The MIME type of the file.

        Returns:
            A ProviderResponse containing the raw JSON string and the model used.

        Raises:
            ProviderError: If the OpenAI model fails to process the document.
        """
        try:
            client = OpenAI(api_key=self._api_key)
            response = client.chat.completions.create(
                model=self._model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": [
                        {"type": "text", "text": _USER_PROMPT},
                        self._file_part(file_path, mime_type),
                    ]},
                ],
            )
            return ProviderResponse(raw_text=response.choices[0].message.content or "", model=self._model)
        except Exception as error:
            attempt = {"provider": self.name, "model": self._model, "error": short_error(error)}
            raise ProviderError("מודל OpenAI נכשל", [attempt]) from error

    @staticmethod
    def _file_part(file_path: str, mime_type: str) -> Dict[str, Any]:
        """PDFs go as a ``file`` part, images as an ``image_url`` data URI.

        This handles the formatting differences required by OpenAI's API when
        sending documents versus images.

        Args:
            file_path: Path to the local file.
            mime_type: The MIME type of the file.

        Returns:
            A dictionary formatted appropriately for the OpenAI chat completion message.
        """
        with open(file_path, "rb") as handle:
            encoded = base64.b64encode(handle.read()).decode("ascii")
        data_uri = f"data:{mime_type};base64,{encoded}"
        if mime_type == "application/pdf":
            return {"type": "file", "file": {"filename": os.path.basename(file_path), "file_data": data_uri}}
        return {"type": "image_url", "image_url": {"url": data_uri}}
