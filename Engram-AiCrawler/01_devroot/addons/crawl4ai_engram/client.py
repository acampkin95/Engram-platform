"""Async HTTP client for the Engram memory API."""
from __future__ import annotations

import json as _json
import logging
from typing import Any, Optional

try:
    import httpx

    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

from .config import EngramConfig, get_config

logger = logging.getLogger(__name__)


class EngramNotConfiguredError(Exception):
    """Raised when Engram is not enabled or not reachable."""


class EngramClient:
    """
    Thin async client for the Engram (DN0_INT_Weaviate) memory API.

    All methods silently return None / empty results when Engram is
    disabled — callers never need to guard against ImportError or
    connection failures themselves.
    """

    def __init__(self, config: Optional[EngramConfig] = None) -> None:
        self._cfg = config or get_config()

    # ── internal ──────────────────────────────────────────────────────────

    def _check_enabled(self) -> None:
        if not self._cfg.is_configured:
            raise EngramNotConfiguredError(
                "Engram is not enabled. Set ENGRAM_ENABLED=true in your .env "
                "or run `c4ai setup` to configure the integration."
            )
        if not HAS_HTTPX:
            raise EngramNotConfiguredError(
                "httpx is required for Engram integration. " "Install it with: pip install httpx"
            )

    async def _post(self, path: str, body: dict[str, Any]) -> Any:
        async with httpx.AsyncClient(
            base_url=self._cfg.api_url,
            headers=self._cfg.headers(),
            timeout=15.0,
        ) as client:
            resp = await client.post(path, json=body)
            resp.raise_for_status()
            try:
                return resp.json()
            except (_json.JSONDecodeError, ValueError) as exc:
                logger.warning("Non-JSON response from Engram API (%s): %s", path, exc)
                raise

    async def _get(self, path: str, params: Optional[dict] = None) -> Any:
        async with httpx.AsyncClient(
            base_url=self._cfg.api_url,
            headers=self._cfg.headers(),
            timeout=10.0,
        ) as client:
            resp = await client.get(path, params=params or {})
            resp.raise_for_status()
            try:
                return resp.json()
            except (_json.JSONDecodeError, ValueError) as exc:
                logger.warning("Non-JSON response from Engram API (%s): %s", path, exc)
                raise

    # ── public API ────────────────────────────────────────────────────────

    async def health(self) -> dict[str, Any]:
        """Check Engram API health. Returns empty dict if disabled/unreachable."""
        if not self._cfg.is_configured:
            return {"status": "disabled"}
        try:
            return await self._get("/health")
        except Exception as exc:
            logger.warning("Engram health check failed: %s", exc)
            return {"status": "unreachable", "error": str(exc)}

    async def store_crawl_result(
        self,
        *,
        url: str,
        content: str,
        title: str = "",
        metadata: Optional[dict] = None,
        project: str = "crawl4ai-default",
    ) -> Optional[dict[str, Any]]:
        """
        Store a crawl result in Engram general memory.

        Returns the stored memory object, or None if Engram is disabled.
        """
        if not self._cfg.is_configured:
            return None
        try:
            self._check_enabled()
            # Guard against None content
            content_str = content or ""
            return await self._post(
                "/memories/",
                {
                    "content": f"[{title}]({url})\n\n{content_str[:4000]}",
                    "source": url,
                    "project": project,
                    "metadata": metadata or {},
                },
            )
        except EngramNotConfiguredError:
            return None
        except Exception as exc:
            logger.warning("Failed to store crawl result in Engram: %s", exc)
            return None

    async def search(
        self,
        query: str,
        *,
        project: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Semantic search across Engram memory.

        Returns an empty list if Engram is disabled or unreachable.
        """
        if not self._cfg.is_configured:
            return []
        try:
            self._check_enabled()
            result = await self._post(
                "/memories/search",
                {"query": query, "project": project, "limit": limit},
            )
            if isinstance(result, dict):
                items = result.get("results", result)
                return items if isinstance(items, list) else []
            return result if isinstance(result, list) else []
        except EngramNotConfiguredError:
            return []
        except Exception as exc:
            logger.warning("Engram search failed: %s", exc)
            return []

    # ── matter / investigation API ────────────────────────────────────────

    async def create_matter(
        self,
        matter_id: str,
        title: str,
        *,
        description: str = "",
        lead_investigator: str = "",
        tags: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        """Create an investigation matter in Engram."""
        if not self._cfg.is_configured:
            return None
        try:
            self._check_enabled()
            return await self._post(
                "/matters/",
                {
                    "matter_id": matter_id,
                    "title": title,
                    "description": description,
                    "lead_investigator": lead_investigator,
                    "tags": tags or [],
                },
            )
        except Exception as exc:
            logger.warning("Failed to create Engram matter: %s", exc)
            return None

    async def ingest_into_matter(
        self,
        matter_id: str,
        *,
        content: str,
        source_url: str,
        source_type: str = "WEB",
        metadata: Optional[dict] = None,
    ) -> Optional[list[dict[str, Any]]]:
        """Ingest a document into a matter's evidence store."""
        if not self._cfg.is_configured:
            return None
        try:
            self._check_enabled()
            return await self._post(
                f"/matters/{matter_id}/evidence",
                {
                    "matter_id": matter_id,
                    "content": content,
                    "source_url": source_url,
                    "source_type": source_type,
                    "metadata": metadata or {},
                },
            )
        except Exception as exc:
            logger.warning("Failed to ingest into Engram matter: %s", exc)
            return None

    async def search_matter(
        self,
        matter_id: str,
        query: str,
        *,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Semantic search within a specific matter's evidence."""
        if not self._cfg.is_configured:
            return []
        try:
            self._check_enabled()
            result = await self._post(
                f"/matters/{matter_id}/evidence/search",
                {"matter_id": matter_id, "query": query, "limit": limit},
            )
            if isinstance(result, dict):
                items = result.get("results", [])
                return items if isinstance(items, list) else []
            return []
        except Exception as exc:
            logger.warning("Engram matter search failed: %s", exc)
            return []

    async def list_matters(self) -> list[dict[str, Any]]:
        """List all investigation matters."""
        if not self._cfg.is_configured:
            return []
        try:
            self._check_enabled()
            result = await self._get("/matters/")
            return result if isinstance(result, list) else []
        except Exception as exc:
            logger.warning("Failed to list Engram matters: %s", exc)
            return []


# ── module-level singleton ────────────────────────────────────────────────────

_client: Optional[EngramClient] = None


def get_client() -> EngramClient:
    """Return the module-level singleton client."""
    global _client
    if _client is None:
        _client = EngramClient()
    return _client
