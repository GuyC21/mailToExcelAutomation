"""Tests for regression Run History persistence and A/B comparison.

These cover the new behavior only (the scoring formula itself is untouched
and already covered by ``test_scorer.py``/``test_runner.py``): every run of
``POST /api/regression/run`` is saved as a row, ``GET /runs``/``GET
/runs/{id}`` read it back, and ``GET /runs/compare`` diffs two runs
case-by-case. Runs offline (a stub Gemini provider), on the shared test
database from ``conftest``.
"""
import json

import pytest
from fastapi.testclient import TestClient

from config import get_settings
from main import app
from schemas.extraction import DocumentExtraction
from services.extraction.providers.base import ProviderResponse
from services.extraction.providers.gemini_provider import GeminiProvider
from tests.fixtures import sample_documents as samples

PDF = b"%PDF-1.4\n% test\n"


def _normalised(data):
    """Ground truth run through the same schema the AI's own output is validated
    with, so a stub extraction that echoes it back scores a perfect match."""
    return DocumentExtraction.model_validate(data).model_dump()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _write_suite(tmp_path, cases: dict[str, dict]) -> None:
    suite = tmp_path / "regression_suite"
    suite.mkdir(exist_ok=True)
    for stem, expected in cases.items():
        (suite / f"{stem}.pdf").write_bytes(PDF)
        (suite / f"{stem}_expected.json").write_text(json.dumps(expected, ensure_ascii=False), encoding="utf-8")
    return suite


def _stub_gemini(monkeypatch, payload: dict, model: str = "gemini-test") -> None:
    monkeypatch.setattr(GeminiProvider, "is_configured", lambda self: True)
    monkeypatch.setattr(GeminiProvider, "extract",
                        lambda self, system_prompt, file_path, mime_type:
                        ProviderResponse(raw_text=json.dumps(payload), model=model))


def test_run_is_persisted_and_readable_from_history(client, monkeypatch, tmp_path):
    expected = _normalised(samples.SHL_VALID)
    _write_suite(tmp_path, {"shl": expected})
    monkeypatch.setattr(get_settings(), "data_dir", str(tmp_path))
    _stub_gemini(monkeypatch, expected)

    run = client.post("/api/regression/run").json()["data"]
    assert run["id"] and run["created_at"]

    listed = client.get("/api/regression/runs").json()["runs"]
    assert listed[0]["id"] == run["id"]
    assert listed[0]["total"] == run["summary"]["total"] == 1
    assert listed[0]["average_score"] == run["summary"]["average_score"]
    assert listed[0]["providers"] == run["providers"]

    detail = client.get(f"/api/regression/runs/{run['id']}").json()
    assert detail["id"] == run["id"]
    assert [r["name"] for r in detail["results"]] == [r["name"] for r in run["results"]]
    assert detail["results"][0]["score"]["overall_score"] == run["results"][0]["score"]["overall_score"]


def test_unknown_run_id_is_404(client):
    assert client.get("/api/regression/runs/999999").status_code == 404
    assert client.delete("/api/regression/runs/999999").status_code == 404


def test_deleted_run_disappears_from_history(client, monkeypatch, tmp_path):
    _write_suite(tmp_path, {"shl": _normalised(samples.SHL_VALID)})
    monkeypatch.setattr(get_settings(), "data_dir", str(tmp_path))
    _stub_gemini(monkeypatch, _normalised(samples.SHL_VALID))

    run_id = client.post("/api/regression/run").json()["data"]["id"]
    assert client.get(f"/api/regression/runs/{run_id}").status_code == 200
    assert client.delete(f"/api/regression/runs/{run_id}").json() == {"success": True}
    assert client.get(f"/api/regression/runs/{run_id}").status_code == 404


def test_compare_diffs_two_runs_case_by_case(client, monkeypatch, tmp_path):
    expected = _normalised(samples.SHL_VALID)
    _write_suite(tmp_path, {"shl": expected})
    monkeypatch.setattr(get_settings(), "data_dir", str(tmp_path))

    # Run A: a worse prompt whose extraction gets the critical total wrong.
    _stub_gemini(monkeypatch, dict(expected, total_amount=0), model="gemini-a")
    run_a = client.post("/api/regression/run").json()["data"]
    assert run_a["results"][0]["passed"] is False

    # Run B: a better prompt that reproduces the ground truth exactly.
    _stub_gemini(monkeypatch, expected, model="gemini-b")
    run_b = client.post("/api/regression/run").json()["data"]
    assert run_b["results"][0]["passed"] is True

    compare = client.get(f"/api/regression/runs/compare?run_a={run_a['id']}&run_b={run_b['id']}").json()
    assert compare["run_a"]["id"] == run_a["id"] and compare["run_b"]["id"] == run_b["id"]
    assert compare["summary_delta"]["passed"] == 1

    [case] = compare["cases"]
    assert case["name"] == "shl"
    assert case["status"] == "improved"
    assert case["a"]["passed"] is False and case["b"]["passed"] is True
    assert case["score_delta"] > 0


def test_compare_marks_a_case_missing_from_one_run(client, monkeypatch, tmp_path):
    expected = _normalised(samples.SHL_VALID)
    suite = _write_suite(tmp_path, {"shl": expected})
    monkeypatch.setattr(get_settings(), "data_dir", str(tmp_path))
    _stub_gemini(monkeypatch, expected, model="gemini-a")
    run_a = client.post("/api/regression/run").json()["data"]

    (suite / "another.pdf").write_bytes(PDF)
    (suite / "another_expected.json").write_text(json.dumps(expected, ensure_ascii=False), encoding="utf-8")
    _stub_gemini(monkeypatch, expected, model="gemini-b")
    run_b = client.post("/api/regression/run").json()["data"]

    compare = client.get(f"/api/regression/runs/compare?run_a={run_a['id']}&run_b={run_b['id']}").json()
    extra = next(c for c in compare["cases"] if c["name"] == "another")
    assert extra["status"] == "only_b" and extra["a"] is None and extra["b"]["passed"] is True


def test_runs_can_be_filtered_by_prompt(client, monkeypatch, tmp_path):
    _write_suite(tmp_path, {"shl": _normalised(samples.SHL_VALID)})
    monkeypatch.setattr(get_settings(), "data_dir", str(tmp_path))
    _stub_gemini(monkeypatch, _normalised(samples.SHL_VALID))

    candidate = client.post("/api/prompts/", json={"name": "candidate-history", "content": "x"}).json()
    own_run = client.post(f"/api/regression/run?prompt_id={candidate['id']}").json()["data"]
    client.post("/api/regression/run")  # a second run, against the active prompt

    filtered = client.get(f"/api/regression/runs?prompt_id={candidate['id']}").json()["runs"]
    assert {r["id"] for r in filtered} == {own_run["id"]}
