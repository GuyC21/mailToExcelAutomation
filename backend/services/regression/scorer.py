"""Regression scoring engine: how close is an LLM extraction to ground truth?

Design:
    * Every header field gets a comparison strategy by *type*, not by name:
      free text -> fuzzy (Levenshtein) similarity, dates -> exact match
      (they are already ISO-normalised upstream by ``schemas.extraction``),
      money / percentages -> tolerance bands so rounding noise doesn't tank
      the score. ``ScoringConfig`` lets a caller retune any of this without
      touching the algorithm.
    * ``line_items`` is an unordered collection that can be missing, extra,
      or reordered between expected and actual. We score every
      expected/actual pair, then greedily take the best-scoring pairs first
      (a lightweight stand-in for the Hungarian algorithm: not globally
      optimal, but O(n*m log(n*m)) with no extra dependency, and more than
      good enough for the handful of lines on a settlement form). Anything
      left unmatched becomes a "missing" or "extra" line and is scored 0,
      which is what actually penalises the count mismatch.
    * The overall score is a weighted blend of the header sub-score and the
      line-items sub-score, both on a 0-100 scale.

No third-party dependency is required (Levenshtein distance is the ~15-line
classic DP below) so the whole engine runs offline, in the existing test
suite, with nothing to install.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Field taxonomy — which comparison strategy applies to each field, and how
# much it should count toward its sub-score.
# ---------------------------------------------------------------------------

_DATE_FIELDS = {"document_date", "billing_period_start", "billing_period_end", "due_date", "service_date"}
_AMOUNT_FIELDS = {"subtotal", "vat_amount", "total_amount", "quantity", "unit_price", "line_total"}
_PERCENT_FIELDS = {"vat_rate"}
_IGNORED_FIELDS = {"line_items", "extraction_notes", "line_number"}

DEFAULT_FIELD_WEIGHTS: Dict[str, float] = {
    "supplier_name": 3.0,
    "document_number": 2.0,
    "document_date": 2.0,
    "total_amount": 3.0,
    "subtotal": 2.0,
    "vat_amount": 2.0,
    "vat_rate": 1.0,
    "supplier_tax_id": 1.0,
    "customer_name": 1.0,
    "currency": 0.5,
    "payment_terms": 0.5,
    "document_type": 0.5,
    "billing_period_start": 1.0,
    "billing_period_end": 1.0,
    "due_date": 1.0,
}

DEFAULT_LINE_FIELD_WEIGHTS: Dict[str, float] = {
    "description": 2.0,
    "quantity": 1.5,
    "unit_price": 1.5,
    "line_total": 2.5,
    "service_date": 0.5,
}


@dataclass
class ScoringConfig:
    """Every tunable of the scoring algorithm, all with sensible defaults."""

    # A fuzzy (text) field counts as "matched" once its similarity clears this bar.
    text_fuzzy_threshold: float = 0.82
    # Money fields: matched if |expected - actual| <= max(amount_abs_tolerance, amount_rel_tolerance * |expected|).
    amount_abs_tolerance: float = 1.0
    amount_rel_tolerance: float = 0.01
    # vat_rate etc.: matched within this many percentage points.
    percent_tolerance: float = 0.5
    # Share of the overall score contributed by line_items (0..1); the rest is the header.
    line_items_weight: float = 0.4
    field_weights: Dict[str, float] = field(default_factory=lambda: dict(DEFAULT_FIELD_WEIGHTS))
    line_field_weights: Dict[str, float] = field(default_factory=lambda: dict(DEFAULT_LINE_FIELD_WEIGHTS))


@dataclass
class FieldResult:
    """One field's comparison outcome."""

    field: str
    expected: Any
    actual: Any
    score: float  # 0..1
    matched: bool
    method: str  # "fuzzy" | "tolerance" | "date"

    def to_dict(self) -> dict:
        return {
            "field": self.field,
            "expected": self.expected,
            "actual": self.actual,
            "score": round(self.score, 4),
            "matched": self.matched,
            "method": self.method,
        }


@dataclass
class LineItemComparison:
    """One line item's fate: matched to a counterpart, missing, or extra."""

    status: str  # "matched" | "missing" | "extra"
    expected_index: Optional[int]
    actual_index: Optional[int]
    score: float  # 0..1
    fields: List[FieldResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "expected_index": self.expected_index,
            "actual_index": self.actual_index,
            "score": round(self.score, 4),
            "fields": [f.to_dict() for f in self.fields],
        }


