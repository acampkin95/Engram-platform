from __future__ import annotations

import asyncio
import logging
import os
from typing import Any
from datetime import datetime
from app._compat import UTC
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

from app.services.lm_studio_bridge import LMStudioBridge, LMStudioError


logger = logging.getLogger(__name__)


class CrawlOrchestrator:
    def __init__(self, lm_bridge: LMStudioBridge | None = None, max_concurrent: int = 5):
        self.lm_bridge = lm_bridge or LMStudioBridge(
            base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        )
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def create_crawl_plan(self, query: str) -> dict[str, Any]:
        """Generate crawl plan from natural language query using LM Studio"""
        try:
            plan = await self.lm_bridge.generate_crawl_strategy(query)
            return plan
        except LMStudioError as e:
            logger.error(f"Failed to generate crawl plan: {e}")
            raise

    async def execute_plan(self, plan: dict[str, Any]) -> list[dict[str, Any]]:
        """Execute crawl plan with parallel crawling"""
        if not plan.get("urls"):
            raise ValueError("Plan must contain at least one URL")

        urls = plan["urls"] if isinstance(plan.get("urls"), list) else []
        if not urls:
            raise ValueError("Plan must contain at least one URL")

        browser_config = BrowserConfig(
            headless=True,
            viewport_width=1920,
            viewport_height=1080,
        )

        plan.get("extraction_type", "css")

        tasks = []
        for url in urls:
            task = self._execute_single_crawl(url, plan, browser_config)
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, BaseException):
                logger.error(f"Crawl {i} failed: {result}")
                processed_results.append({"url": urls[i], "success": False, "error": str(result)})
            else:
                processed_results.append(result)

        return processed_results

    async def _execute_single_crawl(
        self, url: str, plan: dict[str, Any], browser_config: BrowserConfig
    ) -> dict[str, Any]:
        async with self.semaphore:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                run_config = CrawlerRunConfig(
                    cache_mode=CacheMode.ENABLED,
                    wait_for=plan.get("wait_for"),
                    word_count_threshold=plan.get("word_count_threshold", 50),
                    screenshot=False,
                    pdf=False,
                )

                result = await crawler.arun(url, config=run_config)

                return {
                    "url": url,
                    "success": result.success,
                    "markdown": result.markdown if result.success else None,
                    "html": result.html if result.success else None,
                    "extracted_content": result.extracted_content if result.success else None,
                    "links": result.links.get("internal", [])
                    if result.links and result.success
                    else [],
                    "media": result.media if result.success else None,
                    "error": result.error_message if not result.success else None,
                    "word_count": len(result.markdown.split())
                    if result.markdown and result.success
                    else 0,
                    "title": result.metadata.get("title", "")
                    if result.metadata and result.success
                    else "",
                    "timestamp": datetime.now(UTC).isoformat(),
                }

    async def correlate(self, results: list[dict[str, Any]]) -> dict[str, Any]:
        """Correlate results using LM Studio"""
        try:
            correlated = await self.lm_bridge.correlate_results(results)
            return correlated
        except LMStudioError as e:
            logger.error(f"Failed to correlate results: {e}")
            return {"correlated": [], "error": str(e)}

    async def orchestrate_crawl(self, query: str) -> dict[str, Any]:
        """Full orchestration: plan -> execute -> correlate"""
        logger.info(f"Starting crawl orchestration for query: {query}")

        await self._send_progress("planning", {"query": query})

        plan = await self.create_crawl_plan(query)

        urls = plan.get("urls", [])
        if not urls:
            raise ValueError("Generated plan contains no URLs")

        plan["urls"] = urls

        await self._send_progress("executing", {"url_count": len(urls), "plan": plan})

        results = await self.execute_plan(plan)

        successful_results = [r for r in results if r.get("success")]

        await self._send_progress(
            "correlating",
            {"total": len(results), "successful": len(successful_results)},
        )

        correlated = await self.correlate(results)

        await self._send_progress(
            "completed",
            {
                "results_count": len(results),
                "correlated_count": len(correlated.get("correlated", [])),
            },
        )

        return {
            "query": query,
            "plan": plan,
            "results": results,
            "correlated": correlated,
            "summary": {
                "total_urls": len(urls),
                "successful_crawls": len(successful_results),
                "failed_crawls": len(results) - len(successful_results),
                "correlations_found": len(correlated.get("correlated", [])),
            },
        }

    async def _send_progress(self, status: str, data: dict[str, Any]):
        """Send progress update (placeholder for WebSocket integration)"""
        logger.info(f"Progress [{status}]: {data}")
