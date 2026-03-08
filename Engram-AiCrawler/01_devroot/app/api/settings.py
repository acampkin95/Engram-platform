import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from app.models.settings import AppSettings, ConnectionTestRequest, ConnectionTestResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

_SETTINGS_PATH = Path(os.getenv("DATA_PATH", "data")) / "settings.json"


def _load_settings() -> AppSettings:
    try:
        if _SETTINGS_PATH.exists():
            raw = _SETTINGS_PATH.read_text(encoding="utf-8")
            data: Any = json.loads(raw)
            return AppSettings.model_validate(data)
    except Exception as exc:
        logger.warning("Failed to load settings from %s: %s", _SETTINGS_PATH, exc)
    return AppSettings()


def _save_settings(settings: AppSettings) -> None:
    try:
        _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _SETTINGS_PATH.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to save settings to %s: %s", _SETTINGS_PATH, exc)
        raise HTTPException(status_code=500, detail="Failed to persist settings")


@router.get("", response_model=AppSettings)
async def get_settings() -> AppSettings:
    return _load_settings()


@router.put("", response_model=AppSettings)
async def update_settings(partial: dict) -> AppSettings:
    current = _load_settings()
    merged = _deep_merge(current.model_dump(), partial)
    try:
        updated = AppSettings.model_validate(merged)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid settings: {exc}")
    _save_settings(updated)
    return updated


def _deep_merge(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


@router.post("/test-connection", response_model=ConnectionTestResult)
async def test_connection(request: ConnectionTestRequest) -> ConnectionTestResult:
    import time

    url = request.url.rstrip("/") + "/models"
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
        latency_ms = (time.perf_counter() - start) * 1000
        if response.status_code < 500:
            return ConnectionTestResult(
                url=request.url,
                status="connected",
                latency_ms=round(latency_ms, 2),
            )
        return ConnectionTestResult(
            url=request.url,
            status="disconnected",
            latency_ms=round(latency_ms, 2),
            error=f"HTTP {response.status_code}",
        )
    except Exception as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        return ConnectionTestResult(
            url=request.url,
            status="disconnected",
            latency_ms=round(latency_ms, 2),
            error=str(exc),
        )
