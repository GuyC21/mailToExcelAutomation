"""The technical contract between the LLM and the rest of the system.

Every numeric / date field is nullable on purpose: real supplier forms arrive
with missing dates, "not priced yet" lines, etc. A missing value must surface
as a *business validation issue* – never crash the parser and lose the data.
"""
import math
import re
from datetime import date, datetime
from typing import Any, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field, model_validator

_CURRENCY_NOISE = re.compile(r"₪|ש\"ח|ש״ח|ILS|NIS|%", re.IGNORECASE)
# Spaces used as thousands separators (regular, no-break, narrow no-break, thin).
_SPACES = re.compile(r"[\s\u00a0\u202f\u2009]+")
_DATE_FIELDS_DOC = ("document_date", "billing_period_start", "billing_period_end", "due_date")
_NUMBER_FIELDS_DOC = ("subtotal", "vat_rate", "vat_amount", "total_amount")
_NUMBER_FIELDS_LINE = ("quantity", "unit_price", "line_total")

_PLAIN = re.compile(r"[+-]?\d+(?:\.\d+)?")
_DOT_DECIMAL = re.compile(r"[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?")      # 1,234,567.89
_COMMA_DECIMAL = re.compile(r"[+-]?\d{1,3}(?:\.\d{3})+,\d+")          # 1.234.567,89
_COMMA_ONLY_DECIMAL = re.compile(r"[+-]?\d+,\d{1,2}")                   # 1234,56 / 12,5
_SPACE_GROUPED = re.compile(r"[+-]?\d{1,3}(?: \d{3})+(?:[.,]\d+)?")     # 1 234 567,89


def _parse_number_text(text: str) -> Tuple[Optional[float], Optional[str]]:
    """Parses one printed amount, accepting only unambiguous conventions.

    Supported: ``1234.56``, ``1,234.56`` (comma thousands), ``1.234,56`` (dot
    thousands, comma decimal), ``1234,56`` / ``12,5`` (comma decimal with no
    grouping), ``1 234,56`` / ``1 234.56`` (space thousands), each with an
    optional sign. Anything else - including malformed grouping such as
    ``1,23,456`` - is rejected rather than guessed, so a value can never
    silently change magnitude.

    Returns:
        ``(value, note)``: ``value`` is None when rejected; ``note`` explains a
        non-default interpretation (decimal comma) so it stays auditable.
    """
    compact = text.strip()
    if _SPACE_GROUPED.fullmatch(compact) and " " in compact:
        grouped = compact.replace(" ", "")
        return (float(grouped.replace(",", ".")), "פסיק עשרוני") if "," in grouped else (float(grouped), None)
    compact = compact.replace(" ", "")
    if _PLAIN.fullmatch(compact):
        return float(compact), None
    if _DOT_DECIMAL.fullmatch(compact):
        return float(compact.replace(",", "")), None
    if _COMMA_DECIMAL.fullmatch(compact):
        return float(compact.replace(".", "").replace(",", ".")), "פסיק עשרוני"
    if _COMMA_ONLY_DECIMAL.fullmatch(compact):
        return float(compact.replace(",", ".")), "פסיק עשרוני"
    return None, None


def _to_number_with_note(value: Any) -> Tuple[Optional[float], Optional[str]]:
    """Like ``_to_number`` but also returns the interpretation note, if any."""
    if value is None or isinstance(value, bool):
        return None, None
    if isinstance(value, (int, float)):
        number = float(value)
        return (number, None) if math.isfinite(number) else (None, None)
    cleaned = _SPACES.sub(" ", _CURRENCY_NOISE.sub("", str(value))).strip()
    if not cleaned:
        return None, None
    try:
        number, note = _parse_number_text(cleaned)
    except (ValueError, OverflowError):
        return None, None
    if number is None or not math.isfinite(number):  # rejects NaN / Infinity / 1e400
        return None, None
    return number, note


def _to_number(value: Any) -> Optional[float]:
    """Parses '6,300.00 ₪' -> 6300.0. Returns None for non-numeric or non-finite text."""
    return _to_number_with_note(value)[0]


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


def _coerce_numbers(container: dict, fields, notes: List[str], where: str) -> None:
    """``_coerce`` for amounts, also noting non-default interpretations."""
    for name in fields:
        raw = container.get(name)
        converted, interpretation = _to_number_with_note(raw)
        if raw not in (None, "") and converted is None:
            notes.append(f"{where}: הערך '{raw}' בשדה {name} אינו תקין ולכן הושמט")
        elif interpretation:
            notes.append(f"{where}: הערך '{raw}' בשדה {name} פורש כ-{converted} ({interpretation})")
        container[name] = converted


class LineItem(BaseModel):
    """A single charge line, exactly as printed on the document."""

    # Belt and braces: even a value that bypasses ``_normalise`` can't be NaN/Inf.
    model_config = ConfigDict(allow_inf_nan=False)

    line_number: Optional[int] = None
    service_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    description: str = ""
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None


class DocumentExtraction(BaseModel):
    """Structured data of one supplier settlement form / invoice."""

    model_config = ConfigDict(allow_inf_nan=False)

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
        _coerce_numbers(data, _NUMBER_FIELDS_DOC, notes, "מסמך")
        _coerce(data, _DATE_FIELDS_DOC, _to_iso_date, notes, "מסמך")
        lines = []
        for index, item in enumerate(data.get("line_items") or [], start=1):
            if not isinstance(item, dict):
                continue
            line = dict(item)
            _coerce_numbers(line, _NUMBER_FIELDS_LINE, notes, f"שורה {index}")
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
