"""API endpoints for dark web OSINT."""

from crawl4ai_darkweb_osint.api.discovery import router as discovery_router
from crawl4ai_darkweb_osint.api.extraction import router as extraction_router
from crawl4ai_darkweb_osint.api.analysis import router as analysis_router

__all__ = [
    "discovery_router",
    "extraction_router",
    "analysis_router",
]
