"""Unit tests for JWT verification, role authorization, and administrator approvals.

Executes completely in-memory with zero external database dependencies or test plugins.
"""
import asyncio
import os
import sys
import time
from typing import Dict, Any
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from fastapi import HTTPException

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.dependencies.auth import get_current_user, require_approved_user, require_admin
from config import get_settings
from models.user import UserProfile, UserRole, UserStatus
import services.auth.user_service as user_svc

TEST_SECRET = "billingstream-unit-test-secret-key-32chars"


@pytest.fixture(autouse=True)
def setup_auth_settings(monkeypatch):
    monkeypatch.setattr(get_settings(), "supabase_jwt_secret", TEST_SECRET)
    monkeypatch.setattr(get_settings(), "initial_admin_email", "admin@billingstream.local")


def create_token(
    user_id: str,
    email: str,
    secret: str = TEST_SECRET,
    expired: bool = False,
    full_name: str = "Test User",
) -> str:
    """Creates a test JWT conforming to Supabase GoTrue claims."""
    exp = int(time.time()) - 300 if expired else int(time.time()) + 3600
    payload: Dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "exp": exp,
        "user_metadata": {"full_name": full_name},
        "app_metadata": {"role": "user", "status": "pending"},
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_missing_token_raises_401():
    """Requests lacking both Bearer token and Backoffice key must raise 401."""
    async def _test():
        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=None, x_api_key=None, token=None, api_key=None, db=mock_db)
        assert exc_info.value.status_code == 401
        assert "נדרשת התחברות למערכת" in exc_info.value.detail
    asyncio.run(_test())


def test_expired_token_raises_401():
    """Expired JWT tokens must be rejected with 401."""
    async def _test():
        mock_db = AsyncMock()
        token = create_token("user-expired", "exp@example.com", expired=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=f"Bearer {token}", db=mock_db)
        assert exc_info.value.status_code == 401
        assert "פג תוקף" in exc_info.value.detail
    asyncio.run(_test())


def test_tampered_token_signature_raises_401():
    """Tokens signed with an invalid secret must be rejected."""
    async def _test():
        mock_db = AsyncMock()
        token = create_token("user-fake", "fake@example.com", secret="invalid-secret")
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=f"Bearer {token}", db=mock_db)
        assert exc_info.value.status_code == 401
        assert "טוקן התחברות לא תקין" in exc_info.value.detail
    asyncio.run(_test())


def test_pending_user_blocked_by_require_approved_user():
    """Users in PENDING status must be rejected by require_approved_user with 403."""
    async def _test():
        pending_user = UserProfile(
            id="pending-id",
            email="pending@billingstream.local",
            full_name="User Pending",
            role=UserRole.USER,
            status=UserStatus.PENDING,
        )
        with pytest.raises(HTTPException) as exc_info:
            await require_approved_user(current_user=pending_user)
        assert exc_info.value.status_code == 403
        assert "ממתין לאישור מנהל מערכת" in exc_info.value.detail
    asyncio.run(_test())


def test_rejected_user_blocked_by_require_approved_user():
    """Users in REJECTED status must be rejected with 403."""
    async def _test():
        rejected_user = UserProfile(
            id="rejected-id",
            email="rejected@billingstream.local",
            full_name="User Rejected",
            role=UserRole.USER,
            status=UserStatus.REJECTED,
        )
        with pytest.raises(HTTPException) as exc_info:
            await require_approved_user(current_user=rejected_user)
        assert exc_info.value.status_code == 403
        assert "נדחה" in exc_info.value.detail
    asyncio.run(_test())


def test_approved_user_passes_require_approved_user():
    """Approved users must pass the approval check without error."""
    async def _test():
        approved_user = UserProfile(
            id="approved-id",
            email="approved@billingstream.local",
            full_name="User Approved",
            role=UserRole.USER,
            status=UserStatus.APPROVED,
        )
        result = await require_approved_user(current_user=approved_user)
        assert result.id == "approved-id"
        assert result.status == UserStatus.APPROVED
    asyncio.run(_test())


