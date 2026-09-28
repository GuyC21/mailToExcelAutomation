"""Regression test execution endpoint.

Provides an endpoint to trigger the automated regression suite, which runs the
active prompt against a suite of known test cases and reports back accuracy scores.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

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
