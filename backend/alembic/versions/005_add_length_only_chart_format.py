"""Add length_only_numbered chart format and multi-shape entry index

Revision ID: 005_length_only_numbered_charts
Revises: 004_universal_sizing_charts
Create Date: 2026-11-09 13:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_length_only_numbered_charts"
down_revision: Union[str, None] = "004_universal_sizing_charts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update sizing_charts table format check constraint
    op.drop_constraint("ck_sizing_charts_format", "sizing_charts", type_="check")
    op.create_check_constraint(
        "ck_sizing_charts_format",
        "sizing_charts",
        "format IN ('per_size', 'width_ranges', 'preset_set', 'numbered_size', 'shape_range', 'length_only_numbered', 'PRESET_SET', 'NUMBERED_SIZE', 'SHAPE_RANGE', 'LENGTH_ONLY_NUMBERED')",
    )

    # 2. Update unique index on sizing_chart_entries to support multi-shape numbered charts
    op.drop_index("uq_chart_entries_chart_id_size_label_lower", table_name="sizing_chart_entries")
    op.create_index(
        "uq_chart_entries_chart_shape_size_lower",
        "sizing_chart_entries",
        ["chart_id", sa.text("coalesce(lower(trim(shape)), '')"), sa.text("lower(trim(size_label))")],
        unique=True,
    )


def downgrade() -> None:
    # 0. Clean up length_only_numbered charts and multi-shape entries incompatible with 004
    op.execute(
        sa.text(
            "DELETE FROM sizing_chart_entries WHERE chart_id IN ("
            "    SELECT id FROM sizing_charts WHERE lower(format) = 'length_only_numbered'"
            ")"
        )
    )
    op.execute(
        sa.text("DELETE FROM sizing_charts WHERE lower(format) = 'length_only_numbered'")
    )
    op.execute(
        sa.text("""
            DELETE FROM sizing_chart_entries
            WHERE id NOT IN (
                SELECT DISTINCT ON (chart_id, lower(trim(size_label))) id
                FROM sizing_chart_entries
                ORDER BY chart_id, lower(trim(size_label)), id
            )
        """)
    )

    # 1. Restore unique index
    op.drop_index("uq_chart_entries_chart_shape_size_lower", table_name="sizing_chart_entries")
    op.create_index(
        "uq_chart_entries_chart_id_size_label_lower",
        "sizing_chart_entries",
        ["chart_id", sa.text("lower(trim(size_label))")],
        unique=True,
    )

    # 2. Revert format check constraint
    op.drop_constraint("ck_sizing_charts_format", "sizing_charts", type_="check")
    op.create_check_constraint(
        "ck_sizing_charts_format",
        "sizing_charts",
        "format IN ('per_size', 'width_ranges', 'preset_set', 'numbered_size', 'shape_range', 'PRESET_SET', 'NUMBERED_SIZE', 'SHAPE_RANGE')",
    )
