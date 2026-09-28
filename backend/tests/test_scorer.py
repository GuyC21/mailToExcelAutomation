"""Unit tests for the regression scoring engine."""
import copy

from services.regression.scorer import (
    ScoringConfig,
    amount_similarity,
    date_similarity,
    levenshtein_distance,
    score_extraction,
    text_similarity,
)
from tests.fixtures import sample_documents as samples


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

def test_levenshtein_distance_basic_cases():
    assert levenshtein_distance("", "") == 0
    assert levenshtein_distance("abc", "abc") == 0
    assert levenshtein_distance("", "abc") == 3
    assert levenshtein_distance("kitten", "sitting") == 3


def test_text_similarity_is_normalised_and_case_insensitive():
    assert text_similarity(None, None) == 1.0
    assert text_similarity("", None) == 1.0
    assert text_similarity("ACME Ltd", None) == 0.0
    assert text_similarity("  ACME   Ltd  ", "acme ltd") == 1.0
    # A small typo should score high but not perfect.
    score = text_similarity("קלין-טק שירותי כביסה", "קלין-טק שירותי כביסא")
    assert 0.8 < score < 1.0


def test_amount_similarity_tolerates_small_rounding_but_not_large_errors():
    assert amount_similarity(6300.0, 6300.0, abs_tolerance=1.0, rel_tolerance=0.01) == 1.0
    assert amount_similarity(6300.0, 6300.4, abs_tolerance=1.0, rel_tolerance=0.01) == 1.0  # within abs tolerance
    assert amount_similarity(6300.0, 6250.0, abs_tolerance=1.0, rel_tolerance=0.01) == 1.0  # within 1% relative
    assert amount_similarity(6300.0, 3000.0, abs_tolerance=1.0, rel_tolerance=0.01) < 0.5
    assert amount_similarity(None, None, 1.0, 0.01) == 1.0
    assert amount_similarity(100.0, None, 1.0, 0.01) == 0.0


def test_date_similarity_is_exact():
    assert date_similarity("2026-08-30", "2026-08-30") == 1.0
    assert date_similarity(None, None) == 1.0
    assert date_similarity("2026-08-30", "2026-08-31") == 0.0
    assert date_similarity("2026-08-30", None) == 0.0


# ---------------------------------------------------------------------------
# score_extraction — header fields
# ---------------------------------------------------------------------------

def test_identical_documents_score_100():
    report = score_extraction(samples.SHL_VALID, copy.deepcopy(samples.SHL_VALID))
    assert report.overall_score == 100.0
    assert report.header_score == 100.0
    assert report.line_items_score == 100.0
    assert report.mismatched_fields == []
    assert report.matched_line_items == len(samples.SHL_VALID["line_items"])


def test_small_rounding_difference_in_money_field_is_forgiven():
    actual = copy.deepcopy(samples.SHL_VALID)
    actual["total_amount"] = samples.SHL_VALID["total_amount"] + 0.4  # a rounding artefact
    report = score_extraction(samples.SHL_VALID, actual)
    assert report.overall_score == 100.0


def test_wrong_supplier_name_and_total_reduce_the_score():
    actual = copy.deepcopy(samples.SHL_VALID)
    actual["supplier_name"] = "חברה אחרת לגמרי בע\"מ"
    actual["total_amount"] = 1.0
    report = score_extraction(samples.SHL_VALID, actual)
    assert report.overall_score < 90.0
    assert set(report.mismatched_fields) >= {"supplier_name", "total_amount"}


def test_missing_document_fields_score_zero_for_that_field():
    actual = copy.deepcopy(samples.SHL_VALID)
    actual["document_number"] = None
    report = score_extraction(samples.SHL_VALID, actual)
    result = next(f for f in report.field_results if f.field == "document_number")
    assert result.score == 0.0
    assert not result.matched


# ---------------------------------------------------------------------------
# score_extraction — line_items
# ---------------------------------------------------------------------------

def test_reordered_line_items_still_match_by_content():
    actual = copy.deepcopy(samples.SHL_VALID)
    actual["line_items"] = list(reversed(actual["line_items"]))
    report = score_extraction(samples.SHL_VALID, actual)
    assert report.line_items_score == 100.0
    assert report.matched_line_items == 3
    assert report.missing_line_items == 0
    assert report.extra_line_items == 0


def test_missing_line_item_is_penalised_and_reported():
    actual = copy.deepcopy(samples.SHL_VALID)
    actual["line_items"].pop()
    report = score_extraction(samples.SHL_VALID, actual)
    assert report.missing_line_items == 1
    assert report.matched_line_items == 2
    # 2 perfect matches out of a denominator of 3 expected lines.
    assert round(report.line_items_score, 2) == round(200 / 3, 2)


def test_extra_line_item_is_penalised_and_reported():
    actual = copy.deepcopy(samples.SHL_VALID)
    extra = dict(actual["line_items"][0])
    extra["line_number"] = 99
    extra["description"] = "שורה שלא הייתה קיימת במקור"
    actual["line_items"].append(extra)
    report = score_extraction(samples.SHL_VALID, actual)
    assert report.extra_line_items == 1
    assert report.matched_line_items == 3
    assert report.line_items_score < 100.0


def test_empty_line_items_on_both_sides_is_a_perfect_match():
    expected = dict(samples.SHL_VALID, line_items=[])
    actual = dict(samples.SHL_VALID, line_items=[])
    report = score_extraction(expected, actual)
    assert report.line_items_score == 100.0
    assert report.line_item_comparisons == []


def test_completely_wrong_line_items_score_low():
    expected = dict(samples.SHL_VALID)
    actual = dict(samples.SHL_VALID, line_items=[
        {"line_number": 1, "description": "משהו שונה לגמרי", "quantity": 1, "unit_price": 1, "line_total": 1},
    ])
    report = score_extraction(expected, actual)
    assert report.line_items_score < 20.0


# ---------------------------------------------------------------------------
# Custom configuration
# ---------------------------------------------------------------------------

def test_line_items_weight_is_configurable():
    actual = copy.deepcopy(samples.SHL_VALID)
    actual["line_items"] = []  # completely wrong line items, perfect header
    heavy_lines = score_extraction(samples.SHL_VALID, actual, ScoringConfig(line_items_weight=0.9))
    light_lines = score_extraction(samples.SHL_VALID, actual, ScoringConfig(line_items_weight=0.1))
    assert heavy_lines.overall_score < light_lines.overall_score


def test_to_dict_is_json_serialisable():
    import json

    report = score_extraction(samples.SHL_VALID, samples.CLEANTECH_SUBTOTAL_MISMATCH)
    json.dumps(report.to_dict(), ensure_ascii=False)  # must not raise
