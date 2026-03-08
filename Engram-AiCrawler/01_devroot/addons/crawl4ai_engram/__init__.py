"""
Crawl4AI Engram Memory Addon

Integrates Crawl4AI with the Engram/Weaviate knowledge system, enabling
long-term memory and cross-session retrieval of crawl results, OSINT
findings, and investigation evidence.

Features:
- Store crawl results in Engram general memory (auto or manual)
- Semantic search across all stored memory
- Investigation matter management (create, ingest, search)
- Zero-impact when disabled — all calls silently no-op

Setup:
    Run `c4ai setup` and choose to enable Engram when prompted, or
    manually set ENGRAM_ENABLED=true in your .env file.
"""

__version__ = "0.1.0"
__author__ = "Crawl4AI Community"
__license__ = "MIT"

try:
    from crawl4ai_engram.config import EngramConfig, get_config, reload_config
    from crawl4ai_engram.client import EngramClient, get_client, EngramNotConfiguredError
except ModuleNotFoundError:
    from config import EngramConfig, get_config, reload_config
    from client import EngramClient, get_client, EngramNotConfiguredError


def get_addon_info() -> dict:
    """Return addon metadata for auto-detection by the addon loader."""
    import json
    from pathlib import Path

    manifest_path = Path(__file__).parent / "manifest.json"
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except FileNotFoundError:
        manifest = {
            "name": "crawl4ai-engram",
            "version": __version__,
            "description": "",
            "api_prefix": "/api/engram",
            "features": [],
        }
    except json.JSONDecodeError as exc:
        import logging

        logging.getLogger(__name__).warning("Invalid manifest.json: %s", exc)
        manifest = {
            "name": "crawl4ai-engram",
            "version": __version__,
            "description": "",
            "api_prefix": "/api/engram",
            "features": [],
        }

    cfg = get_config()
    return {
        "name": manifest["name"],
        "version": manifest["version"],
        "description": manifest.get("description", ""),
        "api_prefix": manifest.get("api_prefix", "/api/engram"),
        "features": manifest.get("features", []),
        "enabled": cfg.enabled,
        "setup_required": not cfg.is_configured,
    }


def register_addon(app) -> dict:
    """
    Register addon with the FastAPI application.

    Called automatically by the addon loader on startup.
    The API routes are always registered so the /api/engram/status
    endpoint works even when Engram is disabled — it reports the
    disabled state rather than 404-ing.
    """
    try:
        from crawl4ai_engram.api.router import router
    except ModuleNotFoundError:
        from api.router import router

    app.include_router(router, prefix="/api/engram", tags=["engram-memory"])

    cfg = get_config()
    if cfg.is_configured:
        import logging

        logging.getLogger(__name__).info("Engram addon registered — connected to %s", cfg.api_url)
    else:
        import logging

        logging.getLogger(__name__).info(
            "Engram addon registered (disabled — set ENGRAM_ENABLED=true to activate)"
        )

    return {
        "name": "crawl4ai-engram",
        "version": __version__,
        "enabled": cfg.is_configured,
        "routers": ["engram"],
    }


__all__ = [
    "__version__",
    "EngramConfig",
    "get_config",
    "reload_config",
    "EngramClient",
    "get_client",
    "EngramNotConfiguredError",
    "get_addon_info",
    "register_addon",
]
