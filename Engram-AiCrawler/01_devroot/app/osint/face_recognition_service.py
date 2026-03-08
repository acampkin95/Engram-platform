"""OSINT face recognition service — detection, encoding, and matching against reference photos."""

from __future__ import annotations
import asyncio
import base64
import hashlib
import io
import json
import logging
import shutil
import uuid
from datetime import datetime, UTC
from pathlib import Path
from typing import Any

import numpy as np
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------

_MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
_MIN_IMAGE_SIZE_BYTES = 100  # Minimum plausible image size
_DOWNLOAD_MAX_RETRIES = 3
_DOWNLOAD_RETRY_DELAY_BASE = 1.0  # Seconds; doubles each retry
_MATCH_URL_TIMEOUT_SECONDS = 120  # Per-URL timeout for async matching

_IMAGE_MAGIC_BYTES: dict[bytes, str] = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG": "png",
    b"GIF8": "gif",
    b"RIFF": "webp",
    b"BM": "bmp",
}

# ---------------------------------------------------------------------------
# Graceful degradation when optional native libraries are not installed
# ---------------------------------------------------------------------------

try:
    import face_recognition as _fr
except ImportError:
    _fr = None  # type: ignore[assignment]
    logger.warning("face_recognition library not installed — " "face detection/matching disabled")

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore[assignment]
    logger.warning("opencv-python-headless not installed — " "image decoding will use PIL fallback")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class FaceLocation(BaseModel):
    """Bounding-box coordinates for a detected face."""

    top: int
    right: int
    bottom: int
    left: int


class FaceEncoding(BaseModel):
    """A single detected face with its location and encoding hash."""

    face_id: str
    location: FaceLocation
    encoding_hash: str  # SHA256 of the encoding bytes for comparison tracking


class FaceAnalysisResult(BaseModel):
    """Result of face detection on a single image."""

    faces_detected: int
    faces: list[FaceEncoding]
    timestamp: str


class FaceMatch(BaseModel):
    """A single face-match comparison result."""

    reference_id: str
    reference_label: str
    face_id: str
    distance: float
    confidence: float  # 1.0 - distance
    match: bool


class FaceMatchResult(BaseModel):
    """Aggregated results from matching faces against reference photos."""

    matches: list[FaceMatch]
    total_faces_analyzed: int
    total_matches: int
    threshold: float
    timestamp: str


