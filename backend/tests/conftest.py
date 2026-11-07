import os
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from alembic.config import Config
from app.config import settings, mask_database_url
from app.db.session import reset_engine_for_tests, get_db
from app.main import app
from app.models import Base

BACKEND_DIR = Path(__file__).resolve().parent.parent

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
def database_url() -> str:
    """Return database URL for test execution. Uses DATABASE_URL environment variable."""
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        # Fallback to local disposable port 5433 if started by test runner
        url = "postgresql+psycopg://postgres@127.0.0.1:5433/presson_phase1_disposable"
    return url

@pytest.fixture(scope="session")
def alembic_config(database_url: str) -> Config:
    """Return Alembic config pointing to backend/alembic.ini with test database URL."""
    ini_path = BACKEND_DIR / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", database_url)
    return cfg

@pytest.fixture(scope="session")
def test_engine(database_url: str):
    """Session-scoped SQLAlchemy engine bound to disposable database."""
    engine = create_engine(database_url, pool_pre_ping=True)
    yield engine
    engine.dispose()

@pytest.fixture(scope="function")
def db_session(test_engine) -> Session:
    """Function-scoped DB session wrapped in a transaction that rolls back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    def _get_test_db():
        yield session

    app.dependency_overrides[get_db] = _get_test_db

    yield session

    app.dependency_overrides.pop(get_db, None)
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()
