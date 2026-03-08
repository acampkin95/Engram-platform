"""Extraction module for .onion content."""

from crawl4ai_darkweb_osint.extraction.tor_config import (
    TorBrowserConfig,
    TorCrawlerConfig,
)
from crawl4ai_darkweb_osint.extraction.onion_strategy import (
    OnionExtractionStrategy,
)
from crawl4ai_darkweb_osint.extraction.cleaner import (
    clean_content,
    extract_metadata,
)

__all__ = [
    "TorBrowserConfig",
    "TorCrawlerConfig",
    "OnionExtractionStrategy",
    "clean_content",
    "extract_metadata",
]
