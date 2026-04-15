import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from memory_system.auth import create_access_token, require_auth, verify_password
from memory_system.config import get_settings

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@auth_router.post("/login", response_model=LoginResponse, status_code=201)
async def login(request_obj: Request, request: LoginRequest):
    settings = get_settings()

    if settings.admin_password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dashboard login is not configured (set ADMIN_PASSWORD_HASH in .env)",
        )

    password_valid = verify_password(request.password, settings.admin_password_hash)
    if request.username != settings.admin_username or not password_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        {"sub": request.username},
        secret=settings.jwt_secret,
        expire_hours=settings.jwt_expire_hours,
    )

    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_hours * 3600,
    )


@auth_router.post("/refresh", response_model=LoginResponse, status_code=201)
async def refresh_token(identity: str = Depends(require_auth)):
    settings = get_settings()

    token = create_access_token(
        {"sub": identity},
        secret=settings.jwt_secret,
        expire_hours=settings.jwt_expire_hours,
    )

    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_hours * 3600,
    )
