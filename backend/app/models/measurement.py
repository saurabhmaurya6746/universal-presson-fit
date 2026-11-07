import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, Any
from sqlalchemy import String, Boolean, DateTime, CheckConstraint, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .user import User

class MeasurementProfile(Base):
    """
    Personal measurement profile model.
    Stores numerical finger width measurements in millimeters and calibration metadata.
    PRIVACY GUARANTEE: Never stores raw hand photos, uploaded images, or biometric binaries.
    """
    __tablename__ = "measurement_profiles"
    __table_args__ = (
        CheckConstraint(
            "hand_side IN ('left', 'right', 'both')",
            name="ck_measurements_hand_side",
        ),
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
    profile_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    hand_side: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
    )
    measurements: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
    calibration_data: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    coin_verified: Mapped[bool] = mapped_column(
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
    user: Mapped["User"] = relationship("User", back_populates="measurement_profiles")

    @property
    def nickname(self) -> str:
        return self.profile_name

    @nickname.setter
    def nickname(self, value: str) -> None:
        self.profile_name = value
