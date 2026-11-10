"""Data access repository for user profiles and status management.

Encapsulates all database persistence and querying operations for the UserProfile model.
"""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.user import UserProfile, UserRole, UserStatus


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[UserProfile]:
    """Retrieves a user profile by unique UUID identifier.

    Args:
        db: Active asynchronous database session.
        user_id: Unique UUID identifier string.

    Returns:
        The matching UserProfile instance, or None if not found.
    """
    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    return result.scalars().first()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[UserProfile]:
    """Retrieves a user profile by case-insensitive email address.

    Args:
        db: Active asynchronous database session.
        email: Email address to search for.

    Returns:
        The matching UserProfile instance, or None if not found.
    """
    normalized = email.strip().lower()
    result = await db.execute(select(UserProfile).where(UserProfile.email == normalized))
    return result.scalars().first()


async def has_approved_admin(db: AsyncSession) -> bool:
    """Checks whether at least one approved administrator exists in the system.

    Excludes the initial dummy seed placeholder UUID if it has not been claimed.

    Args:
        db: Active asynchronous database session.

    Returns:
        True if an active, approved admin user exists.
    """
    result = await db.execute(
        select(UserProfile.id).where(
            UserProfile.role == UserRole.ADMIN,
            UserProfile.status == UserStatus.APPROVED,
            UserProfile.id != "00000000-0000-0000-0000-000000000001",
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def upsert_user_profile(
    db: AsyncSession,
    user_id: str,
    email: str,
    full_name: str,
    role: UserRole = UserRole.USER,
    status: UserStatus = UserStatus.PENDING,
) -> UserProfile:
    """Inserts a new user profile or updates existing non-status profile metadata.

    Args:
        db: Active asynchronous database session.
        user_id: Unique UUID from Supabase auth.users.
        email: User email address.
        full_name: User display name.
        role: Initial user role (defaults to USER).
        status: Initial user approval status (defaults to PENDING).

    Returns:
        The created or updated UserProfile instance.
    """
    existing = await get_user_by_id(db, user_id)
    normalized_email = email.strip().lower()

    if existing:
        existing.email = normalized_email
        if full_name:
            existing.full_name = full_name
        existing.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return existing

    profile = UserProfile(
        id=user_id,
        email=normalized_email,
        full_name=full_name,
        role=role,
        status=status,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def list_user_profiles(
    db: AsyncSession,
    status_filter: Optional[UserStatus] = None,
) -> List[UserProfile]:
    """Lists registered user profiles, optionally filtered by approval status.

    Args:
        db: Active asynchronous database session.
        status_filter: Optional UserStatus enum to filter users by.

    Returns:
        List of UserProfile entities ordered chronologically by creation date.
    """
    query = select(UserProfile).order_by(UserProfile.created_at.desc())
    if status_filter is not None:
        query = query.where(UserProfile.status == status_filter)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_user_status(
    db: AsyncSession,
    user_id: str,
    status: UserStatus,
    approver_id: Optional[str] = None,
) -> Optional[UserProfile]:
    """Updates the lifecycle status of a user account.

    Args:
        db: Active asynchronous database session.
        user_id: Unique UUID string of the target user.
        status: Target UserStatus to transition into.
        approver_id: Optional UUID of the administrator performing the action.

    Returns:
        The updated UserProfile instance, or None if target user was not found.
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        return None

    user.status = status
    user.updated_at = datetime.now(timezone.utc)
    if status == UserStatus.APPROVED:
        user.approved_at = datetime.now(timezone.utc)
        user.approved_by_id = approver_id

    await db.commit()
    await db.refresh(user)
    return user
