"""Shared base configuration for Engram microservices."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseEngramSettings(BaseSettings):
    """Base pydantic-settings config shared by all Engram services.

    Subclass this in each service to add service-specific settings.
    All settings can be overridden via environment variables or .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Service identity
    service_name: str = Field(default="engram-service", description="Service name for logging")
    environment: str = Field(default="development", description="Deployment environment")
    log_level: str = Field(default="INFO", description="Log level")
    debug: bool = Field(default=False, description="Enable debug mode")

    # Redis (shared by both services)
    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    redis_ttl: int = Field(default=3600, description="Default Redis TTL in seconds")

    # JWT Auth (shared by both services)
    jwt_secret: str = Field(default="", description="JWT signing secret")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    jwt_expiry_hours: int = Field(default=24, description="JWT expiry in hours")

    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3002", "http://localhost:3000"],
        description="Allowed CORS origins",
    )
