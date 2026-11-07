import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User, UserSession, AuthVerificationToken
from app.auth.service import AuthService
from app.core.security import hash_password, hash_token, generate_secure_token

def test_concurrent_refresh_rotation_single_use_and_replay_revocation(test_engine):
    """
    Verify concurrency protection during refresh rotation:
    - 2 concurrent requests attempt to rotate the SAME refresh token.
    - PostgreSQL row locking (SELECT ... FOR UPDATE) ensures atomic evaluation.
    - Exactly ONE request succeeds in rotating the token.
    - The concurrent request detects reuse and revokes the entire token family.
    """
    # 1. Setup user and active session using a dedicated session
    with Session(bind=test_engine) as setup_session:
        user = User(
            id=uuid.uuid4(),
            email=f"concurrent_refresh_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password("Password123!"),
            role="personal",
            is_active=True,
        )
        setup_session.add(user)
        setup_session.flush()

        raw_refresh = generate_secure_token(32)
        token_hash = hash_token(raw_refresh)
        family_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        session_record = UserSession(
            user_id=user.id,
            session_family_id=family_id,
            token_hash=token_hash,
            expires_at=now + timedelta(days=7),
            is_revoked=False,
        )
        setup_session.add(session_record)
        setup_session.commit()
        user_id = user.id

    # 2. Worker function for concurrent execution
    def attempt_rotation():
        with Session(bind=test_engine) as worker_session:
            try:
                result = AuthService.refresh_token(worker_session, raw_refresh)
                return {"success": True, "data": result}
            except HTTPException as e:
                return {"success": False, "status_code": e.status_code, "detail": e.detail}

    # 3. Launch 2 threads concurrently
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(attempt_rotation) for _ in range(2)]
        results = [f.result() for f in as_completed(futures)]

    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]

    # 4. Exactly one request must succeed and one must be rejected for replay
    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}"

    # The failure must be a 401 token reuse detection
    assert failures[0]["status_code"] == 401
    assert "Token reuse detected" in failures[0]["detail"]

    # 5. Check database: The token family must be revoked due to replay detection
    with Session(bind=test_engine) as check_session:
        active_in_family = (
            check_session.query(UserSession)
            .filter(
                UserSession.session_family_id == family_id,
                UserSession.is_revoked == False,
            )
            .all()
        )
        assert len(active_in_family) == 0, "All sessions in family should be revoked on replay"

def test_concurrent_email_verification_single_use(test_engine):
    """
    Verify concurrency protection during email verification:
    - 2 concurrent requests attempt to consume the SAME verification token.
    - PostgreSQL row locking (SELECT ... FOR UPDATE) ensures atomic evaluation.
    - Exactly ONE request consumes the token; the other receives HTTP 400.
    """
    # 1. Setup user and verification token
    with Session(bind=test_engine) as setup_session:
        user = User(
            id=uuid.uuid4(),
            email=f"concurrent_verify_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password("Password123!"),
            role="personal",
            is_active=True,
            email_verified=False,
        )
        setup_session.add(user)
        setup_session.flush()

        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        now = datetime.now(timezone.utc)

        token_record = AuthVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            purpose="email_verification",
            expires_at=now + timedelta(hours=24),
            is_consumed=False,
        )
        setup_session.add(token_record)
        setup_session.commit()
        user_id = user.id

    # 2. Worker function
    def attempt_verify():
        with Session(bind=test_engine) as worker_session:
            try:
                res = AuthService.verify_email(worker_session, raw_token)
                return {"success": True, "data": res}
            except HTTPException as e:
                return {"success": False, "status_code": e.status_code, "detail": e.detail}

    # 3. Launch 2 threads concurrently
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(attempt_verify) for _ in range(2)]
        results = [f.result() for f in as_completed(futures)]

    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}"
    assert failures[0]["status_code"] == 400
    assert "Invalid or expired" in failures[0]["detail"]

    # 4. Check database state
    with Session(bind=test_engine) as check_session:
        user = check_session.query(User).filter(User.id == user_id).first()
        assert user.email_verified is True
        token = check_session.query(AuthVerificationToken).filter(AuthVerificationToken.user_id == user_id).first()
        assert token.is_consumed is True

def test_concurrent_password_reset_single_use(test_engine):
    """
    Verify concurrency protection during password reset:
    - 2 concurrent requests attempt to reset password using the SAME reset token.
    - PostgreSQL row locking (SELECT ... FOR UPDATE) ensures atomic evaluation.
    - Exactly ONE request succeeds; the other receives HTTP 400.
    """
    # 1. Setup user and reset token
    with Session(bind=test_engine) as setup_session:
        user = User(
            id=uuid.uuid4(),
            email=f"concurrent_reset_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password("OldPassword123!"),
            role="personal",
            is_active=True,
        )
        setup_session.add(user)
        setup_session.flush()

        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        now = datetime.now(timezone.utc)

        token_record = AuthVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            purpose="password_reset",
            expires_at=now + timedelta(hours=1),
            is_consumed=False,
        )
        setup_session.add(token_record)
        setup_session.commit()
        user_id = user.id

    # 2. Worker function
    def attempt_reset(new_pw: str):
        with Session(bind=test_engine) as worker_session:
            try:
                res = AuthService.confirm_password_reset(worker_session, raw_token, new_pw)
                return {"success": True, "data": res}
            except HTTPException as e:
                return {"success": False, "status_code": e.status_code, "detail": e.detail}

    # 3. Launch 2 threads concurrently with different new passwords
    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_reset, "WinningPass123!")
        f2 = executor.submit(attempt_reset, "LosingPass456!")
        results = [f1.result(), f2.result()]

    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}"
    assert failures[0]["status_code"] == 400
    assert "Invalid or expired" in failures[0]["detail"]

    # 4. Check database state
    with Session(bind=test_engine) as check_session:
        token = check_session.query(AuthVerificationToken).filter(AuthVerificationToken.user_id == user_id).first()
        assert token.is_consumed is True
