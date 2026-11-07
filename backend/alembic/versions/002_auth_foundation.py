"""Phase 2 Auth Foundation: Verification tokens, session families, replay detection

Revision ID: 002_auth_foundation
Revises: 001_initial_schema
Create Date: 2026-11-04 02:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_auth_foundation"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add session family and replay tracking columns to user_sessions
    op.add_column(
        "user_sessions",
        sa.Column(
            "session_family_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )
    op.add_column(
        "user_sessions",
        sa.Column("parent_token_hash", sa.String(255), nullable=True),
    )
    op.add_column(
        "user_sessions",
        sa.Column("replaced_by_token_hash", sa.String(255), nullable=True),
    )
    op.add_column(
        "user_sessions",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_user_sessions_session_family_id",
        "user_sessions",
        ["session_family_id"],
    )

    # 2. Create auth_verification_tokens table
    op.create_table(
        "auth_verification_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_consumed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "purpose IN ('email_verification', 'password_reset')",
            name="ck_verification_tokens_purpose",
        ),
    )
    op.create_index("ix_auth_verification_tokens_user_id", "auth_verification_tokens", ["user_id"])
    op.create_index("ix_auth_verification_tokens_token_hash", "auth_verification_tokens", ["token_hash"])


def downgrade() -> None:
    # 1. Drop auth_verification_tokens
    op.drop_index("ix_auth_verification_tokens_token_hash", table_name="auth_verification_tokens")
    op.drop_index("ix_auth_verification_tokens_user_id", table_name="auth_verification_tokens")
    op.drop_table("auth_verification_tokens")

    # 2. Revert user_sessions additions
    op.drop_index("ix_user_sessions_session_family_id", table_name="user_sessions")
    op.drop_column("user_sessions", "revoked_at")
    op.drop_column("user_sessions", "replaced_by_token_hash")
    op.drop_column("user_sessions", "parent_token_hash")
    op.drop_column("user_sessions", "session_family_id")
