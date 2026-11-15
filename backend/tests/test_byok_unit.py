"""Unit tests for Bring-Your-Own-Key (BYOK) credential resolution and scoped extractors.

Validates that:
1. API keys are masked appropriately for logs.
2. User-provided keys are correctly injected into request-scoped extractors.
3. Strict 2-tier enforcement prevents fallback to server .env keys when user keys are omitted.
"""
from unittest.mock import MagicMock, patch
import pytest

from api.dependencies.byok import BYOKCredentials
from config import Settings
from services.extraction.extractor import DocumentExtractor, mask_api_key
from services.extraction.providers.mock_provider import MockProvider


def test_mask_api_key():
    """Validates key masking for logging sanitization."""
    assert mask_api_key(None) == "(empty)"
    assert mask_api_key("") == "(empty)"
    assert mask_api_key("   ") == "(empty)"
    assert mask_api_key("short") == "***"
    assert mask_api_key("12345678") == "***"
    assert mask_api_key("AIzaSy1234567890abcdef") == "AIzaSy...cdef"
    assert mask_api_key("sk-proj-1234567890abcdef1234") == "sk-pro...1234"


def test_byok_credentials_empty_defaults_to_mock():
    """Ensures omitting user keys results in MockProvider with no server key leakage."""
    creds = BYOKCredentials(gemini_api_key=None, openai_api_key=None)
    assert not creds.has_user_key

    fake_settings = Settings(gemini_api_key="server-secret-gemini", openai_api_key="server-secret-openai")
    extractor = DocumentExtractor.create_scoped(settings=fake_settings)

    # Must contain ONLY MockProvider, completely ignoring server-secret keys
    assert len(extractor.provider_names) == 1
    assert extractor.provider_names[0] == "mock"


@patch("services.extraction.extractor.GeminiProvider")
def test_byok_credentials_with_gemini_key(mock_gemini_cls):
    """Verifies that providing a user Gemini key creates a scoped GeminiProvider."""
    mock_instance = MagicMock()
    mock_instance.name = "gemini"
    mock_gemini_cls.return_value = mock_instance

    creds = BYOKCredentials(gemini_api_key="user-gemini-key-12345")
    assert creds.has_user_key

    fake_settings = Settings(gemini_api_key="server-secret-gemini")
    extractor = creds.get_extractor()

    mock_gemini_cls.assert_called_once()
    assert extractor.provider_names == ["gemini"]


@patch("services.extraction.extractor.OpenAIProvider")
def test_byok_credentials_with_openai_key(mock_openai_cls):
    """Verifies that providing a user OpenAI key creates a scoped OpenAIProvider."""
    mock_instance = MagicMock()
    mock_instance.name = "openai"
    mock_openai_cls.return_value = mock_instance

    creds = BYOKCredentials(openai_api_key="user-openai-key-67890")
    assert creds.has_user_key

    extractor = creds.get_extractor()
    mock_openai_cls.assert_called_once()
    assert extractor.provider_names == ["openai"]


@patch("services.extraction.extractor.GeminiProvider")
@patch("services.extraction.extractor.OpenAIProvider")
def test_byok_credentials_with_both_keys(mock_openai_cls, mock_gemini_cls):
    """Verifies that providing both keys creates an ordered provider chain."""
    g_inst = MagicMock()
    g_inst.name = "gemini"
    mock_gemini_cls.return_value = g_inst

    o_inst = MagicMock()
    o_inst.name = "openai"
    mock_openai_cls.return_value = o_inst

    creds = BYOKCredentials(
        gemini_api_key="user-gemini-key",
        openai_api_key="user-openai-key",
    )
    assert creds.has_user_key

    extractor = creds.get_extractor()
    assert extractor.provider_names == ["gemini", "openai"]

