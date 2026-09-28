"""Tests for the regression runner: suite discovery + orchestration.

No network is used anywhere here – a stub ``ExtractionProvider`` stands in
for Gemini (dependency injection, per ``DocumentExtractor``'s design), and
regression suites are built in ``tmp_path`` for each test.
"""
import asyncio
import json

from schemas.extraction import DocumentExtraction
from services.extraction.extractor import DocumentExtractor
from services.extraction.providers.base import ExtractionProvider, ProviderError, ProviderResponse
from services.regression.runner import RegressionRunner, discover_cases, guess_mime_type
from tests.fixtures import sample_documents as samples


class StubProvider(ExtractionProvider):
    """Returns a fixed JSON payload (or fails) regardless of the input file."""

    name = "stub"

    def __init__(self, payload: dict | None = None, fail: bool = False):
        self._payload = payload
        self._fail = fail

    def is_configured(self) -> bool:
        return True

    def extract(self, system_prompt: str, file_path: str, mime_type: str) -> ProviderResponse:
        if self._fail:
            raise ProviderError("boom", attempts=[{"provider": self.name, "model": "stub-1", "error": "boom"}])
        return ProviderResponse(raw_text=json.dumps(self._payload), model="stub-1")


def _write_suite(tmp_path, cases: dict[str, dict]) -> None:
    """Writes ``{stem: expected_dict}`` as paired (empty document, ground truth) files."""
    for stem, expected in cases.items():
        (tmp_path / f"{stem}.pdf").write_bytes(b"%PDF-1.4 fake")
        (tmp_path / f"{stem}_expected.json").write_text(json.dumps(expected, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# discover_cases
# ---------------------------------------------------------------------------

def test_discover_cases_pairs_documents_with_ground_truth(tmp_path):
    _write_suite(tmp_path, {"form1": samples.SHL_VALID})
    cases, warnings = discover_cases(tmp_path)
    assert warnings == []
    assert len(cases) == 1
    assert cases[0].name == "form1"
    assert cases[0].document_path.suffix == ".pdf"


def test_discover_cases_warns_on_orphan_document(tmp_path):
    (tmp_path / "orphan.pdf").write_bytes(b"%PDF-1.4 fake")
    cases, warnings = discover_cases(tmp_path)
    assert cases == []
    assert len(warnings) == 1
    assert "orphan.pdf" in warnings[0]


def test_discover_cases_warns_on_orphan_expected_json(tmp_path):
    (tmp_path / "orphan_expected.json").write_text("{}", encoding="utf-8")
    cases, warnings = discover_cases(tmp_path)
    assert cases == []
    assert len(warnings) == 1
    assert "orphan_expected.json" in warnings[0]


def test_discover_cases_reports_missing_directory(tmp_path):
    cases, warnings = discover_cases(tmp_path / "does_not_exist")
    assert cases == []
    assert len(warnings) == 1


def test_guess_mime_type():
    from pathlib import Path

    assert guess_mime_type(Path("form1.pdf")) == "application/pdf"
    assert guess_mime_type(Path("form1.png")) == "image/png"


# ---------------------------------------------------------------------------
# RegressionRunner
# ---------------------------------------------------------------------------

def test_runner_scores_a_perfect_extraction_as_passing(tmp_path):
    # Ground truth is written in the same normalised shape the schema produces
    # (e.g. currency defaults to "ILS"), just like a real hand-labelled
    # expected.json would be — not the bare fixture dict.
    normalised = DocumentExtraction.model_validate(samples.SHL_VALID).model_dump()
    _write_suite(tmp_path, {"shl": normalised})
    extractor = DocumentExtractor([StubProvider(normalised)])
    runner = RegressionRunner(extractor, pass_threshold=80.0)

    report = asyncio.run(runner.run(tmp_path))

    assert report.total == 1
    assert report.passed == 1
    assert report.warnings == []
    assert report.results[0].score.overall_score == 100.0
    # The report must be JSON-serialisable end to end (what the runner's CLI prints).
    json.dumps(report.to_dict(), ensure_ascii=False)


def test_runner_fails_a_bad_extraction_below_threshold(tmp_path):
    _write_suite(tmp_path, {"shl": samples.SHL_VALID})
    wrong = dict(samples.SHL_VALID, supplier_name="ספק שגוי לגמרי", total_amount=1, line_items=[])
    extraction_json = DocumentExtraction.model_validate(wrong).model_dump()
    extractor = DocumentExtractor([StubProvider(extraction_json)])
    runner = RegressionRunner(extractor, pass_threshold=80.0)

    report = asyncio.run(runner.run(tmp_path))

    assert report.passed == 0
    assert report.failed == 1
    assert report.results[0].score.overall_score < 80.0


def test_runner_records_extraction_failure_without_crashing(tmp_path):
    _write_suite(tmp_path, {"shl": samples.SHL_VALID})
    extractor = DocumentExtractor([StubProvider(fail=True)])
    runner = RegressionRunner(extractor)

    report = asyncio.run(runner.run(tmp_path))

    assert report.total == 1
    assert report.passed == 0
    assert report.results[0].error
    assert report.results[0].score is None


def test_runner_handles_corrupt_ground_truth_file(tmp_path):
    (tmp_path / "bad.pdf").write_bytes(b"%PDF-1.4 fake")
    (tmp_path / "bad_expected.json").write_text("{not valid json", encoding="utf-8")
    extractor = DocumentExtractor([StubProvider({})])
    runner = RegressionRunner(extractor)

    report = asyncio.run(runner.run(tmp_path))

    assert report.total == 1
    assert report.passed == 0
    assert "ground" in report.results[0].error or "JSON" in report.results[0].error


def test_runner_surfaces_discovery_warnings_in_the_report(tmp_path):
    normalised = DocumentExtraction.model_validate(samples.SHL_VALID).model_dump()
    _write_suite(tmp_path, {"shl": normalised})
    (tmp_path / "unpaired.pdf").write_bytes(b"%PDF-1.4 fake")
    extractor = DocumentExtractor([StubProvider(normalised)])
    runner = RegressionRunner(extractor)

    report = asyncio.run(runner.run(tmp_path))

    assert report.total == 1
    assert len(report.warnings) == 1
    assert "unpaired.pdf" in report.warnings[0]
