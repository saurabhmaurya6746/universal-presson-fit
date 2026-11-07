from .router import router
from .service import AuthService
from .dependencies import (
    get_current_user,
    require_role,
    require_admin,
    require_brand_membership,
    require_brand_any,
    require_brand_manager_or_owner,
    require_brand_owner,
    BrandMemberContext,
)
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
from .legacy import (
    AuthenticatedUser,
    BrandMembership,
    get_legacy_supabase_user,
    get_brand_membership,
)

__all__ = [
    "router",
    "AuthService",
    "get_current_user",
    "require_role",
    "require_admin",
    "require_brand_membership",
    "require_brand_any",
    "require_brand_manager_or_owner",
    "require_brand_owner",
    "BrandMemberContext",
    "UserRegisterRequest",
    "UserRegisterResponse",
    "UserLoginRequest",
    "UserLoginResponse",
    "TokenRefreshResponse",
    "UserPublicProfile",
    "VerifyEmailRequest",
    "PasswordResetRequest",
    "PasswordResetConfirmRequest",
    "AuthMessageResponse",
    "AuthenticatedUser",
    "BrandMembership",
    "get_legacy_supabase_user",
    "get_brand_membership",
]
