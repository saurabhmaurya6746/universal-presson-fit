import uuid
import pytest
from sqlalchemy import select
from app.db.session import get_db
from app.models import User

def test_get_db_session_commits_on_clean_exit(test_engine):
    """Verify get_db commits inserted rows on clean completion."""
    test_email = f"commit_test_{uuid.uuid4().hex[:8]}@example.com"
    user_id = uuid.uuid4()

    db_gen = get_db()
    session = next(db_gen)
    try:
        user = User(
            id=user_id,
            email=test_email,
            full_name="Commit Lifecycle User",
            role="personal",
        )
        session.add(user)
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass

    # Verify user was committed to database
    verify_gen = get_db()
    verify_session = next(verify_gen)
    try:
        persisted = verify_session.scalar(select(User).where(User.id == user_id))
        assert persisted is not None
        assert persisted.email == test_email
        # Cleanup
        verify_session.delete(persisted)
    finally:
        try:
            next(verify_gen)
        except StopIteration:
            pass

def test_get_db_session_rolls_back_on_exception(test_engine):
    """Verify get_db automatically rolls back changes when an exception is raised."""
    test_email = f"rollback_test_{uuid.uuid4().hex[:8]}@example.com"
    user_id = uuid.uuid4()

    db_gen = get_db()
    session = next(db_gen)

    with pytest.raises(RuntimeError, match="Simulated application error"):
        try:
            user = User(
                id=user_id,
                email=test_email,
                full_name="Rollback User",
                role="personal",
            )
            session.add(user)
            session.flush()
            raise RuntimeError("Simulated application error")
        except Exception:
            db_gen.throw(RuntimeError("Simulated application error"))

    # Verify user was NOT committed
    verify_gen = get_db()
    verify_session = next(verify_gen)
    try:
        persisted = verify_session.scalar(select(User).where(User.id == user_id))
        assert persisted is None, "Failed transaction was not rolled back."
    finally:
        try:
            next(verify_gen)
        except StopIteration:
            pass