def test_non_admin_blocked_by_require_admin():
    """Approved users without ADMIN role must be rejected by require_admin with 403."""
    async def _test():
        approved_regular_user = UserProfile(
            id="regular-id",
            email="regular@billingstream.local",
            full_name="Regular User",
            role=UserRole.USER,
            status=UserStatus.APPROVED,
        )
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(current_user=approved_regular_user)
        assert exc_info.value.status_code == 403
        assert "ממתין" not in exc_info.value.detail
        assert "מנהלי מערכת בלבד" in exc_info.value.detail
    asyncio.run(_test())


def test_admin_passes_require_admin():
    """Approved users with ADMIN role must successfully pass require_admin."""
    async def _test():
        admin_user = UserProfile(
            id="admin-id",
            email="admin@billingstream.local",
            full_name="System Administrator",
            role=UserRole.ADMIN,
            status=UserStatus.APPROVED,
        )
        result = await require_admin(current_user=admin_user)
        assert result.role == UserRole.ADMIN
        assert result.status == UserStatus.APPROVED
    asyncio.run(_test())


def test_approve_user_service_workflow():
    """Tests approving a user updates status and calls metadata synchronization."""
    async def _test():
        mock_db = AsyncMock()
        user_to_approve = UserProfile(
            id="user-123",
            email="clerk@billingstream.local",
            full_name="Finance Clerk",
            role=UserRole.USER,
            status=UserStatus.PENDING,
        )

        with patch("repositories.user_repository.update_user_status", new_callable=AsyncMock) as mock_update, \
             patch("services.auth.user_service.sync_supabase_app_metadata", new_callable=AsyncMock) as mock_sync:
            
            user_to_approve.status = UserStatus.APPROVED
            mock_update.return_value = user_to_approve
            mock_sync.return_value = True

            updated = await user_svc.approve_user(
                db=mock_db,
                user_id="user-123",
                approver_id="admin-uuid",
            )

            assert updated is not None
            assert updated.status == UserStatus.APPROVED
            mock_update.assert_awaited_once_with(
                mock_db,
                user_id="user-123",
                status=UserStatus.APPROVED,
                approver_id="admin-uuid",
            )
            mock_sync.assert_awaited_once_with("user-123", UserStatus.APPROVED, UserRole.USER)
    asyncio.run(_test())


if __name__ == "__main__":
    get_settings().supabase_jwt_secret = TEST_SECRET
    get_settings().initial_admin_email = "admin@billingstream.local"

    print("Running test 1: test_missing_token_raises_401...")
    test_missing_token_raises_401()
    print("  -> Passed")

    print("Running test 2: test_expired_token_raises_401...")
    test_expired_token_raises_401()
    print("  -> Passed")

    print("Running test 3: test_tampered_token_signature_raises_401...")
    test_tampered_token_signature_raises_401()
    print("  -> Passed")

    print("Running test 4: test_pending_user_blocked_by_require_approved_user...")
    test_pending_user_blocked_by_require_approved_user()
    print("  -> Passed")

    print("Running test 5: test_rejected_user_blocked_by_require_approved_user...")
    test_rejected_user_blocked_by_require_approved_user()
    print("  -> Passed")

    print("Running test 6: test_approved_user_passes_require_approved_user...")
    test_approved_user_passes_require_approved_user()
    print("  -> Passed")

    print("Running test 7: test_non_admin_blocked_by_require_admin...")
    test_non_admin_blocked_by_require_admin()
    print("  -> Passed")

    print("Running test 8: test_admin_passes_require_admin...")
    test_admin_passes_require_admin()
    print("  -> Passed")

    print("Running test 9: test_approve_user_service_workflow...")
    test_approve_user_service_workflow()
    print("  -> Passed")

    print("\n=======================================================")
    print("ALL 9 AUTH & APPROVAL UNIT TESTS PASSED SUCCESSFULLY! ✓")
    print("=======================================================\n")
