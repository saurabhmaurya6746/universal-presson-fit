import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User, UserSession, AuthVerificationToken
from app.core.security import (
    hash_password,
    verify_password,
    hash_token,
    create_access_token,
    JWT_ISSUER,
    JWT_AUDIENCE,
)
from app.config import settings
from jose import jwt

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_registration_normalizes_email_and_stores_argon2id_hash_never_plaintext(
    db_session: Session,
    monkeypatch,
):
    """
    Test Case 1:
    Verify registration normalizes email (lowercase, stripped) and stores Argon2id hash.
    Verify plaintext password and raw verification tokens are NEVER stored in DB.
    """
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        raw_pw = "SuperSecurePassword123!"
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "   Jane.Doe+Test@EXAMPLE.com   ",
                "password": raw_pw,
                "full_name": "Jane Doe",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["verification_required"] is True
        assert data["user"]["email"] == "jane.doe+test@example.com"
        assert data["user"]["role"] == "personal"

        # Direct database verification
        user = db_session.query(User).filter(User.email == "jane.doe+test@example.com").first()
        assert user is not None
        assert user.email == "jane.doe+test@example.com"
        assert user.password_hash.startswith("$argon2id$")
        assert raw_pw not in user.password_hash
        assert verify_password(raw_pw, user.password_hash) is True

        # Verification token in DB is hashed, raw token never in DB
        raw_dev_token = data.get("dev_verification_token")
        assert raw_dev_token is not None
        token_record = (
            db_session.query(AuthVerificationToken)
            .filter(AuthVerificationToken.user_id == user.id)
            .first()
        )
        assert token_record is not None
        assert token_record.token_hash == hash_token(raw_dev_token)
        assert token_record.token_hash != raw_dev_token

@pytest.mark.anyio
async def test_public_registration_rejects_or_ignores_admin_role(db_session: Session):
    """
    Test Case 2:
    Verify public registration requesting 'admin' role creates only a 'personal' account.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "hacker@example.com",
                "password": "Password123!",
                "full_name": "Wannabe Admin",
                "role": "admin",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["role"] == "personal"

        user = db_session.query(User).filter(User.email == "hacker@example.com").first()
        assert user is not None
        assert user.role == "personal"

@pytest.mark.anyio
async def test_duplicate_email_registration_returns_conflict_without_leaking_details(db_session: Session):
    """
    Test Case 3:
    Verify registering an existing email returns HTTP 409 Conflict with generic message
    without leaking another user's ID or profile details.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First registration
        r1 = await client.post(
            "/api/auth/register",
            json={"email": "existing@example.com", "password": "Password123!"},
        )
        assert r1.status_code == 201

        # Second registration with duplicate email
        r2 = await client.post(
            "/api/auth/register",
            json={"email": "EXISTING@example.com", "password": "DifferentPassword123!"},
        )
        assert r2.status_code == 409
        err = r2.json()
        assert err["detail"] == "An account with this email address already exists."
        assert "id" not in err

