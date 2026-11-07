import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from pydantic import BaseModel, Field

# Load backend/.env reliably using existing python-dotenv dependency if present
try:
    from dotenv import load_dotenv
    _backend_env = Path(__file__).resolve().parent.parent / ".env"
    if _backend_env.is_file():
        load_dotenv(_backend_env, override=False)
except ImportError:
    pass

def mask_database_url(url: str | None) -> str:
    """
    Safely mask credentials in a database URL for logs and diagnostics.
    Never exposes passwords, user tokens, or sensitive parameters.
    """
    if not url:
        return "<not-configured>"
    try:
        parsed = urlparse(url)
        if not parsed.scheme:
            return "<invalid-url>"
        netloc = parsed.hostname or ""
        if parsed.port:
            netloc += f":{parsed.port}"
        if parsed.username:
            netloc = f"{parsed.username}:***@{netloc}"
        masked = parsed._replace(netloc=netloc)
        return urlunparse(masked)
    except Exception:
        return "<malformed-url>"

def validate_and_normalize_database_url(url: str | None) -> str:
    """
    Validate and normalize a PostgreSQL connection URL for the synchronous engine.
    Converts generic postgresql:// or postgres:// to postgresql+psycopg://
    so SQLAlchemy 2.x uses the synchronous psycopg (version 3) driver.

    Rejects unsupported schemes (including asynchronous 'postgresql+asyncpg://')
    with clean, credential-free errors.
    """
    raw_url = url.strip() if url else ""
    if not raw_url:
        raise ValueError("DATABASE_URL is not configured. Please set the server-side environment variable.")

    try:
        parsed = urlparse(raw_url)
    except Exception:
        raise ValueError("DATABASE_URL is malformed. Ensure it is a valid PostgreSQL connection string.")

    scheme = parsed.scheme.lower()

    # Explicitly reject async driver with clear guidance
    if scheme == "postgresql+asyncpg":
        raise ValueError(
            "Asynchronous driver 'postgresql+asyncpg' is not supported. Use synchronous 'postgresql+psycopg://'."
        )

    valid_schemes = ("postgresql", "postgres", "postgresql+psycopg", "postgresql+psycopg2")
    if scheme not in valid_schemes:
        raise ValueError(
            f"Unsupported database scheme '{scheme}'. Must be a synchronous PostgreSQL connection (e.g. postgresql+psycopg://)."
        )

    if not parsed.hostname:
        raise ValueError("DATABASE_URL is missing a valid host.")

    # Normalize postgresql:// or postgres:// to postgresql+psycopg:// for SQLAlchemy 2.x + psycopg 3
    if scheme in ("postgresql", "postgres"):
        raw_url = urlunparse(parsed._replace(scheme="postgresql+psycopg"))

    return raw_url

def normalize_environment(env: str | None) -> str:
    """Normalize environment string: trim whitespace and convert to lowercase."""
    return (env or "").strip().lower()

def is_production_environment(env: str | None) -> bool:
    """Return True if normalized environment equals 'production'."""
    return normalize_environment(env) == "production"

def is_staging_or_production_environment(env: str | None) -> bool:
    """Return True if normalized environment is 'staging' or 'production'."""
    return normalize_environment(env) in ("staging", "production")

DEV_ONLY_JWT_SIGNING_SECRET = "dev-insecure-jwt-signing-secret-local-use-only-32bytes!"

KNOWN_DEV_JWT_SECRETS = frozenset([
    "LOCAL-DEV-SECRET-REPLACE-IN-PRODUCTION-AT-LEAST-32-BYTES-LONG!",
    "dev-insecure-jwt-signing-secret-local-use-only-32bytes!",
    "super-secret-jwt-token-with-at-least-32-characters-long",
    "change-me",
    "secret",
])

LOCAL_DEV_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

