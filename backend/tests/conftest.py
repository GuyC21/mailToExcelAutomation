"""Test bootstrap: importable backend root + isolated configuration.

Uses an isolated SQLite database when ``aiosqlite`` is installed (or respects
``TEST_DATABASE_URL`` / ``DATABASE_URL`` if explicitly provided), and clears
all cloud/LLM environment secrets so local ``.env`` files never contaminate tests.
"""
import importlib.util
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP = tempfile.mkdtemp(prefix="billingstream-tests-")

_default_db = (
    f"sqlite+aiosqlite:///{_TMP}/test.db"
    if importlib.util.find_spec("aiosqlite")
    else "postgresql+asyncpg://postgres:postgres@localhost:5432/billingstream"
)
db_url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL") or _default_db

os.environ.update({
    "DATABASE_URL": db_url,
    "EXCEL_PATH": f"{_TMP}/BillingStream_Master.xlsx",
    "INBOX_DIR": f"{_TMP}/inbox",
    "GEMINI_API_KEY": "",
    "OPENAI_API_KEY": "",
    "INBOUND_EMAIL_TOKEN": "",
    "BACKOFFICE_API_KEY": "",
    "AUTH_DISABLED_FOR_TESTS": "true",
    "SUPABASE_URL": "",
    "SUPABASE_ANON_KEY": "",
    "SUPABASE_JWT_SECRET": "",
    "SUPABASE_SERVICE_ROLE_KEY": "",
})
