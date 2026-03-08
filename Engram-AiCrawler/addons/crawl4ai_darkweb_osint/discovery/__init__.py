"""Discovery module for dark web search engines."""

from crawl4ai_darkweb_osint.discovery.search import (
    DarkWebDiscoveryEngine,
    SearchResult,
    SearchEngine,
)
from crawl4ai_darkweb_osint.discovery.query_refine import (
    refine_query,
    QueryRefiner,
)
from crawl4ai_darkweb_osint.discovery.dedup import (
    deduplicate_results,
    normalize_url,
)

__all__ = [
    "DarkWebDiscoveryEngine",
    "SearchResult",
    "SearchEngine",
    "refine_query",
    "QueryRefiner",
    "deduplicate_results",
    "normalize_url",
]
