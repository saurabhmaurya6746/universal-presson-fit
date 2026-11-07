"""Initial domain schema for ordinary PostgreSQL

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-11-04 01:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="personal"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('personal', 'brand', 'admin')", name="ck_users_role"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2. user_sessions
    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"])

    # 3. brands
    op.create_table(
        "brands",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("tagline", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contact_person", sa.String(100), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("instagram", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=False, server_default="India"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending_review"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("shapes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('active', 'pending_review', 'rejected', 'suspended', 'demo_sample')",
            name="ck_brands_status",
        ),
    )
    op.create_index("ix_brands_owner_id", "brands", ["owner_id"])
    op.create_index("ix_brands_slug", "brands", ["slug"], unique=True)

    # 4. brand_members
    op.create_table(
        "brand_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("brands.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('owner', 'manager', 'member')", name="ck_brand_members_role"),
        sa.UniqueConstraint("brand_id", "user_id", name="uq_brand_members_brand_user"),
    )
    op.create_index("ix_brand_members_brand_id", "brand_members", ["brand_id"])
    op.create_index("ix_brand_members_user_id", "brand_members", ["user_id"])

    # 5. sizing_charts
    op.create_table(
        "sizing_charts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "brand_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("brands.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,  # STRICT ONE CHART PER BRAND DATABASE CONSTRAINT
        ),
        sa.Column("chart_name", sa.String(150), nullable=False),
        sa.Column("format", sa.String(32), nullable=False),
        sa.Column("unit", sa.String(16), nullable=False, server_default="mm"),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("custom_notes", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(32), nullable=False, server_default="manual"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("format IN ('per_size', 'width_ranges')", name="ck_sizing_charts_format"),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_sizing_charts_status"),
        sa.CheckConstraint(
            "source_type IN ('manual', 'csv_upload', 'json_upload', 'preset')",
            name="ck_sizing_charts_source_type",
        ),
    )
    op.create_index("ix_sizing_charts_brand_id", "sizing_charts", ["brand_id"], unique=True)

    # 6. sizing_chart_entries
    op.create_table(
        "sizing_chart_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("chart_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sizing_charts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("size_label", sa.String(50), nullable=False),
        sa.Column("thumb_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("index_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("middle_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("ring_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("pinky_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("min_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("max_width_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "(thumb_width_mm IS NULL OR thumb_width_mm > 0) AND "
            "(index_width_mm IS NULL OR index_width_mm > 0) AND "
            "(middle_width_mm IS NULL OR middle_width_mm > 0) AND "
            "(ring_width_mm IS NULL OR ring_width_mm > 0) AND "
            "(pinky_width_mm IS NULL OR pinky_width_mm > 0)",
            name="ck_entries_positive_finger_widths",
        ),
        sa.CheckConstraint(
            "(min_width_mm IS NULL OR min_width_mm > 0) AND "
            "(max_width_mm IS NULL OR max_width_mm > 0)",
            name="ck_entries_positive_ranges",
        ),
        sa.CheckConstraint(
            "min_width_mm IS NULL OR max_width_mm IS NULL OR min_width_mm <= max_width_mm",
            name="ck_entries_valid_range_bounds",
        ),
    )
    op.create_index("ix_sizing_chart_entries_chart_id", "sizing_chart_entries", ["chart_id"])
    op.create_index(
        "uq_chart_entries_chart_id_size_label_lower",
        "sizing_chart_entries",
        ["chart_id", sa.text("lower(trim(size_label))")],
        unique=True,
    )

    # 7. measurement_profiles
    op.create_table(
        "measurement_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("profile_name", sa.String(100), nullable=False),
        sa.Column("hand_side", sa.String(16), nullable=False),
        sa.Column("measurements", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("calibration_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("coin_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "hand_side IN ('left', 'right', 'both')",
            name="ck_measurements_hand_side",
        ),
    )
    op.create_index("ix_measurement_profiles_user_id", "measurement_profiles", ["user_id"])

    # 8. brand_trials
    op.create_table(
        "brand_trials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "brand_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("brands.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("renewal_intent", sa.String(32), nullable=False, server_default="not_asked"),
        sa.Column("selected_plan", sa.String(64), nullable=False, server_default="growth"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('active', 'ending_soon', 'expired', 'extended', 'converted')",
            name="ck_brand_trials_status",
        ),
        sa.CheckConstraint(
            "renewal_intent IN ('yes', 'no', 'pending', 'not_asked')",
            name="ck_brand_trials_renewal_intent",
        ),
    )
    op.create_index("ix_brand_trials_brand_id", "brand_trials", ["brand_id"], unique=True)

    # 9. admin_audit_events
    op.create_table(
        "admin_audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_entity", sa.String(100), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("previous_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_admin_audit_events_admin_id", "admin_audit_events", ["admin_id"])
    op.create_index("ix_admin_audit_events_target_id", "admin_audit_events", ["target_id"])


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table("admin_audit_events")
    op.drop_table("brand_trials")
    op.drop_table("measurement_profiles")
    op.drop_table("sizing_chart_entries")
    op.drop_table("sizing_charts")
    op.drop_table("brand_members")
    op.drop_table("brands")
    op.drop_table("user_sessions")
    op.drop_table("users")
