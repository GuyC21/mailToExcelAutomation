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
      line-items sub-score, both on a 0-100 scale. It is a *diagnostic*
      number: correct optional fields can dilute a wrong payable amount.
    * Correctness gate: identifiers and currency are compared exactly (after
      normalisation), money uses a tight absolute tolerance only, and a
      mismatch on any *critical* field (``ScoringConfig.critical_fields``:
      total, supplier tax id, document number, currency) is reported in
      ``critical_failures`` - the runner fails such a case whatever its score.

No third-party dependency is required (Levenshtein distance is the ~15-line
classic DP below) so the whole engine runs offline, in the existing test
suite, with nothing to install.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Set

# ---------------------------------------------------------------------------
# Field taxonomy — which comparison strategy applies to each field, and how
# much it should count toward its sub-score.
# ---------------------------------------------------------------------------

_DATE_FIELDS: Set[str] = {"document_date", "billing_period_start", "billing_period_end", "due_date", "service_date"}
_AMOUNT_FIELDS: Set[str] = {"subtotal", "vat_amount", "total_amount", "quantity", "unit_price", "line_total"}
_PERCENT_FIELDS: Set[str] = {"vat_rate"}
# Compared exactly after normalisation: a one-digit difference is a different entity.
_IDENTIFIER_FIELDS: Set[str] = {"supplier_tax_id", "document_number"}
_CURRENCY_FIELDS: Set[str] = {"currency"}
DEFAULT_CRITICAL_FIELDS: Set[str] = {"total_amount", "supplier_tax_id", "document_number", "currency"}
_ILS_ALIASES = {"ILS", "NIS", "₪", "ש\"ח", "ש״ח", "שח"}
_IGNORED_FIELDS: Set[str] = {"line_items", "extraction_notes", "line_number"}

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
    # A transcription must reproduce the printed amount: only rounding noise
    # (absolute) is forgiven by default - a relative band would give 6,250
    # full credit for a printed 6,300.
    amount_abs_tolerance: float = 1.0
    amount_rel_tolerance: float = 0.0
    # vat_rate etc.: matched within this many percentage points.
    percent_tolerance: float = 0.5
    # Share of the overall score contributed by line_items (0..1); the rest is the header.
    line_items_weight: float = 0.4
    field_weights: Dict[str, float] = field(default_factory=lambda: dict(DEFAULT_FIELD_WEIGHTS))
    line_field_weights: Dict[str, float] = field(default_factory=lambda: dict(DEFAULT_LINE_FIELD_WEIGHTS))
    # Header fields whose mismatch fails a case regardless of its overall score.
    critical_fields: Set[str] = field(default_factory=lambda: set(DEFAULT_CRITICAL_FIELDS))


