"""Regression test runner: replays ``data/regression_suite`` through the real
extraction pipeline (Gemini only) and scores every result against its
hand-labelled ground truth.

Suite layout (see the project README):
    data/regression_suite/
        form1.pdf
        form1_expected.json
        form2.png
        form2_expected.json
        ...

Each document is paired with its ground truth purely by file stem, so any
document extension mimetypes understands works (pdf, png, jpg, ...).

The pipeline itself (system envelope, JSON parsing, schema validation) is
reused from ``services.extraction.extractor.DocumentExtractor`` rather than
re-implemented here, so a regression run exercises exactly the same code path
production ingestion does. Only the provider list is pinned to Gemini
(``GeminiProvider``) per the Sprint 3 spec: regression is about tracking one
model's accuracy over time, not about whichever provider happened to answer.

The extractor is injected (``RegressionRunner.__init__``), so tests can pass
a stub provider and never touch the network — see ``test_runner.py``.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import mimetypes
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple, Union

from config import get_settings
from services.extraction.extractor import DocumentExtractor
from services.extraction.providers.gemini_provider import GeminiProvider
from services.regression.scorer import ScoreReport, ScoringConfig, score_extraction

logger = logging.getLogger(__name__)

DEFAULT_SUITE_DIR = Path("data/regression_suite")
DEFAULT_PASS_THRESHOLD = 80.0
# A neutral business prompt: regression measures the *technical* pipeline's
# transcription accuracy, so it deliberately does not depend on whatever the
# finance team currently has active in the Backoffice.
DEFAULT_BUSINESS_PROMPT = (
    "חלץ את כל הנתונים מהמסמך המצורף בנאמנות מלאה למקור, ללא תיקון או חישוב מחדש."
)

_DOCUMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}
_EXPECTED_SUFFIX = "_expected.json"


def guess_mime_type(path: Path) -> str:
    """Best-effort MIME type from the file extension."""
    mime, _ = mimetypes.guess_type(path.name)
    return mime or "application/octet-stream"


@dataclass
class SuiteCase:
    """One (document, ground truth) pair discovered in the suite directory."""

    name: str
    document_path: Path
    expected_path: Path


def discover_cases(suite_dir: Union[Path, str]) -> Tuple[List[SuiteCase], List[str]]:
    """Pairs each document in ``suite_dir`` with its ``<stem>_expected.json``.

    Returns ``(cases, warnings)``. A document without a matching ground-truth
    file (or vice versa) is never silently skipped — it becomes a warning, so
    a typo'd file name surfaces immediately instead of quietly shrinking the
    suite.
    """
    suite_dir = Path(suite_dir)
    if not suite_dir.is_dir():
        return [], [f"תיקיית הסוויטה אינה קיימת: {suite_dir}"]

    documents = {p.stem: p for p in suite_dir.iterdir()
                if p.is_file() and p.suffix.lower() in _DOCUMENT_EXTENSIONS}
    expected_files = {p.name[: -len(_EXPECTED_SUFFIX)]: p for p in suite_dir.glob(f"*{_EXPECTED_SUFFIX}")}

    warnings: List[str] = []
    cases: List[SuiteCase] = []
    for stem in sorted(set(documents) | set(expected_files)):
        document, expected = documents.get(stem), expected_files.get(stem)
        if document and expected:
            cases.append(SuiteCase(name=stem, document_path=document, expected_path=expected))
        elif document:
            warnings.append(f"אין קובץ ground-truth עבור {document.name} (מצופה: {stem}{_EXPECTED_SUFFIX})")
        else:
            warnings.append(f"אין מסמך תואם לקובץ {expected.name}")
    return cases, warnings


@dataclass
class TestCaseResult:
    """Outcome of running (and scoring) one suite case."""

    name: str
    document_path: str
    expected_path: str
    passed: bool
    provider: Optional[str] = None
    model: Optional[str] = None
    score: Optional[ScoreReport] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "document_path": self.document_path,
            "expected_path": self.expected_path,
            "passed": self.passed,
            "provider": self.provider,
            "model": self.model,
            "error": self.error,
            "score": self.score.to_dict() if self.score else None,
        }


@dataclass
class RegressionReport:
    """Full report for one run of the suite."""

    suite_dir: str
    generated_at: str
    pass_threshold: float
    results: List[TestCaseResult] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def failed(self) -> int:
        return self.total - self.passed

    @property
    def average_score(self) -> float:
        scored = [r.score.overall_score for r in self.results if r.score]
        return sum(scored) / len(scored) if scored else 0.0

    def to_dict(self) -> dict:
        return {
            "suite_dir": self.suite_dir,
            "generated_at": self.generated_at,
            "pass_threshold": self.pass_threshold,
            "summary": {
                "total": self.total,
                "passed": self.passed,
                "failed": self.failed,
                "average_score": round(self.average_score, 2),
            },
            "warnings": self.warnings,
            "results": [r.to_dict() for r in self.results],
        }


class RegressionRunner:
    """Runs a regression suite end-to-end: extract -> score -> report.

    The ``DocumentExtractor`` is injected so this class never decides how
    extraction happens; production wiring (``from_settings``) pins it to
    Gemini, tests pin it to a stub, and nothing here changes either way.
    """

    def __init__(self, extractor: DocumentExtractor, business_prompt: str = DEFAULT_BUSINESS_PROMPT,
                scoring_config: Optional[ScoringConfig] = None,
                pass_threshold: float = DEFAULT_PASS_THRESHOLD):
        self._extractor = extractor
        self._business_prompt = business_prompt
        self._scoring_config = scoring_config or ScoringConfig()
        self._pass_threshold = pass_threshold

    @classmethod
    def from_settings(cls, **kwargs) -> "RegressionRunner":
        """Builds a runner wired to the real ``GeminiProvider`` only."""
        settings = get_settings()
        provider = GeminiProvider(settings.gemini_api_key, settings.gemini_model_chain)
        extractor = DocumentExtractor([provider])
        return cls(extractor, **kwargs)

    async def run(self, suite_dir: Union[Path, str] = DEFAULT_SUITE_DIR) -> RegressionReport:
        """Runs every case in ``suite_dir`` and returns the aggregate report."""
        cases, warnings = discover_cases(suite_dir)
        report = RegressionReport(
            suite_dir=str(suite_dir),
            generated_at=datetime.now(timezone.utc).isoformat(),
            pass_threshold=self._pass_threshold,
            warnings=warnings,
        )
        for case in cases:
            report.results.append(await self._run_case(case))
        return report

    async def _run_case(self, case: SuiteCase) -> TestCaseResult:
        try:
            expected = json.loads(case.expected_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            return TestCaseResult(case.name, str(case.document_path), str(case.expected_path),
                                  passed=False, error=f"קובץ ה-ground-truth אינו קריא: {error}")

        outcome = await self._extractor.extract(
            self._business_prompt, str(case.document_path), guess_mime_type(case.document_path))

        if not outcome.succeeded:
            return TestCaseResult(case.name, str(case.document_path), str(case.expected_path),
                                  passed=False, provider=outcome.provider, model=outcome.model,
                                  error=outcome.error or "extraction failed")

        actual = outcome.data.model_dump()
        score = score_extraction(expected, actual, self._scoring_config)
        return TestCaseResult(case.name, str(case.document_path), str(case.expected_path),
                              passed=score.overall_score >= self._pass_threshold,
                              provider=outcome.provider, model=outcome.model, score=score)


# ---------------------------------------------------------------------------
# CLI entry point: `python -m services.regression.runner [--suite-dir ...]`
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the extraction regression suite against ground truth.")
    parser.add_argument("--suite-dir", default=str(DEFAULT_SUITE_DIR))
    parser.add_argument("--threshold", type=float, default=DEFAULT_PASS_THRESHOLD)
    parser.add_argument("--output", default=None, help="Also write the JSON report to this path.")
    return parser.parse_args()


async def _main() -> int:
    logging.basicConfig(level=logging.INFO)
    args = _parse_args()
    runner = RegressionRunner.from_settings(pass_threshold=args.threshold)
    report = await runner.run(args.suite_dir)
    payload = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
    print(payload)
    if args.output:
        Path(args.output).write_text(payload, encoding="utf-8")
    return 0 if report.total and report.failed == 0 and not report.warnings else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
