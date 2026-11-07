import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Text, DateTime, CheckConstraint, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .brand import Brand

class BrandTrial(Base):
    """
    Brand studio trial period tracking model.
    Supports signup start and ten-day duration.
    Does not encode automated expiry consequences or payments.
    """
    __tablename__ = "brand_trials"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'ending_soon', 'expired', 'extended', 'converted')",
            name="ck_brand_trials_status",
        ),
        CheckConstraint(
            "renewal_intent IN ('yes', 'no', 'pending', 'not_asked')",
            name="ck_brand_trials_renewal_intent",
        ),
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
        unique=True,
        index=True,
    )
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="active",
    )
    renewal_intent: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="not_asked",
    )
    selected_plan: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="growth",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
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

    # Relationship
    brand: Mapped["Brand"] = relationship("Brand", back_populates="trial")
