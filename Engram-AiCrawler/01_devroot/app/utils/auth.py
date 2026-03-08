"""Authentication utility functions for common auth patterns."""

from fastapi import Request, HTTPException, status

from app.config import UserRole
from app.middleware.auth import get_current_user
from app.models.auth import AuthenticatedUser


async def require_admin(request: Request) -> AuthenticatedUser:
    """
    Shortcut decorator for requiring admin role.

    Args:
        request: FastAPI Request object

    Returns:
        AuthenticatedUser: Authenticated admin user

    Raises:
        HTTPException: If user is not authenticated or not admin
    """
    user = await get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return user


async def is_admin(request: Request) -> bool:
    """
    Check if authenticated user has admin role.

    Args:
        request: FastAPI Request object

    Returns:
        bool: True if user is admin, False otherwise
    """
    user = await get_current_user(request)

    if not user:
        return False

    return user.role == UserRole.ADMIN


async def get_user_id(request: Request) -> str:
    """
    Get user ID from request state.

    Args:
        request: FastAPI Request object

    Returns:
        str: User ID

    Raises:
        HTTPException: If user is not authenticated
    """
    user = await get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user.user_id


async def get_user_email(request: Request) -> str:
    """
    Get user email from request state.

    Args:
        request: FastAPI Request object

    Returns:
        str: User email

    Raises:
        HTTPException: If user is not authenticated
    """
    user = await get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user.email
