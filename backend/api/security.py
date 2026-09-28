"""Access control for the Backoffice API and the inbound-email webhook.

Two independent shared secrets, both optional so the local demo keeps working
with zero configuration:

* ``BACKOFFICE_API_KEY`` gates every Backoffice route (prompts, documents,
  Excel, dashboard, regression, sandbox). Clients send it as ``X-API-Key``;
  plain links that cannot carry headers (Excel download, document previews in
  an ``<iframe>``/``<img>``) may pass ``?api_key=`` instead.
* ``INBOUND_EMAIL_TOKEN`` gates the email webhook (``X-Inbound-Token``), which
  mail providers call directly. The Backoffice key is also accepted there so
  the Sandbox's email composer keeps working when both are configured.

This is a shared-secret gate for a single-team deployment, not per-user
authentication: anyone holding the key has full Backoffice rights.
"""
import secrets
from typing import Optional

from fastapi import Header, HTTPException, Query

from config import get_settings


def _matches(expected: str, provided: Optional[str]) -> bool:
    """Constant-time comparison; an unset secret never matches."""
    return bool(expected) and provided is not None and secrets.compare_digest(
        expected.encode("utf-8"), provided.encode("utf-8"))


def require_backoffice_key(
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None, include_in_schema=False),
) -> None:
    """FastAPI dependency: enforces ``BACKOFFICE_API_KEY`` when it is set.

    Raises:
        HTTPException: 401 when a key is configured and the request lacks it.
    """
    expected = get_settings().backoffice_api_key
    if not expected:
        return
    if _matches(expected, x_api_key) or _matches(expected, api_key):
        return
    raise HTTPException(status_code=401, detail="נדרש מפתח גישה (X-API-Key)")


def require_inbound_access(
    x_inbound_token: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
) -> None:
    """FastAPI dependency for the email webhook.

    Open only when neither secret is configured. Otherwise a valid inbound
    token (mail provider) or Backoffice key (Sandbox UI) is required.

    Raises:
        HTTPException: 401 when a secret is configured and none matches.
    """
    settings = get_settings()
    inbound, backoffice = settings.inbound_email_token, settings.backoffice_api_key
    if not inbound and not backoffice:
        return
    if _matches(inbound, x_inbound_token) or _matches(backoffice, x_api_key):
        return
    raise HTTPException(status_code=401, detail="Invalid inbound token")
