import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from ..config import settings
from ..core.security import (
    hash_password,
    verify_password,
    hash_token,
    generate_secure_token,
    create_access_token,
    DUMMY_ARGON2_HASH,
)
from ..models.user import User, UserSession, AuthVerificationToken
from ..models.brand import Brand, BrandMember
from .schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserPublicProfile,
)
from .email import email_service

class AuthService:
    """Application authentication and credential lifecycle manager."""

    @staticmethod
    def resolve_user_profile(db: Session, user: User) -> UserPublicProfile:
        brand_id = None
        brand_name = None
        brand_role = None

        if user.role == "brand":
            membership = (
                db.query(BrandMember)
                .filter(BrandMember.user_id == user.id)
                .first()
            )
            if membership:
                brand_id = str(membership.brand_id)
                brand_role = membership.role
                brand_obj = db.query(Brand).filter(Brand.id == membership.brand_id).first()
                if brand_obj:
                    brand_name = brand_obj.name

        return UserPublicProfile(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            email_verified=user.email_verified,
            brand_id=brand_id,
            brand_name=brand_name,
            brand_role=brand_role,
        )

    @classmethod
    def register_user(
        cls,
        db: Session,
        req: UserRegisterRequest,
    ) -> Tuple[User, Optional[str]]:
        email = req.email.strip().lower()

        # Check existing user (account conflict)
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists.",
            )

        # Argon2id password hash
        pw_hash = hash_password(req.password)

        # Public signup ALWAYS creates personal role; admin is strictly prohibited
        user = User(
            email=email,
            password_hash=pw_hash,
            full_name=req.full_name.strip() if req.full_name else None,
            role="personal",
            is_active=True,
            email_verified=False,
        )
        db.add(user)
        db.flush()  # assign user.id

        # Generate single-use email verification token
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=settings.VERIFY_TOKEN_EXPIRE_HOURS)

        token_record = AuthVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            purpose="email_verification",
            expires_at=expires_at,
            is_consumed=False,
        )
        db.add(token_record)

        try:
            # Send/capture token - if email delivery fails, roll back completely
            # to prevent inconsistent or dangling unverified user records
            dev_token = email_service.send_verification_email(user.email, raw_token)
            db.commit()
        except Exception:
            db.rollback()
            raise

        return user, dev_token

    @classmethod
    def login_user(
        cls,
        db: Session,
        req: UserLoginRequest,
    ) -> Tuple[str, str, int, User]:
        email = req.email.strip().lower()
        user = db.query(User).filter(User.email == email).first()

        # Constant-time mitigation for non-existent account
        if not user or not user.password_hash:
            verify_password("dummy_password", DUMMY_ARGON2_HASH)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify password
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Account active check
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled. Please contact support.",
            )

        # Email verification policy check
        if settings.REQUIRE_EMAIL_VERIFICATION and not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email address has not been confirmed yet. Please verify your email.",
            )

        # Create short-lived access JWT
        access_token = create_access_token(user.id, user.email, user.role)

        # Create opaque rotating refresh token stored only as hash
        raw_refresh = generate_secure_token(32)
        ref_hash = hash_token(raw_refresh)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        session = UserSession(
            user_id=user.id,
            session_family_id=uuid.uuid4(),
            token_hash=ref_hash,
            expires_at=expires_at,
            is_revoked=False,
        )
        db.add(session)
        db.commit()

        expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        return access_token, raw_refresh, expires_in, user

    @classmethod
    def refresh_token(
        cls,
        db: Session,
        raw_refresh: str,
    ) -> Tuple[str, str, int, User]:
        if not raw_refresh or not raw_refresh.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token_hash = hash_token(raw_refresh.strip())
        session = (
            db.query(UserSession)
            .filter(UserSession.token_hash == token_hash)
            .with_for_update()
            .first()
        )

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        now = datetime.now(timezone.utc)

        # Replay Attack Detection: If token is revoked or was already replaced, revoke ENTIRE family
        if session.is_revoked or session.replaced_by_token_hash is not None:
            db.query(UserSession).filter(
                UserSession.session_family_id == session.session_family_id,
                UserSession.is_revoked == False,
            ).with_for_update().update(
                {"is_revoked": True, "revoked_at": now},
                synchronize_session="fetch",
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token reuse detected. All sessions in this family have been revoked. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Expiration check
        if session.expires_at < now:
            session.is_revoked = True
            session.revoked_at = now
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # User status check from PostgreSQL
        user = db.query(User).filter(User.id == session.user_id).first()
        if not user or not user.is_active:
            session.is_revoked = True
            session.revoked_at = now
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or disabled.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Token Rotation: Revoke current token and link to replacement
        raw_new_refresh = generate_secure_token(32)
        new_token_hash = hash_token(raw_new_refresh)

        session.is_revoked = True
        session.revoked_at = now
        session.replaced_by_token_hash = new_token_hash

        new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        new_session = UserSession(
            user_id=user.id,
            session_family_id=session.session_family_id,
            token_hash=new_token_hash,
            parent_token_hash=session.token_hash,
            expires_at=new_expires_at,
            is_revoked=False,
        )
        db.add(new_session)
        db.commit()

        # Fresh short-lived access token with current DB status
        new_access_token = create_access_token(user.id, user.email, user.role)
        expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        return new_access_token, raw_new_refresh, expires_in, user

    @classmethod
    def logout_user(cls, db: Session, raw_refresh: Optional[str]) -> bool:
        if raw_refresh and raw_refresh.strip():
            token_hash = hash_token(raw_refresh.strip())
            session = db.query(UserSession).filter(UserSession.token_hash == token_hash).first()
            if session:
                session.is_revoked = True
                session.revoked_at = datetime.now(timezone.utc)
                db.commit()
        return True

    @classmethod
    def verify_email(cls, db: Session, raw_token: str) -> bool:
        if not raw_token or not raw_token.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token is required.",
            )

        token_hash = hash_token(raw_token.strip())
        record = (
            db.query(AuthVerificationToken)
            .filter(
                AuthVerificationToken.token_hash == token_hash,
                AuthVerificationToken.purpose == "email_verification",
            )
            .with_for_update()
            .first()
        )

        now = datetime.now(timezone.utc)
        if not record or record.is_consumed or record.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token.",
            )

        # Single-use consumption
        record.is_consumed = True
        record.consumed_at = now

        user = db.query(User).filter(User.id == record.user_id).first()
        if user:
            user.email_verified = True
        db.commit()
        return True

    @classmethod
    def request_password_reset(cls, db: Session, email: str) -> Tuple[bool, Optional[str]]:
        clean_email = email.strip().lower()
        user = db.query(User).filter(User.email == clean_email).first()

        dev_token = None
        if user and user.is_active:
            raw_token = generate_secure_token(32)
            token_hash = hash_token(raw_token)
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(hours=settings.RESET_TOKEN_EXPIRE_HOURS)

            token_record = AuthVerificationToken(
                user_id=user.id,
                token_hash=token_hash,
                purpose="password_reset",
                expires_at=expires_at,
                is_consumed=False,
            )
            db.add(token_record)
            dev_token = email_service.send_password_reset_email(user.email, raw_token)

        # Always return generic success to prevent account enumeration
        return True, dev_token

    @classmethod
    def confirm_password_reset(
        cls,
        db: Session,
        raw_token: str,
        new_password: str,
    ) -> bool:
        if not raw_token or not raw_token.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token is required.",
            )

        token_hash = hash_token(raw_token.strip())
        record = (
            db.query(AuthVerificationToken)
            .filter(
                AuthVerificationToken.token_hash == token_hash,
                AuthVerificationToken.purpose == "password_reset",
            )
            .with_for_update()
            .first()
        )

        now = datetime.now(timezone.utc)
        if not record or record.is_consumed or record.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token.",
            )

        user = db.query(User).filter(User.id == record.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token.",
            )

        # Single-use consumption
        record.is_consumed = True
        record.consumed_at = now

        # Update password with new Argon2id hash
        user.password_hash = hash_password(new_password)

        # Revoke all existing refresh sessions on password change
        db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.is_revoked == False,
        ).with_for_update().update(
            {"is_revoked": True, "revoked_at": now},
            synchronize_session="fetch",
        )
        db.commit()
        return True