@pytest.mark.anyio
async def test_login_success_and_generic_error_on_invalid_credentials_and_inactive_user(
    db_session: Session,
    monkeypatch,
):
    """
    Test Case 4:
    Verify login success, generic error on wrong credentials, and inactive user rejection.
    Verify unverified email policy when REQUIRE_EMAIL_VERIFICATION is enabled.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register user
        reg_resp = await client.post(
            "/api/auth/register",
            json={"email": "login_test@example.com", "password": "CorrectPassword123!"},
        )
        assert reg_resp.status_code == 201

        # 1. Successful login
        login_resp = await client.post(
            "/api/auth/login",
            json={"email": "LOGIN_TEST@example.com", "password": "CorrectPassword123!"},
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        assert "access_token" in login_data
        assert "refresh_token" not in login_data  # Raw refresh token must never appear in JSON
        assert login_data["token_type"] == "bearer"
        assert login_data["expires_in"] == 900
        assert "pressonfit_refresh_token" in login_resp.cookies

        # 2. Invalid password -> Generic 401
        bad_pw_resp = await client.post(
            "/api/auth/login",
            json={"email": "login_test@example.com", "password": "WrongPassword999!"},
        )
        assert bad_pw_resp.status_code == 401
        assert bad_pw_resp.json()["detail"] == "Invalid email or password."

        # 3. Non-existent email -> Generic 401
        non_existent_resp = await client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "AnyPassword123!"},
        )
        assert non_existent_resp.status_code == 401
        assert non_existent_resp.json()["detail"] == "Invalid email or password."

        # 4. Inactive account -> 403 Forbidden
        user = db_session.query(User).filter(User.email == "login_test@example.com").first()
        user.is_active = False
        db_session.commit()

        inactive_resp = await client.post(
            "/api/auth/login",
            json={"email": "login_test@example.com", "password": "CorrectPassword123!"},
        )
        assert inactive_resp.status_code == 403
        assert "Account is disabled" in inactive_resp.json()["detail"]

        # Restore active status
        user.is_active = True
        user.email_verified = False
        db_session.commit()

        # 5. Email verification policy enforced when enabled
        monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)
        unverified_resp = await client.post(
            "/api/auth/login",
            json={"email": "login_test@example.com", "password": "CorrectPassword123!"},
        )
        assert unverified_resp.status_code == 403
        assert "Email address has not been confirmed" in unverified_resp.json()["detail"]

@pytest.mark.anyio
async def test_access_token_validation_expired_wrong_issuer_audience_algorithm_rejected(
    db_session: Session,
):
    """
    Test Case 5:
    Verify access token validation: valid, expired, wrong issuer, wrong audience, wrong alg.
    """
    # Create test user
    user = User(
        email="token_validator@example.com",
        password_hash=hash_password("Pass123!"),
        role="personal",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Valid access token succeeds on GET /api/auth/me
        valid_token = create_access_token(user.id, user.email, user.role)
        r_valid = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
        assert r_valid.status_code == 200
        assert r_valid.json()["email"] == "token_validator@example.com"

        # 2. Expired access token rejected
        now = datetime.now(timezone.utc)
        expired_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "iat": int((now - timedelta(minutes=30)).timestamp()),
            "exp": int((now - timedelta(minutes=15)).timestamp()),
            "jti": str(uuid.uuid4()),
        }
        signing_secret = settings.get_jwt_signing_secret()
        expired_token = jwt.encode(expired_payload, signing_secret, algorithm="HS256")
        r_exp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert r_exp.status_code == 401
        assert "expired" in r_exp.json()["detail"].lower()

        # 3. Wrong issuer rejected
        wrong_iss_payload = dict(expired_payload, exp=int((now + timedelta(minutes=15)).timestamp()), iss="malicious_issuer")
        wrong_iss_token = jwt.encode(wrong_iss_payload, signing_secret, algorithm="HS256")
        r_iss = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {wrong_iss_token}"})
        assert r_iss.status_code == 401

        # 4. Wrong audience rejected
        wrong_aud_payload = dict(expired_payload, exp=int((now + timedelta(minutes=15)).timestamp()), aud="wrong_audience")
        wrong_aud_token = jwt.encode(wrong_aud_payload, signing_secret, algorithm="HS256")
        r_aud = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {wrong_aud_token}"})
        assert r_aud.status_code == 401

        # 5. Wrong algorithm / signature rejected
        wrong_secret_token = jwt.encode(wrong_iss_payload, "completely_different_signing_key_32bytes", algorithm="HS256")
        r_sec = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {wrong_secret_token}"})
        assert r_sec.status_code == 401

@pytest.mark.anyio
async def test_refresh_token_rotation_and_replay_detection_revokes_session_family(
    db_session: Session,
):
    """
    Test Case 6:
    Verify refresh rotation issues new token via HttpOnly cookie and revokes old.
    Verify raw refresh token never appears in JSON responses.
    Verify replaying an old refresh token triggers replay detection and revokes the whole family.
    Verify logout revokes current session and clears cookie.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register and login
        await client.post(
            "/api/auth/register",
            json={"email": "replay_test@example.com", "password": "Password123!"},
        )
        login_resp = await client.post(
            "/api/auth/login",
            json={"email": "replay_test@example.com", "password": "Password123!"},
        )
        assert "refresh_token" not in login_resp.json()
        assert "pressonfit_refresh_token" in login_resp.cookies
        t1_refresh = login_resp.cookies["pressonfit_refresh_token"]

        # 1. First refresh with t1 cookie -> succeeds and sets t2 in cookie
        client.cookies.set("pressonfit_refresh_token", t1_refresh)
        ref1_resp = await client.post("/api/auth/refresh")
        assert ref1_resp.status_code == 200
        assert "refresh_token" not in ref1_resp.json()
        assert "access_token" in ref1_resp.json()
        t2_refresh = ref1_resp.cookies["pressonfit_refresh_token"]
        assert t2_refresh != t1_refresh

        # Check DB: t1 is marked revoked and linked to t2
        s1 = db_session.query(UserSession).filter(UserSession.token_hash == hash_token(t1_refresh)).first()
        assert s1.is_revoked is True
        assert s1.replaced_by_token_hash == hash_token(t2_refresh)

        # 2. Replay attack: Attacker re-presents t1
        client.cookies.set("pressonfit_refresh_token", t1_refresh)
        replay_resp = await client.post("/api/auth/refresh")
        assert replay_resp.status_code == 401
        assert "Token reuse detected" in replay_resp.json()["detail"]

        # Verify all sessions in the family were revoked
        s2 = db_session.query(UserSession).filter(UserSession.token_hash == hash_token(t2_refresh)).first()
        assert s2.is_revoked is True

        # Now legitimate user attempting to use t2 is also rejected (family compromised)
        client.cookies.set("pressonfit_refresh_token", t2_refresh)
        t2_followup = await client.post("/api/auth/refresh")
        assert t2_followup.status_code == 401

        # 3. Test logout revocation
        login2 = await client.post(
            "/api/auth/login",
            json={"email": "replay_test@example.com", "password": "Password123!"},
        )
        t3_refresh = login2.cookies["pressonfit_refresh_token"]
        client.cookies.set("pressonfit_refresh_token", t3_refresh)
        logout_resp = await client.post("/api/auth/logout")
        assert logout_resp.status_code == 200

        # Attempt to refresh with logged-out token
        client.cookies.set("pressonfit_refresh_token", t3_refresh)
        after_logout = await client.post("/api/auth/refresh")
        assert after_logout.status_code == 401

