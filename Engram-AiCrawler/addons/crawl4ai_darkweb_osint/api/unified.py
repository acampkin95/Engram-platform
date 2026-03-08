"""
Unified API router for Dark Web OSINT addon.

Combines all API routers into a single router for easy integration.
"""

from fastapi import APIRouter

from crawl4ai_darkweb_osint.api.discovery import router as discovery_router
from crawl4ai_darkweb_osint.api.extraction import router as extraction_router
from crawl4ai_darkweb_osint.api.analysis import router as analysis_router

# Create main router
router = APIRouter(prefix="/darkweb", tags=["darkweb-osint"])

# Include sub-routers
router.include_router(discovery_router, prefix="/discovery", tags=["darkweb-discovery"])
router.include_router(
    extraction_router, prefix="/extraction", tags=["darkweb-extraction"]
)
router.include_router(analysis_router, prefix="/analysis", tags=["darkweb-analysis"])


# Root endpoint for the addon
@router.get("/")
async def darkweb_root():
    """Dark Web OSINT addon root endpoint."""
    return {
        "name": "crawl4ai-darkweb-osint",
        "version": "0.1.0",
        "description": "Dark web OSINT discovery and extraction addon",
        "endpoints": {
            "discovery": {
                "search": "POST /api/darkweb/discover",
                "engines_status": "GET /api/darkweb/engines/status",
                "engines_list": "GET /api/darkweb/engines/list",
            },
            "extraction": {
                "extract": "POST /api/darkweb/extract",
                "batch_extract": "POST /api/darkweb/extract/batch",
                "status": "GET /api/darkweb/extract/status/{job_id}",
            },
            "analysis": {
                "analyze": "POST /api/darkweb/analyze",
                "report": "GET /api/darkweb/report/{analysis_id}",
                "presets": "GET /api/darkweb/presets",
                "extract_artifacts": "POST /api/darkweb/artifacts/extract",
            },
        },
    }


@router.get("/health")
async def darkweb_health():
    """Overall health check for the Dark Web OSINT addon."""
    from crawl4ai_darkweb_osint.config import get_config
    from crawl4ai_darkweb_osint.tor_proxy import check_tor_connection
    import asyncio

    config = get_config()

    # Check Tor
    tor_status = asyncio.run(
        check_tor_connection(
            host=config.tor.host,
            port=config.tor.port,
            timeout=5,
        )
    )

    return {
        "status": "healthy",
        "version": "0.1.0",
        "tor": {
            "connected": tor_status.get("connected", False),
            "proxy": tor_status.get("proxy"),
            "error": tor_status.get("error"),
        },
        "llm": {
            "provider": config.llm.provider,
            "model": config.llm.model,
        },
    }


def register_addon(app):
    """
    Register the Dark Web OSINT addon with a FastAPI app.

    This is the main entry point called by the addon loader.

    Args:
        app: FastAPI application instance

    Returns:
        Dict with registration info
    """
    app.include_router(router, prefix="/api")

    return {
        "name": "crawl4ai-darkweb-osint",
        "version": "0.1.0",
        "routers": ["discovery", "extraction", "analysis"],
        "api_prefix": "/api/darkweb",
    }


__all__ = ["router", "register_addon"]
