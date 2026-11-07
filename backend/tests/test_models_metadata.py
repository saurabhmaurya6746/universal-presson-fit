import pytest
from sqlalchemy import UniqueConstraint, CheckConstraint, Index
from app.models import Base

EXPECTED_TABLES = {
    "users",
    "user_sessions",
    "brands",
    "brand_members",
    "sizing_charts",
    "sizing_chart_entries",
    "measurement_profiles",
    "brand_trials",
    "admin_audit_events",
}

def test_all_expected_tables_present_in_metadata():
    """Verify all planned domain tables exist in SQLAlchemy Base.metadata."""
    metadata_tables = set(Base.metadata.tables.keys())
    assert EXPECTED_TABLES.issubset(metadata_tables), (
        f"Missing tables: {EXPECTED_TABLES - metadata_tables}"
    )

def test_sizing_chart_enforces_one_chart_per_brand_in_metadata():
    """Verify sizing_charts model has a unique constraint or unique column on brand_id."""
    table = Base.metadata.tables["sizing_charts"]
    brand_id_col = table.c.brand_id
    has_unique_col = bool(brand_id_col.unique)

    has_unique_constraint = any(
        isinstance(c, UniqueConstraint) and "brand_id" in [col.name for col in c.columns]
        for c in table.constraints
    )

    has_unique_index = any(
        isinstance(idx, Index) and idx.unique and [c.name for c in idx.columns] == ["brand_id"]
        for idx in table.indexes
    )

    assert has_unique_col or has_unique_constraint or has_unique_index, (
        "sizing_charts must strictly enforce one chart per brand via unique brand_id constraint."
    )

def test_no_image_or_photo_storage_columns():
    """Verify no photo, raw image, base64 data, or biometric binary columns exist in any table."""
    forbidden_tokens = ["photo", "image", "raw_bytes", "blob", "hand_photo", "chart_file", "binary_data"]
    for table_name, table in Base.metadata.tables.items():
        for column in table.columns:
            for token in forbidden_tokens:
                assert token not in column.name.lower(), (
                    f"Forbidden image/photo column '{column.name}' found in table '{table_name}'."
                )

def test_table_foreign_keys():
    """Verify all critical foreign keys are correctly defined."""
    fk_map = {
        "user_sessions": ("user_id", "users.id"),
        "brands": ("owner_id", "users.id"),
        "brand_members": ("brand_id", "brands.id"),
        "sizing_charts": ("brand_id", "brands.id"),
        "sizing_chart_entries": ("chart_id", "sizing_charts.id"),
        "measurement_profiles": ("user_id", "users.id"),
        "brand_trials": ("brand_id", "brands.id"),
    }
    for table_name, (col_name, target) in fk_map.items():
        table = Base.metadata.tables[table_name]
        fks = [fk.target_fullname for fk in table.foreign_keys]
        assert target in fks, f"Table '{table_name}' missing expected foreign key to '{target}'."

def test_check_constraints_present():
    """Verify check constraints for roles, statuses, and measurement validation exist."""
    table_constraints = {
        t_name: [c.name for c in table.constraints if isinstance(c, CheckConstraint)]
        for t_name, table in Base.metadata.tables.items()
    }
    assert "ck_users_role" in table_constraints["users"]
    assert "ck_brands_status" in table_constraints["brands"]
    assert "ck_brand_members_role" in table_constraints["brand_members"]
    assert "ck_sizing_charts_format" in table_constraints["sizing_charts"]
    assert "ck_entries_positive_finger_widths" in table_constraints["sizing_chart_entries"]
    assert "ck_entries_positive_ranges" in table_constraints["sizing_chart_entries"]
    assert "ck_entries_valid_range_bounds" in table_constraints["sizing_chart_entries"]
    assert "ck_measurements_hand_side" in table_constraints["measurement_profiles"]
    assert "ck_brand_trials_status" in table_constraints["brand_trials"]
    assert "ck_verification_tokens_purpose" in table_constraints["auth_verification_tokens"]

def test_brand_member_role_constraint_and_default_in_metadata():
    """Verify brand_members metadata has reconciled constraint allowing only owner and manager, and default role owner."""
    table = Base.metadata.tables["brand_members"]
    role_col = table.c.role
    assert role_col.default is not None
    assert role_col.default.arg == "owner"

    role_checks = [
        str(c.sqltext) for c in table.constraints
        if isinstance(c, CheckConstraint) and c.name == "ck_brand_members_role"
    ]
    assert len(role_checks) == 1
    assert "owner" in role_checks[0] and "manager" in role_checks[0]
    assert "member" not in role_checks[0]
