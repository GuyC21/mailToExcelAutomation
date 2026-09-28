from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from services.regression.runner import RegressionRunner

router = APIRouter()

class RegressionResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    error: str | None = None

@router.post("/run", response_model=RegressionResponse)
async def run_regression_suite():
    """Triggers the regression test suite and returns the scored report."""
    try:
        runner = RegressionRunner.from_settings()
        report = await runner.run()
        return RegressionResponse(success=True, data=report.to_dict())
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
