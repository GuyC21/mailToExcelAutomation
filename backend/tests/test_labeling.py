"""Tests for the ground-truth authoring ("תיוג") service and its API.

``services.regression.labeling.suite_dir`` is monkeypatched to a ``tmp_path``
for every test, so nothing here ever touches the repo's real
``data/regression_suite/``. Patching the module-level function works for both
direct service calls and calls made through the API layer, since
``api.routes.regression`` imports the same function objects, and their
bytecode still resolves ``suite_dir`` from ``services.regression.labeling``'s
own globals at call time.
"""
import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import services.regression.labeling as labeling
from main import app
from schemas.extraction import DocumentExtraction

PDF = b"%PDF-1.4\n% test\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16

VALID_EXPECTED = {
    "document_number": "SLH-88421",
    "document_date": "2026-08-30",
    "supplier_name": "ש.ל.ה שירותי לוגיסטיקה בע\"מ",
    "line_items": [
        {"line_number": 1, "description": "הסעת מטופלים", "quantity": 18, "unit_price": 350, "line_total": 6300},
    ],
    "subtotal": 6300, "vat_rate": 17, "vat_amount": 1071, "total_amount": 7371,
}


@pytest.fixture
def suite(tmp_path, monkeypatch):
    """Redirects the regression suite to an isolated temp directory."""
    monkeypatch.setattr(labeling, "suite_dir", lambda: tmp_path)
    return tmp_path


# ---------------------------------------------------------------------------
# sanitise_case_name
# ---------------------------------------------------------------------------

def test_sanitise_case_name_keeps_safe_characters():
    assert labeling.sanitise_case_name("shl_valid-1") == "shl_valid-1"


def test_sanitise_case_name_strips_everything_else():
    assert labeling.sanitise_case_name("Case #1 (טופס)") == "Case-1"


def test_sanitise_case_name_rejects_traversal_attempts():
    # No literal '..' or '/' can survive: only letters/digits/-/_ pass through.
    assert "/" not in labeling.sanitise_case_name("../../etc/passwd")
    assert ".." not in labeling.sanitise_case_name("../../etc/passwd")


def test_sanitise_case_name_rejects_empty_result():
    with pytest.raises(labeling.InvalidCaseNameError):
        labeling.sanitise_case_name("   ")
    with pytest.raises(labeling.InvalidCaseNameError):
        labeling.sanitise_case_name("טופס עברית בלבד")


def test_sanitise_case_name_truncates_long_names():
    assert len(labeling.sanitise_case_name("a" * 500)) == labeling._MAX_NAME_LENGTH


# ---------------------------------------------------------------------------
# save_labeled_case / get_labeled_case / list_labeled_cases / delete
# ---------------------------------------------------------------------------

