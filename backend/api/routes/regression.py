"""Regression testing endpoints: run the automated suite, and author ("תיוג")
the ground-truth cases it runs against.

Two concerns live in this router because they share one resource – the suite
under ``data/regression_suite/`` – and one URL namespace (``/api/regression``):

    * ``POST /run``            – replay the suite through Gemini and score it
      (``services.regression.runner``).
    * ``GET/POST/DELETE /cases`` – list, create, edit and remove the
      hand-labeled ground-truth cases the suite is made of
      (``services.regression.labeling``). This is the API behind the תיוג
      (labeling) page: without it, growing the suite means a developer
      hand-writing JSON files.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ValidationError

from schemas.extraction import DocumentExtraction
from schemas.regression import RegressionCaseDeleteResult, RegressionCaseSaveResult, RegressionCaseSummary
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
from services.regression.runner import RegressionRunner

router = APIRouter()


class RegressionResponse(BaseModel):
    """Response schema for a regression test run."""
    success: bool
    data: Dict[str, Any]
    error: str | None = None

@router.post("/run", response_model=RegressionResponse)
async def run_regression_suite() -> RegressionResponse:
    """Triggers the regression test suite and returns the scored report.

    This allows the Backoffice UI to run regression tests on demand, evaluating
    how well the currently active prompt performs against a benchmark set of documents.

    Returns:
        RegressionResponse: The results of the regression run, including scores and detailed metrics.

    Raises:
        HTTPException: If the test suite runner encounters a fatal error (500).
    """
    try:
        runner = RegressionRunner.from_settings()
        report = await runner.run()
        return RegressionResponse(success=True, data=report.to_dict())
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
    return FileResponse(path, media_type=mime_type, filename=path.name)


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

    content = await file.read() if file is not None else None
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
