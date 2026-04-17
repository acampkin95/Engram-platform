"""Platform-aware crawl router.

Takes a list of SearchVectors from DeepCrawlOrchestrator and routes each
to the appropriate platform adapter. Falls back to generic crawl4ai for
unknown or unregistered platforms.

This replaces the simple generic loop in DeepCrawlOrchestrator._crawl_vectors
with platform-specific handling, rate limiting, and result normalisation.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass
from app.osint.platforms import get_crawler, get_registry, PlatformCrawlResult

logger = logging.getLogger(__name__)

_registry = get_registry()


class PlatformCrawlRouter:
    """Routes SearchVectors to platform-specific adapters.

    Usage:
        router = PlatformCrawlRouter(max_concurrent=5)
        results = await router.crawl_vectors(vectors)
    """

    def __init__(self, max_concurrent: int = 5) -> None:
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def crawl_vectors(
        self,
        vectors: list[Any],  # List[SearchVector] — typed via TYPE_CHECKING only
    ) -> list[dict[str, Any]]:
        """Crawl all search vectors in parallel (bounded by semaphore).

        Returns a list of crawl result dicts compatible with
        EntityEnrichmentPipeline.extract_pii().
        """
        tasks = [self._crawl_one(v) for v in vectors]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: list[dict[str, Any]] = []
        for vector, raw in zip(vectors, raw_results):
            if isinstance(raw, Exception):
                logger.warning(f"Vector crawl raised exception for {vector.query!r}: {raw}")
                results.append(
                    {
                        "success": False,
                        "query": vector.query,
                        "markdown": None,
                        "error": str(raw),
                    }
                )
            else:
                results.append(raw)  # type: ignore[arg-type]  # raw is dict after isinstance guard above

        return results

    async def _crawl_one(self, vector: Any) -> dict[str, Any]:
        """Crawl a single search vector, routing to the right adapter."""
        async with self._semaphore:
            # Determine which platform to use
            platform_id = self._resolve_platform(vector)

            if platform_id:
                return await self._crawl_with_adapter(vector, platform_id)
            else:
                return await self._crawl_generic(vector)

    def _resolve_platform(self, vector: Any) -> str | None:
        """Pick the best platform adapter for this vector.

        Priority:
        1. vector.platforms list (first matching registered platform)
        2. Infer from vector_type (e.g. "phone" → truepeoplesearch)
        3. None → fall back to generic crawl4ai
        """
        if vector.platforms:
            for platform_name in vector.platforms:
                p = _registry.get(platform_name.lower())
                if p:
                    return p.id

        # Infer from vector type
        type_platform_map: dict[str, str] = {
            "phone": "truepeoplesearch",
            "email": "emailrep",
            "username": "github",
            "name": "truepeoplesearch",
            "address": "truepeoplesearch",
        }
        return type_platform_map.get(vector.vector_type)

    async def _crawl_with_adapter(
        self,
        vector: Any,
        platform_id: str,
    ) -> dict[str, Any]:
        """Use a registered platform adapter."""
        try:
            crawler = get_crawler(platform_id)
            result: PlatformCrawlResult = await crawler.search(vector.query)

            # Convert to enrichment-pipeline format
            base = result.to_crawl_dict()

            # Attach pre-structured extractions so they don't need re-parsing
            base["platform_id"] = platform_id
            base["pre_extracted"] = {
                "names": result.names,
                "emails": result.emails,
                "phones": result.phones,
                "addresses": result.addresses,
                "usernames": result.usernames,
                "image_urls": result.image_urls,
                "profile_urls": result.profile_urls,
                "relationships": result.relationships,
            }
            return base

        except Exception as exc:
            logger.warning(f"Adapter {platform_id!r} failed for {vector.query!r}: {exc}")
            # Fall back to generic
            return await self._crawl_generic(vector)

    async def _crawl_generic(self, vector: Any) -> dict[str, Any]:
        """Generic crawl4ai fallback — used when no adapter matches."""
        try:
            from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
            from app.osint.platforms.base import _random_user_agent

            browser_cfg = BrowserConfig(
                headless=True,
                user_agent=_random_user_agent(),
            )
            run_cfg = CrawlerRunConfig(
                check_robots_txt=True,
                cache_mode=CacheMode.ENABLED,
                word_count_threshold=30,
                page_timeout=30000,
            )

            async with AsyncWebCrawler(config=browser_cfg) as crawler:
                res = await crawler.arun(vector.query, config=run_cfg)
                return {
                    "success": res.success,
                    "query": vector.query,
                    "markdown": res.markdown if res.success else None,
                    "error": res.error_message if not res.success else None,
                }

        except ImportError:
            return {
                "success": False,
                "query": vector.query,
                "markdown": None,
                "error": "crawl4ai not available",
            }
        except Exception as exc:
            return {
                "success": False,
                "query": vector.query,
                "markdown": None,
                "error": str(exc),
            }
