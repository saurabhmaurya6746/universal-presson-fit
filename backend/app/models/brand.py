import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional, Any
from sqlalchemy import String, Boolean, Text, DateTime, CheckConstraint, UniqueConstraint, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .user import User
    from .chart import SizingChart
    from .trial import BrandTrial

class Brand(Base):
    """
    Brand studio entity.
    Represents partner press-on nail studios and brands.
    """
    __tablename__ = "brands"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'pending_review', 'rejected', 'suspended', 'demo_sample')",
            name="ck_brands_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    tagline: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    contact_person: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    contact_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    website: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    instagram: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    city: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    country: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="India",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending_review",
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    shapes: Mapped[List[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    logo_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    is_official: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
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
    owner: Mapped["User"] = relationship("User", back_populates="owned_brands")
    members: Mapped[List["BrandMember"]] = relationship(
        "BrandMember",
        back_populates="brand",
        cascade="all, delete-orphan",
    )
    chart: Mapped[Optional["SizingChart"]] = relationship(
        "SizingChart",
        back_populates="brand",
        uselist=False,
        cascade="all, delete-orphan",
    )
    trial: Mapped[Optional["BrandTrial"]] = relationship(
        "BrandTrial",
        back_populates="brand",
        uselist=False,
        cascade="all, delete-orphan",
    )

class BrandMember(Base):
    """
    Brand studio membership linking users to brands.
    Supports 'owner' and 'manager' roles per legacy schema.
    """
    __tablename__ = "brand_members"
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'manager')", name="ck_brand_members_role"),
        UniqueConstraint("brand_id", "user_id", name="uq_brand_members_brand_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="owner",
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
    brand: Mapped["Brand"] = relationship("Brand", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="memberships")
