"""Unit and integration test suite for Document Reviewer Audit Trail.

Validates that:
1. DocumentIngestion schema properly models reviewer attribution (updated_by_id, updated_at).
2. The serialization helper formats reviewer profile or service accounts reliably.
3. to_excel_record maps editor display names and local timestamps into Excel row dictionaries.
4. DOCUMENT_COLUMNS in the Excel layout includes the 'עורך אחרון' and 'תאריך עריכה' audit headers.
5. Startup database migration helper _sync_audit_schema safely adds missing columns.
"""
from datetime import datetime, timezone
import sys
from typing import Any, Dict
from unittest.mock import MagicMock

# Mock openpyxl in environments where it is not installed globally
if "openpyxl" not in sys.modules:
    sys.modules["openpyxl"] = MagicMock()
    sys.modules["openpyxl.styles"] = MagicMock()
    sys.modules["openpyxl.utils.exceptions"] = MagicMock()

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base

from api.routes.documents import _serialize_user_identity
from main import _sync_audit_schema
from models.ingestion import DocumentIngestion
from models.user import UserProfile, UserRole, UserStatus
from repositories.excel_layout import DOCUMENT_COLUMNS
from services.excel_sync import to_excel_record


def test_serialize_user_identity_with_user_profile():
    """Verifies that an active UserProfile is mapped to a secure public dictionary."""
    user = UserProfile(
        id="usr-uuid-12345",
        email="auditor@billingstream.local",
        full_name="ישראל ישראלי",
        role=UserRole.USER,
        status=UserStatus.APPROVED,
    )
    result = _serialize_user_identity(user, user.id)

    assert result is not None
    assert result["id"] == "usr-uuid-12345"
    assert result["email"] == "auditor@billingstream.local"
    assert result["full_name"] == "ישראל ישראלי"


def test_serialize_user_identity_with_system_api_key():
    """Verifies that headless service account requests are attributed to System API Key."""
    result = _serialize_user_identity(None, "system-api-key")

    assert result is not None
    assert result["id"] == "system-api-key"
    assert result["full_name"] == "System API Key"
    assert result["email"] == "system@billingstream.local"


def test_serialize_user_identity_unreviewed():
    """Verifies that unreviewed automated documents return None for editor attribution."""
    result = _serialize_user_identity(None, None)
    assert result is None


def test_to_excel_record_with_reviewer():
    """Verifies that to_excel_record projects reviewer name and local timestamp."""
    reviewer = UserProfile(
        id="rev-777",
        email="clerk@example.com",
        full_name="דנה לוי",
        role=UserRole.USER,
        status=UserStatus.APPROVED,
    )
    now = datetime(2026, 11, 16, 10, 30, tzinfo=timezone.utc)
    doc = DocumentIngestion(
        id=42,
        original_filename="invoice_nov.pdf",
        channel="email",
        status="VALID",
        extracted_data={"supplier_name": "סלקום", "total_amount": 150.0},
        updated_at=now,
        updated_by_id=reviewer.id,
        updated_by=reviewer,
        created_at=now,
    )

    record = to_excel_record(doc)

    assert record["ingestion_id"] == 42
    assert record["updated_by_id"] == "rev-777"
    assert record["updated_by_name"] == "דנה לוי"
    assert record["updated_at_local"] is not None


def test_to_excel_record_system_api_key():
    """Verifies that automated scripts updating documents via API key project correctly to Excel."""
    now = datetime(2026, 11, 16, 10, 30, tzinfo=timezone.utc)
    doc = DocumentIngestion(
        id=99,
        original_filename="script_upload.pdf",
        channel="sandbox",
        status="VALID",
        updated_at=now,
        updated_by_id="system-api-key",
        updated_by=None,
        created_at=now,
    )

    record = to_excel_record(doc)

    assert record["updated_by_id"] == "system-api-key"
    assert record["updated_by_name"] == "מערכת (API Key)"


def test_to_excel_record_unreviewed_document():
    """Verifies that unreviewed automated documents project None for audit fields in Excel."""
    doc = DocumentIngestion(
        id=101,
        original_filename="auto.pdf",
        channel="email",
        status="NEEDS_REVIEW",
        updated_at=None,
        updated_by_id=None,
        updated_by=None,
        created_at=datetime.now(timezone.utc),
    )

    record = to_excel_record(doc)

    assert record["updated_by_id"] is None
    assert record["updated_by_name"] is None
    assert record["updated_at_local"] is None


def test_excel_layout_document_columns_has_audit_headers():
    """Verifies that the Excel layout master columns include the audit headers."""
    headers = [col.header for col in DOCUMENT_COLUMNS]

    assert "עורך אחרון" in headers
    assert "תאריך עריכה" in headers

    editor_col = next(c for c in DOCUMENT_COLUMNS if c.header == "עורך אחרון")
    date_col = next(c for c in DOCUMENT_COLUMNS if c.header == "תאריך עריכה")

    # Test lambda value extraction on sample record dict
    test_record = {
        "updated_by_name": "שרה כהן",
        "updated_by_id": "usr-1",
        "updated_at_local": "16/11/2026 12:00",
    }
    assert editor_col.value(test_record) == "שרה כהן"
    assert date_col.value(test_record) == "16/11/2026 12:00"

    # Test fallback for unreviewed record
    unreviewed_record = {"updated_by_name": None, "updated_by_id": None, "updated_at_local": None}
    assert editor_col.value(unreviewed_record) == "קליטה אוטומטית"
    assert date_col.value(unreviewed_record) is None


def test_startup_schema_sync_is_idempotent():
    """Verifies that _sync_audit_schema creates missing audit columns idempotently."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE document_ingestions (id INTEGER PRIMARY KEY, status VARCHAR(30));"))
        
        # First execution: should add columns
        _sync_audit_schema(conn)

        inspector = inspect(conn)
        cols_after_first = {c["name"] for c in inspector.get_columns("document_ingestions")}
        assert "updated_at" in cols_after_first
        assert "updated_by_id" in cols_after_first

        # Second execution: should safely no-op without raising table alteration errors
        _sync_audit_schema(conn)
        cols_after_second = {c["name"] for c in inspector.get_columns("document_ingestions")}
        assert cols_after_second == cols_after_first
