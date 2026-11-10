"""Automated test suite for Supabase JWT verification and Administrator Approval workflows."""
import time
from typing import Dict, Any
import jwt
import pytest
from fastapi.testclient import TestClient

from config import get_settings
from database import async_session
from main import app
from models.user import UserProfile, UserRole, UserStatus
import repositories.user_repository as user_repo

TEST_SECRET = "test-secret-key-for-billingstream-auth"


@pytest.fixture(autouse=True)
def setup_test_auth_env(monkeypatch):
    """Configures predictable secret keys and admin emails for testing."""
    monkeypatch.setattr(get_settings(), "supabase_jwt_secret", TEST_SECRET)
    monkeypatch.setattr(get_settings(), "initial_admin_email", "admin@billingstream.local")


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_jwt(
    sub: str,
    email: str,
    full_name: str = "User Test",
    secret: str = TEST_SECRET,
    expired: bool = False,
) -> str:
    """Generates a test JWT imitating Supabase GoTrue token format."""
    exp = int(time.time()) - 100 if expired else int(time.time()) + 3600
    payload: Dict[str, Any] = {
        "sub": sub,
        "email": email,
        "exp": exp,
        "user_metadata": {"full_name": full_name},
        "app_metadata": {"provider": "email"},
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_unauthenticated_request_is_rejected(client):
    """Backoffice routes must reject requests with no authorization header."""
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 401
    assert "נדרשת התחברות למערכת" in response.json()["detail"]


def test_invalid_signature_is_rejected(client):
    """Requests with tampered or mismatched JWT signature must return 401."""
    tampered_token = make_jwt("user-tampered", "tampered@example.com", secret="wrong-secret")
    response = client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert response.status_code == 401
    assert "טוקן התחברות לא תקין" in response.json()["detail"]


def test_expired_token_is_rejected(client):
    """Expired tokens must return 401 with a specific re-login notice."""
    expired_token = make_jwt("user-exp", "exp@example.com", expired=True)
    response = client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert "פג תוקף" in response.json()["detail"]


def test_pending_user_is_blocked_from_backoffice_but_can_inspect_me(client):
    """A registered user in PENDING status cannot access backoffice routes but can query /api/auth/me."""
    user_id = "user-pending-123"
    token = make_jwt(user_id, "pending@example.com", full_name="ישראל הממתין")

    # 1. Inspecting self profile via /api/auth/me succeeds
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_body = me_resp.json()
    assert me_body["id"] == user_id
    assert me_body["status"] == "PENDING"
    assert me_body["role"] == "USER"

    # 2. Accessing protected backoffice endpoints is blocked with 403
    blocked_resp = client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert blocked_resp.status_code == 403
    assert "ממתין לאישור מנהל מערכת" in blocked_resp.json()["detail"]


def test_admin_can_approve_pending_user_and_grant_access(client):
    """An admin can list users, approve a pending user, after which the user gains full access."""
    admin_id = "admin-uuid-001"
    admin_token = make_jwt(admin_id, "admin@billingstream.local", full_name="מנהל ראשי")

    user_id = "user-to-approve-456"
    user_token = make_jwt(user_id, "finance.clerk@example.com", full_name="פקיד כספים")

    # User initializes self
    client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})

    # Admin lists users
    list_resp = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_resp.status_code == 200
    users = list_resp.json()["users"]
    target = next((u for u in users if u["id"] == user_id), None)
    assert target is not None
    assert target["status"] == "PENDING"

    # Admin approves user
    approve_resp = client.patch(
        f"/api/admin/users/{user_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "APPROVED"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    # User now has access to the protected route!
    access_resp = client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert access_resp.status_code == 200


def test_non_admin_cannot_access_admin_endpoints(client):
    """Standard users (even if approved) cannot access administrator management endpoints."""
    user_id = "approved-regular-user-789"
    user_token = make_jwt(user_id, "regular@example.com")

    # Seed as approved regular user
    client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    admin_token = make_jwt("admin-boss", "admin@billingstream.local")
    client.patch(
        f"/api/admin/users/{user_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "APPROVED"},
    )

    # Attempt to access admin routes with regular user
    admin_resp = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert admin_resp.status_code == 403
    assert "מנהלי מערכת בלבד" in admin_resp.json()["detail"]


def test_rejected_user_is_blocked(client):
    """A rejected user is blocked with a 403 notice."""
    admin_token = make_jwt("admin-boss-2", "admin@billingstream.local")
    user_id = "user-rejected-999"
    user_token = make_jwt(user_id, "spam@example.com")

    # Create user
    client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})

    # Reject user
    client.patch(
        f"/api/admin/users/{user_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "REJECTED"},
    )

    # Request rejected
    resp = client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403
    assert "נדחה" in resp.json()["detail"]
