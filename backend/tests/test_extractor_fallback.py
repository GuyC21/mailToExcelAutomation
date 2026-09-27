"""Provider fallback behaviour, with the vendor SDK replaced by fakes."""
import asyncio
import json
from types import SimpleNamespace

from services.extraction.extractor import DocumentExtractor
from services.extraction.providers import gemini_provider
from services.extraction.providers.base import ExtractionProvider, ProviderError, ProviderResponse

GOOD_JSON = json.dumps({"supplier_name": "ספק", "total_amount": 10})


class FakeGenai:
    """Mimics the parts of ``google.generativeai`` the provider uses."""

    def __init__(self, failures):
        self.failures, self.calls, self.deleted = failures, [], False
        self.types = SimpleNamespace(GenerationConfig=lambda **kw: kw)

    def configure(self, api_key):
        pass

    def upload_file(self, path, mime_type):
        return SimpleNamespace(name="files/1")

    def delete_file(self, name):
        self.deleted = True

    def GenerativeModel(self, name, system_instruction):  # noqa: N802 (SDK naming)
        fake = self

        class Model:
            def generate_content(self, parts, generation_config):
                fake.calls.append(name)
                if name in fake.failures:
                    raise RuntimeError(fake.failures[name])
                return SimpleNamespace(text=GOOD_JSON)
        return Model()


def test_gemini_falls_back_to_next_model_on_quota(monkeypatch):
    fake = FakeGenai({"m1": "429 You exceeded your current quota"})
    monkeypatch.setattr(gemini_provider, "genai", fake)
    response = gemini_provider.GeminiProvider("key", ["m1", "m2"]).extract("sys", "f.pdf", "application/pdf")
    assert response.model == "m2" and fake.calls == ["m1", "m2"] and fake.deleted


def test_gemini_stops_on_non_retryable_error(monkeypatch):
    fake = FakeGenai({"m1": "400 invalid argument"})
    monkeypatch.setattr(gemini_provider, "genai", fake)
    try:
        gemini_provider.GeminiProvider("key", ["m1", "m2"]).extract("sys", "f.pdf", "application/pdf")
        raise AssertionError("expected ProviderError")
    except ProviderError as error:
        assert fake.calls == ["m1"] and len(error.attempts) == 1


class _Failing(ExtractionProvider):
    name = "first"

    def is_configured(self):
        return True

    def extract(self, system_prompt, file_path, mime_type):
        raise ProviderError("down", [{"provider": "first", "model": "x", "error": "429 quota"}])


class _Garbage(_Failing):
    name = "garbage"

    def extract(self, system_prompt, file_path, mime_type):
        return ProviderResponse(raw_text="not json", model="g")


class _Good(_Failing):
    name = "second"

    def extract(self, system_prompt, file_path, mime_type):
        return ProviderResponse(raw_text=f"```json\n{GOOD_JSON}\n```", model="s")


def test_extractor_uses_next_provider_and_keeps_attempt_log():
    outcome = asyncio.run(DocumentExtractor([_Failing(), _Garbage(), _Good()]).extract("p", "f.pdf", "application/pdf"))
    assert outcome.succeeded and outcome.provider == "second"
    assert [a["provider"] for a in outcome.attempts] == ["first", "garbage"]


def test_total_failure_is_reported_not_raised():
    outcome = asyncio.run(DocumentExtractor([_Failing()]).extract("p", "f.pdf", "application/pdf"))
    assert not outcome.succeeded and "מכסת" in outcome.error  # quota explained in Hebrew
