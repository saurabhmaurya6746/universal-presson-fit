import uuid
from decimal import Decimal
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    String,
    Boolean,
    Text,
    Integer,
    Numeric,
    DateTime,
    CheckConstraint,
    Index,
    ForeignKey,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .brand import Brand

class SizingChart(Base):
    """
    Sizing chart header model.
    Enforces strictly ONE sizing chart per brand via unique=True on brand_id.
    Supports per_size (Format A) and width_ranges (Format B).
    """
    __tablename__ = "sizing_charts"
    __table_args__ = (
        CheckConstraint(
            "format IN ('per_size', 'width_ranges', 'preset_set', 'numbered_size', 'shape_range', 'length_only_numbered', 'PRESET_SET', 'NUMBERED_SIZE', 'SHAPE_RANGE', 'LENGTH_ONLY_NUMBERED')",
            name="ck_sizing_charts_format",
        ),
        CheckConstraint("status IN ('draft', 'published')", name="ck_sizing_charts_status"),
        CheckConstraint(
            "source_type IN ('manual', 'csv_upload', 'json_upload', 'preset')",
            name="ck_sizing_charts_source_type",
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
        unique=True,  # STRICT ONE CHART PER BRAND DATABASE CONSTRAINT
        index=True,
    )
    chart_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    format: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    unit: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="mm",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="draft",
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    custom_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    source_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    source_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    verification_status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="user_provided",
        server_default="user_provided",
    )
    is_official: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    source_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="manual",
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
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
    brand: Mapped["Brand"] = relationship("Brand", back_populates="chart")
    entries: Mapped[List["SizingChartEntry"]] = relationship(
        "SizingChartEntry",
        back_populates="chart",
        cascade="all, delete-orphan",
        order_by="SizingChartEntry.display_order",
    )

class SizingChartEntry(Base):
    """
    Individual size tier or width range row for a sizing chart.
    Validates positive millimeter values, valid range boundaries,
    and case-insensitive unique size labels per chart.
    """
    __tablename__ = "sizing_chart_entries"
    __table_args__ = (
        CheckConstraint(
            "(thumb_width_mm IS NULL OR thumb_width_mm > 0) AND "
            "(index_width_mm IS NULL OR index_width_mm > 0) AND "
            "(middle_width_mm IS NULL OR middle_width_mm > 0) AND "
            "(ring_width_mm IS NULL OR ring_width_mm > 0) AND "
            "(pinky_width_mm IS NULL OR pinky_width_mm > 0)",
            name="ck_entries_positive_finger_widths",
        ),
        CheckConstraint(
            "(min_width_mm IS NULL OR min_width_mm > 0) AND "
            "(max_width_mm IS NULL OR max_width_mm > 0)",
            name="ck_entries_positive_ranges",
        ),
        CheckConstraint(
            "min_width_mm IS NULL OR max_width_mm IS NULL OR min_width_mm <= max_width_mm",
            name="ck_entries_valid_range_bounds",
        ),
        CheckConstraint(
            "(min_length_mm IS NULL OR min_length_mm > 0) AND "
            "(max_length_mm IS NULL OR max_length_mm > 0)",
            name="ck_entries_positive_length_ranges",
        ),
        CheckConstraint(
            "min_length_mm IS NULL OR max_length_mm IS NULL OR min_length_mm <= max_length_mm",
            name="ck_entries_valid_length_bounds",
        ),
        CheckConstraint("width_mm IS NULL OR width_mm > 0", name="ck_entries_positive_width"),
        CheckConstraint("length_mm IS NULL OR length_mm > 0", name="ck_entries_positive_length"),
        CheckConstraint("thickness_mm IS NULL OR thickness_mm > 0", name="ck_entries_positive_thickness"),
        Index(
            "uq_chart_entries_chart_shape_size_lower",
            "chart_id",
            func.coalesce(func.lower(func.trim(func.cast("shape", Text))), ""),
            func.lower(func.trim(func.cast("size_label", Text))),
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    chart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sizing_charts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    size_label: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    shape: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    finger: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    typical_finger: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    length_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    min_length_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    max_length_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    thickness_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    is_approximate: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    thumb_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    index_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    middle_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    ring_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    pinky_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    min_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    max_width_mm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Relationships
    chart: Mapped["SizingChart"] = relationship("SizingChart", back_populates="entries")
