"""Centralised, validated runtime configuration.

All tunables come from environment variables (see ``.env.example``) so that no
secret or environment-specific value is hardcoded in the codebase.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from the environment / ``.env`` file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/goldencare"
    sql_echo: bool = False  # Off by default: SQL echo would log extracted PII.

    # --- AI providers -----------------------------------------------------
    gemini_api_key: str = ""
    # Ordered fallback chain. Free-tier quotas are per model, so falling back to
    # a sibling model on 429/404 keeps the pipeline alive during demos.
    gemini_models: str = "gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3-flash,gemini-2.5-flash,gemini-2.5-flash-lite"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # --- Storage ----------------------------------------------------------
    data_dir: str = "data"
    excel_path: str = "data/GoldenCare_Master.xlsx"
    inbox_dir: str = "data/inbox"
    max_upload_mb: int = 15
    # Hard cap on any request body (all attachments of one email together).
    # Enforced while streaming, before the body is buffered or spooled.
    max_request_mb: int = 60
    max_email_attachments: int = 20

    # --- Business rules ---------------------------------------------------
    # Used only when the document does not print its own VAT rate.
    default_vat_rate: float = 18.0
    # Absolute tolerance (in currency units) for rounding differences.
    amount_tolerance: float = 1.0
    # Timestamps in the workbook are shown in the finance team's local time.
    timezone: str = "Asia/Jerusalem"

    # --- Security ---------------------------------------------------------
    # When set, inbound-email webhooks must send header ``X-Inbound-Token``.
    inbound_email_token: str = ""
    # When set, every Backoffice API route requires header ``X-API-Key`` (or
    # ``?api_key=`` for plain links such as downloads / previews). Empty keeps
    # the local-demo behaviour; set it before exposing the API beyond localhost.
    backoffice_api_key: str = ""

    @property
    def gemini_model_chain(self) -> List[str]:
        """``GEMINI_MODELS`` (comma separated) as an ordered list."""
        return [m.strip() for m in self.gemini_models.split(",") if m.strip()]

    @property
    def has_real_provider(self) -> bool:
        """True when at least one real LLM provider has credentials."""
        return bool(self.gemini_api_key.strip() or self.openai_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    """Returns the process-wide settings singleton."""
    return Settings()