@pytest.mark.anyio
async def test_csrf_origin_protection_on_refresh_and_logout(db_session: Session):
    """
    Verify CSRF origin checks on cookie-authenticated refresh and logout endpoints:
    - Requests with disallowed Origin/Referer are rejected with HTTP 403.
    - Requests with allowed Origin succeed.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register and login
        await client.post(
            "/api/auth/register",
            json={"email": "csrf_test@example.com", "password": "Password123!"},
        )
        login_resp = await client.post(
            "/api/auth/login",
            json={"email": "csrf_test@example.com", "password": "Password123!"},
        )
        refresh_token = login_resp.cookies["pressonfit_refresh_token"]
        client.cookies.set("pressonfit_refresh_token", refresh_token)

        # 1. Cross-site attacker origin rejected
        evil_refresh = await client.post(
            "/api/auth/refresh",
            headers={"Origin": "http://evil-attacker-site.com"},
        )
        assert evil_refresh.status_code == 403
        assert "CSRF check failed" in evil_refresh.json()["detail"]

        evil_logout = await client.post(
            "/api/auth/logout",
            headers={"Origin": "http://evil-attacker-site.com"},
        )
        assert evil_logout.status_code == 403
        assert "CSRF check failed" in evil_logout.json()["detail"]

        # 2. Allowed origin succeeds
        good_refresh = await client.post(
            "/api/auth/refresh",
            headers={"Origin": "http://localhost:5173"},
        )
        assert good_refresh.status_code == 200
        assert "access_token" in good_refresh.json()

@pytest.mark.anyio
async def test_verification_and_reset_tokens_single_use_and_expiry_enforced_no_raw_tokens_in_db(
    db_session: Session,
):
    """
    Test Case 7:
    Verify email verification and password reset tokens are single-use, enforce expiry,
    and are never stored in raw form in the database.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register to obtain verification token
        reg_resp = await client.post(
            "/api/auth/register",
            json={"email": "verify_test@example.com", "password": "Password123!"},
        )
        v_token = reg_resp.json()["dev_verification_token"]

        # First verify -> succeeds
        v1_resp = await client.post("/api/auth/verify-email", json={"token": v_token})
        assert v1_resp.status_code == 200
        assert v1_resp.json()["success"] is True

        # Check DB: user.email_verified is True
        user = db_session.query(User).filter(User.email == "verify_test@example.com").first()
        assert user.email_verified is True

        # Second verify with same token -> fails (single-use)
        v2_resp = await client.post("/api/auth/verify-email", json={"token": v_token})
        assert v2_resp.status_code == 400
        assert "Invalid or expired" in v2_resp.json()["detail"]

        # 2. Request password reset
        reset_req_resp = await client.post(
            "/api/auth/password-reset/request",
            json={"email": "verify_test@example.com"},
        )
        assert reset_req_resp.status_code == 200
        reset_token = reset_req_resp.json()["dev_reset_token"]

        # Confirm password reset
        confirm_resp = await client.post(
            "/api/auth/password-reset/confirm",
            json={"token": reset_token, "new_password": "NewStrongPassword789!"},
        )
        assert confirm_resp.status_code == 200
        assert confirm_resp.json()["success"] is True

        # Old password rejected
        old_login = await client.post(
            "/api/auth/login",
            json={"email": "verify_test@example.com", "password": "Password123!"},
        )
        assert old_login.status_code == 401

        # New password succeeds
        new_login = await client.post(
            "/api/auth/login",
            json={"email": "verify_test@example.com", "password": "NewStrongPassword789!"},
        )
        assert new_login.status_code == 200

        # Re-using reset token -> fails (single-use)
        reuse_reset = await client.post(
            "/api/auth/password-reset/confirm",
            json={"token": reset_token, "new_password": "AnotherPassword999!"},
        )
        assert reuse_reset.status_code == 400

