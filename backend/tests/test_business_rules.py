"""Each sample form's designed defect must be caught – and nothing else."""
from schemas.extraction import DocumentExtraction
from services.validation.business_rules import (
    STATUS_NEEDS_REVIEW,
    STATUS_VALID,
    derive_status,
    validate_document,
)
from tests.fixtures import sample_documents as samples


def _run(raw):
    doc = DocumentExtraction.model_validate(raw)
    issues = validate_document(doc)
    errors = {i.code for i in issues if i.severity == "error"}
    return doc, issues, errors, derive_status(issues)


def test_valid_forms_pass_cleanly():
    for raw in (samples.SHL_VALID, samples.MEDIPHARM_VALID):
        _, _, errors, status = _run(raw)
        assert errors == set()
        assert status == STATUS_VALID


def test_subtotal_mismatch_is_flagged():
    _, _, errors, status = _run(samples.CLEANTECH_SUBTOTAL_MISMATCH)
    # Lines sum to 14,100 vs a printed subtotal of 12,500; the printed total
    # (15,625) also disagrees with 12,500 + 2,125 = 14,625.
    assert errors == {"SUBTOTAL_MISMATCH", "TOTAL_MISMATCH"}
    assert status == STATUS_NEEDS_REVIEW


def test_line_multiplication_and_vat_errors_are_flagged():
    _, issues, errors, _ = _run(samples.SHEFA_LINE_AND_VAT_ERRORS)
    assert errors == {"LINE_MATH_MISMATCH", "VAT_MISMATCH"}
    assert [i.line_number for i in issues if i.code == "LINE_MATH_MISMATCH"] == [2]


def test_missing_and_non_numeric_values_become_review_items():
    doc, issues, errors, status = _run(samples.AB_MISSING_FIELDS)
    assert status == STATUS_NEEDS_REVIEW
    assert {"MISSING_FIELD", "LINE_MISSING_AMOUNT"} <= errors
    missing = {i.field for i in issues if i.code == "MISSING_FIELD" and i.severity == "error"}
    assert missing == {"document_number", "document_date", "total_amount"}
    assert doc.line_items[2].unit_price is None
    assert any("טרם תומחר" in note for note in doc.extraction_notes)


def test_llm_formatting_noise_is_normalised():
    doc = DocumentExtraction.model_validate(samples.MEDIPHARM_VALID)
    assert doc.document_date == "2026-09-15"
    assert doc.line_items[0].line_total == 8000.0
    assert doc.line_items[0].unit_price == 320.0


def test_default_vat_rate_used_when_rate_not_printed():
    raw = dict(samples.SHL_VALID, vat_rate=None)
    doc = DocumentExtraction.model_validate(raw)
    codes = {i.code for i in validate_document(doc, default_vat_rate=18.0)}
    assert "VAT_MISMATCH" in codes  # 1,870 is 17%, not the default 18%
