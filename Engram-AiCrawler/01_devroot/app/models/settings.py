from __future__ import annotations

from pydantic import BaseModel, Field


class CrawlDefaults(BaseModel):
    extraction_type: str = "css"
    word_count_threshold: int = 50
    wait_for: str | None = None
    screenshot: bool = False
    pdf: bool = False


class ConnectionSettings(BaseModel):
    lm_studio_url: str = "http://localhost:1234/v1"
    redis_url: str = "redis://localhost:6379/0"


class NotificationSettings(BaseModel):
    crawl_complete: bool = True
    crawl_error: bool = True
    scan_complete: bool = True


class NetworkPrivacySettings(BaseModel):
    proxy_url: str | None = None
    user_agent_mode: str = "default"  # "default", "rotate", "custom"
    custom_user_agent: str | None = None
    dns_over_https: bool = False


class AppSettings(BaseModel):
    theme: str = "system"  # "light", "dark", "system"
    language: str = "en"
    crawl_defaults: CrawlDefaults = Field(default_factory=CrawlDefaults)
    connections: ConnectionSettings = Field(default_factory=ConnectionSettings)
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)
    network_privacy: NetworkPrivacySettings = Field(default_factory=NetworkPrivacySettings)


class ConnectionTestRequest(BaseModel):
    url: str = Field(..., description="URL to test connectivity against")


class ConnectionTestResult(BaseModel):
    url: str
    status: str  # "connected" | "disconnected"
    latency_ms: float | None = None
    error: str | None = None
