"""Unit tests verifying security, BYOK isolation, and layering fixes."""
from email.message import EmailMessage
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from api.dependencies.auth import get_current_user
from api.rate_limit import RateLimiter
from api.routes import dashboard
from api.security import require_inbound_access
from config import get_settings
from models.user import UserProfile, UserRole, UserStatus
from schemas.prompt import EnhanceRequest, PromptCreate
from services import file_storage, llm_service
from services.auth import user_service
from services.email_parser import parse_eml
from services.extraction.providers import gemini_provider


def _run_coro(coro):
    """Drives a pure in-memory coroutine without opening an OS event-loop socketpair."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()
    raise AssertionError("Coroutine yielded unexpectedly for I/O in a synchronous unit test")


def test_forged_admin_jwt_rejected_with_and_without_secret(monkeypatch):
    """Unverified or forged JWTs must always be rejected (Strategy D removed)."""
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_jwt_secret", "real-secret-key-32-chars-minimum")
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "backoffice_api_key", "")
    monkeypatch.setattr(settings, "initial_admin_email", "admin@billingstream.local")

    forged = jwt.encode(
        {"sub": "attacker-id", "email": "admin@billingstream.local", "exp": 9999999999},
        "attacker-wrong-secret",
        algorithm="HS256",
    )
    mock_db = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        _run_coro(get_current_user(authorization=f"Bearer {forged}", db=mock_db))
    assert exc_info.value.status_code == 401
    assert "טוקן התחברות לא תקין" in exc_info.value.detail

    # Even when secret & supabase_url are cleared, an unverified JWT must fail closed
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")
    with pytest.raises(HTTPException) as exc_unverified:
        _run_coro(get_current_user(authorization=f"Bearer {forged}", db=mock_db))
    assert exc_unverified.value.status_code == 401

    # Query-string ?token= must never be accepted for JWT auth
    monkeypatch.setattr(settings, "supabase_jwt_secret", "real-secret-key-32-chars-minimum")
    valid = jwt.encode(
        {"sub": "user-1", "email": "u1@example.com", "exp": 9999999999},
        "real-secret-key-32-chars-minimum",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_qs:
        _run_coro(get_current_user(authorization=None, token=valid, db=mock_db))
    assert exc_qs.value.status_code == 401


def test_fail_closed_default_and_explicit_test_opt_in(monkeypatch):
    """Unconfigured auth fails closed with 503 unless auth_disabled_for_tests is True."""
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "backoffice_api_key", "")
    monkeypatch.setattr(settings, "inbound_email_token", "")
    monkeypatch.setattr(settings, "auth_disabled_for_tests", False)

    mock_db = AsyncMock()
    with pytest.raises(HTTPException) as exc_auth:
        _run_coro(get_current_user(authorization=None, x_api_key=None, token=None, api_key=None, db=mock_db))
    assert exc_auth.value.status_code == 503

    with pytest.raises(HTTPException) as exc_webhook:
        require_inbound_access(x_inbound_token=None, x_api_key=None)
    assert exc_webhook.value.status_code == 503

    # Test fixture opt-in allows unconfigured offline runs until a key is set
    monkeypatch.setattr(settings, "auth_disabled_for_tests", True)
    demo_user = _run_coro(
        get_current_user(authorization=None, x_api_key=None, token=None, api_key=None, db=mock_db)
    )
    assert demo_user.id == "local-demo-user"
    assert demo_user.status == UserStatus.APPROVED

    monkeypatch.setattr(settings, "backoffice_api_key", "s3cret")
    with pytest.raises(HTTPException) as exc_info:
        _run_coro(get_current_user(authorization=None, x_api_key=None, token=None, api_key=None, db=mock_db))
    assert exc_info.value.status_code == 401


def test_gemini_provider_isolates_api_key_configuration(monkeypatch):
    """Constructing a scoped GeminiProvider must not overwrite process-wide credentials prematurely."""
    configured_keys = []

    class TrackingGenai:
        types = SimpleNamespace(GenerationConfig=lambda **kw: kw)

        def configure(self, api_key):
            configured_keys.append(api_key)

        def upload_file(self, path, mime_type):
            return SimpleNamespace(name="files/1")

        def delete_file(self, name):
            pass

        def GenerativeModel(self, name, system_instruction):
            class Model:
                def generate_content(self, parts, generation_config):
                    return SimpleNamespace(text=json.dumps({"supplier_name": "ספק", "total_amount": 10}))

            return Model()

    monkeypatch.setattr(gemini_provider, "genai", TrackingGenai())

    server_provider = gemini_provider.GeminiProvider("server-key", ["m1"])
    byok_provider = gemini_provider.GeminiProvider("user-byok-key", ["m1"])
    assert configured_keys == []

    server_provider.extract("sys", "f.pdf", "application/pdf")
    byok_provider.extract("sys", "f.pdf", "application/pdf")
    server_provider.extract("sys", "f.pdf", "application/pdf")
    assert configured_keys == ["server-key", "user-byok-key", "server-key"]


def test_enhance_prompt_text_enforces_byok_isolation(monkeypatch):
    """enhance_prompt_text must ignore server keys when no BYOK key is passed."""
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", "server-secret-key")
    monkeypatch.setattr(settings, "openai_api_key", "server-openai-key")

    offline_result = _run_coro(llm_service.enhance_prompt_text("חלץ ספק ותאריך"))
    assert "BillingStream" in offline_result

    async def immediate_to_thread(fn, *args, **kwargs):
        return fn(*args, **kwargs)

    seen = []

    def fake_gemini_enhance(rough_text: str, api_key: str) -> str:
        seen.append(api_key)
        return f"enhanced:{rough_text}"

    monkeypatch.setattr(llm_service.asyncio, "to_thread", immediate_to_thread)
    monkeypatch.setattr(llm_service, "_gemini_enhance", fake_gemini_enhance)

    byok_result = _run_coro(llm_service.enhance_prompt_text("טקסט", gemini_api_key="user-byok-gemini"))
    assert byok_result == "enhanced:טקסט"
    assert seen == ["user-byok-gemini"]


def test_admin_cannot_suspend_self_and_suspend_syncs_supabase():
    """Administrators cannot suspend/reject themselves, and suspending another user syncs Supabase."""
    mock_db = AsyncMock()
    with pytest.raises(ValueError):
        _run_coro(
            user_service.change_user_status(
                db=mock_db,
                user_id="admin-1",
                status=UserStatus.SUSPENDED,
                approver_id="admin-1",
            )
        )

    suspended_user = UserProfile(
        id="user-2",
        email="user2@billingstream.local",
        full_name="User Two",
        role=UserRole.USER,
        status=UserStatus.SUSPENDED,
    )
    with patch("repositories.user_repository.update_user_status", new_callable=AsyncMock) as mock_update, \
         patch("services.auth.user_service.sync_supabase_app_metadata", new_callable=AsyncMock) as mock_sync:
        mock_update.return_value = suspended_user
        mock_sync.return_value = True

        result = _run_coro(
            user_service.change_user_status(
                db=mock_db,
                user_id="user-2",
                status=UserStatus.SUSPENDED,
                approver_id="admin-1",
            )
        )
        assert result is not None and result.status == UserStatus.SUSPENDED
        mock_sync.assert_awaited_once_with("user-2", UserStatus.SUSPENDED, UserRole.USER)


def test_resolve_inbox_file_confines_paths_and_deletes_safely(monkeypatch, tmp_path):
    """resolve_inbox_file rejects traversal/missing files and confines deletions to inbox_dir."""
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("secret", encoding="utf-8")
    valid = inbox / "invoice.pdf"
    valid.write_bytes(b"%PDF-1.4\n")

    monkeypatch.setattr(get_settings(), "inbox_dir", str(inbox))

    assert file_storage.resolve_inbox_file(str(outside)) is None
    assert file_storage.resolve_inbox_file(str(inbox / "missing.pdf")) is None
    assert file_storage.resolve_inbox_file(str(valid)) == str(valid.resolve())
    assert file_storage.delete_stored_document(str(outside)) is False
    assert outside.exists()
    assert file_storage.delete_stored_document(str(valid)) is True
    assert not valid.exists()


def test_parse_eml_enforces_attachment_size_limit():
    """parse_eml flags attachments exceeding max_attachment_bytes as oversized."""
    msg = EmailMessage()
    msg["From"] = "supplier@example.com"
    msg["To"] = "invoices@billingstream.local"
    msg["Subject"] = "Test"
    msg.set_content("Body")
    msg.add_attachment(b"%PDF-1.4" + b"0" * 200, maintype="application", subtype="pdf", filename="large.pdf")

    payload = parse_eml(msg.as_bytes(), max_attachment_bytes=50)
    assert len(payload.attachments) == 1
    assert payload.attachments[0].oversized is True
    assert payload.attachments[0].content == b""


def test_prompt_schemas_reject_blank_inputs():
    """PromptCreate and EnhanceRequest reject whitespace-only strings."""
    with pytest.raises(ValidationError):
        PromptCreate(name="   ", content="valid content")
    with pytest.raises(ValidationError):
        PromptCreate(name="valid", content="   ")
    with pytest.raises(ValidationError):
        EnhanceRequest(text="   ")


def test_dashboard_treats_user_email_simulations_as_test_records():
    """Sandbox BYOK email simulations (created_by_id set) stay out of operational metrics."""
    prod_webhook = SimpleNamespace(channel="email", provider="gemini", created_by_id=None)
    user_sim = SimpleNamespace(channel="email", provider="gemini", created_by_id="user-123")
    sandbox_upload = SimpleNamespace(channel="sandbox", provider="openai", created_by_id="user-123")

    assert dashboard.is_test_record(prod_webhook) is False
    assert dashboard.is_test_record(user_sim) is True
    assert dashboard.is_test_record(sandbox_upload) is True


def test_sync_user_display_name_handles_transient_identities():
    """Transient system/demo identities update in memory without failing db.refresh()."""
    mock_db = AsyncMock()
    transient = UserProfile(
        id="system-api-key",
        email="system@billingstream.local",
        full_name="System API Key",
        role=UserRole.ADMIN,
        status=UserStatus.APPROVED,
    )
    updated = _run_coro(user_service.sync_user_display_name(mock_db, transient, "Automated Bot"))
    assert updated.full_name == "Automated Bot"
    mock_db.refresh.assert_not_called()


def test_rate_limiter_enforces_window_cap():
    """RateLimiter permits traffic up to max_requests and rejects excess with 429."""
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    limiter.check("caller-a", now=100.0)
    limiter.check("caller-a", now=110.0)
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("caller-a", now=120.0)
    assert exc_info.value.status_code == 429

    # Once the first timestamp leaves the 60s window, the next call succeeds
    limiter.check("caller-a", now=161.0)