@dataclass
class ScoreReport:
    """Full result of scoring one extraction against its ground truth."""

    overall_score: float  # 0..100
    header_score: float  # 0..100
    line_items_score: float  # 0..100
    field_results: List[FieldResult]
    line_item_comparisons: List[LineItemComparison]

    @property
    def matched_line_items(self) -> int:
        return sum(1 for c in self.line_item_comparisons if c.status == "matched")

    @property
    def missing_line_items(self) -> int:
        return sum(1 for c in self.line_item_comparisons if c.status == "missing")

    @property
    def extra_line_items(self) -> int:
        return sum(1 for c in self.line_item_comparisons if c.status == "extra")

    @property
    def mismatched_fields(self) -> List[str]:
        return [f.field for f in self.field_results if not f.matched]

    def to_dict(self) -> dict:
        return {
            "overall_score": round(self.overall_score, 2),
            "header_score": round(self.header_score, 2),
            "line_items_score": round(self.line_items_score, 2),
            "summary": {
                "matched_line_items": self.matched_line_items,
                "missing_line_items": self.missing_line_items,
                "extra_line_items": self.extra_line_items,
                "mismatched_fields": self.mismatched_fields,
            },
            "field_results": [f.to_dict() for f in self.field_results],
            "line_item_comparisons": [c.to_dict() for c in self.line_item_comparisons],
        }


# ---------------------------------------------------------------------------
# String similarity — dependency-free Levenshtein ratio.
# ---------------------------------------------------------------------------

