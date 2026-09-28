"""Dashboard statistics endpoint for the financial overview.

This module provides routes for fetching aggregated dashboard statistics. It handles
basic database aggregation logic to render summary metrics for the frontend.

Two rules keep the numbers financially meaningful:
    * Scope - by default only *operational* records count: documents that
      arrived by email and were read by a real AI provider. Sandbox uploads
      and offline mock extractions are test activity; they are included only
      when the caller explicitly asks for ``scope=all``.
    * Currency - amounts are never added across currencies. Totals are
      reported per currency, and the supplier ranking uses a single currency.
"""
import math
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.ingestion import DocumentIngestion

router = APIRouter()

_TEST_CHANNELS = {"sandbox"}
_TEST_PROVIDERS = {"mock"}
_ILS_ALIASES = {"", "ILS", "NIS", "₪", "ש\"ח", "ש״ח", "שח", "שקל", "שקלים"}


def is_test_record(record: DocumentIngestion) -> bool:
    """Sandbox uploads and mock extractions are not operational activity."""
    return record.channel in _TEST_CHANNELS or (record.provider or "") in _TEST_PROVIDERS


def normalise_currency(value: Any) -> str:
    """Maps the schema's free-text currency to an ISO-like code (default ILS)."""
    text = str(value or "").strip()
    return "ILS" if text.upper() in _ILS_ALIASES or text in _ILS_ALIASES else text.upper()


def _amount(value: Any) -> Optional[float]:
    """A finite number, or None (a manual edit or legacy row may hold anything)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


@router.get("/stats")
async def get_dashboard_stats(
    scope: str = Query("operational", pattern="^(operational|all)$",
                       description="operational = email + real AI provider only; all = include sandbox/mock tests"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Fetches aggregated statistics for the financial dashboard.

    Note: For this prototype/demo, data is fetched and aggregated in Python because
    aggregating inside JSON columns using SQLite is complex and less portable.
    In a high-volume production environment, this should be pushed down to the
    database via SQL aggregates or a materialized view.

    Args:
        scope (str): ``operational`` (default) or ``all``.
        db (AsyncSession): The database session dependency.

    Returns:
        Dict[str, Any]: A dictionary containing:
            - scope (str): The scope actually applied.
            - excluded_test_documents (int): Test records left out by the scope.
            - totals_by_currency (list): ``{currency, amount, documents}`` for VALID
              documents, largest document count first. Never summed across currencies.
            - total_documents (int): Documents in scope (all statuses).
            - status_distribution (list): Count of documents grouped by status.
            - top_suppliers (list): Top 5 suppliers by amount in ``top_suppliers_currency``.
            - top_suppliers_currency (str | None): The currency of that ranking.
    """
    result = await db.execute(select(DocumentIngestion))
    records = result.unique().scalars().all()

    excluded = 0
    in_scope = []
    for record in records:
        if scope == "operational" and is_test_record(record):
            excluded += 1
            continue
        in_scope.append(record)

    status_counts: Dict[str, int] = {"VALID": 0, "NEEDS_REVIEW": 0, "EXTRACTION_FAILED": 0}
    totals: Dict[str, Dict[str, float]] = {}
    supplier_totals: Dict[str, Dict[str, float]] = {}

    for record in in_scope:
        status_counts[record.status] = status_counts.get(record.status, 0) + 1
        data = record.extracted_data or {}
        amount = _amount(data.get("total_amount"))
        if record.status != "VALID" or amount is None:
            continue
        currency = normalise_currency(data.get("currency"))
        bucket = totals.setdefault(currency, {"amount": 0.0, "documents": 0})
        bucket["amount"] += amount
        bucket["documents"] += 1
        supplier = data.get("supplier_name") or "ספק לא ידוע"
        by_supplier = supplier_totals.setdefault(currency, {})
        by_supplier[supplier] = by_supplier.get(supplier, 0.0) + amount

    totals_by_currency = [
        {"currency": currency, "amount": round(values["amount"], 2), "documents": int(values["documents"])}
        for currency, values in sorted(totals.items(), key=lambda item: (-item[1]["documents"], item[0]))
    ]
    ranking_currency = totals_by_currency[0]["currency"] if totals_by_currency else None
    ranking = supplier_totals.get(ranking_currency, {}) if ranking_currency else {}
    top_suppliers = [{"name": name, "value": round(value, 2)}
                     for name, value in sorted(ranking.items(), key=lambda item: item[1], reverse=True)[:5]]

    return {
        "scope": scope,
        "excluded_test_documents": excluded,
        "totals_by_currency": totals_by_currency,
        "total_documents": len(in_scope),
        "status_distribution": [
            {"name": "Valid", "value": status_counts.get("VALID", 0), "fill": "#10b981"},
            {"name": "Needs Review", "value": status_counts.get("NEEDS_REVIEW", 0) + status_counts.get("WARNING_MATH_MISMATCH", 0), "fill": "#f59e0b"},
            {"name": "Failed", "value": status_counts.get("EXTRACTION_FAILED", 0), "fill": "#ef4444"}
        ],
        "top_suppliers": top_suppliers,
        "top_suppliers_currency": ranking_currency,
    }
