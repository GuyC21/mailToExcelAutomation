"""Business service for user management, approval workflows, and Supabase synchronization.

Coordinates database persistence with Supabase GoTrue Admin REST APIs to propagate
authorization roles and approval statuses into issued JWT tokens.
"""
import logging
from typing import List, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.user import UserProfile, UserRole, UserStatus
import repositories.user_repository as user_repo

logger = logging.getLogger("billingstream.auth")


async def sync_supabase_app_metadata(user_id: str, status: UserStatus, role: UserRole) -> bool:
    """Updates the user's app_metadata in Supabase using the Service Role secret.

    Modifying app_metadata on the Supabase GoTrue server ensures that subsequent
    JWTs issued by Supabase embed the updated approval status and role directly
    in the cryptographic token claims.

    Args:
        user_id: Unique UUID of the user in Supabase auth.users.
        status: Target approval status to set in app_metadata.
        role: Target role to set in app_metadata.

    Returns:
        True if Supabase was successfully updated or if running in offline mode.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.info("Supabase credentials not configured; skipped remote app_metadata sync for user %s", user_id)
        return True

    endpoint = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "app_metadata": {
            "status": status.value.lower(),
            "role": role.value.lower(),
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.put(endpoint, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.error(
                    "Failed to sync Supabase metadata for %s: %s %s",
                    user_id,
                    response.status_code,
                    response.text,
                )
                return False
            logger.info("Successfully updated Supabase app_metadata for user %s (status=%s)", user_id, status.value)
            return True
    except Exception as exc:
        logger.exception("Network error while syncing Supabase metadata for user %s: %s", user_id, exc)
        return False


async def approve_user(
    db: AsyncSession,
    user_id: str,
    approver_id: str,
) -> Optional[UserProfile]:
    """Approves a pending user account and syncs state to Supabase.

    Args:
        db: Active asynchronous database session.
        user_id: Unique UUID of the user to approve.
        approver_id: UUID of the administrator granting approval.

    Returns:
        The updated UserProfile instance, or None if user not found.
    """
    updated_user = await user_repo.update_user_status(
        db,
        user_id=user_id,
        status=UserStatus.APPROVED,
        approver_id=approver_id,
    )
    if updated_user:
        await sync_supabase_app_metadata(user_id, updated_user.status, updated_user.role)
    return updated_user


async def reject_user(
    db: AsyncSession,
    user_id: str,
    approver_id: str,
) -> Optional[UserProfile]:
    """Rejects a user account and syncs state to Supabase.

    Args:
        db: Active asynchronous database session.
        user_id: Unique UUID of the user to reject.
        approver_id: UUID of the administrator rejecting the account.

    Returns:
        The updated UserProfile instance, or None if user not found.
    """
    updated_user = await user_repo.update_user_status(
        db,
        user_id=user_id,
        status=UserStatus.REJECTED,
        approver_id=approver_id,
    )
    if updated_user:
        await sync_supabase_app_metadata(user_id, updated_user.status, updated_user.role)
    return updated_user


async def list_users(
    db: AsyncSession,
    status_filter: Optional[UserStatus] = None,
) -> List[UserProfile]:
    """Lists user profiles, optionally filtered by status.

    Args:
        db: Active asynchronous database session.
        status_filter: Optional UserStatus filter.

    Returns:
        List of UserProfile instances.
    """
    return await user_repo.list_user_profiles(db, status_filter=status_filter)