def test_save_and_get_case_round_trip(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    case, warnings = labeling.save_labeled_case("shl valid", "form.pdf", PDF, expected)

    assert case.name == "shl-valid"
    assert case.document_filename == "shl-valid.pdf"
    assert case.mime_type == "application/pdf"
    assert warnings == []  # the fixture's arithmetic is internally consistent

    fetched = labeling.get_labeled_case("shl valid")
    assert fetched.expected["supplier_name"] == VALID_EXPECTED["supplier_name"]
    assert (suite / "shl-valid.pdf").exists()
    assert (suite / "shl-valid_expected.json").exists()


def test_save_case_surfaces_business_rule_warnings_without_failing(suite):
    broken = dict(VALID_EXPECTED, total_amount=1)  # subtotal + vat != total
    expected = DocumentExtraction.model_validate(broken)
    case, warnings = labeling.save_labeled_case("broken", "form.pdf", PDF, expected)

    assert case.name == "broken"  # save still succeeds
    assert any(w.code == "TOTAL_MISMATCH" for w in warnings)


def test_save_case_rejects_unsupported_file_type(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    with pytest.raises(labeling.UnsupportedLabelDocumentError):
        labeling.save_labeled_case("bad", "form.exe", b"MZ\x90\x00", expected)


def test_relabeling_without_a_new_file_keeps_the_existing_document(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    labeling.save_labeled_case("shl", "form.pdf", PDF, expected)

    corrected = DocumentExtraction.model_validate(dict(VALID_EXPECTED, supplier_name="שם מתוקן"))
    case, _ = labeling.save_labeled_case("shl", None, None, corrected)

    assert case.document_filename == "shl.pdf"
    assert case.expected["supplier_name"] == "שם מתוקן"
    assert (suite / "shl.pdf").read_bytes() == PDF  # untouched


def test_relabeling_with_a_new_file_type_removes_the_stale_document(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    labeling.save_labeled_case("shl", "form.pdf", PDF, expected)
    labeling.save_labeled_case("shl", "form.png", PNG, expected)

    assert not (suite / "shl.pdf").exists()
    assert (suite / "shl.png").exists()


def test_save_case_without_a_file_for_a_new_case_raises(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    with pytest.raises(labeling.CaseNotFoundError):
        labeling.save_labeled_case("never-created", None, None, expected)


def test_get_labeled_case_missing_raises(suite):
    with pytest.raises(labeling.CaseNotFoundError):
        labeling.get_labeled_case("does-not-exist")


def test_list_labeled_cases_returns_every_paired_case(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    labeling.save_labeled_case("a", "a.pdf", PDF, expected)
    labeling.save_labeled_case("b", "b.png", PNG, expected)

    names = {case.name for case in labeling.list_labeled_cases()}
    assert names == {"a", "b"}


def test_get_case_document_returns_path_and_mime_type(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    labeling.save_labeled_case("shl", "form.pdf", PDF, expected)

    path, mime_type = labeling.get_case_document("shl")
    assert path.name == "shl.pdf"
    assert mime_type == "application/pdf"


def test_delete_labeled_case_removes_both_files(suite):
    expected = DocumentExtraction.model_validate(VALID_EXPECTED)
    labeling.save_labeled_case("shl", "form.pdf", PDF, expected)

    assert labeling.delete_labeled_case("shl") is True
    assert not (suite / "shl.pdf").exists()
    assert not (suite / "shl_expected.json").exists()
    assert labeling.delete_labeled_case("shl") is False  # already gone


# ---------------------------------------------------------------------------
# API layer (multipart handling, status codes)
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_api_save_list_get_and_delete_case(client, suite):
    save = client.post(
        "/api/regression/cases",
        data={"case_name": "api-case", "expected_json": json.dumps(VALID_EXPECTED)},
        files={"file": ("form.pdf", PDF, "application/pdf")},
    )
    assert save.status_code == 200, save.text
    body = save.json()
    assert body["case"]["name"] == "api-case"
    assert body["warnings"] == []

    listing = client.get("/api/regression/cases").json()
    assert any(c["name"] == "api-case" for c in listing)

    fetched = client.get("/api/regression/cases/api-case").json()
    assert fetched["expected"]["supplier_name"] == VALID_EXPECTED["supplier_name"]

    document = client.get("/api/regression/cases/api-case/document")
    assert document.status_code == 200
    assert document.content == PDF

    deleted = client.delete("/api/regression/cases/api-case")
    assert deleted.status_code == 200 and deleted.json()["success"] is True
    assert client.get("/api/regression/cases/api-case").status_code == 404


def test_api_rejects_malformed_expected_json(client, suite):
    response = client.post(
        "/api/regression/cases",
        data={"case_name": "bad", "expected_json": "{not valid json"},
        files={"file": ("form.pdf", PDF, "application/pdf")},
    )
    assert response.status_code == 422


def test_api_new_case_without_a_file_is_rejected(client, suite):
    response = client.post(
        "/api/regression/cases",
        data={"case_name": "no-file", "expected_json": json.dumps(VALID_EXPECTED)},
    )
    assert response.status_code == 400


def test_api_get_missing_case_is_404(client, suite):
    assert client.get("/api/regression/cases/nope").status_code == 404