def resolve_cors_origins(
    env: str | None = None,
    allowed_origins_raw: str | list[str] | None = None,
) -> list[str]:
    """
    Resolve allowed CORS origins based on environment.
    - Staging / Production: strictly uses explicitly configured origins; never appends localhost or 127.0.0.1.
    - Development / Test: allows local dev origins (localhost, 127.0.0.1) along with any explicitly configured origins.
    """
    norm_env = normalize_environment(
        env if env is not None else os.getenv("ENVIRONMENT", "development")
    )

    if allowed_origins_raw is None:
        allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "")

    explicit_origins: list[str] = []
    if isinstance(allowed_origins_raw, list):
        explicit_origins = [str(o).strip() for o in allowed_origins_raw if str(o).strip()]
    elif isinstance(allowed_origins_raw, str):
        raw_str = allowed_origins_raw.strip()
        if raw_str.startswith("[") and raw_str.endswith("]"):
            import json
            try:
                parsed = json.loads(raw_str)
                if isinstance(parsed, list):
                    explicit_origins = [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                explicit_origins = [origin.strip() for origin in raw_str.split(",") if origin.strip()]
        else:
            explicit_origins = [origin.strip() for origin in raw_str.split(",") if origin.strip()]

    if norm_env in ("staging", "production"):
        # Staging / production: strictly return only explicit origins; never append localhost
        return list(dict.fromkeys(explicit_origins))

    # Development / test: include local dev origins
    return list(dict.fromkeys(LOCAL_DEV_CORS_ORIGINS + explicit_origins))

class Settings(BaseModel):
    # Supabase Connection details (preserved for existing legacy routes)
    SUPABASE_URL: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL", "http://127.0.0.1:54321"))
    SUPABASE_ANON_KEY: str = Field(
        default_factory=lambda: os.getenv(
            "SUPABASE_ANON_KEY",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
        )
    )
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    SUPABASE_JWT_SECRET: str = Field(
        default_factory=lambda: os.getenv(
            "SUPABASE_JWT_SECRET",
            "super-secret-jwt-token-with-at-least-32-characters-long",
        )
    )

    # CORS origins
    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: resolve_cors_origins()
    )

    # Ordinary PostgreSQL Connection (server-side only)
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", ""))

    # Phase 2 Application Authentication
    JWT_SIGNING_SECRET: str = Field(
        default_factory=lambda: os.getenv("JWT_SIGNING_SECRET", "")
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    VERIFY_TOKEN_EXPIRE_HOURS: int = 24
    RESET_TOKEN_EXPIRE_HOURS: int = 1
    ENVIRONMENT: str | None = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    REQUIRE_EMAIL_VERIFICATION: bool = Field(
        default_factory=lambda: os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() in ("true", "1", "yes")
    )

    @property
    def normalized_environment(self) -> str:
        """Return trimmed, lowercase ENVIRONMENT."""
        return normalize_environment(self.ENVIRONMENT)

    @property
    def is_production(self) -> bool:
        """Return True if normalized_environment equals 'production'."""
        return is_production_environment(self.ENVIRONMENT)

    @property
    def is_staging(self) -> bool:
        """Return True if normalized_environment equals 'staging'."""
        return self.normalized_environment == "staging"

    @property
    def requires_strong_jwt_secret(self) -> bool:
        """Return True if normalized_environment is 'staging' or 'production'."""
        return is_staging_or_production_environment(self.ENVIRONMENT)

    @property
    def is_cookie_secure(self) -> bool:
        """Return True if refresh cookies must include the Secure flag (staging and production)."""
        return is_staging_or_production_environment(self.ENVIRONMENT)

    def get_cors_origins(self) -> list[str]:
        """Return resolved allowed CORS origins based on current ENVIRONMENT and ALLOWED_ORIGINS."""
        return resolve_cors_origins(env=self.ENVIRONMENT, allowed_origins_raw=self.ALLOWED_ORIGINS)

    def get_jwt_signing_secret(self) -> str:
        """
        Validate and resolve the JWT signing secret.
        When ENVIRONMENT is 'staging' or 'production' (trimmed, case-insensitive), strictly enforces:
        - Must be explicitly set in the environment.
        - Must NOT be empty or whitespace.
        - Must NOT match any known development placeholder.
        - Must be at least 32 characters long.
        Fails closed with a clear, non-leaking ValueError if any check fails.
        """
        raw_secret = (self.JWT_SIGNING_SECRET or "").strip()

        if self.requires_strong_jwt_secret:
            env_label = "staging" if self.normalized_environment == "staging" else "production"
            if not raw_secret:
                raise ValueError(
                    f"JWT_SIGNING_SECRET is missing. A secure random secret of at least 32 characters is required in {env_label}."
                )
            if raw_secret in KNOWN_DEV_JWT_SECRETS:
                raise ValueError(
                    f"JWT_SIGNING_SECRET is using a known development placeholder. A distinct, secure {env_label} secret is required."
                )
            if len(raw_secret) < 32:
                raise ValueError(
                    f"JWT_SIGNING_SECRET is too short ({len(raw_secret)} characters). A minimum of 32 characters is required in {env_label}."
                )
            return raw_secret

        # Non-staging, non-production (development / test): fallback to dev secret if not set
        if not raw_secret:
            return DEV_ONLY_JWT_SIGNING_SECRET

        return raw_secret

    def get_database_url(self) -> str:
        """
        Validate and normalize the PostgreSQL connection URL for the synchronous engine.
        Converts generic postgresql:// or postgres:// to postgresql+psycopg://
        so SQLAlchemy 2.x uses the synchronous psycopg (version 3) driver.

        Rejects unsupported schemes (including asynchronous 'postgresql+asyncpg://')
        with clean, credential-free errors.
        """
        return validate_and_normalize_database_url(self.DATABASE_URL)

    @property
    def is_database_configured(self) -> bool:
        return bool(self.DATABASE_URL and self.DATABASE_URL.strip())

    @property
    def safe_database_info(self) -> dict[str, str | None]:
        """Return non-sensitive database connection details for diagnostics."""
        if not self.is_database_configured:
            return {"configured": "false", "host": None, "database": None}
        try:
            parsed = urlparse(self.DATABASE_URL.strip())
            dbname = parsed.path.lstrip("/") if parsed.path else None
            return {
                "configured": "true",
                "host": parsed.hostname,
                "port": str(parsed.port) if parsed.port else "5432",
                "database": dbname,
            }
        except Exception:
            return {"configured": "error", "host": None, "database": None}

def get_alembic_target_url(config=None, settings_obj: Settings | None = None) -> str:
    """
    Resolve target database URL for Alembic from config override or application settings.
    Guarantees consistent URL validation, async rejection, and normalization across both
    application and migrations without leaking credentials.
    """
    if config is not None:
        cmd_url = config.get_main_option("sqlalchemy.url")
        if cmd_url and cmd_url.strip():
            return validate_and_normalize_database_url(cmd_url)
    s = settings_obj or settings
    return s.get_database_url()

settings = Settings()
