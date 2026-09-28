"""Ground-truth authoring ("תיוג"): turn a person's manual transcription of a
document into a paired (document, expected.json) regression-suite case.

This is the write-side companion to ``services.regression.runner`` — it is
how ``data/regression_suite/`` actually grows. Today the only way to add a
ground-truth case is for a developer to hand-write a JSON file; this module
is what lets a finance-team member (or a developer correcting a
NEEDS_REVIEW document) do the same thing through a form instead, by
transcribing a document exactly the way the AI extraction pipeline would.

Design notes:
    * A case name typed in a browser becomes a file path
      (``data/regression_suite/<name>.pdf``), so ``sanitise_case_name`` is the
      single choke point every entry point (form field or URL path segment)
      must pass through before touching the filesystem — see the module
      docstring warning in ``services.file_storage`` for the same concern on
      the ingestion side.
    * The ground truth is validated against the exact same
      ``schemas.extraction.DocumentExtraction`` schema the AI's output is
      validated against, so a labeled case can never drift out of shape with
      what ``services.regression.scorer`` expects to compare it to.
    * Business-rule findings (``services.validation.business_rules``) are
      surfaced as non-blocking warnings, never a hard failure: a ground
      truth may faithfully transcribe a supplier's own arithmetic mistake,
      and catching the AI failing to preserve that mistake is exactly what
      regression testing is for.
"""
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from config import get_settings
from schemas.extraction import DocumentExtraction
from services.file_storage import detect_document_type, safe_filename
from services.regression.runner import DOCUMENT_EXTENSIONS, EXPECTED_SUFFIX, default_suite_dir, discover_cases
from services.validation.business_rules import ValidationIssue, validate_document

_NAME_PATTERN = re.compile(r"[^a-zA-Z0-9\-_]+")
_MAX_NAME_LENGTH = 80


class InvalidCaseNameError(ValueError):
    """``case_name`` has no usable characters once sanitised (HTTP 400)."""


class UnsupportedLabelDocumentError(ValueError):
    """The uploaded source file is not a supported document type (HTTP 415)."""


class CaseNotFoundError(LookupError):
    """No labeled case exists under this name (HTTP 404)."""


def sanitise_case_name(name: str) -> str:
    """Turns free text into a filesystem-safe regression-suite case stem.

    Security: this is the only thing standing between a case name typed in
    the browser and a path on disk. Rather than blocklisting traversal
    sequences (``..``, ``/``, …) it allowlists ASCII letters, digits, ``-``
    and ``_`` and discards everything else, so no separator or traversal
    token can ever survive into a path.

    Args:
        name: Free-text case name as typed by the labeler.

    Returns:
        A safe file stem, at most ``_MAX_NAME_LENGTH`` characters.

    Raises:
        InvalidCaseNameError: If nothing usable remains after sanitising
            (e.g. the name was empty, or entirely Hebrew/punctuation).
    """
    cleaned = _NAME_PATTERN.sub("-", (name or "").strip()).strip("-")
    if not cleaned:
        raise InvalidCaseNameError(
            "שם התיק ריק או מכיל רק תווים לא נתמכים – יש להשתמש באותיות/ספרות באנגלית, מקף או קו תחתון")
    return cleaned[:_MAX_NAME_LENGTH]


@dataclass
class LabeledCase:
    """One (document, ground truth) pair as stored in the regression suite."""

    name: str
    document_filename: str
    mime_type: str
    expected: dict

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "document_filename": self.document_filename,
            "mime_type": self.mime_type,
            "expected": self.expected,
        }


def suite_dir() -> Path:
    """The regression suite directory, created on first use."""
    path = default_suite_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _document_glob(directory: Path, stem: str):
    """Yields files named ``<stem>.<ext>`` (never the ``_expected.json`` sibling)."""
    for path in directory.glob(f"{stem}.*"):
        if path.suffix.lower() in DOCUMENT_EXTENSIONS:
            yield path


