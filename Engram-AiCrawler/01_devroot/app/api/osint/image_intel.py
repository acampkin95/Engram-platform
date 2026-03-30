"""Image Intelligence endpoints — Phase 3 image pipeline, catalog, identity scoring."""
from __future__ import annotations
import base64 as _base64
import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.osint.image_intelligence import (
    ImageIntelligencePipeline,
    ImageIntelligenceReport,
    CatalogEntry,
    IdentityVerificationScore,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/osint", tags=["osint"])


class ImageIntelRunRequest(BaseModel):
    entity_id: str = Field(..., min_length=1, max_length=256)
    image_urls: list[str] = Field(..., min_length=1, max_length=100)
    run_reverse_search: bool = Field(
        default=True,
        description="Submit images to Google/TinEye/Yandex reverse search",
    )
    max_reverse_search: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Max images to submit for reverse search (rate-limit guard)",
    )
    tineye_api_key: str | None = Field(
        default=None,
        description="TinEye API key (optional — enables official TinEye search)",
    )


class ImageIntelAnalyzeRequest(BaseModel):
    entity_id: str = Field(..., min_length=1, max_length=256)
    image_base64: str = Field(..., min_length=1)
    source_url: str | None = Field(
        default=None,
        description="Original URL the image was sourced from (used for reverse search)",
    )
    run_reverse_search: bool = False


class ImageCatalogResponse(BaseModel):
    entity_id: str
    total_images: int
    unique_images: int
    duplicate_images: int
    entries: list[CatalogEntry]


@router.post("/image-intel/run", response_model=ImageIntelligenceReport, status_code=201)
async def run_image_intelligence(request: ImageIntelRunRequest) -> ImageIntelligenceReport:
    try:
        pipeline = ImageIntelligencePipeline(
            tineye_api_key=request.tineye_api_key,
        )
        report = await pipeline.run(
            entity_id=request.entity_id,
            image_urls=request.image_urls,
            run_reverse_search=request.run_reverse_search,
            max_reverse_search=request.max_reverse_search,
        )
        return report
    except Exception as exc:
        logger.exception("Image intelligence pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {exc}")


@router.post("/image-intel/analyze", response_model=ImageIntelligenceReport, status_code=201)
async def analyze_single_image(request: ImageIntelAnalyzeRequest) -> ImageIntelligenceReport:
    try:
        raw = _base64.b64decode(request.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    try:
        pipeline = ImageIntelligencePipeline()
        report = await pipeline.analyze_single(
            raw_bytes=raw,
            entity_id=request.entity_id,
            source_url=request.source_url,
            run_reverse_search=request.run_reverse_search,
        )
        return report
    except Exception as exc:
        logger.exception("Single image analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Analysis error: {exc}")


@router.get("/image-intel/catalog/{entity_id}", response_model=ImageCatalogResponse, status_code=200)
async def get_image_catalog(entity_id: str) -> ImageCatalogResponse:
    from app.osint.image_intelligence import ImageCatalog

    catalog = ImageCatalog()
    entries = catalog.load_catalog(entity_id)
    unique = [e for e in entries if not e.is_duplicate]
    dups = [e for e in entries if e.is_duplicate]
    return ImageCatalogResponse(
        entity_id=entity_id,
        total_images=len(entries),
        unique_images=len(unique),
        duplicate_images=len(dups),
        entries=entries,
    )


@router.post("/image-intel/ingest", response_model=CatalogEntry, status_code=201)
async def ingest_image(
    entity_id: str = Form(...),
    source_url: str | None = Form(None),
    file: UploadFile = File(...),
) -> CatalogEntry:
    raw = await file.read()
    if len(raw) < 100:
        raise HTTPException(status_code=400, detail="File too small to be a valid image")

    from app.osint.image_intelligence import ImageCatalog

    catalog = ImageCatalog()
    try:
        entry = await catalog.ingest_bytes(raw, entity_id, source_url=source_url)
        return entry
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Image ingest failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Ingest error: {exc}")


@router.get("/image-intel/score/{entity_id}", response_model=IdentityVerificationScore, status_code=200)
async def get_identity_score(entity_id: str) -> IdentityVerificationScore:
    from app.osint.image_intelligence import ImageCatalog, FaceClusterer, compute_identity_score

    catalog = ImageCatalog()
    entries = catalog.load_catalog(entity_id)
    if not entries:
        raise HTTPException(
            status_code=404,
            detail=f"No images cataloged for entity '{entity_id}'",
        )
    clusterer = FaceClusterer()
    clusters = clusterer.cluster_catalog(entries, entity_id)
    score = compute_identity_score(entity_id, entries, clusters, [])
    return score


@router.delete("/image-intel/catalog/{entity_id}", status_code=200)
async def clear_image_catalog(entity_id: str) -> dict[str, Any]:
    import shutil
    from app.osint.image_intelligence import _CATALOG_ROOT

    entity_dir = _CATALOG_ROOT / entity_id
    if not entity_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No catalog found for entity '{entity_id}'",
        )
    shutil.rmtree(entity_dir, ignore_errors=True)
    return {"entity_id": entity_id, "deleted": True}
