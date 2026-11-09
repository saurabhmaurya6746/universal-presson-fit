"""Phase 4: Universal Brand Sizing Chart Management System

Revision ID: 004_universal_brand_sizing_charts
Revises: 003_reconcile_brand_member_roles
Create Date: 2026-11-08 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_universal_sizing_charts"
down_revision: Union[str, None] = "003_reconcile_brand_member_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update brands table
    op.add_column("brands", sa.Column("logo_url", sa.String(500), nullable=True))
    op.add_column(
        "brands",
        sa.Column("is_official", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # 2. Update sizing_charts table format check constraint
    op.drop_constraint("ck_sizing_charts_format", "sizing_charts", type_="check")
    op.create_check_constraint(
        "ck_sizing_charts_format",
        "sizing_charts",
        "format IN ('per_size', 'width_ranges', 'preset_set', 'numbered_size', 'shape_range', 'PRESET_SET', 'NUMBERED_SIZE', 'SHAPE_RANGE')",
    )

    # Add metadata columns to sizing_charts
    op.add_column("sizing_charts", sa.Column("source_url", sa.String(500), nullable=True))
    op.add_column("sizing_charts", sa.Column("source_notes", sa.Text(), nullable=True))
    op.add_column(
        "sizing_charts",
        sa.Column("verification_status", sa.String(64), nullable=False, server_default="user_provided"),
    )
    op.add_column(
        "sizing_charts",
        sa.Column("is_official", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # 3. Update sizing_chart_entries table
    # Widen precision for existing numeric columns to (6, 2)
    op.alter_column("sizing_chart_entries", "thumb_width_mm", type_=sa.Numeric(6, 2))
    op.alter_column("sizing_chart_entries", "index_width_mm", type_=sa.Numeric(6, 2))
    op.alter_column("sizing_chart_entries", "middle_width_mm", type_=sa.Numeric(6, 2))
    op.alter_column("sizing_chart_entries", "ring_width_mm", type_=sa.Numeric(6, 2))
    op.alter_column("sizing_chart_entries", "pinky_width_mm", type_=sa.Numeric(6, 2))
    op.alter_column("sizing_chart_entries", "min_width_mm", type_=sa.Numeric(6, 2))
    op.alter_column("sizing_chart_entries", "max_width_mm", type_=sa.Numeric(6, 2))

    # Add flexible measurement and shape columns
    op.add_column("sizing_chart_entries", sa.Column("shape", sa.String(100), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("finger", sa.String(50), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("typical_finger", sa.String(150), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("width_mm", sa.Numeric(6, 2), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("length_mm", sa.Numeric(6, 2), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("min_length_mm", sa.Numeric(6, 2), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("max_length_mm", sa.Numeric(6, 2), nullable=True))
    op.add_column("sizing_chart_entries", sa.Column("thickness_mm", sa.Numeric(6, 2), nullable=True))
    op.add_column(
        "sizing_chart_entries",
        sa.Column("is_approximate", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # Add numeric check constraints
    op.create_check_constraint(
        "ck_entries_positive_length_ranges",
        "sizing_chart_entries",
        "(min_length_mm IS NULL OR min_length_mm > 0) AND (max_length_mm IS NULL OR max_length_mm > 0)",
    )
    op.create_check_constraint(
        "ck_entries_valid_length_bounds",
        "sizing_chart_entries",
        "min_length_mm IS NULL OR max_length_mm IS NULL OR min_length_mm <= max_length_mm",
    )
    op.create_check_constraint(
        "ck_entries_positive_width",
        "sizing_chart_entries",
        "width_mm IS NULL OR width_mm > 0",
    )
    op.create_check_constraint(
        "ck_entries_positive_length",
        "sizing_chart_entries",
        "length_mm IS NULL OR length_mm > 0",
    )
    op.create_check_constraint(
        "ck_entries_positive_thickness",
        "sizing_chart_entries",
        "thickness_mm IS NULL OR thickness_mm > 0",
    )


def downgrade() -> None:
    # 0. Clean up official / new-format records before reverting schema constraints
    op.execute(
        "DELETE FROM sizing_chart_entries WHERE chart_id IN "
        "(SELECT id FROM sizing_charts WHERE is_official = TRUE OR format NOT IN ('per_size', 'width_ranges'))"
    )
    op.execute(
        "DELETE FROM sizing_charts WHERE is_official = TRUE OR format NOT IN ('per_size', 'width_ranges')"
    )
    op.execute("DELETE FROM brands WHERE is_official = TRUE")

    # 1. Drop check constraints on sizing_chart_entries
    op.drop_constraint("ck_entries_positive_thickness", "sizing_chart_entries", type_="check")
    op.drop_constraint("ck_entries_positive_length", "sizing_chart_entries", type_="check")
    op.drop_constraint("ck_entries_positive_width", "sizing_chart_entries", type_="check")
    op.drop_constraint("ck_entries_valid_length_bounds", "sizing_chart_entries", type_="check")
    op.drop_constraint("ck_entries_positive_length_ranges", "sizing_chart_entries", type_="check")

    # Drop columns on sizing_chart_entries
    op.drop_column("sizing_chart_entries", "is_approximate")
    op.drop_column("sizing_chart_entries", "thickness_mm")
    op.drop_column("sizing_chart_entries", "max_length_mm")
    op.drop_column("sizing_chart_entries", "min_length_mm")
    op.drop_column("sizing_chart_entries", "length_mm")
    op.drop_column("sizing_chart_entries", "width_mm")
    op.drop_column("sizing_chart_entries", "typical_finger")
    op.drop_column("sizing_chart_entries", "finger")
    op.drop_column("sizing_chart_entries", "shape")

    # Restore numeric precision
    op.alter_column("sizing_chart_entries", "max_width_mm", type_=sa.Numeric(4, 1))
    op.alter_column("sizing_chart_entries", "min_width_mm", type_=sa.Numeric(4, 1))
    op.alter_column("sizing_chart_entries", "pinky_width_mm", type_=sa.Numeric(4, 1))
    op.alter_column("sizing_chart_entries", "ring_width_mm", type_=sa.Numeric(4, 1))
    op.alter_column("sizing_chart_entries", "middle_width_mm", type_=sa.Numeric(4, 1))
    op.alter_column("sizing_chart_entries", "index_width_mm", type_=sa.Numeric(4, 1))
    op.alter_column("sizing_chart_entries", "thumb_width_mm", type_=sa.Numeric(4, 1))

    # 2. Revert sizing_charts
    op.drop_column("sizing_charts", "is_official")
    op.drop_column("sizing_charts", "verification_status")
    op.drop_column("sizing_charts", "source_notes")
    op.drop_column("sizing_charts", "source_url")

    op.drop_constraint("ck_sizing_charts_format", "sizing_charts", type_="check")
    op.create_check_constraint(
        "ck_sizing_charts_format",
        "sizing_charts",
        "format IN ('per_size', 'width_ranges')",
    )

    # 3. Revert brands
    op.drop_column("brands", "is_official")
    op.drop_column("brands", "logo_url")
