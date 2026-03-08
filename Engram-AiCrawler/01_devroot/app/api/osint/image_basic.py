"""Image Search and Face Recognition endpoints."""
from __future__ import annotations
import logging
import os
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

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


def _get_face_service():
    from app.osint.face_recognition_service import FaceRecognitionService

    return FaceRecognitionService(
        reference_dir=os.getenv("FACE_REFERENCE_DIR", "/app/data/face_references"),
        tolerance=float(os.getenv("FACE_TOLERANCE", "0.6")),
    )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ImageAnalyzeRequest(BaseModel):
    """Base64-encoded image data for analysis."""

    image_base64: str = Field(..., min_length=1)


class ImageSearchRequest(BaseModel):
    """Natural-language image description for search query generation."""

    image_description: str = Field(..., min_length=1, max_length=2000)


class FaceDetectRequest(BaseModel):
    """Base64-encoded image for face detection."""

    image_base64: str = Field(..., min_length=1)


class FaceMatchRequest(BaseModel):
    """Base64-encoded image for matching against stored reference photos."""

    image_base64: str = Field(..., min_length=1)
    label: str | None = None  # Filter to match against specific person


class FaceReferenceUploadResponse(BaseModel):
    """Response after uploading a face reference photo."""

    photo_id: str
    label: str
    filename: str
    faces_detected: int


# ---------------------------------------------------------------------------
# Image Search endpoints
# ---------------------------------------------------------------------------


@router.post("/image/analyze")
async def analyze_image(request: ImageAnalyzeRequest) -> dict[str, Any]:
    """Analyze an image — compute perceptual hashes and extract metadata."""
    try:
        import base64
        from app.osint.image_search import ImageSearchService

        image_data = base64.b64decode(request.image_base64)
        bridge = _get_lm_bridge()
        service = ImageSearchService(lm_bridge=bridge)
        result = service.analyze_image(image_data)
        return result.model_dump()
    except Exception as e:
        logger.exception(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {e}")


@router.post("/image/search")
async def search_image(request: ImageSearchRequest) -> dict[str, Any]:
    """Generate reverse-image search queries from a description."""
    try:
        from app.osint.image_search import ImageSearchService

        bridge = _get_lm_bridge()
        service = ImageSearchService(lm_bridge=bridge)
        return await service.generate_search_queries(request.image_description)
    except (LMStudioError, ExternalServiceError) as e:
        raise HTTPException(status_code=502, detail=f"LM Studio error: {e}")
    except Exception as e:
        logger.exception(f"Image search failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error during image search")


# ---------------------------------------------------------------------------
# Face Recognition endpoints
# ---------------------------------------------------------------------------


@router.post("/face/reference", status_code=201)
async def upload_face_reference(
    file: UploadFile = File(...),
    label: str = Form(...),
) -> dict[str, Any]:
    """Upload a reference photo for face recognition matching."""
    try:
        service = _get_face_service()
        image_data = await file.read()
        filename = file.filename or "reference.jpg"
        ref = service.save_reference_photo(label=label, image_data=image_data, filename=filename)
        return ref.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.exception(f"Face reference upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save reference photo")


@router.get("/face/reference")
async def list_face_references() -> dict[str, Any]:
    """List all stored face reference photos."""
    service = _get_face_service()
    refs = service.list_reference_photos()
    return {"references": [r.model_dump() for r in refs], "count": len(refs)}


@router.delete("/face/reference/{photo_id}")
async def delete_face_reference(photo_id: str) -> dict[str, Any]:
    """Delete a stored face reference photo."""
    service = _get_face_service()
    if not service.delete_reference_photo(photo_id):
        raise HTTPException(status_code=404, detail=f"Reference photo '{photo_id}' not found")
    return {"deleted": photo_id}


@router.post("/face/detect")
async def detect_faces(request: FaceDetectRequest) -> dict[str, Any]:
    """Detect faces in a base64-encoded image."""
    try:
        import base64 as b64mod

        service = _get_face_service()
        image_data = b64mod.b64decode(request.image_base64)
        result = service.detect_faces(image_data)
        return result.model_dump()
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.exception(f"Face detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Face detection failed: {e}")


@router.post("/face/match")
async def match_faces(request: FaceMatchRequest) -> dict[str, Any]:
    """Match faces in a base64-encoded image against stored references."""
    try:
        import base64 as b64mod

        service = _get_face_service()
        image_data = b64mod.b64decode(request.image_base64)
        result = service.match_faces(image_data, label=request.label)
        return result.model_dump()
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.exception(f"Face matching failed: {e}")
        raise HTTPException(status_code=500, detail=f"Face matching failed: {e}")
