"""API request/response shapes for the regression endpoints.

Two families live here:
    * Ground-truth authoring ("תיוג"): ``RegressionCase*``.
    * Run History / A-B Comparison: ``RegressionRun*`` / ``RegressionCompare*``.
      These are read models over ``models.regression.RegressionRun`` rows -
      plain snapshots of a past ``RegressionReport``
      (``services/regression/runner.py``). Nothing here recomputes a score;
      see ``api/routes/regression.py`` for where a run is written and diffed.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class RegressionCaseSummary(BaseModel):
    """One (document, ground truth) pair in the regression suite."""

    name: str
    document_filename: str
    mime_type: str
    expected: Dict[str, Any]


class RegressionCaseSaveResult(BaseModel):
    """What the labeling UI renders right after a successful save."""

    case: RegressionCaseSummary
    warnings: List[Dict[str, Any]] = []


class RegressionCaseDeleteResult(BaseModel):
    success: bool


# ---------------------------------------------------------------------------
# Run History
# ---------------------------------------------------------------------------

class RegressionRunSummary(BaseModel):
    """One row of the Run History list - everything except the per-case detail."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    prompt_id: Optional[int] = None
    prompt_name: Optional[str] = None
    prompt_is_active: Optional[bool] = None
    providers: List[str] = []
    pass_threshold: float
    total: int
    passed: int
    failed: int
    scored: int
    coverage: float
    average_score: float
    scored_average_score: float
    warnings: List[str] = []

    # RegressionRun.prompt_version_id -> exposed as prompt_id so the API
    # shape matches the live (non-persisted) report's "prompt": {"id": ...}.
    @classmethod
    def from_run(cls, run: "Any") -> "RegressionRunSummary":
        return cls(
            id=run.id, created_at=run.created_at, prompt_id=run.prompt_version_id,
            prompt_name=run.prompt_name, prompt_is_active=run.prompt_is_active,
            providers=run.providers or [], pass_threshold=run.pass_threshold,
            total=run.total, passed=run.passed, failed=run.failed, scored=run.scored,
            coverage=run.coverage, average_score=run.average_score,
            scored_average_score=run.scored_average_score, warnings=run.warnings or [],
        )


class RegressionRunDetail(RegressionRunSummary):
    """A Run History row plus its full per-case breakdown."""

    suite_dir: str
    generated_at: str
    results: List[Dict[str, Any]] = []

    @classmethod
    def from_run(cls, run: "Any") -> "RegressionRunDetail":
        base = RegressionRunSummary.from_run(run)
        return cls(**base.model_dump(), suite_dir=run.suite_dir,
                   generated_at=run.generated_at, results=run.results or [])


class RegressionRunListResponse(BaseModel):
    runs: List[RegressionRunSummary]


class RegressionRunDeleteResult(BaseModel):
    success: bool


# ---------------------------------------------------------------------------
# A/B Comparison
# ---------------------------------------------------------------------------

class RegressionCaseComparison(BaseModel):
    """One suite case's outcome in run A vs. run B.

    ``a``/``b`` are ``None`` when the case did not exist in that run (the
    suite changed between the two runs); each present side is
    ``{"passed", "score", "critical_failures", "error"}``, read straight out
    of that run's stored ``TestCaseResult.to_dict()`` - see
    ``services/regression/runner.py``.
    """

    name: str
    a: Optional[Dict[str, Any]] = None
    b: Optional[Dict[str, Any]] = None
    score_delta: Optional[float] = None
    status: str  # "improved" | "regressed" | "unchanged" | "only_a" | "only_b"


class RegressionCompareResponse(BaseModel):
    run_a: RegressionRunDetail
    run_b: RegressionRunDetail
    cases: List[RegressionCaseComparison]
    summary_delta: Dict[str, float]  # run_b - run_a, for the headline metrics
