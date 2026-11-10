"""API endpoints for user authentication introspection and administrator approvals."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import get_current_user, require_admin
from database import get_db
from models.user import UserProfile, UserRole, UserStatus
from schemas.auth import (
    AdminUserListResponse,
    SyncProfileRequest,
    UpdateUserStatusRequest,
    UserProfileResponse,
)
import repositories.user_repository as user_repo
import services.auth.user_service as user_svc

router = APIRouter()


@router.post(
    "/auth/sync-profile",
    response_model=UserProfileResponse,
    summary="Synchronize user profile upon registration",
)
async def sync_profile(
    payload: SyncProfileRequest,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Synchronizes or updates the caller's display name after registration.

    Called by the frontend immediately after a successful Supabase signUp call
    to store full_name and ensure a local UserProfile record exists with PENDING status.

    Args:
        payload: Metadata payload containing the user's full name.
        current_user: The authenticated UserProfile resolved from the JWT.
        db: Active asynchronous database session.

    Returns:
        The synchronized UserProfileResponse.
    """
    if payload.full_name and payload.full_name != current_user.full_name:
        current_user.full_name = payload.full_name
        await db.commit()
        await db.refresh(current_user)

    return UserProfileResponse.model_validate(current_user)


@router.get(
    "/auth/me",
    response_model=UserProfileResponse,
    summary="Get current authenticated user profile and approval status",
)
async def get_me(
    current_user: UserProfile = Depends(get_current_user),
) -> UserProfileResponse:
    """Returns the caller's authenticated profile and current lifecycle approval status.

    Does not require APPROVED status so that pending or rejected users can inspect
    their state and be redirected to appropriate waiting screens.

    Args:
        current_user: The authenticated UserProfile resolved from the JWT.

    Returns:
        The caller's UserProfileResponse.
    """
    return UserProfileResponse.model_validate(current_user)


@router.get(
    "/admin/users",
    response_model=AdminUserListResponse,
    summary="List users for administrator review and approvals",
)
async def list_users(
    status: Optional[UserStatus] = Query(None, description="Filter by approval status"),
    _admin: UserProfile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListResponse:
    """Returns all registered users with their approval status.

    Restricted to system administrators.

    Args:
        status: Optional UserStatus filter (PENDING, APPROVED, REJECTED, SUSPENDED).
        _admin: Verifies that caller has role == ADMIN.
        db: Active asynchronous database session.

    Returns:
        AdminUserListResponse containing the list of user profiles.
    """
    users = await user_svc.list_users(db=db, status_filter=status)
    items = [UserProfileResponse.model_validate(u) for u in users]
    return AdminUserListResponse(users=items, total=len(items))


@router.patch(
    "/admin/users/{user_id}/status",
    response_model=UserProfileResponse,
    summary="Update a user's approval status (Approve, Reject, Suspend)",
)
async def update_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    admin: UserProfile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Updates a user's approval status and synchronizes metadata with Supabase.

    Restricted to system administrators.

    Args:
        user_id: Unique UUID of the target user.
        payload: Target status (APPROVED, REJECTED, SUSPENDED) and optional notes.
        admin: Verifies that caller has role == ADMIN.
        db: Active asynchronous database session.

    Returns:
        The updated UserProfileResponse.

    Raises:
        HTTPException: 404 if the target user was not found.
    """
    if payload.status == UserStatus.APPROVED:
        updated = await user_svc.approve_user(db=db, user_id=user_id, approver_id=admin.id)
    elif payload.status == UserStatus.REJECTED:
        updated = await user_svc.reject_user(db=db, user_id=user_id, approver_id=admin.id)
    else:
        updated = await user_repo.update_user_status(db=db, user_id=user_id, status=payload.status)

    if not updated:
        raise HTTPException(status_code=404, detail="המשתמש המבוקש לא נמצא")

    return UserProfileResponse.model_validate(updated)
