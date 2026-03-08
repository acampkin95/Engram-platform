"""Configuration for the Crawl4AI Engram addon."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EngramConfig:
    """Engram integration configuration, loaded from environment variables."""

    # Master switch — set by the install wizard
    enabled: bool = field(
        default_factory=lambda: os.getenv("ENGRAM_ENABLED", "false").lower() == "true"
    )

    # Engram API endpoint (the DN0_INT_Weaviate memory API)
    api_url: str = field(
        default_factory=lambda: os.getenv("ENGRAM_API_URL") or "http://localhost:8000"
    )

    # Optional API key (if Engram API has auth enabled)
    api_key: Optional[str] = field(default_factory=lambda: os.getenv("ENGRAM_API_KEY") or None)

    # Automatically store every crawl result into Engram memory
    auto_store: bool = field(
        default_factory=lambda: os.getenv("ENGRAM_AUTO_STORE", "true").lower() == "true"
    )

    @property
    def is_configured(self) -> bool:
        """True when Engram is enabled and an API URL is set."""
        return self.enabled and bool(self.api_url)

    def headers(self) -> dict[str, str]:
        """Build HTTP headers for Engram API requests."""
        h: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h


_config: Optional[EngramConfig] = None


def get_config() -> EngramConfig:
    """Return the singleton config instance (lazy-loaded from env)."""
    global _config
    if _config is None:
        _config = EngramConfig()
    return _config


def reload_config() -> EngramConfig:
    """Force a reload of config from environment (useful after wizard writes .env)."""
    global _config
    _config = EngramConfig()
    return _config
