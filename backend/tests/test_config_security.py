import os
import tempfile
from pathlib import Path
import pytest
from app.config import Settings, mask_database_url, get_alembic_target_url
from alembic.config import Config

def test_missing_database_url_raises_clean_error():
    """Verify missing DATABASE_URL raises a clear ValueError without exposing secrets."""
    settings = Settings(DATABASE_URL="")
    with pytest.raises(ValueError) as excinfo:
        settings.get_database_url()
    assert "DATABASE_URL is not configured" in str(excinfo.value)

def test_asyncpg_scheme_is_explicitly_rejected():
    """Verify postgresql+asyncpg:// is rejected with clear, credential-free error guidance."""
    secret_pass = "SuperSecretAsyncPass987!"
    secret_user = "async_admin_user"
    url = f"postgresql+asyncpg://{secret_user}:{secret_pass}@127.0.0.1:5432/my_db"
    settings = Settings(DATABASE_URL=url)

    with pytest.raises(ValueError) as excinfo:
        settings.get_database_url()

    error_msg = str(excinfo.value)
    assert "Asynchronous driver 'postgresql+asyncpg' is not supported" in error_msg
    assert "Use synchronous 'postgresql+psycopg://'" in error_msg
    # Ensure sensitive credentials were NOT leaked in the error
    assert secret_pass not in error_msg
    assert secret_user not in error_msg
    assert url not in error_msg

def test_invalid_scheme_raises_clean_error_without_leaking_credentials():
    """Verify non-postgres schemes raise an informative error without exposing credentials."""
    secret_pass = "MySecretMySQLPass!"
    url = f"mysql://dbuser:{secret_pass}@127.0.0.1:3306/db"
    settings = Settings(DATABASE_URL=url)

    with pytest.raises(ValueError) as excinfo:
        settings.get_database_url()

    error_msg = str(excinfo.value)
    assert "Unsupported database scheme 'mysql'" in error_msg
    assert "Must be a synchronous PostgreSQL connection" in error_msg
    assert secret_pass not in error_msg
    assert url not in error_msg

