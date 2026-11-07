import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import argon2
from jose import jwt, JWTError
from fastapi import HTTPException, status
from ..config import settings

# Configure RFC 9106 recommended Argon2id parameters
_hasher = argon2.PasswordHasher(
    time_cost=2,
    memory_cost=19456,  # 19 MiB
    parallelism=1,
    hash_len=32,
    type=argon2.Type.ID,
)

# Dummy hash for timing attack mitigation when user does not exist
DUMMY_ARGON2_HASH = _hasher.hash("dummy_constant_time_padding_password_123!")

JWT_ISSUER = "presson-fit"
JWT_AUDIENCE = "presson-fit-api"

def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _hasher.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against Argon2id hash.
    Constant-time comparison handled by argon2-cffi.
    """
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (argon2.exceptions.VerifyMismatchError, argon2.exceptions.InvalidHashError):
        return False
    except Exception:
        return False

def hash_token(raw_token: str) -> str:
    """
    Compute SHA-256 hash of high-entropy token for safe database persistence.
    Raw tokens are never stored at rest.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

def generate_secure_token(nbytes: int = 32) -> str:
    """Generate high-entropy URL-safe token."""
    return secrets.token_urlsafe(nbytes)

def create_access_token(
    user_id: str | uuid.UUID,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed short-lived JWT access token.
    Claims include issuer, audience, subject, role, issue time, and expiration.
    Role claim is informational only; authoritative roles are loaded from PostgreSQL.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode: Dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }

    signing_secret = settings.get_jwt_signing_secret()
    return jwt.encode(
        to_encode,
        signing_secret,
        algorithm=settings.JWT_ALGORITHM,
    )

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate JWT access token signature, algorithm, issuer, audience, and expiry.
    Rejects tokens with wrong algorithm, issuer, audience, or expired timestamp.
    """
    signing_secret = settings.get_jwt_signing_secret()
    try:
        payload = jwt.decode(
            token,
            signing_secret,
            algorithms=[settings.JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
            },
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token subject missing.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTClaimsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims validation failed (invalid issuer, audience, or format).",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