@dataclass
class FieldResult:
    """One field's comparison outcome."""

    field: str
    expected: Any
    actual: Any
    score: float  # 0..1
    matched: bool
    method: str  # "fuzzy" | "tolerance" | "date" | "exact"

    def to_dict(self) -> dict:
        """Serializes the result to a dictionary."""
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
        """Serializes the comparison to a dictionary."""
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
    # Critical header fields that did not match (see ScoringConfig.critical_fields).
    critical_failures: List[str] = field(default_factory=list)

    @property
    def matched_line_items(self) -> int:
        """Count of successfully matched line items."""
        return sum(1 for c in self.line_item_comparisons if c.status == "matched")

    @property
    def missing_line_items(self) -> int:
        """Count of line items present in ground truth but missing from extraction."""
        return sum(1 for c in self.line_item_comparisons if c.status == "missing")

    @property
    def extra_line_items(self) -> int:
        """Count of line items extracted but not present in ground truth."""
        return sum(1 for c in self.line_item_comparisons if c.status == "extra")

    @property
    def mismatched_fields(self) -> List[str]:
        """Names of header fields that failed to match ground truth."""
        return [f.field for f in self.field_results if not f.matched]

    def to_dict(self) -> dict:
        """Serializes the full report to a dictionary."""
        return {
            "overall_score": round(self.overall_score, 2),
            "header_score": round(self.header_score, 2),
            "line_items_score": round(self.line_items_score, 2),
            "critical_failures": list(self.critical_failures),
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
    """Classic edit distance, O(len(a)*len(b)) time, O(min(len(a),len(b))) memory.

    Calculated dynamically without external libraries to keep the test runner
    lightweight and dependency-free.

    Args:
        a: First string.
        b: Second string.

    Returns:
        The minimum number of single-character edits required to change 'a' into 'b'.
    """
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
    """Normalizes string representations for fuzzy comparison.

    Args:
        value: The raw input to normalize.

    Returns:
        A lowercased string with extra spaces removed.
    """
    if value is None:
        return ""
    return " ".join(str(value).strip().casefold().split())


def text_similarity(expected: Any, actual: Any) -> float:
    """Normalised Levenshtein similarity in [0, 1]; both-empty is a perfect match.

    Args:
        expected: Ground truth value.
        actual: Extracted value.

    Returns:
        Similarity score between 0.0 (completely different) and 1.0 (identical).
    """
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
    """Safely converts a value to a float, ignoring booleans."""
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

    Args:
        expected: Ground truth numeric value.
        actual: Extracted numeric value.
        abs_tolerance: Maximum absolute difference allowed.
        rel_tolerance: Maximum relative difference allowed (as a fraction of expected).

    Returns:
        A score between 0.0 and 1.0.
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
    """Dates are ISO-normalised upstream, so this is an exact-match check.

    Args:
        expected: Ground truth date string.
        actual: Extracted date string.

    Returns:
        1.0 if identical, 0.0 otherwise.
    """
    a = str(expected).strip() if expected not in (None, "") else None
    b = str(actual).strip() if actual not in (None, "") else None
    if a is None and b is None:
        return 1.0
    return 1.0 if a == b else 0.0


def _normalise_identifier(value: Any) -> str:
    """Case/whitespace-insensitive identifier; everything else must match exactly."""
    if value is None:
        return ""
    return "".join(str(value).split()).casefold()


def _normalise_currency(value: Any) -> str:
    """ILS aliases (₪, ש"ח, NIS...) and an absent value all mean ILS - the
    schema's default - so a transcription and an extraction compare equal."""
    text = "".join(str(value or "").split()).upper()
    return "ILS" if not text or text in _ILS_ALIASES else text


def exact_similarity(expected: Any, actual: Any, normaliser=_normalise_identifier) -> float:
    """1.0 when both normalise to the same string, else 0.0."""
    return 1.0 if normaliser(expected) == normaliser(actual) else 0.0


def _compare_field(name: str, expected: Any, actual: Any, config: ScoringConfig) -> FieldResult:
    """Dispatches the field to the appropriate comparison strategy based on its type.

    Args:
        name: The field key.
        expected: The ground truth value.
        actual: The extracted value.
        config: The active ScoringConfig.

    Returns:
        The calculated FieldResult.
    """
    if name in _AMOUNT_FIELDS:
        score = amount_similarity(expected, actual, config.amount_abs_tolerance, config.amount_rel_tolerance)
        method = "tolerance"
    elif name in _PERCENT_FIELDS:
        score = amount_similarity(expected, actual, config.percent_tolerance, 0.0)
        method = "tolerance"
    elif name in _DATE_FIELDS:
        score = date_similarity(expected, actual)
        method = "date"
    elif name in _IDENTIFIER_FIELDS:
        score = exact_similarity(expected, actual)
        method = "exact"
    elif name in _CURRENCY_FIELDS:
        score = exact_similarity(expected, actual, _normalise_currency)
        method = "exact"
    else:
        score = text_similarity(expected, actual)
        method = "fuzzy"
    matched = score >= config.text_fuzzy_threshold if method == "fuzzy" else score >= 0.999
    return FieldResult(field=name, expected=expected, actual=actual, score=score, matched=matched, method=method)


# ---------------------------------------------------------------------------
# Header scoring.
# ---------------------------------------------------------------------------

def _score_header(expected: dict, actual: dict, config: ScoringConfig) -> Tuple[float, List[FieldResult]]:
    """Calculates the weighted score for all header (non-line-item) fields.

    Args:
        expected: The ground truth document dictionary.
        actual: The extracted document dictionary.
        config: The active ScoringConfig.

    Returns:
        A tuple of the (weighted average score, list of individual field results).
    """
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
    """Calculates the weighted similarity between a single pair of line items.

    Args:
        expected_item: A line item dict from the ground truth.
        actual_item: A line item dict from the extraction.
        config: The active ScoringConfig.

    Returns:
        A tuple of the (weighted average score, list of field results).
    """
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
    """Aligns expected and actual line items using a greedy matching algorithm.

    This avoids the complexity of full bipartite matching (Hungarian algorithm)
    while being more than accurate enough for the short line item lists typical
    of settlement forms. Unmatched items are penalized as missing/extra.

    Args:
        expected_items: The ground truth list of line items.
        actual_items: The extracted list of line items.
        config: The active ScoringConfig.

    Returns:
        A tuple of the (overall line items score, list of line item comparisons).
    """
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
    
    Args:
        expected: Ground truth dictionary.
        actual: The extracted dictionary.
        config: The active ScoringConfig (uses default if None).

    Returns:
        A complete ScoreReport with detailed breakdowns.
    """
    config = config or ScoringConfig()
    expected = expected or {}
    actual = actual or {}

    header_score, field_results = _score_header(expected, actual, config)
    line_items_score, line_comparisons = _match_line_items(
        expected.get("line_items") or [], actual.get("line_items") or [], config)

    overall = (1 - config.line_items_weight) * header_score + config.line_items_weight * line_items_score
    critical_failures = sorted(f.field for f in field_results
                               if f.field in config.critical_fields and not f.matched)

    return ScoreReport(
        overall_score=overall * 100,
        header_score=header_score * 100,
        line_items_score=line_items_score * 100,
        field_results=field_results,
        line_item_comparisons=line_comparisons,
        critical_failures=critical_failures,
    )


def score_files(expected_path: Path | str, actual_path: Path | str,
               config: Optional[ScoringConfig] = None) -> ScoreReport:
    """Convenience wrapper: loads two JSON files from disk and scores them.

    Args:
        expected_path: Path to the expected JSON file.
        actual_path: Path to the actual JSON file.
        config: The active ScoringConfig.

    Returns:
        A complete ScoreReport.
    """
    expected = json.loads(Path(expected_path).read_text(encoding="utf-8"))
    actual = json.loads(Path(actual_path).read_text(encoding="utf-8"))
    return score_extraction(expected, actual, config)
