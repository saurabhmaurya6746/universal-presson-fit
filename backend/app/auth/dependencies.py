import uuid
from typing import Callable, Sequence
from fastapi import Depends, HTTPException, Security, status, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..db.session import get_db
from ..core.security import decode_access_token
from ..models.user import User
from ..models.brand import BrandMember

http_bearer = HTTPBearer(auto_error=True)

class BrandMemberContext(BaseModel):
    brand_id: str
    user_id: str
    role: str
    is_admin_override: bool = False

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate request via JWT Bearer token and load fresh user from PostgreSQL.
    JWT claims are verified for signature and expiration, but user status and role
    are ALWAYS loaded authoritatively from the database.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id_str = payload.get("sub")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Authoritative DB lookup
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def require_role(*roles: str) -> Callable[[User], User]:
    """
    Factory creating a dependency that enforces DB-loaded user roles.
    Never trusts role claims embedded inside JWT tokens.
    """
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: operation requires role in {roles}.",
            )
        return user
    return role_dependency

def require_admin(user: User = Depends(require_role("admin"))) -> User:
    """Enforce administrator role."""
    return user

def require_personal(user: User = Depends(require_role("personal"))) -> User:
    """Enforce personal user role."""
    return user

def require_brand_membership(
    allowed_roles: Sequence[str] = ("owner", "manager"),
) -> Callable[[str, User, Session], BrandMemberContext]:
    """
    Factory creating a dependency to enforce brand studio membership and specific
    brand-level roles (owner, manager) loaded from PostgreSQL.
    Preserves distinct owner vs manager permissions.
    Platform administrators bypass studio membership restrictions.
    """
    def membership_dependency(
        brand_id: str = Path(..., description="Brand studio UUID"),
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> BrandMemberContext:
        # Platform admin override
        if user.role == "admin":
            return BrandMemberContext(
                brand_id=brand_id,
                user_id=str(user.id),
                role="admin",
                is_admin_override=True,
            )

        try:
            brand_uuid = uuid.UUID(brand_id)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid brand ID format.",
            )

        # Query database brand_members table
        membership = (
            db.query(BrandMember)
            .filter(
                BrandMember.brand_id == brand_uuid,
                BrandMember.user_id == user.id,
            )
            .first()
        )

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not belong to this brand studio.",
            )

        if membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires brand role in {allowed_roles}; your role is '{membership.role}'.",
            )

        return BrandMemberContext(
            brand_id=str(membership.brand_id),
            user_id=str(user.id),
            role=membership.role,
            is_admin_override=False,
        )

    return membership_dependency

# Pre-configured brand membership dependencies
require_brand_member = require_brand_membership(("owner", "manager"))
require_brand_any = require_brand_membership(("owner", "manager"))
require_brand_manager_or_owner = require_brand_membership(("owner", "manager"))
require_brand_owner = require_brand_membership(("owner",))
