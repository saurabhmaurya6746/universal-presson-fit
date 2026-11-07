"""Phase 3: Reconcile brand_members role constraint to owner and manager

Revision ID: 003_reconcile_brand_member_roles
Revises: 002_auth_foundation
Create Date: 2026-11-04 17:25:00.000000

"""
from typing import Sequence, Union
from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_reconcile_brand_member_roles"
down_revision: Union[str, None] = "002_auth_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Fail closed if any unresolved legacy 'member' rows exist
    if not context.is_offline_mode():
        bind = op.get_bind()
        unresolved_count = bind.execute(
            sa.text("SELECT COUNT(*) FROM brand_members WHERE role = 'member'")
        ).scalar()

        if unresolved_count and unresolved_count > 0:
            raise RuntimeError(
                f"Cannot apply migration 003_reconcile_brand_member_roles: "
                f"Found {unresolved_count} brand_members row(s) with unresolved legacy role 'member'. "
                "Automatic role assignment is prohibited. Each row requires explicit, reviewed role resolution "
                "to either 'owner' or 'manager' before this migration can proceed."
            )

    # 2. Drop historical Phase 1 check constraint permitting 'member'
    op.drop_constraint("ck_brand_members_role", "brand_members", type_="check")

    # 3. Create reconciled check constraint allowing strictly 'owner' and 'manager'
    op.create_check_constraint(
        "ck_brand_members_role",
        "brand_members",
        "role IN ('owner', 'manager')",
    )

    # 4. Update default role from 'member' to 'owner'
    op.alter_column("brand_members", "role", server_default="owner")


def downgrade() -> None:
    # 1. Drop reconciled check constraint
    op.drop_constraint("ck_brand_members_role", "brand_members", type_="check")

    # 2. Restore historical Phase 1 check constraint permitting 'owner', 'manager', 'member'
    op.create_check_constraint(
        "ck_brand_members_role",
        "brand_members",
        "role IN ('owner', 'manager', 'member')",
    )

    # 3. Restore Phase 1 default role to 'member'
    op.alter_column("brand_members", "role", server_default="member")
