"""Application initialization."""

from app.config import (
    ClerkConfig,
    get_clerk_config,
    UserRole,
    AuthException,
    TokenExpiredError,
    InvalidTokenError,
    AuthorizationError,
    is_admin_user,
)

from app.models.auth import AuthenticatedUser

from app.middleware.auth import (
    verify_jwt_token,
    require_auth,
    get_current_user,
    get_current_user_role,
)

from app.utils.auth import (
    require_admin,
    is_admin as check_is_admin,
    get_user_id,
    get_user_email,
)

__all__ = [
    "ClerkConfig",
    "get_clerk_config",
    "UserRole",
    "AuthException",
    "TokenExpiredError",
    "InvalidTokenError",
    "AuthorizationError",
    "is_admin_user",
    "AuthenticatedUser",
    "verify_jwt_token",
    "require_auth",
    "get_current_user",
    "get_current_user_role",
    "require_admin",
    "check_is_admin",
    "get_user_id",
    "get_user_email",
]
