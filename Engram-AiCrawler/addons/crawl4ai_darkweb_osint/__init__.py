"""
Crawl4AI Dark Web OSINT Addon

A modular addon for dark web OSINT discovery and extraction.
Integrates Robin's 16 search engine aggregator with Crawl4AI's browser-based extraction.

Features:
- 16 dark web search engines via Tor SOCKS5 proxy
- LLM-powered query refinement and semantic filtering
- Crawl4AI browser extraction for .onion sites
- 4 preset analysis modes (threat intel, ransomware, PII, corporate)
- Interactive setup wizard
- Unified dashboard integration

Usage:
    # After placing in addons/ folder, the addon auto-detects on startup
    # Access via:
    # - API: POST /api/darkweb/discover
    # - UI: Dark Web OSINT tab in dashboard
"""

__version__ = "0.1.0"
__author__ = "Crawl4AI Community"
__license__ = "MIT"

# Handle imports both when installed as package and when run from directory
try:
    from crawl4ai_darkweb_osint.config import DarkWebConfig, get_config
    from crawl4ai_darkweb_osint.tor_proxy import TorSession, check_tor_connection
except ModuleNotFoundError:
    # Running from within the module directory
    from config import DarkWebConfig, get_config
    from tor_proxy import TorSession, check_tor_connection


# Lazy imports for heavy modules
def get_discovery_engine():
    """Get the discovery engine (lazy import)."""
    try:
        from crawl4ai_darkweb_osint.discovery.search import DarkWebDiscoveryEngine
    except ModuleNotFoundError:
        from discovery.search import DarkWebDiscoveryEngine
    return DarkWebDiscoveryEngine


def get_llm_provider():
    """Get LLM provider factory (lazy import)."""
    try:
        from crawl4ai_darkweb_osint.llm_providers import get_llm_client
    except ModuleNotFoundError:
        from llm_providers import get_llm_client
    return get_llm_client


def get_extraction_strategy():
    """Get onion extraction strategy (lazy import)."""
    try:
        from crawl4ai_darkweb_osint.extraction.onion_strategy import (
            OnionExtractionStrategy,
        )
    except ModuleNotFoundError:
        from extraction.onion_strategy import OnionExtractionStrategy
    return OnionExtractionStrategy


def get_analysis_presets():
    """Get analysis presets (lazy import)."""
    try:
        from crawl4ai_darkweb_osint.analysis.presets import PRESET_PROMPTS
    except ModuleNotFoundError:
        from analysis.presets import PRESET_PROMPTS
    return PRESET_PROMPTS


def get_addon_info():
    """Return addon metadata for auto-detection."""
    import json
    from pathlib import Path

    manifest_path = Path(__file__).parent / "manifest.json"
    with open(manifest_path) as f:
        manifest = json.load(f)

    return {
        "name": manifest["name"],
        "version": manifest["version"],
        "description": manifest["description"],
        "api_prefix": manifest["api_prefix"],
        "features": manifest["features"],
        "setup_required": not get_config().is_configured,
    }


def register_addon(app):
    """
    Register addon with FastAPI application.

    Called by addon_loader when auto-detecting addons.

    Args:
        app: FastAPI application instance
    """
    try:
        from crawl4ai_darkweb_osint.api.discovery import router as discovery_router
        from crawl4ai_darkweb_osint.api.extraction import router as extraction_router
        from crawl4ai_darkweb_osint.api.analysis import router as analysis_router
    except ModuleNotFoundError:
        from api.discovery import router as discovery_router
        from api.extraction import router as extraction_router
        from api.analysis import router as analysis_router

    app.include_router(
        discovery_router, prefix="/api/darkweb", tags=["darkweb-discovery"]
    )
    app.include_router(
        extraction_router, prefix="/api/darkweb", tags=["darkweb-extraction"]
    )
    app.include_router(
        analysis_router, prefix="/api/darkweb", tags=["darkweb-analysis"]
    )

    return {
        "name": "crawl4ai-darkweb-osint",
        "version": __version__,
        "routers": ["discovery", "extraction", "analysis"],
    }


__all__ = [
    "__version__",
    "__author__",
    "__license__",
    "DarkWebConfig",
    "get_config",
    "TorSession",
    "check_tor_connection",
    "get_discovery_engine",
    "get_llm_provider",
    "get_extraction_strategy",
    "get_analysis_presets",
    "get_addon_info",
    "register_addon",
]
