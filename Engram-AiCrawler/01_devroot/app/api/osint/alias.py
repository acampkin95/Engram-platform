"""Alias Discovery endpoints — POST /alias/discover, /alias/search, /alias/batch-discover, GET /platforms."""
from __future__ import annotations
import asyncio
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.osint.alias_discovery import AliasDiscoveryService
from app.osint.platforms import get_all_platforms
from app.services.lm_studio_bridge import LMStudioBridge, LMStudioError
from app.core.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/osint", tags=["osint"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_lm_bridge() -> LMStudioBridge:
    return LMStudioBridge(
        base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        model=os.getenv("LM_STUDIO_MODEL", "local-model"),
        timeout=int(os.getenv("LM_STUDIO_TIMEOUT", "60")),
        temperature=float(os.getenv("LM_STUDIO_TEMPERATURE", "0.7")),
    )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class AliasDiscoverRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=256)
    platforms: list[str] | None = None


class AliasSearchRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=256)


class BatchAliasDiscoverRequest(BaseModel):
    usernames: list[str] = Field(..., min_length=1, max_length=50)
    platforms: list[str] | None = None


# ---------------------------------------------------------------------------
# Alias Discovery endpoints
# ---------------------------------------------------------------------------


@router.post("/alias/discover")
async def discover_aliases(request: AliasDiscoverRequest) -> dict[str, Any]:
    """Generate LLM-powered alias discovery queries for a username."""

    try:
        bridge = _get_lm_bridge()
        service = AliasDiscoveryService(bridge)
        return await service.discover_aliases(
            username=request.username,
            platforms=request.platforms,
        )
    except (LMStudioError, ExternalServiceError) as e:
        raise HTTPException(status_code=502, detail=f"LM Studio error: {e}")
    except Exception as e:
        logger.exception(f"Alias discovery failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error during alias discovery")


@router.post("/alias/search")
async def search_username(request: AliasSearchRequest) -> dict[str, Any]:
    """Comprehensive username search across all platforms."""
    try:
        bridge = _get_lm_bridge()
        service = AliasDiscoveryService(bridge)
        return await service.search_username(username=request.username)
    except (LMStudioError, ExternalServiceError) as e:
        raise HTTPException(status_code=502, detail=f"LM Studio error: {e}")
    except Exception as e:
        logger.exception(f"Username search failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error during username search")


@router.post("/alias/batch-discover")
async def batch_discover_aliases(request: BatchAliasDiscoverRequest) -> dict[str, Any]:
    usernames = list({u.strip() for u in request.usernames if u.strip()})
    if not usernames:
        raise HTTPException(status_code=422, detail="No valid usernames provided")
    if len(usernames) > 50:
        raise HTTPException(status_code=422, detail="Maximum 50 usernames per batch")

    bridge = _get_lm_bridge()
    service = AliasDiscoveryService(bridge)

    async def _discover_one(username: str) -> dict[str, Any]:
        try:
            result = await service.discover_aliases(
                username=username,
                platforms=request.platforms,
            )
            platforms_found: dict[str, dict[str, Any]] = {}
            for query in result.get("queries", []):
                platform = query.get("platform", "unknown")
                platforms_found[platform] = {
                    "found": True,
                    "url": query.get("url", ""),
                    "confidence": query.get("confidence", 0.0),
                }
            return {"username": username, "platforms": platforms_found, "error": None}
        except Exception as exc:
            logger.warning(f"Batch discover failed for '{username}': {exc}")
            return {"username": username, "platforms": {}, "error": str(exc)}

    raw_results = await asyncio.gather(*[_discover_one(u) for u in usernames])

    results: dict[str, dict[str, Any]] = {}
    total_found = 0
    for item in raw_results:
        uname = item["username"]
        platforms_data = item["platforms"]
        results[uname] = platforms_data
        total_found += sum(1 for v in platforms_data.values() if v.get("found"))

    errors = [
        {"username": item["username"], "error": item["error"]}
        for item in raw_results
        if item["error"] is not None
    ]

    return {
        "results": results,
        "summary": {
            "total_usernames": len(usernames),
            "total_found": total_found,
            "total_errors": len(errors),
        },
        "errors": errors,
    }


@router.get("/platforms")
async def list_platforms() -> dict[str, Any]:
    """List all supported OSINT platforms."""
    platforms = get_all_platforms()
    return {
        "platforms": [
            {
                "name": p.name,
                "base_url": p.base_url,
                "profile_url_template": p.profile_url_template,
            }
            for p in platforms
        ],
        "count": len(platforms),
    }
