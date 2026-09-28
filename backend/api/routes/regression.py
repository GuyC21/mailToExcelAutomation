"""Regression testing endpoints: run the automated suite, and author ("תיוג")
the ground-truth cases it runs against.

Two concerns live in this router because they share one resource – the suite
under ``data/regression_suite/`` – and one URL namespace (``/api/regression``):

    * ``POST /run``            – replay the suite with a chosen prompt version
      (default: the active one) and score it (``services.regression.runner``).
    * ``GET/POST/DELETE /cases`` – list, create, edit and remove the
      hand-labeled ground-truth cases the suite is made of
      (``services.regression.labeling``). This is the API behind the תיוג
      (labeling) page: without it, growing the suite means a developer
      hand-writing JSON files.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.uploads import MB, read_upload_or_413
from config import get_settings
from database import get_db
from models.prompt import PromptVersion
from models.regression import RegressionRun
from repositories.prompt_repository import get_active_prompt
from schemas.extraction import DocumentExtraction
from schemas.regression import (
    RegressionCaseComparison,
    RegressionCaseDeleteResult,
    RegressionCaseSaveResult,
    RegressionCaseSummary,
    RegressionCompareResponse,
    RegressionRunDeleteResult,
    RegressionRunDetail,
    RegressionRunListResponse,
    RegressionRunSummary,
)
from services.extraction.providers.base import short_error
from services.regression.labeling import (
    CaseNotFoundError,
    InvalidCaseNameError,
    UnsupportedLabelDocumentError,
    delete_labeled_case,
    get_case_document,
    get_labeled_case,
    list_labeled_cases,
    save_labeled_case,
)
from services.regression.runner import RegressionProviderUnavailableError, RegressionRunner

router = APIRouter()
logger = logging.getLogger(__name__)


class RegressionResponse(BaseModel):
    """Response schema for a regression test run."""
    success: bool
    data: Dict[str, Any]
    error: str | None = None

@router.post("/run", response_model=RegressionResponse)
async def run_regression_suite(
    prompt_id: Optional[int] = Query(None, description="Prompt version to evaluate; defaults to the active prompt."),
    db: AsyncSession = Depends(get_db),
) -> RegressionResponse:
    """Runs the regression suite with a specific prompt version and returns the scored report.

    This is how a prompt change is checked: pick a candidate version (it does
    not have to be active) and compare its report with the baseline's. The
    report records the prompt, provider and model actually used.

    Args:
        prompt_id (Optional[int]): The prompt version to evaluate. Defaults to the active prompt.
        db (AsyncSession): The database session dependency.

    Returns:
        RegressionResponse: The results of the regression run, including scores and detailed metrics.

    Raises:
        HTTPException: 404 unknown prompt, 409 no active prompt / no real AI
            provider configured, 500 if the runner itself crashes.
    """
    if prompt_id is not None:
        prompt = (await db.execute(select(PromptVersion).where(PromptVersion.id == prompt_id))).scalars().first()
        if prompt is None:
            raise HTTPException(status_code=404, detail=f"פרומפט {prompt_id} לא נמצא")
    else:
        prompt = await get_active_prompt(db)
        if prompt is None:
            raise HTTPException(status_code=409, detail="אין פרומפט פעיל. יש לבחור פרומפט להרצה.")

    try:
        runner = RegressionRunner.from_settings(
            business_prompt=prompt.content,
            prompt_info={"id": prompt.id, "name": prompt.name, "is_active": bool(prompt.is_active)})
    except RegressionProviderUnavailableError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    try:
        report = await runner.run()
    except Exception as error:
        logger.exception("Regression run failed")
        raise HTTPException(status_code=500, detail=str(error)) from error

    run = await _persist_run(report, prompt, db)

    data = report.to_dict()
    data["id"] = run.id
    data["created_at"] = run.created_at.isoformat()
    return RegressionResponse(success=True, data=data)


async def _persist_run(report, prompt: PromptVersion, db: AsyncSession) -> RegressionRun:
    """Saves a finished run as one ``RegressionRun`` row (Run History).

    A plain snapshot of ``report`` - see ``models.regression.RegressionRun``.
    Never recomputes anything: the scoring formula is untouched by this.
    """
    summary = report.to_dict()["summary"]
    run = RegressionRun(
        prompt_version_id=prompt.id, prompt_name=prompt.name, prompt_is_active=bool(prompt.is_active),
        suite_dir=report.suite_dir, generated_at=report.generated_at, pass_threshold=report.pass_threshold,
        providers=report.providers, warnings=report.warnings,
        total=summary["total"], passed=summary["passed"], failed=summary["failed"], scored=summary["scored"],
        coverage=summary["coverage"], average_score=summary["average_score"],
        scored_average_score=summary["scored_average_score"],
        results=[r.to_dict() for r in report.results],
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


# ---------------------------------------------------------------------------
# Run History – persisted past runs, and A/B comparison between two of them.
# ---------------------------------------------------------------------------

@router.get("/runs", response_model=RegressionRunListResponse)
async def list_runs(
    prompt_id: Optional[int] = Query(None, description="Only runs of this prompt version."),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> RegressionRunListResponse:
    """Lists past regression runs, newest first, for the Run History view.

    Args:
        prompt_id (Optional[int]): Restrict to runs made with this prompt version.
        limit (int): Maximum rows to return (default 50, max 200).
        db (AsyncSession): The database session dependency.

    Returns:
        RegressionRunListResponse: Run summaries (no per-case detail - use
            ``GET /runs/{run_id}`` for that).
    """
    stmt = select(RegressionRun).order_by(RegressionRun.id.desc()).limit(limit)
    if prompt_id is not None:
        stmt = stmt.where(RegressionRun.prompt_version_id == prompt_id)
    rows = (await db.execute(stmt)).scalars().all()
    return RegressionRunListResponse(runs=[RegressionRunSummary.from_run(row) for row in rows])


async def _get_run_or_404(run_id: int, db: AsyncSession) -> RegressionRun:
    run = (await db.execute(select(RegressionRun).where(RegressionRun.id == run_id))).scalars().first()
    if run is None:
        raise HTTPException(status_code=404, detail=f"הרצה {run_id} לא נמצאה")
    return run


def _case_side(result: Dict[str, Any]) -> Dict[str, Any]:
    """One run's stored ``TestCaseResult.to_dict()`` reduced to what Compare needs."""
    score = result.get("score") or {}
    return {
        "passed": bool(result.get("passed")),
        "score": score.get("overall_score"),
        "critical_failures": result.get("critical_failures") or [],
        "error": result.get("error"),
    }


