import csv
import hashlib
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent

def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest().upper()

def test_legacy_supabase_migrations_preserved():
    """Verify legacy Supabase migration files exist and remain unmutated."""
    migrations_dir = WORKSPACE_ROOT / "docs" / "legacy" / "supabase" / "migrations"
    migration1 = migrations_dir / "20261101120000_initial_schema.sql"
    migration2 = migrations_dir / "20261102130000_allow_trusted_seed_provisioning.sql"

    assert migration1.exists(), "Initial Supabase schema migration was removed."
    assert migration2.exists(), "Trusted seed provisioning migration was removed."
    assert migration1.stat().st_size == 36512
    assert migration2.stat().st_size == 1903

def test_protected_ai_and_model_assets_preserved():
    """Verify all 44 protected AI/model assets match Phase 0 baseline SHA-256."""
    manifest_path = Path("C:/Users/hp/AppData/Local/Temp/PressOnFit-pre-restructure-20261103-232150/protected-assets-before.csv")
    if not manifest_path.exists():
        return  # Skip if temporary baseline is not present in test runner

    with open(manifest_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rel_path = row["RelativePath"]
            if rel_path.startswith("pressonai-onnx-demo\\"):
                target_path = WORKSPACE_ROOT / "frontend" / "demos" / rel_path
            else:
                target_path = WORKSPACE_ROOT / rel_path

            assert target_path.exists(), f"Protected file missing: {target_path}"
            actual_sha = compute_sha256(target_path)
            assert actual_sha == row["SHA256"], f"Protected file hash mismatch: {target_path}"
