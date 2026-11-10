"""Pydantic schemas for authentication payloads, profiles, and administration.

Defines the contract for user profile synchronization, state introspection,
and administrator approval endpoints.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from models.user import UserRole, UserStatus


class SyncProfileRequest(BaseModel):
    """Payload sent by client after Supabase registration to synchronize profile."""

    model_config = ConfigDict(extra="ignore")

    full_name: str = Field(default="", description="Full display name of the registered user.")


class UserProfileResponse(BaseModel):
    """Public representation of an authenticated user profile."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique UUID identifier from Supabase auth.users.")
    email: str = Field(..., description="User email address.")
    full_name: str = Field(default="", description="User display name.")
    role: UserRole = Field(..., description="Access authorization role.")
    status: UserStatus = Field(..., description="Account lifecycle approval state.")
    created_at: datetime = Field(..., description="UTC registration timestamp.")
    approved_at: Optional[datetime] = Field(default=None, description="UTC approval timestamp.")
    approved_by_id: Optional[str] = Field(default=None, description="Approving admin identifier.")


class UpdateUserStatusRequest(BaseModel):
    """Payload submitted by administrator to update user approval status."""

    model_config = ConfigDict(extra="forbid")

    status: UserStatus = Field(..., description="Target status (APPROVED, REJECTED, SUSPENDED).")
    notes: Optional[str] = Field(default=None, description="Optional administrative notes or reasoning.")


class AdminUserListResponse(BaseModel):
    """List response returned for administrator user management."""

    model_config = ConfigDict(from_attributes=True)

    users: List[UserProfileResponse] = Field(..., description="List of user profiles.")
    total: int = Field(..., description="Total count of returned user records.")
