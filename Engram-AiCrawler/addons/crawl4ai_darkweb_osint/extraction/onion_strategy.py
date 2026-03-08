"""
Onion-specific extraction strategy for Crawl4AI.

Provides specialized extraction for .onion sites with:
- Tor proxy support
- JavaScript rendering
- Dark web content handling
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse

from crawl4ai_darkweb_osint.config import get_config, ExtractionConfig
from crawl4ai_darkweb_osint.extraction.tor_config import (
    TorBrowserConfig,
    TorCrawlerConfig,
    create_tor_browser_config,
    create_tor_crawler_config,
)
from crawl4ai_darkweb_osint.extraction.cleaner import clean_content

logger = logging.getLogger(__name__)


@dataclass
class OnionExtractionResult:
    """Result from onion extraction."""

    url: str
    success: bool
    title: str = ""
    content: str = ""
    html: str = ""
    markdown: str = ""
    links: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    extraction_time: float = 0.0

    def is_onion(self) -> bool:
        """Check if URL is an .onion address."""
        return ".onion" in self.url.lower()


class OnionExtractionStrategy:
    """
    Extraction strategy for .onion sites.

    Uses Crawl4AI's AsyncWebCrawler with Tor proxy configuration.
    """

    def __init__(
        self,
        browser_config: Optional[TorBrowserConfig] = None,
        crawler_config: Optional[TorCrawlerConfig] = None,
    ):
        self.browser_config = browser_config or create_tor_browser_config()
        self.crawler_config = crawler_config or create_tor_crawler_config()
        self._crawler = None

    async def _get_crawler(self):
        """Get or create Crawl4AI crawler."""
        if self._crawler is None:
            try:
                from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

                # Create browser config with Tor proxy
                browser_cfg = BrowserConfig(
                    headless=self.browser_config.headless,
                    browser_type=self.browser_config.browser_type,
                    viewport_width=self.browser_config.viewport_width,
                    viewport_height=self.browser_config.viewport_height,
                    proxy=self.browser_config.proxy_config,
                    user_agent=self.browser_config.user_agent,
                    ignore_https_errors=self.browser_config.ignore_https_errors,
                )

                self._crawler = AsyncWebCrawler(config=browser_cfg)
                await self._crawler.start()

            except ImportError:
                raise ImportError(
                    "Crawl4AI not installed. Install with: pip install crawl4ai"
                )

        return self._crawler

    async def extract(
        self,
        url: str,
        wait_for: Optional[str] = None,
        js_code: Optional[str] = None,
    ) -> OnionExtractionResult:
        """
        Extract content from an .onion URL.

        Args:
            url: .onion URL to extract from
            wait_for: CSS selector to wait for (optional)
            js_code: JavaScript to execute before extraction (optional)

        Returns:
            OnionExtractionResult with extracted content
        """
        import time

        start_time = time.time()

        result = OnionExtractionResult(
            url=url,
            success=False,
        )

        # Validate URL
        if not self._is_valid_onion_url(url):
            result.error = "Invalid .onion URL"
            return result

        try:
            crawler = await self._get_crawler()

            from crawl4ai import CrawlerRunConfig

            # Build run config
            config = CrawlerRunConfig(
                word_count_threshold=self.crawler_config.word_count_threshold,
                excluded_tags=self.crawler_config.excluded_tags,
                exclude_external_links=self.crawler_config.exclude_external_links,
                exclude_all_images=self.crawler_config.exclude_all_images,
                wait_for=wait_for or self.crawler_config.wait_for,
                page_timeout=self.crawler_config.wait_timeout,
                js_code=js_code or self.crawler_config.js_code,
                screenshot=self.crawler_config.screenshot,
                pdf=self.crawler_config.pdf,
                cache_mode=self.crawler_config.cache_mode,
            )

            # Execute crawl
            crawl_result = await crawler.arun(url, config=config)

            if crawl_result.success:
                result.success = True
                result.title = crawl_result.metadata.get("title", "")
                result.html = crawl_result.html or ""
                result.markdown = crawl_result.markdown or ""
                result.links = crawl_result.links.get(
                    "internal", []
                ) + crawl_result.links.get("external", [])
                result.metadata = crawl_result.metadata or {}

                # Clean content
                result.content = clean_content(result.markdown or result.html)

            else:
                result.error = crawl_result.error_message or "Extraction failed"

        except asyncio.TimeoutError:
            result.error = "Extraction timed out"

        except Exception as e:
            logger.error(f"Extraction failed for {url}: {e}")
            result.error = str(e)

        result.extraction_time = time.time() - start_time
        return result

    async def extract_many(
        self,
        urls: List[str],
        max_concurrent: int = 3,
    ) -> List[OnionExtractionResult]:
        """
        Extract content from multiple .onion URLs.

        Args:
            urls: List of .onion URLs
            max_concurrent: Maximum concurrent extractions

        Returns:
            List of OnionExtractionResult
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def limited_extract(url):
            async with semaphore:
                return await self.extract(url)

        results = await asyncio.gather(
            *[limited_extract(url) for url in urls],
            return_exceptions=True,
        )

        # Handle exceptions
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                final_results.append(
                    OnionExtractionResult(
                        url=urls[i],
                        success=False,
                        error=str(result),
                    )
                )
            else:
                final_results.append(result)

        return final_results

    def _is_valid_onion_url(self, url: str) -> bool:
        """Validate if URL is a valid .onion or regular URL."""
        try:
            parsed = urlparse(url)
            # Accept both .onion and regular URLs (for testing)
            return parsed.scheme in ("http", "https") and bool(parsed.netloc)
        except Exception:
            return False

    async def close(self):
        """Close the crawler."""
        if self._crawler:
            await self._crawler.close()
            self._crawler = None


# Convenience function
async def extract_onion(
    url: str,
    config: Optional[ExtractionConfig] = None,
) -> OnionExtractionResult:
    """
    Quick extraction helper for .onion URLs.

    Args:
        url: .onion URL to extract
        config: Extraction configuration

    Returns:
        OnionExtractionResult
    """
    extraction_config = config or get_config().extraction

    browser_config = create_tor_browser_config(
        page_timeout=extraction_config.page_timeout,
        disable_images=not extraction_config.screenshot,
    )

    crawler_config = create_tor_crawler_config(
        wait_for=extraction_config.wait_for_selector,
        excluded_tags=extraction_config.excluded_tags,
        screenshot=extraction_config.screenshot,
        pdf=extraction_config.pdf,
    )

    strategy = OnionExtractionStrategy(
        browser_config=browser_config,
        crawler_config=crawler_config,
    )

    try:
        return await strategy.extract(url)
    finally:
        await strategy.close()


# CLI entry point
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Onion extraction")
    parser.add_argument("url", help="URL to extract from")
    parser.add_argument("--wait-for", help="CSS selector to wait for")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    async def main():
        result = await extract_onion(args.url, wait_for=args.wait_for)

        if args.json:
            print(
                json.dumps(
                    {
                        "success": result.success,
                        "url": result.url,
                        "title": result.title,
                        "content": result.content[:500] if result.content else "",
                        "links_count": len(result.links),
                        "error": result.error,
                        "extraction_time": result.extraction_time,
                    },
                    indent=2,
                )
            )
        else:
            print(f"Success: {result.success}")
            print(f"Title: {result.title}")
            if result.error:
                print(f"Error: {result.error}")
            if result.content:
                print(f"\nContent preview:\n{result.content[:500]}...")

    asyncio.run(main())