def _diff_cases(results_a: List[Dict[str, Any]], results_b: List[Dict[str, Any]]) -> List[RegressionCaseComparison]:
    """Aligns two runs' per-case results by case name and classifies each pair.

    Pure read-side diffing over already-scored results - it never re-scores
    anything, so a change here can never affect ``services.regression.scorer``.
    """
    by_a = {r["name"]: r for r in (results_a or [])}
    by_b = {r["name"]: r for r in (results_b or [])}
    comparisons: List[RegressionCaseComparison] = []
    for name in sorted(set(by_a) | set(by_b)):
        raw_a, raw_b = by_a.get(name), by_b.get(name)
        a = _case_side(raw_a) if raw_a else None
        b = _case_side(raw_b) if raw_b else None
        score_delta = (round(b["score"] - a["score"], 2)
                      if a and b and a["score"] is not None and b["score"] is not None else None)
        if a is None:
            status = "only_b"
        elif b is None:
            status = "only_a"
        elif a["passed"] == b["passed"]:
            status = "unchanged"
        elif b["passed"]:
            status = "improved"
        else:
            status = "regressed"
        comparisons.append(RegressionCaseComparison(name=name, a=a, b=b, score_delta=score_delta, status=status))
    return comparisons


@router.get("/runs/compare", response_model=RegressionCompareResponse)
async def compare_runs(
    run_a: int = Query(..., description="Baseline run id (e.g. Prompt A)."),
    run_b: int = Query(..., description="Candidate run id (e.g. Prompt B)."),
    db: AsyncSession = Depends(get_db),
) -> RegressionCompareResponse:
    """Compares two persisted runs case-by-case, for the A/B Comparison view.

    Args:
        run_a (int): Baseline run id.
        run_b (int): Candidate run id.
        db (AsyncSession): The database session dependency.

    Returns:
        RegressionCompareResponse: Both runs in full, a per-case diff, and the
            headline metric deltas (``run_b`` minus ``run_a``).

    Raises:
        HTTPException: 404 if either run id doesn't exist.
    """
    row_a, row_b = await _get_run_or_404(run_a, db), await _get_run_or_404(run_b, db)
    return RegressionCompareResponse(
        run_a=RegressionRunDetail.from_run(row_a),
        run_b=RegressionRunDetail.from_run(row_b),
        cases=_diff_cases(row_a.results, row_b.results),
        summary_delta={
            "average_score": round(row_b.average_score - row_a.average_score, 2),
            "scored_average_score": round(row_b.scored_average_score - row_a.scored_average_score, 2),
            "coverage": round(row_b.coverage - row_a.coverage, 2),
            "passed": row_b.passed - row_a.passed,
        },
    )


@router.get("/runs/{run_id}", response_model=RegressionRunDetail)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)) -> RegressionRunDetail:
    """Returns one persisted run in full, including its per-case results.

    Args:
        run_id (int): The run's id.
        db (AsyncSession): The database session dependency.

    Returns:
        RegressionRunDetail: The stored run, shaped like the live report.

    Raises:
        HTTPException: 404 if no such run exists.
    """
    return RegressionRunDetail.from_run(await _get_run_or_404(run_id, db))


@router.delete("/runs/{run_id}", response_model=RegressionRunDeleteResult)
async def delete_run(run_id: int, db: AsyncSession = Depends(get_db)) -> RegressionRunDeleteResult:
    """Removes one run from the history (e.g. a throwaway/misconfigured run).

    Args:
        run_id (int): The run's id.
        db (AsyncSession): The database session dependency.

    Returns:
        RegressionRunDeleteResult: Always ``{"success": true}`` on success.

    Raises:
        HTTPException: 404 if no such run exists.
    """
    await db.delete(await _get_run_or_404(run_id, db))
    await db.commit()
    return RegressionRunDeleteResult(success=True)


