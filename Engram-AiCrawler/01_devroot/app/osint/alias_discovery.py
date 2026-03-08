"""OSINT alias discovery service — generates search queries and profile URLs."""

from __future__ import annotations
import logging
from datetime import datetime, UTC
from typing import Any

from app.osint.platforms import get_platform, get_all_platforms
from app.services.lm_studio_bridge import LMStudioBridge

logger = logging.getLogger(__name__)


class AliasDiscoveryService:
    """Discovers aliases and generates search queries for a username across platforms."""

    def __init__(self, lm_bridge: LMStudioBridge) -> None:
        self.lm_bridge = lm_bridge

    async def discover_aliases(
        self,
        username: str,
        platforms: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate LLM-powered alias discovery queries for a username.

        Args:
            username: Target username to investigate.
            platforms: Optional list of platform names to filter results.

        Returns:
            Dict with username, queries, platforms_searched, and timestamp.
        """
        logger.info(f"Discovering aliases for '{username}'")
        result = await self.lm_bridge.generate_alias_discovery_queries(username)

        queries = result.get("queries", [])
        if platforms:
            lower_platforms = {p.lower() for p in platforms}
            queries = [q for q in queries if q.get("platform", "").lower() in lower_platforms]

        platforms_searched = sorted({q.get("platform", "unknown") for q in queries})

        return {
            "username": username,
            "queries": queries,
            "platforms_searched": platforms_searched,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    async def build_profile_urls(
        self,
        username: str,
        platforms: list[str] | None = None,
    ) -> list[dict[str, str]]:
        """Generate direct profile URLs for a username across platforms.

        Args:
            username: Target username.
            platforms: Optional list of platform names to restrict.

        Returns:
            List of {"platform": ..., "url": ...} dicts.
        """
        if platforms:
            configs = [c for p in platforms if (c := get_platform(p)) is not None]
        else:
            configs = get_all_platforms()

        return [
            {
                "platform": cfg.id,
                "url": cfg.profile_url_template.format(username=username),
            }
            for cfg in configs
            if cfg.profile_url_template is not None
        ]

    async def search_username(self, username: str) -> dict[str, Any]:
        """Comprehensive username search combining aliases and profile URLs.

        Args:
            username: Target username.

        Returns:
            Combined result with profile_urls, search_queries, and timestamp.
        """
        profile_urls = await self.build_profile_urls(username)
        alias_result = await self.discover_aliases(username)

        return {
            "username": username,
            "profile_urls": profile_urls,
            "search_queries": alias_result.get("queries", []),
            "platforms_searched": alias_result.get("platforms_searched", []),
            "timestamp": datetime.now(UTC).isoformat(),
        }
