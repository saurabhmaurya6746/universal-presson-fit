from typing import Optional
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from ..config import settings
from ..db.session import get_db
from ..models.user import User
from .schemas import (
    UserRegisterRequest,
    UserRegisterResponse,
    UserLoginRequest,
    UserLoginResponse,
    TokenRefreshResponse,
    UserPublicProfile,
    VerifyEmailRequest,
    PasswordResetRequest,
    PasswordResetConfirmRequest,
    AuthMessageResponse,
)
from .service import AuthService
from .dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "pressonfit_refresh_token"

def set_refresh_cookie(response: Response, raw_refresh: str) -> None:
    """Set secure HttpOnly cookie with rotating refresh token."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_refresh,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.is_cookie_secure,
        samesite="lax",
        path="/api/auth",
    )

def clear_refresh_cookie(response: Response) -> None:
    """Clear refresh token cookie on logout with matching path and security attributes."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api/auth",
        httponly=True,
        secure=settings.is_cookie_secure,
        samesite="lax",
    )

def verify_csrf_origin(request: Request) -> None:
    """
    Verify Origin or Referer for cookie-authenticated state-changing requests (/refresh, /logout).
    Rejects requests with untrusted Origin or Referer to prevent Cross-Site Request Forgery (CSRF).
    """
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")

    # Build set of allowed origins
    allowed = set(settings.get_cors_origins())
    host = request.headers.get("host")
    if host:
        allowed.add(f"http://{host}")
        allowed.add(f"https://{host}")

    target = origin
    if not target and referer:
        parsed = urlparse(referer)
        target = f"{parsed.scheme}://{parsed.netloc}"

    if target:
        normalized_target = target.rstrip("/")
        normalized_allowed = {a.rstrip("/") for a in allowed}
        if normalized_target not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF check failed: Origin or Referer not allowed.",
            )
    else:
        # If neither Origin nor Referer is present, verify Sec-Fetch-Site
        sec_fetch_site = request.headers.get("sec-fetch-site")
        if sec_fetch_site in ("cross-site",):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF check failed: Cross-site request blocked.",
            )

@router.post(
    "/register",
    response_model=UserRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new personal account",
)
def register(
    req: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    user, dev_token = AuthService.register_user(db, req)
    profile = AuthService.resolve_user_profile(db, user)
    return UserRegisterResponse(
        user=profile,
        verification_required=True,
        message="Registration successful. Please verify your email.",
        dev_verification_token=dev_token,
    )

@router.post(
    "/login",
    response_model=UserLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate with email and password",
)
def login(
    req: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    access_token, raw_refresh, expires_in, user = AuthService.login_user(db, req)
    set_refresh_cookie(response, raw_refresh)
    profile = AuthService.resolve_user_profile(db, user)
    return UserLoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=profile,
    )

@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_csrf_origin)],
    summary="Rotate refresh token via HttpOnly cookie and issue new access token",
)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cookie missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token, new_raw_refresh, expires_in, user = AuthService.refresh_token(db, token)
    set_refresh_cookie(response, new_raw_refresh)
    profile = AuthService.resolve_user_profile(db, user)
    return TokenRefreshResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=profile,
    )

@router.post(
    "/logout",
    response_model=AuthMessageResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_csrf_origin)],
    summary="Revoke refresh token from cookie and clear session",
)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        AuthService.logout_user(db, token)
    clear_refresh_cookie(response)
    return AuthMessageResponse(
        success=True,
        message="Successfully logged out.",
    )

@router.get(
    "/me",
    response_model=UserPublicProfile,
    status_code=status.HTTP_200_OK,
    summary="Get current DB-backed user profile and role",
)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AuthService.resolve_user_profile(db, current_user)

@router.post(
    "/verify-email",
    response_model=AuthMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email using single-use token",
)
def verify_email(
    req: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    AuthService.verify_email(db, req.token)
    return AuthMessageResponse(
        success=True,
        message="Email verified successfully.",
    )

@router.post(
    "/password-reset/request",
    response_model=AuthMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a password reset link",
)
def request_password_reset(
    req: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    success, dev_token = AuthService.request_password_reset(db, req.email)
    return AuthMessageResponse(
        success=success,
        message="If an account with that email exists, password reset instructions have been sent.",
        dev_reset_token=dev_token,
    )

@router.post(
    "/password-reset/confirm",
    response_model=AuthMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset password using single-use token",
)
def confirm_password_reset(
    req: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    AuthService.confirm_password_reset(db, req.token, req.new_password)
    return AuthMessageResponse(
        success=True,
        message="Password has been successfully reset. Please log in with your new password.",
    )
