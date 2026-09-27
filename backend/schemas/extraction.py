"""The technical contract between the LLM and the rest of the system.

Every numeric / date field is nullable on purpose: real supplier forms arrive
with missing dates, "not priced yet" lines, etc. A missing value must surface
as a *business validation issue* – never crash the parser and lose the data.
"""
import re
from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, model_validator

_NUMBER_NOISE = re.compile(r"[₪,\s]|ש\"ח|ש״ח|ILS|NIS", re.IGNORECASE)
_DATE_FIELDS_DOC = ("document_date", "billing_period_start", "billing_period_end", "due_date")
_NUMBER_FIELDS_DOC = ("subtotal", "vat_rate", "vat_amount", "total_amount")
_NUMBER_FIELDS_LINE = ("quantity", "unit_price", "line_total")


def _to_number(value: Any) -> Optional[float]:
    """Parses '6,300.00 ₪' -> 6300.0. Returns None for non-numeric text."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = _NUMBER_NOISE.sub("", str(value)).replace("%", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _to_iso_date(value: Any) -> Optional[str]:
    """Normalises ISO or Israeli (DD/MM/YYYY) dates to ISO. Invalid -> None."""
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _coerce(container: dict, fields, converter, notes: List[str], where: str) -> None:
    """Converts fields in place; records a note whenever text had to be dropped."""
    for name in fields:
        raw = container.get(name)
        converted = converter(raw)
        if raw not in (None, "") and converted is None:
            notes.append(f"{where}: הערך '{raw}' בשדה {name} אינו תקין ולכן הושמט")
        container[name] = converted


class LineItem(BaseModel):
    """A single charge line, exactly as printed on the document."""

    line_number: Optional[int] = None
    service_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    description: str = ""
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None


class DocumentExtraction(BaseModel):
    """Structured data of one supplier settlement form / invoice."""

    document_type: Optional[str] = None
    document_number: Optional[str] = None
    document_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    billing_period_start: Optional[str] = None
    billing_period_end: Optional[str] = None
    due_date: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_tax_id: Optional[str] = None
    customer_name: Optional[str] = None
    currency: Optional[str] = "ILS"
    payment_terms: Optional[str] = None
    line_items: List[LineItem] = Field(default_factory=list)
    subtotal: Optional[float] = None
    vat_rate: Optional[float] = Field(None, description="Percent, e.g. 17")
    vat_amount: Optional[float] = None
    total_amount: Optional[float] = None
    extraction_notes: List[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _normalise(cls, raw: Any) -> Any:
        """Defensive coercion: LLMs sometimes return '1,200 ₪' or '30/08/2026'."""
        if not isinstance(raw, dict):
            return raw
        data = dict(raw)
        notes = [str(n) for n in (data.get("extraction_notes") or [])]
        _coerce(data, _NUMBER_FIELDS_DOC, _to_number, notes, "מסמך")
        _coerce(data, _DATE_FIELDS_DOC, _to_iso_date, notes, "מסמך")
        lines = []
        for index, item in enumerate(data.get("line_items") or [], start=1):
            if not isinstance(item, dict):
                continue
            line = dict(item)
            _coerce(line, _NUMBER_FIELDS_LINE, _to_number, notes, f"שורה {index}")
            _coerce(line, ("service_date",), _to_iso_date, notes, f"שורה {index}")
            line["description"] = str(line.get("description") or "")
            number = _to_number(line.get("line_number"))
            line["line_number"] = int(number) if number is not None else index
            lines.append(line)
        data["line_items"] = lines
        data["extraction_notes"] = notes
        return data

    def document_date_obj(self) -> Optional[date]:
        """The document date as a ``date`` object (or None)."""
        return date.fromisoformat(self.document_date) if self.document_date else None
