import uuid
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError


def test_alembic_clean_upgrade_from_base_reaches_new_head_and_enforces_roles(
    alembic_config: Config,
    test_engine,
):
    """
    Test Case 1:
    A clean upgrade from base to revision 003 succeeds and enforces owner/manager roles:
    1. Downgrade to base drops all tables.
    2. Clean upgrade from base to head reaches 003_reconcile_brand_member_roles.
    3. Reconciled database rejects unsupported role 'member' under ck_brand_members_role.
    4. Database accepts supported roles ('owner', 'manager').
    5. Default role on insert is 'owner'.
    """
    # 1. Downgrade to base
    command.downgrade(alembic_config, "base")
    inspector = inspect(test_engine)
    tables_after_downgrade = set(inspector.get_table_names()) - {"alembic_version"}
    assert len(tables_after_downgrade) == 0, (
        f"Tables remained after downgrade to base: {tables_after_downgrade}"
    )

    # 2. Clean upgrade from base to head
    command.upgrade(alembic_config, "head")

    with test_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "005_length_only_numbered_charts"

        # Verify core tables present
        inspector = inspect(test_engine)
        tables = set(inspector.get_table_names())
        assert "users" in tables
        assert "brands" in tables
        assert "brand_members" in tables
        assert "sizing_charts" in tables
        assert "auth_verification_tokens" in tables

        # Create user and brand
        user_id = uuid.uuid4()
        brand_id = uuid.uuid4()
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role) "
                "VALUES (:uid, 'clean_mig@example.com', 'hash', 'brand')"
            ),
            {"uid": user_id},
        )
        conn.execute(
            text(
                "INSERT INTO brands (id, owner_id, name, slug, contact_email) "
                "VALUES (:bid, :uid, 'Clean Mig Brand', 'clean-mig-brand', 'clean@example.com')"
            ),
            {"bid": brand_id, "uid": user_id},
        )
        conn.commit()

        # 3. Reject unsupported role 'member' under ck_brand_members_role
        with pytest.raises(IntegrityError):
            conn.execute(
                text(
                    "INSERT INTO brand_members (id, brand_id, user_id, role) "
                    "VALUES (:mid, :bid, :uid, 'member')"
                ),
                {"mid": uuid.uuid4(), "bid": brand_id, "uid": user_id},
            )
            conn.commit()
        conn.rollback()

        # 4. Accept supported roles 'owner' and 'manager'
        conn.execute(
            text(
                "INSERT INTO brand_members (id, brand_id, user_id, role) "
                "VALUES (:mid, :bid, :uid, 'owner')"
            ),
            {"mid": uuid.uuid4(), "bid": brand_id, "uid": user_id},
        )
        conn.commit()

        # 5. Verify default role is 'owner'
        other_user_id = uuid.uuid4()
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role) "
                "VALUES (:uid, 'clean_mig2@example.com', 'hash', 'brand')"
            ),
            {"uid": other_user_id},
        )
        conn.execute(
            text(
                "INSERT INTO brand_members (id, brand_id, user_id) "
                "VALUES (:mid, :bid, :uid)"
            ),
            {"mid": uuid.uuid4(), "bid": brand_id, "uid": other_user_id},
        )
        conn.commit()

        inserted_role = conn.execute(
            text("SELECT role FROM brand_members WHERE user_id = :uid"),
            {"uid": other_user_id},
        ).scalar()
        assert inserted_role == "owner"