def list_labeled_cases() -> List[LabeledCase]:
    """All existing (document, ground truth) pairs, for the labeling page's list.

    Reuses ``runner.discover_cases`` so the labeling UI and the regression
    runner always agree on what counts as a valid, paired case.
    """
    cases, _warnings = discover_cases(suite_dir())
    summaries = []
    for case in cases:
        try:
            expected = json.loads(case.expected_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            expected = {}
        mime_type = detect_document_type(case.document_path.name, case.document_path.read_bytes()[:16])
        summaries.append(LabeledCase(name=case.name, document_filename=case.document_path.name,
                                     mime_type=mime_type or "application/octet-stream", expected=expected))
    return summaries


def get_labeled_case(case_name: str) -> LabeledCase:
    """Returns one labeled case, for opening it in the labeling UI to edit.

    Raises:
        InvalidCaseNameError: ``case_name`` sanitises to nothing.
        CaseNotFoundError: No paired (document, ground truth) case exists under this name.
    """
    stem = sanitise_case_name(case_name)
    directory = suite_dir()
    expected_path = directory / f"{stem}{EXPECTED_SUFFIX}"
    document_path = next(_document_glob(directory, stem), None)
    if not expected_path.exists() or document_path is None:
        raise CaseNotFoundError(f"לא נמצא תיק רגרסיה בשם '{stem}'")
    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    mime_type = detect_document_type(document_path.name, document_path.read_bytes()[:16])
    return LabeledCase(name=stem, document_filename=document_path.name,
                       mime_type=mime_type or "application/octet-stream", expected=expected)


def get_case_document(case_name: str) -> Tuple[Path, str]:
    """Locates a labeled case's source file, for streaming it back for preview.

    Returns:
        ``(path, mime_type)``.

    Raises:
        InvalidCaseNameError: ``case_name`` sanitises to nothing.
        CaseNotFoundError: No document exists under this name.
    """
    stem = sanitise_case_name(case_name)
    document_path = next(_document_glob(suite_dir(), stem), None)
    if document_path is None:
        raise CaseNotFoundError(f"לא נמצא מסמך עבור תיק '{stem}'")
    mime_type = detect_document_type(document_path.name, document_path.read_bytes()[:16])
    return document_path, mime_type or "application/octet-stream"


def save_labeled_case(case_name: str, filename: Optional[str], content: Optional[bytes],
                      expected: DocumentExtraction) -> Tuple[LabeledCase, List[ValidationIssue]]:
    """Writes one (document, expected.json) pair into the regression suite.

    Creating a case requires the source file; re-labeling an existing case
    may omit it (``filename``/``content`` both ``None``) to keep the
    previously uploaded document unchanged while only the transcription is
    corrected.

    Args:
        case_name: Free-text label typed by the user; sanitised into a safe file stem.
        filename: The uploaded document's original name (used only for its
            extension), or ``None`` to keep the existing document.
        content: The uploaded document's raw bytes, or ``None`` to keep the
            existing document.
        expected: The manually transcribed ground truth.

    Returns:
        ``(case, warnings)`` — the saved case, plus any business-rule
        findings on the ground truth itself (e.g. a line's quantity × price
        not matching its total). These are informational, never a reason to
        reject the save: the labeler may be faithfully transcribing a
        supplier's own error.

    Raises:
        InvalidCaseNameError: ``case_name`` sanitises to nothing.
        UnsupportedLabelDocumentError: A new upload isn't a supported document type.
        CaseNotFoundError: No file was uploaded and no existing case has this name.
    """
    stem = sanitise_case_name(case_name)
    directory = suite_dir()

    if content is not None:
        safe_name = safe_filename(filename)
        mime_type = detect_document_type(safe_name, content)
        if not mime_type:
            raise UnsupportedLabelDocumentError(f"הקובץ '{safe_name}' אינו PDF או תמונה נתמכת")
        extension = Path(safe_name).suffix.lower() or ".pdf"
        document_path = directory / f"{stem}{extension}"
        # A case may be re-labeled with a different file type than it had
        # originally (e.g. re-scanned as .png instead of .pdf) – drop any
        # stale sibling first so the suite never accumulates orphaned files
        # under the same stem.
        for stale in _document_glob(directory, stem):
            if stale != document_path:
                stale.unlink()
        document_path.write_bytes(content)
    else:
        document_path = next(_document_glob(directory, stem), None)
        if document_path is None:
            raise CaseNotFoundError(f"אין מסמך קיים עבור '{stem}' – יש להעלות קובץ מקור עבור תיק חדש")
        mime_type = detect_document_type(document_path.name, document_path.read_bytes()[:16]) or "application/octet-stream"

    expected_dict = expected.model_dump()
    expected_path = directory / f"{stem}{EXPECTED_SUFFIX}"
    expected_path.write_text(json.dumps(expected_dict, ensure_ascii=False, indent=2), encoding="utf-8")

    warnings = validate_document(expected)
    case = LabeledCase(name=stem, document_filename=document_path.name, mime_type=mime_type, expected=expected_dict)
    return case, warnings


def delete_labeled_case(case_name: str) -> bool:
    """Removes a labeled case's document and ground truth from the suite.

    Returns:
        True if anything was removed, False if the case did not exist.

    Raises:
        InvalidCaseNameError: ``case_name`` sanitises to nothing.
    """
    stem = sanitise_case_name(case_name)
    directory = suite_dir()
    removed = False

    expected_path = directory / f"{stem}{EXPECTED_SUFFIX}"
    if expected_path.exists():
        expected_path.unlink()
        removed = True

    for document in _document_glob(directory, stem):
        document.unlink()
        removed = True

    return removed