# ---------------------------------------------------------------------------
# Ground-truth authoring ("תיוג") – the manual labeling workflow.
# ---------------------------------------------------------------------------

@router.get("/cases", response_model=List[RegressionCaseSummary])
async def list_cases() -> List[RegressionCaseSummary]:
    """Lists every labeled case currently in the regression suite.

    Returns:
        List[RegressionCaseSummary]: One entry per paired
            (document, ``*_expected.json``) case, for the תיוג page's case list.
    """
    return [RegressionCaseSummary(**case.to_dict()) for case in list_labeled_cases()]


@router.get("/cases/{case_name}", response_model=RegressionCaseSummary)
async def get_case(case_name: str) -> RegressionCaseSummary:
    """Returns one labeled case's ground truth, for opening it in the תיוג page.

    Args:
        case_name (str): The case's file stem (as returned by ``list_cases``).

    Returns:
        RegressionCaseSummary: The case's stored ground truth.

    Raises:
        HTTPException: If the name is unusable (400) or no such case exists (404).
    """
    try:
        case = get_labeled_case(case_name)
    except InvalidCaseNameError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except CaseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return RegressionCaseSummary(**case.to_dict())


@router.get("/cases/{case_name}/document")
async def get_case_document_file(case_name: str) -> FileResponse:
    """Streams a labeled case's source file, so the תיוג page can preview it
    side-by-side with the transcription form.

    Args:
        case_name (str): The case's file stem.

    Returns:
        FileResponse: The raw PDF/image, with its detected MIME type.

    Raises:
        HTTPException: If the name is unusable (400) or no such document exists (404).
    """
    try:
        path, mime_type = get_case_document(case_name)
    except InvalidCaseNameError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except CaseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    # Inline: this endpoint backs the side-by-side preview (<iframe>/<img>);
    # "attachment" would make browsers download the file instead.
    return FileResponse(path, media_type=mime_type, filename=path.name, content_disposition_type="inline")


@router.post("/cases", response_model=RegressionCaseSaveResult)
async def save_case(
    case_name: str = Form(..., max_length=80,
                          description="Suite case identifier, e.g. 'shl_valid'. Becomes the file stem."),
    expected_json: str = Form(..., description="The manually transcribed ground truth, "
                                                "as JSON shaped like schemas.extraction.DocumentExtraction."),
    file: Optional[UploadFile] = File(
        None, description="The source PDF/image. Required for a new case; omit when "
                          "re-labeling an existing one to keep its current document."),
) -> RegressionCaseSaveResult:
    """Saves (creates or updates) one manually labeled ground-truth case.

    This is the sole write path for ``data/regression_suite/`` from the UI:
    it validates the transcription against the same schema the AI's own
    output is validated with, writes the paired
    ``<case_name>.<ext>`` / ``<case_name>_expected.json`` files, and returns
    any business-rule findings on the transcription itself as non-blocking
    warnings (never a reason to reject the save).

    Args:
        case_name (str): Suite case identifier, sanitised into a safe file stem.
        expected_json (str): The ground truth, serialised as JSON text (multipart
            forms cannot carry nested JSON as a typed field).
        file (Optional[UploadFile]): The source document. Required unless a case
            with this name already exists.

    Returns:
        RegressionCaseSaveResult: The saved case plus any validation warnings.

    Raises:
        HTTPException: 422 if ``expected_json`` doesn't match the extraction
            schema, 400 for an unusable case name or a missing file on a new
            case, 415 if the uploaded file isn't a supported document type.
    """
    try:
        expected = DocumentExtraction.model_validate_json(expected_json)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=f"מבנה הנתונים אינו תקין: {short_error(error)}") from error

    content = (await read_upload_or_413(file, get_settings().max_upload_mb * MB)
               if file is not None else None)
    filename = file.filename if file is not None else None

    try:
        case, warnings = save_labeled_case(case_name, filename, content, expected)
    except InvalidCaseNameError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except UnsupportedLabelDocumentError as error:
        raise HTTPException(status_code=415, detail=str(error)) from error
    except CaseNotFoundError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return RegressionCaseSaveResult(case=RegressionCaseSummary(**case.to_dict()),
                                    warnings=[issue.to_dict() for issue in warnings])


@router.delete("/cases/{case_name}", response_model=RegressionCaseDeleteResult)
async def delete_case(case_name: str) -> RegressionCaseDeleteResult:
    """Removes a labeled case (document + ground truth) from the suite.

    Args:
        case_name (str): The case's file stem.

    Returns:
        RegressionCaseDeleteResult: Always ``{"success": true}`` on success.

    Raises:
        HTTPException: If the name is unusable (400) or no such case exists (404).
    """
    try:
        removed = delete_labeled_case(case_name)
    except InvalidCaseNameError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not removed:
        raise HTTPException(status_code=404, detail=f"לא נמצא תיק רגרסיה בשם '{case_name}'")
    return RegressionCaseDeleteResult(success=True)
