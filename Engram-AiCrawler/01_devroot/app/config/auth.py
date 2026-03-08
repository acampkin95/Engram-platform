"""Authentication configuration module for Clerk JWT-based authentication."""

from __future__ import annotations
import os
from dataclasses import dataclass
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


@dataclass
class UserRole:
    """User role constants."""

    ADMIN: str = "admin"
    USER: str = "user"


@dataclass
class AuthException(Exception):
    """Base authentication exception with to_dict method."""

    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

    def to_dict(self) -> dict:
        """Convert exception to dictionary for API responses."""
        return {"error": self.message, "status_code": self.status_code}


class TokenExpiredError(AuthException):
    """Raised when JWT token has expired."""

    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, status_code=401)


class InvalidTokenError(AuthException):
    """Raised when JWT token is invalid or malformed."""

    def __init__(self, message: str = "Invalid token"):
        super().__init__(message, status_code=401)


class AuthorizationError(AuthException):
    """Raised when user lacks required role for operation."""

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status_code=403)


@dataclass
class ClerkConfig:
    """Clerk authentication configuration loaded from environment variables."""

    secret_key: str
    jwt_key: str
    issuer: str
    audience: str
    admin_users: list[str]
    auth_enabled: bool
    protected_routes_enabled: bool
    token_expiry_hours: int
    refresh_buffer_minutes: int

    @classmethod
    def from_env(cls) -> ClerkConfig:
        auth_enabled = os.getenv("AUTH_ENABLED", "true").lower() == "true"

        if auth_enabled:
            secret_key = os.getenv("CLERK_SECRET_KEY")
            if not secret_key:
                raise ValueError("CLERK_SECRET_KEY environment variable is required")

            jwt_key = os.getenv("CLERK_JWT_KEY")
            if not jwt_key:
                raise ValueError("CLERK_JWT_KEY environment variable is required")
        else:
            secret_key = os.getenv("CLERK_SECRET_KEY", "disabled")
            jwt_key = os.getenv("CLERK_JWT_KEY", "disabled")

        issuer = os.getenv("CLERK_ISSUER", "https://clerk.com")
        audience = os.getenv("CLERK_AUDIENCE", "")

        admin_emails_str = os.getenv("CLERK_ADMIN_USERS", "")
        admin_users = [email.strip() for email in admin_emails_str.split(",") if email.strip()]

        protected_routes_enabled = os.getenv("PROTECTED_ROUTES_ENABLED", "false").lower() == "true"

        token_expiry_hours = int(os.getenv("TOKEN_EXPIRY_HOURS", "24"))
        refresh_buffer_minutes = int(os.getenv("REFRESH_BUFFER_MINUTES", "30"))

        return cls(
            secret_key=secret_key,
            jwt_key=jwt_key,
            issuer=issuer,
            audience=audience,
            admin_users=admin_users,
            auth_enabled=auth_enabled,
            protected_routes_enabled=protected_routes_enabled,
            token_expiry_hours=token_expiry_hours,
            refresh_buffer_minutes=refresh_buffer_minutes,
        )


@lru_cache
def get_clerk_config() -> ClerkConfig:
    return ClerkConfig.from_env()


def is_admin_user(email: str, config: ClerkConfig | None = None) -> bool:
    if config is None:
        config = get_clerk_config()
    return email.lower() in [u.lower() for u in config.admin_users]