class ReferencePhoto(BaseModel):
    """Metadata for a stored reference photo."""

    photo_id: str
    label: str
    filename: str
    file_size_bytes: int
    faces_detected: int
    created_at: str


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class FaceRecognitionService:
    """Face detection, encoding, and matching against a library of reference
    photos.

    Reference photos are persisted on the filesystem::

        {reference_dir} / {photo_id} / {filename}
        {reference_dir} / {photo_id} / encodings.json

    Parameters:
        reference_dir: Directory for storing reference photos and encodings.
        tolerance: Maximum face-distance to consider a match (lower = stricter).
    """

    def __init__(
        self,
        reference_dir: str = "/app/data/face_references",
        tolerance: float = 0.6,
    ) -> None:
        self.reference_dir = Path(reference_dir)
        self.tolerance = tolerance
        self.reference_dir.mkdir(parents=True, exist_ok=True)

    # -- Reference management -----------------------------------------------

    def save_reference_photo(
        self,
        label: str,
        image_data: bytes,
        filename: str,
    ) -> ReferencePhoto:
        """Save a reference photo to disk, encode faces, and return metadata.

        Cleans up the on-disk directory if face encoding fails so that
        corrupt/partial references are never persisted.
        """
        if _fr is None:
            raise RuntimeError("face_recognition library is not installed")

        self._validate_image(image_data)

        photo_id = uuid.uuid4().hex
        photo_dir = self.reference_dir / photo_id
        photo_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Persist the raw image file
            file_path = photo_dir / filename
            file_path.write_bytes(image_data)

            # Detect and encode faces
            img_array = self._bytes_to_array(image_data)
            locations = _fr.face_locations(img_array)
            encodings = _fr.face_encodings(
                img_array,
                known_face_locations=locations,
            )

            # Serialise encodings to JSON (numpy arrays -> base64)
            enc_records: list[dict[str, Any]] = []
            for loc, enc in zip(locations, encodings):
                enc_b64 = base64.b64encode(enc.tobytes()).decode("ascii")
                enc_records.append(
                    {
                        "location": {
                            "top": loc[0],
                            "right": loc[1],
                            "bottom": loc[2],
                            "left": loc[3],
                        },
                        "encoding_b64": enc_b64,
                        "dtype": str(enc.dtype),
                        "shape": list(enc.shape),
                    }
                )

            encodings_path = photo_dir / "encodings.json"
            encodings_path.write_text(
                json.dumps(
                    {
                        "label": label,
                        "photo_id": photo_id,
                        "filename": filename,
                        "faces": enc_records,
                    },
                    indent=2,
                )
            )

        except Exception:
            # Clean up partial files so we never leave a corrupt reference
            if photo_dir.exists():
                shutil.rmtree(photo_dir, ignore_errors=True)
            raise

        now = datetime.now(UTC).isoformat()
        logger.info(
            "Saved reference photo %s for '%s' (%d face(s) detected)",
            photo_id,
            label,
            len(encodings),
        )
        return ReferencePhoto(
            photo_id=photo_id,
            label=label,
            filename=filename,
            file_size_bytes=len(image_data),
            faces_detected=len(locations),
            created_at=now,
        )

    def list_reference_photos(self) -> list[ReferencePhoto]:
        """List all stored reference photos with metadata."""
        photos: list[ReferencePhoto] = []
        if not self.reference_dir.exists():
            return photos

        for child in sorted(self.reference_dir.iterdir()):
            enc_path = child / "encodings.json"
            if not child.is_dir() or not enc_path.exists():
                continue
            try:
                meta = json.loads(enc_path.read_text())
                image_files = [
                    f for f in child.iterdir() if f.is_file() and f.name != "encodings.json"
                ]
                file_size = image_files[0].stat().st_size if image_files else 0
                photos.append(
                    ReferencePhoto(
                        photo_id=meta["photo_id"],
                        label=meta["label"],
                        filename=meta["filename"],
                        file_size_bytes=file_size,
                        faces_detected=len(meta.get("faces", [])),
                        created_at=datetime.fromtimestamp(
                            enc_path.stat().st_mtime,
                            tz=UTC,
                        ).isoformat(),
                    )
                )
            except (json.JSONDecodeError, KeyError, IndexError) as exc:
                logger.warning(
                    "Skipping corrupt reference dir %s: %s",
                    child.name,
                    exc,
                )

        return photos

    def delete_reference_photo(self, photo_id: str) -> bool:
        """Delete a reference photo and its encodings."""
        photo_dir = self.reference_dir / photo_id
        if not photo_dir.exists() or not photo_dir.is_dir():
            return False
        shutil.rmtree(photo_dir)
        logger.info("Deleted reference photo %s", photo_id)
        return True

    def get_reference_encodings(
        self,
        label: str | None = None,
    ) -> dict[str, Any]:
        """Load all reference face encodings, optionally filtered by label.

        Returns a dict mapping ``photo_id`` to
        ``{"label": str, "encodings": List[np.ndarray]}``.
        """
        result: dict[str, Any] = {}
        if not self.reference_dir.exists():
            return result

        for child in self.reference_dir.iterdir():
            enc_path = child / "encodings.json"
            if not child.is_dir() or not enc_path.exists():
                continue
            try:
                meta = json.loads(enc_path.read_text())
                if label and meta.get("label") != label:
                    continue
                encodings: list[np.ndarray] = []
                for face in meta.get("faces", []):
                    raw = base64.b64decode(face["encoding_b64"])
                    # .copy() is required — np.frombuffer returns a
                    # read-only view which face_recognition rejects.
                    arr = np.frombuffer(
                        raw,
                        dtype=np.float64,
                    ).copy()
                    if "shape" in face:
                        arr = arr.reshape(face["shape"])
                    encodings.append(arr)
                result[meta["photo_id"]] = {
                    "label": meta["label"],
                    "encodings": encodings,
                }
            except (json.JSONDecodeError, KeyError) as exc:
                logger.warning(
                    "Skipping corrupt encodings in %s: %s",
                    child.name,
                    exc,
                )

        return result

    # -- Detection ----------------------------------------------------------

    def detect_faces(self, image_data: bytes) -> FaceAnalysisResult:
        """Detect all faces in an image; return locations and encoding
        hashes."""
        if _fr is None:
            return FaceAnalysisResult(
                faces_detected=0,
                faces=[],
                timestamp=datetime.now(UTC).isoformat(),
            )

        self._validate_image(image_data)
        img_array = self._bytes_to_array(image_data)
        locations = _fr.face_locations(img_array)
        encodings = _fr.face_encodings(
            img_array,
            known_face_locations=locations,
        )

        faces: list[FaceEncoding] = []
        for loc, enc in zip(locations, encodings):
            enc_hash = hashlib.sha256(enc.tobytes()).hexdigest()
            faces.append(
                FaceEncoding(
                    face_id=uuid.uuid4().hex,
                    location=FaceLocation(
                        top=loc[0],
                        right=loc[1],
                        bottom=loc[2],
                        left=loc[3],
                    ),
                    encoding_hash=enc_hash,
                )
            )

        return FaceAnalysisResult(
            faces_detected=len(faces),
            faces=faces,
            timestamp=datetime.now(UTC).isoformat(),
        )

    # -- Matching -----------------------------------------------------------

    def match_faces(
        self,
        image_data: bytes,
        label: str | None = None,
    ) -> FaceMatchResult:
        """Compare faces in *image_data* against stored reference encodings.

        Args:
            image_data: Raw image bytes.
            label: Optional label to restrict comparison to one person.
        """
        if _fr is None:
            return FaceMatchResult(
                matches=[],
                total_faces_analyzed=0,
                total_matches=0,
                threshold=self.tolerance,
                timestamp=datetime.now(UTC).isoformat(),
            )

        self._validate_image(image_data)
        img_array = self._bytes_to_array(image_data)
        locations = _fr.face_locations(img_array)
        encodings = _fr.face_encodings(
            img_array,
            known_face_locations=locations,
        )

        ref_data = self.get_reference_encodings(label=label)
        if not ref_data:
            return FaceMatchResult(
                matches=[],
                total_faces_analyzed=len(encodings),
                total_matches=0,
                threshold=self.tolerance,
                timestamp=datetime.now(UTC).isoformat(),
            )

        matches: list[FaceMatch] = []
        for enc in encodings:
            face_id = uuid.uuid4().hex
            for photo_id, info in ref_data.items():
                ref_encs: list[np.ndarray] = info["encodings"]
                if not ref_encs:
                    continue
                distances = _fr.face_distance(ref_encs, enc)
                best_dist = float(np.min(distances))
                confidence = max(0.0, 1.0 - best_dist)
                is_match = best_dist <= self.tolerance
                matches.append(
                    FaceMatch(
                        reference_id=photo_id,
                        reference_label=info["label"],
                        face_id=face_id,
                        distance=round(best_dist, 6),
                        confidence=round(confidence, 6),
                        match=is_match,
                    )
                )

        total_matches = sum(1 for m in matches if m.match)
        return FaceMatchResult(
            matches=matches,
            total_faces_analyzed=len(encodings),
            total_matches=total_matches,
            threshold=self.tolerance,
            timestamp=datetime.now(UTC).isoformat(),
        )

    async def match_from_url(self, url: str) -> FaceMatchResult:
        """Download an image from *url* and run face matching.

        Applies a per-URL timeout to prevent indefinite hangs on
        slow downloads or oversized images.
        """
        try:
            image_data = await asyncio.wait_for(
                self._download_image(url),
                timeout=_MATCH_URL_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            raise TimeoutError(
                f"Face match for {url} timed out after " f"{_MATCH_URL_TIMEOUT_SECONDS}s"
            ) from None
        except Exception as exc:
            raise RuntimeError(f"Failed to download image from {url}: {exc}") from exc

        return self.match_faces(image_data)

    async def batch_match_urls(
        self,
        urls: list[str],
        max_concurrent: int = 5,
    ) -> list[dict[str, Any]]:
        """Match faces across multiple URLs with concurrency control."""
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _match_one(url: str) -> dict[str, Any]:
            async with semaphore:
                try:
                    result = await self.match_from_url(url)
                    return {
                        "url": url,
                        "success": True,
                        "result": result.model_dump(),
                    }
                except (TimeoutError, RuntimeError, ValueError) as exc:
                    logger.warning(
                        "Face match failed for %s: %s",
                        url,
                        exc,
                    )
                    return {
                        "url": url,
                        "success": False,
                        "error": str(exc),
                    }
                except Exception as exc:
                    logger.error(
                        "Unexpected error during face match for %s: %s",
                        url,
                        exc,
                        exc_info=True,
                    )
                    return {
                        "url": url,
                        "success": False,
                        "error": f"Unexpected error: {exc}",
                    }

        tasks = [_match_one(u) for u in urls]
        return list(await asyncio.gather(*tasks))

    # -- Internal helpers ---------------------------------------------------

    @staticmethod
    def _validate_image(image_data: bytes) -> None:
        """Validate image data before processing.

        Raises ``ValueError`` for empty, oversized, or unrecognised data.
        """
        if not image_data or len(image_data) < _MIN_IMAGE_SIZE_BYTES:
            raise ValueError(
                f"Image data too small ({len(image_data)} bytes) — " "not a valid image"
            )
        if len(image_data) > _MAX_IMAGE_SIZE_BYTES:
            size_mb = len(image_data) / (1024 * 1024)
            limit_mb = _MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
            raise ValueError(f"Image too large ({size_mb:.1f} MB, " f"max {limit_mb:.0f} MB)")
        for magic in _IMAGE_MAGIC_BYTES:
            if image_data[: len(magic)] == magic:
                return
        raise ValueError("Unsupported image format — " "expected JPEG, PNG, GIF, WebP, or BMP")

    @staticmethod
    def _bytes_to_array(image_data: bytes) -> np.ndarray:
        """Convert raw image bytes to a numpy RGB array.

        Tries OpenCV first (faster), falls back to PIL.
        """
        if cv2 is not None:
            buf = np.frombuffer(image_data, dtype=np.uint8)
            img_bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
            if img_bgr is None:
                raise ValueError("Failed to decode image with OpenCV")
            return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # Fallback to PIL (always available via pillow dependency)
        from PIL import Image

        img = Image.open(io.BytesIO(image_data)).convert("RGB")
        return np.array(img)

    @staticmethod
    async def _download_image(url: str) -> bytes:
        """Download an image from a URL with retry logic.

        Retries up to ``_DOWNLOAD_MAX_RETRIES`` times with exponential
        back-off on transient HTTP errors (429, 5xx) and connection
        failures.
        """
        try:
            import httpx
        except ImportError:
            raise RuntimeError(
                "httpx is required for URL downloads — " "install it or crawl4ai[all]"
            ) from None

        last_exc: Exception | None = None
        for attempt in range(_DOWNLOAD_MAX_RETRIES):
            try:
                async with httpx.AsyncClient(
                    timeout=30.0,
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    data = response.content
                    if len(data) < _MIN_IMAGE_SIZE_BYTES:
                        raise ValueError(
                            f"Downloaded content too small " f"({len(data)} bytes) from {url}"
                        )
                    return data
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status == 429 or status >= 500:
                    last_exc = exc
                    delay = _DOWNLOAD_RETRY_DELAY_BASE * (2**attempt)
                    logger.warning(
                        "Retrying download %s (HTTP %d, attempt %d/%d, " "wait %.1fs)",
                        url,
                        status,
                        attempt + 1,
                        _DOWNLOAD_MAX_RETRIES,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise  # 4xx errors (except 429) are not retryable
            except (httpx.ConnectError, httpx.ReadTimeout) as exc:
                last_exc = exc
                delay = _DOWNLOAD_RETRY_DELAY_BASE * (2**attempt)
                logger.warning(
                    "Retrying download %s (%s, attempt %d/%d, " "wait %.1fs)",
                    url,
                    type(exc).__name__,
                    attempt + 1,
                    _DOWNLOAD_MAX_RETRIES,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

        raise RuntimeError(
            f"Failed to download {url} after " f"{_DOWNLOAD_MAX_RETRIES} attempts: {last_exc}"
        )

    @staticmethod
    def is_available() -> bool:
        """Return True if the face_recognition library is installed."""
        return _fr is not None
