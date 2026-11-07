import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Boolean, DateTime, CheckConstraint, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .brand import Brand, BrandMember
    from .measurement import MeasurementProfile

class User(Base):
    """
    Application User and Profile model.
    Represents authenticated platform users across personal, brand, and admin roles.
    """
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('personal', 'brand', 'admin')", name="ck_users_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="personal",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    owned_brands: Mapped[List["Brand"]] = relationship(
        "Brand",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    memberships: Mapped[List["BrandMember"]] = relationship(
        "BrandMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    measurement_profiles: Mapped[List["MeasurementProfile"]] = relationship(
        "MeasurementProfile",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    verification_tokens: Mapped[List["AuthVerificationToken"]] = relationship(
        "AuthVerificationToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )

class UserSession(Base):
    """
    Refresh token and session storage for application authentication.
    Stores only cryptographically hashed token secrets, tracks rotation families,
    and detects replay attacks.
    """
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    parent_token_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    replaced_by_token_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="sessions")

class AuthVerificationToken(Base):
    """
    Single-use verification and password reset tokens.
    Stores only cryptographically hashed token secrets (SHA-256).
    """
    __tablename__ = "auth_verification_tokens"
    __table_args__ = (
        CheckConstraint("purpose IN ('email_verification', 'password_reset')", name="ck_verification_tokens_purpose"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    purpose: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    is_consumed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="verification_tokens")
