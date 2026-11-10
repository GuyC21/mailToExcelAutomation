"""SQLAlchemy model for user profiles and approval states.

This module maps application users authenticated via Supabase GoTrue to their local
profile representation, tracking authorization roles (USER, ADMIN) and lifecycle
approval states (PENDING, APPROVED, REJECTED, SUSPENDED).
"""
import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import relationship

from database import Base


class UserRole(str, enum.Enum):
    """Authorization roles within the BillingStream system."""

    ADMIN = "ADMIN"
    USER = "USER"


class UserStatus(str, enum.Enum):
    """Lifecycle states for registered user accounts."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class UserProfile(Base):
    """Local user profile tied to a Supabase authentication record.

    Attributes:
        id: Unique UUID string matching Supabase auth.users.id.
        email: Unique user email address.
        full_name: User display name.
        role: Access role (ADMIN or USER).
        status: Lifecycle approval status (PENDING, APPROVED, REJECTED, SUSPENDED).
        created_at: UTC timestamp when the user registered.
        updated_at: UTC timestamp of the latest profile modification.
        approved_at: UTC timestamp when the administrator approved the account.
        approved_by_id: UUID of the administrator who approved the account.
    """

    __tablename__ = "user_profiles"

    id: str = Column(String(36), primary_key=True, index=True)
    email: str = Column(String(255), unique=True, index=True, nullable=False)
    full_name: str = Column(String(150), nullable=False, default="")
    role: UserRole = Column(
        Enum(UserRole, name="user_role", native_enum=False),
        nullable=False,
        default=UserRole.USER,
    )
    status: UserStatus = Column(
        Enum(UserStatus, name="user_status", native_enum=False),
        nullable=False,
        default=UserStatus.PENDING,
        index=True,
    )
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    approved_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    approved_by_id: Optional[str] = Column(
        String(36),
        ForeignKey("user_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )

    approver = relationship("UserProfile", remote_side=[id], foreign_keys=[approved_by_id])
