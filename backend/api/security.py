"""Access control for the inbound-email webhook.

The webhook gate fails closed in normal operation: unless ``INBOUND_EMAIL_TOKEN``
or ``BACKOFFICE_API_KEY`` is configured (or ``AUTH_DISABLED_FOR_TESTS=true`` in
isolated offline tests), incoming webhook calls are rejected with HTTP 503.
When configured, callers authenticate via ``X-Inbound-Token`` (or ``X-API-Key``).
"""
import secrets
from typing import Optional

from fastapi import Header, HTTPException

from config import get_settings


def _matches(expected: str, provided: Optional[str]) -> bool:
    """Constant-time comparison; an unset secret never matches."""
    return (
        bool(expected)
        and isinstance(provided, str)
        and secrets.compare_digest(expected.encode("utf-8"), provided.encode("utf-8"))
    )


def require_inbound_access(
    x_inbound_token: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
) -> None:
    """FastAPI dependency for the email webhook (fail-closed by default).

    Requires a matching ``X-Inbound-Token`` or ``X-API-Key``. Rejects with 503
    if no webhook secret is configured unless ``auth_disabled_for_tests`` is
    explicitly enabled in offline test fixtures.

    Raises:
        HTTPException: 401 when credentials fail, or 503 when unconfigured.
    """
    settings = get_settings()
    inbound, backoffice = settings.inbound_email_token, settings.backoffice_api_key
    if not inbound and not backoffice:
        if settings.auth_disabled_for_tests:
            return
        raise HTTPException(status_code=503, detail="טוקן אימות ל-Webhook אינו מוגדר בשרת")
    if _matches(inbound, x_inbound_token) or _matches(backoffice, x_api_key):
        return
    raise HTTPException(status_code=401, detail="Invalid inbound token")
