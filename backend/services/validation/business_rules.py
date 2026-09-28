"""Deterministic business validation of extracted documents.

The LLM transcribes; this module judges. Keeping the arithmetic out of the
prompt means a model can never "helpfully" fix a supplier's error and hide it.
Every rule returns Hebrew messages aimed at the finance team.
"""
from dataclasses import asdict, dataclass
from typing import List, Optional

from schemas.extraction import DocumentExtraction

ERROR = "error"
WARNING = "warning"

STATUS_VALID = "VALID"
STATUS_NEEDS_REVIEW = "NEEDS_REVIEW"
STATUS_FAILED = "EXTRACTION_FAILED"

_REQUIRED_FIELDS = {
    "supplier_name": "שם הספק",
    "document_number": "מספר מסמך",
    "document_date": "תאריך המסמך",
    "total_amount": "סה\"כ לתשלום",
}
_RECOMMENDED_FIELDS = {"subtotal": "סה\"כ לפני מע\"מ", "vat_amount": "סכום המע\"מ"}


@dataclass
class ValidationIssue:
    """One finding. ``line_number`` is set for line-level findings."""

    code: str
    severity: str
    message: str
    field: Optional[str] = None
    line_number: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _fmt(value: float) -> str:
    return f"{value:,.2f}"


def _differs(a: float, b: float, tolerance: float) -> bool:
    return abs(a - b) > tolerance


def _check_required(doc: DocumentExtraction) -> List[ValidationIssue]:
    issues = [ValidationIssue("MISSING_FIELD", ERROR, f"שדה חובה חסר: {label}", field=name)
              for name, label in _REQUIRED_FIELDS.items() if getattr(doc, name) in (None, "")]
    issues += [ValidationIssue("MISSING_FIELD", WARNING, f"שדה חסר: {label}", field=name)
               for name, label in _RECOMMENDED_FIELDS.items() if getattr(doc, name) is None]
    if not doc.line_items:
        issues.append(ValidationIssue("NO_LINE_ITEMS", WARNING, "לא זוהו שורות חיוב במסמך"))
    return issues


def _check_lines(doc: DocumentExtraction, tolerance: float) -> List[ValidationIssue]:
    issues = []
    for line in doc.line_items:
        if line.line_total is None:
            issues.append(ValidationIssue("LINE_MISSING_AMOUNT", ERROR,
                                          f"שורה {line.line_number}: אין סכום לשורה", line_number=line.line_number))
            continue
        if line.quantity is not None and line.unit_price is not None:
            expected = line.quantity * line.unit_price
            if _differs(expected, line.line_total, tolerance):
                issues.append(ValidationIssue(
                    "LINE_MATH_MISMATCH", ERROR,
                    f"שורה {line.line_number}: {line.quantity:g} × {_fmt(line.unit_price)} = {_fmt(expected)}, "
                    f"אך בטופס מופיע {_fmt(line.line_total)}", line_number=line.line_number))
    return issues


def _check_totals(doc: DocumentExtraction, default_vat_rate: float, tolerance: float) -> List[ValidationIssue]:
    issues = []
    line_totals = [l.line_total for l in doc.line_items]
    if doc.subtotal is not None and line_totals and None not in line_totals:
        lines_sum = sum(line_totals)
        if _differs(lines_sum, doc.subtotal, tolerance):
            issues.append(ValidationIssue("SUBTOTAL_MISMATCH", ERROR,
                                          f"סכום השורות ({_fmt(lines_sum)}) שונה מהסה\"כ לפני מע\"מ ({_fmt(doc.subtotal)})",
                                          field="subtotal"))
    if doc.subtotal is not None and doc.vat_amount is not None:
        rate = doc.vat_rate if doc.vat_rate is not None else default_vat_rate
        expected_vat = doc.subtotal * rate / 100
        if _differs(expected_vat, doc.vat_amount, tolerance):
            issues.append(ValidationIssue("VAT_MISMATCH", ERROR,
                                          f"מע\"מ {rate:g}% על {_fmt(doc.subtotal)} צריך להיות {_fmt(expected_vat)}, "
                                          f"אך בטופס מופיע {_fmt(doc.vat_amount)}", field="vat_amount"))
    if None not in (doc.subtotal, doc.vat_amount, doc.total_amount):
        expected_total = doc.subtotal + doc.vat_amount
        if _differs(expected_total, doc.total_amount, tolerance):
            issues.append(ValidationIssue("TOTAL_MISMATCH", ERROR,
                                          f"סה\"כ לפני מע\"מ + מע\"מ = {_fmt(expected_total)}, "
                                          f"אך הסה\"כ לתשלום בטופס הוא {_fmt(doc.total_amount)}", field="total_amount"))
    return issues


def validate_document(doc: DocumentExtraction, default_vat_rate: float = 18.0,
                      tolerance: float = 1.0) -> List[ValidationIssue]:
    """Runs all business rules and returns the findings (empty = clean).

    Centralizes all deterministic validation rules. We separate the extraction 
    (LLM transcription) from validation (arithmetic checks) to prevent the LLM 
    from silently correcting supplier mistakes and masking real issues.

    Args:
        doc (DocumentExtraction): The extracted document data to validate.
        default_vat_rate (float): The default VAT percentage to apply if missing.
        tolerance (float): Allowed difference in arithmetic checks (e.g. for rounding).

    Returns:
        List[ValidationIssue]: A list of identified validation issues, if any.
    """
    issues = _check_required(doc) + _check_lines(doc, tolerance) + _check_totals(doc, default_vat_rate, tolerance)
    issues += [ValidationIssue("EXTRACTION_NOTE", WARNING, note) for note in doc.extraction_notes]
    return issues


def derive_status(issues: List[ValidationIssue]) -> str:
    """Any error-level finding routes the document to human review."""
    return STATUS_NEEDS_REVIEW if any(i.severity == ERROR for i in issues) else STATUS_VALID
