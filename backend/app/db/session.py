from typing import Generator
from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from ..config import settings

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None

def get_engine() -> Engine:
    """
    Get or initialize the SQLAlchemy 2.x engine for PostgreSQL.
    Configured with pre-ping to detect stale connections and connection pooling.
    """
    global _engine
    if _engine is None:
        db_url = settings.get_database_url()
        _engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            future=True,
        )
    return _engine

def get_session_factory() -> sessionmaker[Session]:
    """Get or initialize the sessionmaker bound to the PostgreSQL engine."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _session_factory

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI request-scoped database session dependency.
    Yields an active session, commits on clean completion,
    automatically rolls back on exceptions, and ensures session closure.
    """
    session_cls = get_session_factory()
    session = session_cls()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

def reset_engine_for_tests(custom_url: str | None = None) -> Engine:
    """
    Utility for tests to re-bind engine to a disposable test database.
    Disposes of any existing connection pool.
    """
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    if custom_url:
        _engine = create_engine(
            custom_url,
            pool_pre_ping=True,
            future=True,
        )
    else:
        _engine = None
    _session_factory = None
    return get_engine() if _engine is not None else None