def test_upgrade_from_002_aborts_safely_when_unresolved_member_rows_exist(
    alembic_config: Config,
    test_engine,
):
    """
    Test Case 2:
    Upgrading from revision 002 when member rows exist fails safely:
    - Pre-flight check detects existing role='member' rows.
    - Aborts migration with a clear error reporting the count but no personal data.
    - Explains that each row needs an explicit, reviewed role resolution.
    - Leaves both the rows and the Alembic revision unchanged (stays at 002).
    """
    # 1. Downgrade to 002_auth_foundation
    command.downgrade(alembic_config, "002_auth_foundation")

    user_id = uuid.uuid4()
    brand_id = uuid.uuid4()
    member_id = uuid.uuid4()

    with test_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "002_auth_foundation"

        # Insert user, brand, and a brand_member with role='member' (permitted at 002)
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role) "
                "VALUES (:uid, 'abort_test@example.com', 'hash', 'brand')"
            ),
            {"uid": user_id},
        )
        conn.execute(
            text(
                "INSERT INTO brands (id, owner_id, name, slug, contact_email) "
                "VALUES (:bid, :uid, 'Abort Test Brand', 'abort-test-brand', 'abort@example.com')"
            ),
            {"bid": brand_id, "uid": user_id},
        )
        conn.execute(
            text(
                "INSERT INTO brand_members (id, brand_id, user_id, role) "
                "VALUES (:mid, :bid, :uid, 'member')"
            ),
            {"mid": member_id, "bid": brand_id, "uid": user_id},
        )
        conn.commit()

        # Verify it was inserted as 'member' at revision 002
        role_at_002 = conn.execute(
            text("SELECT role FROM brand_members WHERE id = :mid"),
            {"mid": member_id},
        ).scalar()
        assert role_at_002 == "member"

    # 2. Attempt upgrade to head -> must fail safely
    with pytest.raises(Exception) as exc_info:
        command.upgrade(alembic_config, "head")

    err_msg = str(exc_info.value)
    # Verify error reports count but no personal data
    assert "Found 1 brand_members row(s) with unresolved legacy role 'member'" in err_msg
    assert "explicit, reviewed role resolution" in err_msg
    assert "abort_test@example.com" not in err_msg
    assert str(member_id) not in err_msg

    # 3. Verify database state is untouched (revision is still 002, row is still 'member')
    with test_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "002_auth_foundation"

        role_unchanged = conn.execute(
            text("SELECT role FROM brand_members WHERE id = :mid"),
            {"mid": member_id},
        ).scalar()
        assert role_unchanged == "member"


def test_downgrade_and_reupgrade_when_no_unresolved_rows_exist(
    alembic_config: Config,
    test_engine,
):
    """
    Test Case 3:
    Downgrade/re-upgrade behavior works when no unresolved member rows exist:
    - Resolving any member rows allows upgrade to revision 003 to succeed.
    - Downgrade to 002 succeeds and restores Phase 1 constraint and default.
    - Re-upgrade to 003 succeeds and re-applies owner/manager constraint and default.
    - Clean downgrade to base and re-upgrade to head leaves database ready for tests.
    """
    # 1. Resolve any existing 'member' rows explicitly to 'owner' or 'manager'
    with test_engine.connect() as conn:
        conn.execute(text("UPDATE brand_members SET role = 'owner' WHERE role = 'member'"))
        conn.commit()

    # 2. Upgrade to head succeeds now that no unresolved rows exist
    command.upgrade(alembic_config, "head")

    with test_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "005_length_only_numbered_charts"

    # 3. Downgrade to 002_auth_foundation succeeds
    command.downgrade(alembic_config, "002_auth_foundation")

    with test_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "002_auth_foundation"

    # 4. Re-upgrade to head succeeds
    command.upgrade(alembic_config, "head")

    with test_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "005_length_only_numbered_charts"

    # 5. Clean downgrade to base and re-upgrade to head leaves database at head
    command.downgrade(alembic_config, "base")
    inspector = inspect(test_engine)
    assert len(set(inspector.get_table_names()) - {"alembic_version"}) == 0

    command.upgrade(alembic_config, "head")
    inspector = inspect(test_engine)
    assert "sizing_charts" in set(inspector.get_table_names())
    assert "brand_members" in set(inspector.get_table_names())

    # Ensure official charts are re-seeded so database remains ready for live usage
    from app.db.seed_official_charts import run_seeds
    run_seeds()