@pytest.mark.anyio
async def test_auth_response_contains_no_sensitive_hashes_or_secrets():
    """
    Test Case 10:
    Verify auth responses do not leak password hashes, token hashes, or secret keys.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "leak_test@example.com", "password": "SecretPassword123!"},
        )
        login = await client.post(
            "/api/auth/login",
            json={"email": "leak_test@example.com", "password": "SecretPassword123!"},
        )

        forbidden_keys = ["password_hash", "token_hash", "secret", "private_key", "salt", "refresh_token"]
        for payload in [reg.json(), login.json()]:
            for key in forbidden_keys:
                assert key not in payload
                if "user" in payload:
                    assert key not in payload["user"]


def test_refresh_cookie_secure_flag_normalized_environment(monkeypatch):
    """Verify refresh cookie sets secure=True for normalized staging and production environments, and False for development."""
    from fastapi import Response
    from app.auth.router import set_refresh_cookie
    from app.config import settings

    secure_variants = [
        "production",
        "  Production  ",
        "PRODUCTION",
        " production\t",
        "staging",
        "  Staging  ",
        "STAGING",
        " staging\t\n",
    ]
    for variant in secure_variants:
        monkeypatch.setattr(settings, "ENVIRONMENT", variant)
        resp = Response()
        set_refresh_cookie(resp, "test-refresh-token")
        cookie_header = resp.headers.get("set-cookie", "")
        assert "secure" in cookie_header.lower(), f"Expected Secure flag for {variant!r}"

    local_http_variants = ["development", "  development  ", "test", "local", "", None]
    for variant in local_http_variants:
        monkeypatch.setattr(settings, "ENVIRONMENT", variant)
        resp = Response()
        set_refresh_cookie(resp, "test-refresh-token")
        cookie_header = resp.headers.get("set-cookie", "")
        assert "secure" not in cookie_header.lower(), f"Expected no Secure flag for {variant!r}"


def test_refresh_cookie_and_logout_attributes_staging_and_development(monkeypatch):
    """
    Verify complete attribute symmetry between set_refresh_cookie and clear_refresh_cookie:
    - Staging and production include Secure, HttpOnly, SameSite=Lax, and Path=/api/auth.
    - Development retains local HTTP usability (HttpOnly, SameSite=Lax, Path=/api/auth without Secure).
    - clear_refresh_cookie expires the cookie (Max-Age=0) with identical security attributes.
    """
    from fastapi import Response
    from app.auth.router import set_refresh_cookie, clear_refresh_cookie
    from app.config import settings

    # 1. Staging environment verification
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")

    set_resp_staging = Response()
    set_refresh_cookie(set_resp_staging, "staging-token-abc")
    set_header_staging = set_resp_staging.headers.get("set-cookie", "").lower()

    assert "pressonfit_refresh_token=staging-token-abc" in set_header_staging
    assert "httponly" in set_header_staging
    assert "samesite=lax" in set_header_staging
    assert "path=/api/auth" in set_header_staging
    assert "secure" in set_header_staging

    clear_resp_staging = Response()
    clear_refresh_cookie(clear_resp_staging)
    clear_header_staging = clear_resp_staging.headers.get("set-cookie", "").lower()

    assert "pressonfit_refresh_token=" in clear_header_staging
    assert "max-age=0" in clear_header_staging
    assert "httponly" in clear_header_staging
    assert "samesite=lax" in clear_header_staging
    assert "path=/api/auth" in clear_header_staging
    assert "secure" in clear_header_staging

    # 2. Production environment verification
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    set_resp_prod = Response()
    set_refresh_cookie(set_resp_prod, "prod-token-xyz")
    set_header_prod = set_resp_prod.headers.get("set-cookie", "").lower()
    assert "secure" in set_header_prod
    assert "httponly" in set_header_prod
    assert "samesite=lax" in set_header_prod
    assert "path=/api/auth" in set_header_prod

    clear_resp_prod = Response()
    clear_refresh_cookie(clear_resp_prod)
    clear_header_prod = clear_resp_prod.headers.get("set-cookie", "").lower()
    assert "secure" in clear_header_prod
    assert "max-age=0" in clear_header_prod
    assert "httponly" in clear_header_prod
    assert "path=/api/auth" in clear_header_prod

    # 3. Development environment verification (local HTTP)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    set_resp_dev = Response()
    set_refresh_cookie(set_resp_dev, "dev-token-123")
    set_header_dev = set_resp_dev.headers.get("set-cookie", "").lower()

    assert "pressonfit_refresh_token=dev-token-123" in set_header_dev
    assert "httponly" in set_header_dev
    assert "samesite=lax" in set_header_dev
    assert "path=/api/auth" in set_header_dev
    assert "secure" not in set_header_dev  # Usable over plain HTTP localhost

    clear_resp_dev = Response()
    clear_refresh_cookie(clear_resp_dev)
    clear_header_dev = clear_resp_dev.headers.get("set-cookie", "").lower()

    assert "pressonfit_refresh_token=" in clear_header_dev
    assert "max-age=0" in clear_header_dev
    assert "httponly" in clear_header_dev
    assert "samesite=lax" in clear_header_dev
    assert "path=/api/auth" in clear_header_dev
    assert "secure" not in clear_header_dev
