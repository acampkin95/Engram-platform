"""JWT verification middleware for Clerk authentication."""

from __future__ import annotations
import jwt
from fastapi import Request, HTTPException, status

from app.config import get_clerk_config, UserRole
from app.models.auth import AuthenticatedUser
from app.config.auth import (
    TokenExpiredError,
    InvalidTokenError,
    AuthorizationError,
)


def verify_jwt_token(authorization_header: str) -> AuthenticatedUser:
    """

    Verify and decode Clerk JWT token.

    Args:
        authorization_header: Authorization header value (Bearer <token>)

    Returns:
        AuthenticatedUser: User information extracted from token

    Raises:
        TokenExpiredError: If token has expired
        InvalidTokenError: If token is malformed or invalid
        AuthorizationError: If authorization header is malformed
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise AuthorizationError("Missing or invalid Authorization header")

    token = authorization_header[7:]
    config = get_clerk_config()

    try:
        payload = jwt.decode(
            token,
            config.jwt_key,
            algorithms=["RS256"],
            audience=config.audience,
            issuer=config.issuer,
        )

        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id or not email:
            raise InvalidTokenError("Token missing required claims")

        iat = payload.get("iat", 0)
        exp = payload.get("exp", 0)

        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            role=UserRole.ADMIN
            if email.lower() in [u.lower() for u in config.admin_users]
            else UserRole.USER,
            iat=iat,
            exp=exp,
        )

    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Token has expired")

    except jwt.InvalidSignatureError:
        raise InvalidTokenError("Invalid token signature")

    except jwt.InvalidAudienceError:
        raise InvalidTokenError("Invalid token audience")

    except jwt.InvalidIssuerError:
        raise InvalidTokenError("Invalid token issuer")

    except jwt.InvalidTokenError as e:
        raise InvalidTokenError(f"Invalid token: {str(e)}")


async def require_auth(role: str | None = None):
    """
    FastAPI dependency to require authentication.

    Args:
        role: Optional role requirement (None, 'admin', 'user')

    Returns:
        Callable: FastAPI dependency that raises HTTPException if auth fails
    """

    async def dependency(request: Request):
        config = get_clerk_config()

        if not config.auth_enabled:
            return None

        authorization_header = request.headers.get("Authorization")

        if not authorization_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            user = verify_jwt_token(authorization_header)

            if user.is_token_expired():
                raise TokenExpiredError("Token has expired")

            if role and user.role != role:
                raise AuthorizationError(f"Role '{role}' required, but user has role '{user.role}'")

            request.state.user = user

        except TokenExpiredError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=e.message,
            )
        except InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=e.message,
            )
        except AuthorizationError as e:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=e.message,
            )

    return dependency


async def get_current_user(request: Request) -> AuthenticatedUser | None:
    """
    Get authenticated user from request state.

    Args:
        request: FastAPI Request object

    Returns:
        Optional[AuthenticatedUser]: User if authenticated, None otherwise
    """
    return getattr(request.state, "user", None)


async def get_current_user_role(request: Request) -> str | None:
    """
    Get authenticated user's role from request state.

    Args:
        request: FastAPI Request object

    Returns:
        Optional[str]: User role if authenticated, None otherwise
    """
    user = await get_current_user(request)
    return user.role if user else None


async def require_admin_user(request: Request) -> AuthenticatedUser | None:
    """
    FastAPI dependency to require admin role.

    Args:
        request: FastAPI Request object

    Returns:
        AuthenticatedUser: Authenticated admin user

    Raises:
        HTTPException: If user is not authenticated or not admin
    """
    config = get_clerk_config()

    if not config.auth_enabled:
        return None

    authorization_header = request.headers.get("Authorization")

    if not authorization_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = verify_jwt_token(authorization_header)

        if user.is_token_expired():
            raise TokenExpiredError("Token has expired")

        if user.role != UserRole.ADMIN:
            raise AuthorizationError("Admin access required")

        request.state.user = user

    except TokenExpiredError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    return user