def levenshtein_distance(a: str, b: str) -> int:
    """Classic edit distance, O(len(a)*len(b)) time, O(min(len(a),len(b))) memory."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):
        a, b = b, a
    previous_row = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current_row = [i] + [0] * len(b)
        for j, char_b in enumerate(b, start=1):
            insert_cost = current_row[j - 1] + 1
            delete_cost = previous_row[j] + 1
            substitute_cost = previous_row[j - 1] + (char_a != char_b)
            current_row[j] = min(insert_cost, delete_cost, substitute_cost)
        previous_row = current_row
    return previous_row[-1]


def _normalise_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().casefold().split())


def text_similarity(expected: Any, actual: Any) -> float:
    """Normalised Levenshtein similarity in [0, 1]; both-empty is a perfect match."""
    a, b = _normalise_text(expected), _normalise_text(actual)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return 1.0 - levenshtein_distance(a, b) / max(len(a), len(b))


# ---------------------------------------------------------------------------
# Numeric / date comparisons.
# ---------------------------------------------------------------------------

def _as_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def amount_similarity(expected: Any, actual: Any, abs_tolerance: float, rel_tolerance: float) -> float:
    """1.0 inside the tolerance band, decaying linearly toward 0 beyond it.

    The band is ``max(abs_tolerance, rel_tolerance * |expected|)`` so a tiny
    rounding difference on a large invoice total doesn't fail the same way a
    tiny amount would with a fixed absolute tolerance.
    """
    a, b = _as_float(expected), _as_float(actual)
    if a is None and b is None:
        return 1.0
    if a is None or b is None:
        return 0.0
    diff = abs(a - b)
    tolerance = max(abs_tolerance, rel_tolerance * abs(a))
    if diff <= tolerance:
        return 1.0
    denominator = max(abs(a), tolerance, 1e-9)
    relative_error = (diff - tolerance) / denominator
    return max(0.0, 1.0 - relative_error)


def date_similarity(expected: Any, actual: Any) -> float:
    """Dates are ISO-normalised upstream, so this is an exact-match check."""
    a = str(expected).strip() if expected not in (None, "") else None
    b = str(actual).strip() if actual not in (None, "") else None
    if a is None and b is None:
        return 1.0
    return 1.0 if a == b else 0.0


def _compare_field(name: str, expected: Any, actual: Any, config: ScoringConfig) -> FieldResult:
    if name in _AMOUNT_FIELDS:
        score = amount_similarity(expected, actual, config.amount_abs_tolerance, config.amount_rel_tolerance)
        method = "tolerance"
    elif name in _PERCENT_FIELDS:
        score = amount_similarity(expected, actual, config.percent_tolerance, 0.0)
        method = "tolerance"
    elif name in _DATE_FIELDS:
        score = date_similarity(expected, actual)
        method = "date"
    else:
        score = text_similarity(expected, actual)
        method = "fuzzy"
    matched = score >= config.text_fuzzy_threshold if method == "fuzzy" else score >= 0.999
    return FieldResult(field=name, expected=expected, actual=actual, score=score, matched=matched, method=method)


# ---------------------------------------------------------------------------
# Header scoring.
# ---------------------------------------------------------------------------

def _score_header(expected: dict, actual: dict, config: ScoringConfig) -> Tuple[float, List[FieldResult]]:
    weights = dict(config.field_weights)
    # Any field present in either payload but not in the weight table still
    # counts (default weight 1.0), so an unexpected schema addition is never
    # silently dropped from the score.
    for key in set(expected) | set(actual):
        if key not in weights and key not in _IGNORED_FIELDS:
            weights[key] = 1.0

    results: List[FieldResult] = []
    weighted_sum = 0.0
    total_weight = 0.0
    for name, weight in weights.items():
        result = _compare_field(name, expected.get(name), actual.get(name), config)
        results.append(result)
        weighted_sum += result.score * weight
        total_weight += weight

    header_score = weighted_sum / total_weight if total_weight else 1.0
    return header_score, results


# ---------------------------------------------------------------------------
# line_items scoring: pairwise similarity + greedy best-first matching.
# ---------------------------------------------------------------------------

def _line_item_similarity(expected_item: dict, actual_item: dict,
                          config: ScoringConfig) -> Tuple[float, List[FieldResult]]:
    field_names = (set(config.line_field_weights) | set(expected_item) | set(actual_item)) - _IGNORED_FIELDS
    results: List[FieldResult] = []
    weighted_sum = 0.0
    total_weight = 0.0
    for name in field_names:
        weight = config.line_field_weights.get(name, 1.0)
        result = _compare_field(name, expected_item.get(name), actual_item.get(name), config)
        results.append(result)
        weighted_sum += result.score * weight
        total_weight += weight
    score = weighted_sum / total_weight if total_weight else 1.0
    return score, results


def _match_line_items(expected_items: List[dict], actual_items: List[dict],
                      config: ScoringConfig) -> Tuple[float, List[LineItemComparison]]:
    n_expected, n_actual = len(expected_items), len(actual_items)
    if n_expected == 0 and n_actual == 0:
        return 1.0, []

    pair_scores: Dict[Tuple[int, int], Tuple[float, List[FieldResult]]] = {
        (i, j): _line_item_similarity(exp, act, config)
        for i, exp in enumerate(expected_items)
        for j, act in enumerate(actual_items)
    }

    # Greedy best-first matching: repeatedly take the highest-scoring
    # still-available pair. Not guaranteed globally optimal (that needs the
    # Hungarian algorithm), but for the small line counts on a settlement
    # form it converges to the same matching in practice, at a fraction of
    # the code and with no numeric library dependency.
    ranked = sorted(pair_scores.items(), key=lambda item: item[1][0], reverse=True)
    matched_expected: set = set()
    matched_actual: set = set()
    comparisons: List[LineItemComparison] = []
    for (i, j), (score, fields) in ranked:
        if i in matched_expected or j in matched_actual:
            continue
        matched_expected.add(i)
        matched_actual.add(j)
        comparisons.append(LineItemComparison("matched", i, j, score, fields))

    for i in range(n_expected):
        if i not in matched_expected:
            comparisons.append(LineItemComparison("missing", i, None, 0.0, []))
    for j in range(n_actual):
        if j not in matched_actual:
            comparisons.append(LineItemComparison("extra", None, j, 0.0, []))

    comparisons.sort(key=lambda c: (c.expected_index is None, c.expected_index, c.actual_index))

    # Missing/extra items score 0 and still count toward the denominator, so
    # a perfect match on the wrong number of lines can never reach 100%.
    total_score = sum(c.score for c in comparisons if c.status == "matched")
    denominator = max(n_expected, n_actual)
    line_items_score = total_score / denominator if denominator else 1.0
    return line_items_score, comparisons


# ---------------------------------------------------------------------------
# Public API.
# ---------------------------------------------------------------------------

def score_extraction(expected: Dict[str, Any], actual: Dict[str, Any],
                     config: Optional[ScoringConfig] = None) -> ScoreReport:
    """Scores an LLM ``actual`` extraction against ``expected`` ground truth.

    Both arguments are plain dicts shaped like ``schemas.extraction.DocumentExtraction``
    (e.g. from ``.model_dump()`` or a hand-written ``expected.json``). Returns a
    0-100 ``overall_score`` plus a full field-by-field / line-by-line breakdown.
    """
    config = config or ScoringConfig()
    expected = expected or {}
    actual = actual or {}

    header_score, field_results = _score_header(expected, actual, config)
    line_items_score, line_comparisons = _match_line_items(
        expected.get("line_items") or [], actual.get("line_items") or [], config)

    overall = (1 - config.line_items_weight) * header_score + config.line_items_weight * line_items_score

    return ScoreReport(
        overall_score=overall * 100,
        header_score=header_score * 100,
        line_items_score=line_items_score * 100,
        field_results=field_results,
        line_item_comparisons=line_comparisons,
    )


def score_files(expected_path: Path | str, actual_path: Path | str,
               config: Optional[ScoringConfig] = None) -> ScoreReport:
    """Convenience wrapper: loads two JSON files from disk and scores them."""
    expected = json.loads(Path(expected_path).read_text(encoding="utf-8"))
    actual = json.loads(Path(actual_path).read_text(encoding="utf-8"))
    return score_extraction(expected, actual, config)
