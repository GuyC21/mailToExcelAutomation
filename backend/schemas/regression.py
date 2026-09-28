"""API request/response shapes for the regression ground-truth ("תיוג") endpoints."""
from typing import Any, Dict, List

from pydantic import BaseModel


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
