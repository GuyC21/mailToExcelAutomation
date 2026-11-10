"""Test bootstrap: importable backend root + isolated configuration.

Defaults to the project's production PostgreSQL asyncpg driver, or respects
DATABASE_URL if provided.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP = tempfile.mkdtemp(prefix="billingstream-tests-")

default_pg = "postgresql+asyncpg://postgres:postgres@localhost:5432/billingstream"
db_url = os.environ.get("DATABASE_URL", default_pg)

os.environ.update({
    "DATABASE_URL": db_url,
    "EXCEL_PATH": f"{_TMP}/BillingStream_Master.xlsx",
    "INBOX_DIR": f"{_TMP}/inbox",
    "GEMINI_API_KEY": "",
    "OPENAI_API_KEY": "",
    "INBOUND_EMAIL_TOKEN": "",
})
