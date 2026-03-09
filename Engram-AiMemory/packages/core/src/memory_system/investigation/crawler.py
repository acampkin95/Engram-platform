"""OSINT crawler for investigation matters using Crawl4AI with Redis URL deduplication."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import AsyncIterator
from urllib.parse import urljoin, urlparse

from rich.console import Console

console = Console()


@dataclass
class CrawlResult:
    """Result of crawling a single URL."""
    url: str
    matter_id: str
    content: str
    markdown: str
    title: str = ""
    crawled_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    source_type: str = "WEB"
    metadata: dict = field(default_factory=dict)
    success: bool = True
    error: str = ""


@dataclass
class CrawlJob:
    """A crawl job for a matter."""
    matter_id: str
    seed_urls: list[str]
    max_depth: int = 2
    max_pages: int = 50
    allowed_domains: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)


class InvestigationCrawler:
    """OSINT crawler with Redis URL deduplication and Crawl4AI backend."""

    REDIS_KEY_PREFIX = "investigation:crawled_urls"
    DEFAULT_MAX_PAGES = 50
    DEFAULT_MAX_DEPTH = 2

    def __init__(self, redis_client=None):
        """
        Args:
            redis_client: Optional redis.Redis instance. If None, deduplication is in-memory only.
        """
        self._redis = redis_client
        self._in_memory_seen: set[str] = set()

    async def crawl_matter(self, job: CrawlJob) -> AsyncIterator[CrawlResult]:
        """Crawl URLs for a matter, yielding CrawlResult for each page.

        Uses Redis SADD/SISMEMBER for URL deduplication.
        Respects max_depth and max_pages limits.
        check_robots_txt=True ALWAYS — never False.
        """
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

        browser_config = BrowserConfig(
            headless=True,
            text_mode=True,   # Disable images for speed
            light_mode=True,  # Reduce background features
        )

        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            exclude_all_images=True,
            excluded_tags=["script", "style", "nav", "footer", "aside"],
            word_count_threshold=50,
            page_timeout=30000,
            check_robots_txt=True,  # ALWAYS True — never False
        )

        pages_crawled = 0
        queue: list[tuple[str, int]] = [(url, 0) for url in job.seed_urls]  # (url, depth)

        async with AsyncWebCrawler(config=browser_config) as crawler:
            while queue and pages_crawled < job.max_pages:
                url, depth = queue.pop(0)

                # Deduplication check
                if await self._is_seen(job.matter_id, url):
                    continue

                # Domain restriction
                if job.allowed_domains and not self._is_allowed_domain(url, job.allowed_domains):
                    continue

                # Mark as seen before crawl to prevent race conditions
                await self._mark_seen(job.matter_id, url)

                try:
                    result = await crawler.arun(url, config=run_config)
                    pages_crawled += 1

                    if not result.success:
                        yield CrawlResult(
                            url=url,
                            matter_id=job.matter_id,
                            content="",
                            markdown="",
                            success=False,
                            error=result.error_message or "Unknown error",
                        )
                        continue

                    # Extract content
                    markdown_content = result.markdown or ""
                    raw_content = result.cleaned_html or markdown_content

                    # Extract title
                    title = ""
                    if result.metadata:
                        title = result.metadata.get("title", "") or ""

                    crawl_result = CrawlResult(
                        url=url,
                        matter_id=job.matter_id,
                        content=raw_content,
                        markdown=markdown_content,
                        title=title,
                        source_type="WEB",
                        metadata={
                            "depth": depth,
                            "crawled_at": datetime.now(UTC).isoformat(),
                        },
                    )

                    yield crawl_result

                    # Enqueue discovered links if within depth limit
                    if depth < job.max_depth and result.links:
                        for link_info in result.links.get("internal", []):
                            href = link_info.get("href", "") if isinstance(link_info, dict) else str(link_info)
                            if href and href.startswith("http"):
                                if not await self._is_seen(job.matter_id, href):
                                    queue.append((href, depth + 1))

                except Exception as exc:
                    console.print(f"[red]Crawl error for {url}: {exc}[/red]")
                    yield CrawlResult(
                        url=url,
                        matter_id=job.matter_id,
                        content="",
                        markdown="",
                        success=False,
                        error=str(exc),
                    )

        console.print(f"[green]Crawl complete: {pages_crawled} pages for matter {job.matter_id}[/green]")

    async def crawl_single(self, url: str, matter_id: str) -> CrawlResult:
        """Crawl a single URL. Does not use deduplication."""
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

        browser_config = BrowserConfig(headless=True, text_mode=True, light_mode=True)
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            exclude_all_images=True,
            excluded_tags=["script", "style", "nav", "footer"],
            word_count_threshold=20,
            page_timeout=30000,
            check_robots_txt=True,  # ALWAYS True
        )

        try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                result = await crawler.arun(url, config=run_config)
                if not result.success:
                    return CrawlResult(
                        url=url, matter_id=matter_id, content="", markdown="",
                        success=False, error=result.error_message or "Unknown error",
                    )
                markdown_content = result.markdown or ""
                title = ""
                if result.metadata:
                    title = result.metadata.get("title", "") or ""
                return CrawlResult(
                    url=url,
                    matter_id=matter_id,
                    content=result.cleaned_html or markdown_content,
                    markdown=markdown_content,
                    title=title,
                    source_type="WEB",
                )
        except Exception as exc:
            console.print(f"[red]crawl_single error for {url}: {exc}[/red]")
            return CrawlResult(
                url=url, matter_id=matter_id, content="", markdown="",
                success=False, error=str(exc),
            )

    async def _is_seen(self, matter_id: str, url: str) -> bool:
        """Check if URL has been crawled for this matter."""
        key = f"{self.REDIS_KEY_PREFIX}:{matter_id}"
        if self._redis is not None:
            try:
                return bool(self._redis.sismember(key, url))
            except Exception as exc:
                console.print(f"[yellow]Redis sismember failed, using in-memory: {exc}[/yellow]")
        return url in self._in_memory_seen

    async def _mark_seen(self, matter_id: str, url: str) -> None:
        """Mark URL as seen for this matter."""
        key = f"{self.REDIS_KEY_PREFIX}:{matter_id}"
        if self._redis is not None:
            try:
                self._redis.sadd(key, url)
                return
            except Exception as exc:
                console.print(f"[yellow]Redis sadd failed, using in-memory: {exc}[/yellow]")
        self._in_memory_seen.add(url)

    async def clear_seen_urls(self, matter_id: str) -> None:
        """Clear seen URLs for a matter (useful for re-crawl)."""
        key = f"{self.REDIS_KEY_PREFIX}:{matter_id}"
        if self._redis is not None:
            try:
                self._redis.delete(key)
                return
            except Exception as exc:
                console.print(f"[yellow]Redis delete failed: {exc}[/yellow]")
        self._in_memory_seen.clear()

    def _is_allowed_domain(self, url: str, allowed_domains: list[str]) -> bool:
        """Check if URL's domain is in the allowed list."""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            return any(domain == d.lower() or domain.endswith(f".{d.lower()}") for d in allowed_domains)
        except Exception:
            return False
