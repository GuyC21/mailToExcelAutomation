"""Test bootstrap: importable backend root + isolated, offline configuration.

Environment variables are set before any application module is imported, so
the cached settings point at a throw-away SQLite DB and temp data folder and
the mock provider is used (no API keys, no network).
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP = tempfile.mkdtemp(prefix="goldencare-tests-")
os.environ.update({
    "DATABASE_URL": f"sqlite+aiosqlite:///{_TMP}/test.db",
    "EXCEL_PATH": f"{_TMP}/GoldenCare_Master.xlsx",
    "INBOX_DIR": f"{_TMP}/inbox",
    "GEMINI_API_KEY": "",
    "OPENAI_API_KEY": "",
    "INBOUND_EMAIL_TOKEN": "",
})
