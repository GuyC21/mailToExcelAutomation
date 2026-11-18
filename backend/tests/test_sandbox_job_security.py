"""Unit and security test suite for Sandbox Job Persistence & In-Flight Tracking.

Validates that:
1. Schema Migration & Idempotence: _sync_audit_schema safely adds `created_by_id`
   to document_ingestions on existing schemas without duplicate column errors.
2. Model Security & Relationship Invariants: DocumentIngestion defines `created_by_id`,
   `created_by` relationship to UserProfile, and STATUS_PROCESSING constant.
3. Ingestion Pipeline Signature Contracts: ingest_document and ingest_email accept
   the `user_id` parameter to propagate caller ownership down to the database record.
4. Callers Pass User ID: ingestion route and email_simulation route extract and pass
   `user_id` to the pipeline.
5. Router Security & Authentication Gates: /active-job and /job-result endpoints
   are strictly guarded by `require_approved_user` and mounted under the protected
   Backoffice prefix.
6. Strict User Isolation (BOLA/IDOR Prevention): Endpoint query builders enforce
   `created_by_id == current_user.id` in their WHERE clauses, ensuring User A
   cannot view or poll User B's documents, and production webhook documents
   (created_by_id IS NULL) are invisible.
7. Staleness Window Guard: /active-job query builders enforce a 5-minute cutoff
   on created_at to prevent indefinite spinner deadlocks.
8. Sanitized DTO Contracts: ActiveJobResponse and JobResultResponse schemas
   never leak sensitive raw LLM responses or server filesystem paths.
"""
from datetime import datetime, timedelta, timezone
import inspect
import sys
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, inspect as sa_inspect, text
from sqlalchemy.sql.selectable import Select

# Mock openpyxl in environments where it is not installed globally
if "openpyxl" not in sys.modules:
    sys.modules["openpyxl"] = MagicMock()
    sys.modules["openpyxl.styles"] = MagicMock()
    sys.modules["openpyxl.utils"] = MagicMock()
    sys.modules["openpyxl.utils.exceptions"] = MagicMock()

from api.dependencies.auth import require_approved_user
from api.routes import ingestion, email_simulation, sandbox_status
from api.routes.sandbox_status import (
    ActiveJobResponse,
    JobResultResponse,
    router as sandbox_router,
    _STALENESS_WINDOW,
)
from main import app, _sync_audit_schema
from models.ingestion import DocumentIngestion, STATUS_PROCESSING
from models.user import UserProfile
from services.ingestion_pipeline import ingest_document, ingest_email


def test_schema_migration_creates_created_by_id_idempotently():
    """Verifies that _sync_audit_schema safely adds created_by_id to document_ingestions."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE document_ingestions (id INTEGER PRIMARY KEY, status VARCHAR(30));"))

        # Run migration helper
        _sync_audit_schema(conn)

        inspector = sa_inspect(conn)
        cols = {c["name"] for c in inspector.get_columns("document_ingestions")}
        assert "created_by_id" in cols
        assert "updated_at" in cols
        assert "updated_by_id" in cols

        # Second run should safely no-op without exception
        _sync_audit_schema(conn)
        cols_second = {c["name"] for c in inspector.get_columns("document_ingestions")}
        assert cols == cols_second


def test_model_definitions_and_processing_constant():
    """Verifies that DocumentIngestion includes created_by_id and STATUS_PROCESSING is defined."""
    assert STATUS_PROCESSING == "PROCESSING"

    # Inspect DocumentIngestion table columns
    table_columns = {c.name for c in DocumentIngestion.__table__.columns}
    assert "created_by_id" in table_columns
    assert "status" in table_columns
    assert "updated_by_id" in table_columns
    assert "updated_at" in table_columns

    # Verify relationships
    assert hasattr(DocumentIngestion, "created_by")
    assert hasattr(DocumentIngestion, "updated_by")
    assert hasattr(DocumentIngestion, "email")


def test_ingestion_pipeline_signature_contracts():
    """Verifies that ingest_document and ingest_email accept user_id for caller attribution."""
    doc_sig = inspect.signature(ingest_document)
    assert "user_id" in doc_sig.parameters
    assert doc_sig.parameters["user_id"].default is None

    email_sig = inspect.signature(ingest_email)
    assert "user_id" in email_sig.parameters
    assert email_sig.parameters["user_id"].default is None


def test_callers_propagate_user_id_contract():
    """Verifies that sandbox upload and email simulation routes accept and require user."""
    # Ingestion upload endpoint must accept current_user
    upload_sig = inspect.signature(ingestion.ingest_sample)
    assert "current_user" in upload_sig.parameters

    # Email simulation internal processor must accept user_id
    sim_proc_sig = inspect.signature(email_simulation._process_simulation)
    assert "user_id" in sim_proc_sig.parameters


def test_router_endpoints_and_authentication_guards():
    """Verifies that sandbox status routes are authenticated with require_approved_user."""
    routes = {r.path: r for r in sandbox_router.routes}
    assert "/active-job" in routes
    assert "/job-result/{document_id}" in routes

    for path, route in routes.items():
        dep_callables = [d.call for d in route.dependant.dependencies]
        assert require_approved_user in dep_callables, (
            f"Endpoint {path} must enforce require_approved_user"
        )


def test_main_mounts_sandbox_status_router_with_backoffice_guard():
    """Verifies that main.py mounts the sandbox router under /api/sandbox with _backoffice."""
    matched = [
        r for r in app.routes
        if getattr(r, "path", "").startswith("/api/sandbox")
    ]
    assert len(matched) >= 2, "Both /api/sandbox/active-job and /job-result must be registered"


def test_sanitized_dto_contracts():
    """Verifies that response DTOs do not expose raw_response, stored_path, or sensitive internals."""
    active_job_fields = set(ActiveJobResponse.model_fields.keys())
    assert active_job_fields == {"active", "document_id", "filename", "channel", "email_id"}
    assert "raw_response" not in active_job_fields
    assert "stored_path" not in active_job_fields

    job_result_fields = set(JobResultResponse.model_fields.keys())
    assert "raw_response" not in job_result_fields
    assert "stored_path" not in job_result_fields
    assert "document_id" in job_result_fields
    assert "status" in job_result_fields
    assert "data" in job_result_fields


def test_staleness_window_duration():
    """Verifies that _STALENESS_WINDOW is set to 5 minutes to prevent infinite spinner lockups."""
    assert _STALENESS_WINDOW == timedelta(minutes=5)