def test_url_normalization_to_psycopg():
    """Verify postgresql:// and postgres:// are normalized to postgresql+psycopg://."""
    s1 = Settings(DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/testdb")
    assert s1.get_database_url().startswith("postgresql+psycopg://")

    s2 = Settings(DATABASE_URL="postgres://user:pass@127.0.0.1:5432/testdb")
    assert s2.get_database_url().startswith("postgresql+psycopg://")

def test_mask_database_url_masks_password():
    """Verify mask_database_url hides credentials while preserving host and database."""
    url = "postgresql+psycopg://my_admin:SuperSecret123!@127.0.0.1:5432/production_db"
    masked = mask_database_url(url)
    assert "SuperSecret123!" not in masked
    assert "my_admin:***@127.0.0.1:5432/production_db" in masked

def test_mask_database_url_handles_empty_and_none():
    """Verify mask_database_url handles edge cases safely."""
    assert mask_database_url(None) == "<not-configured>"
    assert mask_database_url("") == "<not-configured>"
    assert mask_database_url("not_a_valid_url") == "<invalid-url>"

def test_documented_config_supplies_url_to_app_and_alembic(monkeypatch):
    """
    Verify the documented configuration method (environment / settings)
    actually supplies DATABASE_URL to both the application and Alembic.
    """
    sample_url = "postgresql+psycopg://presson_dev:SecretPass@127.0.0.1:5432/presson_phase1_disposable"
    monkeypatch.setenv("DATABASE_URL", sample_url)

    # 1. Verify application settings receives and normalizes the URL
    app_settings = Settings(DATABASE_URL=sample_url)
    app_url = app_settings.get_database_url()
    assert app_url == sample_url
    assert app_settings.is_database_configured is True
    assert app_settings.safe_database_info["host"] == "127.0.0.1"
    assert app_settings.safe_database_info["database"] == "presson_phase1_disposable"

    # 2. Verify Alembic env.py get_target_url() retrieves the same URL
    backend_dir = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_url = get_alembic_target_url(alembic_cfg, app_settings)
    assert alembic_url == sample_url

def test_get_alembic_target_url_from_config_rejects_asyncpg_without_leaking_credentials():
    """
    Verify get_alembic_target_url rejects postgresql+asyncpg:// specified in Alembic config
    without leaking username or password in the error.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    secret_pass = "AlembicAsyncSecret999!"
    secret_user = "alembic_async_user"
    url = f"postgresql+asyncpg://{secret_user}:{secret_pass}@127.0.0.1:5432/alembic_async_db"
    alembic_cfg.set_main_option("sqlalchemy.url", url)

    with pytest.raises(ValueError) as excinfo:
        get_alembic_target_url(alembic_cfg)

    error_msg = str(excinfo.value)
    assert "Asynchronous driver 'postgresql+asyncpg' is not supported" in error_msg
    assert "Use synchronous 'postgresql+psycopg://'" in error_msg
    assert secret_pass not in error_msg
    assert secret_user not in error_msg
    assert url not in error_msg

def test_get_alembic_target_url_from_config_rejects_unsupported_scheme_without_leaking_credentials():
    """
    Verify get_alembic_target_url rejects non-PostgreSQL schemes in Alembic config
    without exposing credentials.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    secret_pass = "AlembicMySQLSecret888!"
    url = f"mysql://alembic_user:{secret_pass}@127.0.0.1:3306/alembic_db"
    alembic_cfg.set_main_option("sqlalchemy.url", url)

    with pytest.raises(ValueError) as excinfo:
        get_alembic_target_url(alembic_cfg)

    error_msg = str(excinfo.value)
    assert "Unsupported database scheme 'mysql'" in error_msg
    assert "Must be a synchronous PostgreSQL connection" in error_msg
    assert secret_pass not in error_msg
    assert url not in error_msg

def test_get_alembic_target_url_from_config_normalizes_generic_postgres():
    """
    Verify get_alembic_target_url normalizes postgresql:// from Alembic config to postgresql+psycopg://.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    url = "postgresql://alembic_user:pass@127.0.0.1:5432/alembic_db"
    alembic_cfg.set_main_option("sqlalchemy.url", url)

    normalized = get_alembic_target_url(alembic_cfg)
    assert normalized.startswith("postgresql+psycopg://")

def test_backend_dotenv_loading_in_isolated_process(tmp_path):
    """
    Verify DATABASE_URL is loaded from a backend/.env file when imported,
    and that process environment variables take precedence.
    Runs in an isolated subprocess with a temporary backend directory.
    Does NOT inspect, read, or modify any real .env file.
    """
    import subprocess
    import sys
    import shutil

    temp_backend = tmp_path / "backend"
    temp_app = temp_backend / "app"
    temp_app.mkdir(parents=True)

    (temp_app / "__init__.py").write_text("", encoding="utf-8")
    real_backend = Path(__file__).resolve().parent.parent
    shutil.copy(real_backend / "app" / "config.py", temp_app / "config.py")

    dummy_url_from_env_file = "postgresql+psycopg://env_user:env_secret_pass@127.0.0.1:5432/env_test_db"
    temp_env_file = temp_backend / ".env"
    temp_env_file.write_text(f"DATABASE_URL={dummy_url_from_env_file}\n", encoding="utf-8")

    # Clean env without ambient DATABASE_URL
    sub_env = {k: v for k, v in os.environ.items() if k != "DATABASE_URL"}

    code_load = (
        "import sys; "
        f"sys.path.insert(0, r'{temp_backend}'); "
        "from app.config import settings; "
        "print(settings.get_database_url())"
    )

    res = subprocess.run(
        [sys.executable, "-c", code_load],
        env=sub_env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert res.stdout.strip() == dummy_url_from_env_file

    # Verify process environment takes precedence over .env file
    override_url = "postgresql+psycopg://override_user:override_pass@127.0.0.1:5432/override_db"
    sub_env_with_override = dict(sub_env)
    sub_env_with_override["DATABASE_URL"] = override_url

    res_override = subprocess.run(
        [sys.executable, "-c", code_load],
        env=sub_env_with_override,
        capture_output=True,
        text=True,
        check=True,
    )
    assert res_override.stdout.strip() == override_url

def test_production_jwt_signing_secret_missing_fails_closed():
    """Verify production fails closed if JWT_SIGNING_SECRET is missing or empty."""
    prod_settings = Settings(ENVIRONMENT="production", JWT_SIGNING_SECRET="")
    with pytest.raises(ValueError) as excinfo:
        prod_settings.get_jwt_signing_secret()
    err = str(excinfo.value)
    assert "JWT_SIGNING_SECRET is missing" in err
    assert "required in production" in err

def test_production_jwt_signing_secret_dev_placeholder_fails_closed():
    """Verify production fails closed if JWT_SIGNING_SECRET uses any known development placeholder."""
    known_placeholders = [
        "LOCAL-DEV-SECRET-REPLACE-IN-PRODUCTION-AT-LEAST-32-BYTES-LONG!",
        "dev-insecure-jwt-signing-secret-local-use-only-32bytes!",
        "super-secret-jwt-token-with-at-least-32-characters-long",
        "change-me",
        "secret",
    ]
    for placeholder in known_placeholders:
        prod_settings = Settings(ENVIRONMENT="production", JWT_SIGNING_SECRET=placeholder)
        with pytest.raises(ValueError) as excinfo:
            prod_settings.get_jwt_signing_secret()
        err = str(excinfo.value)
        assert "development placeholder" in err

def test_production_jwt_signing_secret_too_short_fails_closed():
    """Verify production fails closed if JWT_SIGNING_SECRET is under 32 characters, and never leaks secret."""
    weak_secret = "weak_secret_under_32"
    prod_settings = Settings(ENVIRONMENT="production", JWT_SIGNING_SECRET=weak_secret)
    with pytest.raises(ValueError) as excinfo:
        prod_settings.get_jwt_signing_secret()
    err = str(excinfo.value)
    assert "too short" in err
    assert "minimum of 32 characters" in err
    # Never leak the actual secret in the error
    assert weak_secret not in err

def test_development_jwt_signing_secret_fallback_usable():
    """Verify local development works out of the box with clearly development-only key."""
    dev_settings = Settings(ENVIRONMENT="development", JWT_SIGNING_SECRET="")
    dev_secret = dev_settings.get_jwt_signing_secret()
    assert dev_secret is not None
    assert len(dev_secret) >= 32
    assert "dev-insecure" in dev_secret

def test_token_functions_in_production_fail_closed_with_invalid_secret(monkeypatch):
    """Verify JWT token creation/decoding fails closed in production when secret is invalid."""
    from app.core.security import create_access_token, decode_access_token
    from app.config import settings
    import uuid

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "JWT_SIGNING_SECRET", "")

    with pytest.raises(ValueError, match="JWT_SIGNING_SECRET is missing"):
        create_access_token(uuid.uuid4(), "test@example.com", "personal")

    with pytest.raises(ValueError, match="JWT_SIGNING_SECRET is missing"):
        decode_access_token("header.payload.signature")


def test_normalized_environment_casing_and_whitespace():
    """Verify ENVIRONMENT is normalized consistently across case variations and surrounding whitespace."""
    prod_variants = [
        "production",
        "PRODUCTION",
        "Production",
        "  production  ",
        "  Production \t\n",
        "  PrOdUcTiOn  ",
    ]
    for variant in prod_variants:
        s = Settings(ENVIRONMENT=variant)
        assert s.normalized_environment == "production", f"Failed for {variant!r}"
        assert s.is_production is True, f"Failed for {variant!r}"

    non_prod_variants = [
        "development",
        "DEVELOPMENT",
        "  development  ",
        "test",
        "staging",
        "  staging  ",
        "prod",
        "",
        "   ",
        None,
        "production-preview",
    ]
    for variant in non_prod_variants:
        s = Settings(ENVIRONMENT=variant)
        assert s.is_production is False, f"Expected False for {variant!r}"


def test_production_startup_validation_normalizes_environment(monkeypatch):
    """Verify validate_production_security fails closed with whitespace/case variants of production."""
    from app.main import validate_production_security
    from app.config import settings

    # Missing secret with leading/trailing whitespace and mixed case
    monkeypatch.setattr(settings, "ENVIRONMENT", "  Production  ")
    monkeypatch.setattr(settings, "JWT_SIGNING_SECRET", "")
    with pytest.raises(ValueError, match="JWT_SIGNING_SECRET is missing"):
        validate_production_security()

    # Placeholder secret with all-caps production
    monkeypatch.setattr(settings, "ENVIRONMENT", " PRODUCTION ")
    monkeypatch.setattr(settings, "JWT_SIGNING_SECRET", "super-secret-jwt-token-with-at-least-32-characters-long")
    with pytest.raises(ValueError, match="development placeholder"):
        validate_production_security()

    # Non-production (development) does not raise even if secret is missing
    monkeypatch.setattr(settings, "ENVIRONMENT", "  development  ")
    monkeypatch.setattr(settings, "JWT_SIGNING_SECRET", "")
    validate_production_security()  # Should not raise


def test_staging_jwt_signing_secret_missing_fails_closed():
    """Verify staging fails closed if JWT_SIGNING_SECRET is missing or empty."""
    staging_settings = Settings(ENVIRONMENT="staging", JWT_SIGNING_SECRET="")
    assert staging_settings.is_staging is True
    assert staging_settings.requires_strong_jwt_secret is True
    with pytest.raises(ValueError) as excinfo:
        staging_settings.get_jwt_signing_secret()
    err = str(excinfo.value)
    assert "JWT_SIGNING_SECRET is missing" in err
    assert "required in staging" in err


def test_staging_jwt_signing_secret_dev_placeholder_fails_closed():
    """Verify staging fails closed if JWT_SIGNING_SECRET uses any known development placeholder."""
    known_placeholders = [
        "LOCAL-DEV-SECRET-REPLACE-IN-PRODUCTION-AT-LEAST-32-BYTES-LONG!",
        "dev-insecure-jwt-signing-secret-local-use-only-32bytes!",
        "super-secret-jwt-token-with-at-least-32-characters-long",
        "change-me",
        "secret",
    ]
    for placeholder in known_placeholders:
        staging_settings = Settings(ENVIRONMENT="staging", JWT_SIGNING_SECRET=placeholder)
        with pytest.raises(ValueError) as excinfo:
            staging_settings.get_jwt_signing_secret()
        err = str(excinfo.value)
        assert "development placeholder" in err
        assert "secure staging secret" in err


def test_staging_jwt_signing_secret_too_short_fails_closed():
    """Verify staging fails closed if JWT_SIGNING_SECRET is under 32 characters, and never leaks secret."""
    weak_secret = "weak_secret_under_32"
    staging_settings = Settings(ENVIRONMENT="staging", JWT_SIGNING_SECRET=weak_secret)
    with pytest.raises(ValueError) as excinfo:
        staging_settings.get_jwt_signing_secret()
    err = str(excinfo.value)
    assert "too short" in err
    assert "minimum of 32 characters" in err
    assert "required in staging" in err
    assert weak_secret not in err


def test_staging_startup_validation_fails_closed(monkeypatch):
    """Verify validate_production_security fails closed when ENVIRONMENT is staging and secret is missing or placeholder."""
    from app.main import validate_production_security
    from app.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "  Staging  ")
    monkeypatch.setattr(settings, "JWT_SIGNING_SECRET", "")
    with pytest.raises(ValueError, match="JWT_SIGNING_SECRET is missing.*required in staging"):
        validate_production_security()

    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
    monkeypatch.setattr(settings, "JWT_SIGNING_SECRET", "change-me")
    with pytest.raises(ValueError, match="development placeholder.*secure staging secret"):
        validate_production_security()


def test_cors_origins_resolution_in_development():
    """Verify development environment includes local dev origins (localhost, 127.0.0.1) and custom origins."""
    from app.config import resolve_cors_origins

    # Default development without custom origins
    dev_origins = resolve_cors_origins(env="development", allowed_origins_raw="")
    assert "http://localhost:3000" in dev_origins
    assert "http://localhost:5173" in dev_origins
    assert "http://127.0.0.1:3000" in dev_origins
    assert "http://127.0.0.1:5173" in dev_origins

    # Development with custom origin
    dev_custom = resolve_cors_origins(env="development", allowed_origins_raw="http://192.168.1.5:3000")
    assert "http://192.168.1.5:3000" in dev_custom
    assert "http://localhost:3000" in dev_custom


def test_cors_origins_resolution_in_staging_strict_and_no_localhost():
    """
    Verify staging environment strictly uses explicitly configured origins only.
    Localhost and 127.0.0.1 origins are NEVER appended in staging.
    """
    from app.config import resolve_cors_origins

    staging_frontend = "https://pressonfit-staging.onrender.com"
    staging_origins = resolve_cors_origins(env="staging", allowed_origins_raw=staging_frontend)
    assert staging_origins == [staging_frontend]
    for origin in staging_origins:
        assert "localhost" not in origin
        assert "127.0.0.1" not in origin

    # Multiple staging origins
    multi_staging = "https://pressonfit-staging.onrender.com,https://preview-123.onrender.com"
    multi_origins = resolve_cors_origins(env="staging", allowed_origins_raw=multi_staging)
    assert multi_origins == [
        "https://pressonfit-staging.onrender.com",
        "https://preview-123.onrender.com",
    ]
    for origin in multi_origins:
        assert "localhost" not in origin
        assert "127.0.0.1" not in origin

    # Unset / empty in staging returns empty list (fail-safe closed)
    empty_staging = resolve_cors_origins(env="staging", allowed_origins_raw="")
    assert empty_staging == []


def test_cors_origins_resolution_in_production_strict_and_no_localhost():
    """Verify production environment strictly uses explicitly configured origins only without localhost."""
    from app.config import resolve_cors_origins

    prod_frontend = "https://pressonfit.com"
    prod_origins = resolve_cors_origins(env="production", allowed_origins_raw=prod_frontend)
    assert prod_origins == [prod_frontend]
    assert not any("localhost" in o or "127.0.0.1" in o for o in prod_origins)


def test_fastapi_cors_middleware_uses_environment_aware_origins(monkeypatch):
    """Verify FastAPI application settings get_cors_origins() respects staging vs development."""
    from app.config import Settings

    staging_origin = "https://presson-fit-staging.onrender.com"
    s_staging = Settings(ENVIRONMENT="staging", ALLOWED_ORIGINS=[staging_origin])
    cors_staging = s_staging.get_cors_origins()
    assert cors_staging == [staging_origin]
    assert not any("localhost" in o or "127.0.0.1" in o for o in cors_staging)

    s_dev = Settings(ENVIRONMENT="development", ALLOWED_ORIGINS=[])
    cors_dev = s_dev.get_cors_origins()
    assert "http://localhost:3000" in cors_dev
    assert "http://localhost:5173" in cors_dev


def test_production_email_service_behavior_with_and_without_verification(monkeypatch):
    """Verify EmailService behavior under production: optional verification succeeds safely, mandatory verification fails closed with 503."""
    from fastapi import HTTPException
    from app.auth.email import EmailService
    from app.config import settings

    svc = EmailService()

    # 1. Non-production captures tokens safely
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    dev_token = svc.send_verification_email("user@example.com", "token_123")
    assert dev_token == "token_123"
    assert svc.get_latest_dev_token("user@example.com", "email_verification") == "token_123"

    # 2. Production with REQUIRE_EMAIL_VERIFICATION=False: returns None without crashing
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", False)
    assert svc.send_verification_email("user@example.com", "token_123") is None

    # 3. Production with REQUIRE_EMAIL_VERIFICATION=True: fails closed with 503
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)
    with pytest.raises(HTTPException) as exc_info:
        svc.send_verification_email("user@example.com", "token_123")
    assert exc_info.value.status_code == 503
    assert "Production email delivery provider is not configured" in exc_info.value.detail

    # 4. Production password reset fails closed with 503
    with pytest.raises(HTTPException) as exc_info:
        svc.send_password_reset_email("user@example.com", "token_123")
    assert exc_info.value.status_code == 503
