"""OSINT image search service — perceptual hashing, metadata extraction, and search query generation."""

from __future__ import annotations
import base64
import hashlib
import io
import logging
from datetime import datetime, UTC
from typing import Any

import imagehash
from PIL import Image, ExifTags
from pydantic import BaseModel

from app.services.lm_studio_bridge import LMStudioBridge

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ImageHashResult(BaseModel):
    """Perceptual hash results for an image."""

    phash: str
    dhash: str
    whash: str
    ahash: str


class ImageMetadata(BaseModel):
    """Image metadata extracted from file."""

    width: int
    height: int
    format: str | None = None
    mode: str
    exif: dict[str, Any] | None = None
    file_size_bytes: int | None = None


class ImageAnalysisResult(BaseModel):
    """Complete image analysis output."""

    hashes: ImageHashResult
    metadata: ImageMetadata
    md5: str
    sha256: str
    timestamp: str


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def hamming_similarity(hash1_hex: str, hash2_hex: str) -> float:
    """Compute similarity (0.0–1.0) between two hex-encoded perceptual hashes.

    Uses hamming distance: similarity = 1 - (distance / total_bits).
    """
    h1 = imagehash.hex_to_hash(hash1_hex)
    h2 = imagehash.hex_to_hash(hash2_hex)
    distance = h1 - h2  # imagehash overloads __sub__ as hamming distance
    total_bits = h1.hash.size
    if total_bits == 0:
        return 0.0
    return 1.0 - (distance / total_bits)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ImageSearchService:
    """Perceptual hashing, metadata extraction, and LLM-powered image search."""

    def __init__(
        self,
        lm_bridge: LMStudioBridge,
        similarity_threshold: float = 0.85,
    ) -> None:
        self.lm_bridge = lm_bridge
        self.similarity_threshold = similarity_threshold

    # -- Loading helpers ---------------------------------------------------

    def _load_image(self, image_data: bytes) -> Image.Image:
        """Load a PIL Image from raw bytes."""
        return Image.open(io.BytesIO(image_data))

    def _load_image_from_base64(self, b64_string: str) -> Image.Image:
        """Decode base64 string and load as PIL Image."""
        raw = base64.b64decode(b64_string)
        return self._load_image(raw)

    # -- Hashing -----------------------------------------------------------

    def compute_hashes(self, image: Image.Image) -> ImageHashResult:
        """Compute four perceptual hashes for an image."""
        return ImageHashResult(
            phash=str(imagehash.phash(image)),
            dhash=str(imagehash.dhash(image)),
            whash=str(imagehash.whash(image)),
            ahash=str(imagehash.average_hash(image)),
        )

    # -- Metadata ----------------------------------------------------------

    def extract_metadata(
        self,
        image: Image.Image,
        raw_bytes: bytes | None = None,
    ) -> ImageMetadata:
        """Extract image metadata including EXIF if available."""
        exif_data: dict[str, Any] | None = None

        try:
            raw_exif = image.getexif()
            if raw_exif:
                exif_data = {}
                for tag_id, value in raw_exif.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    # Convert non-serialisable types to strings
                    try:
                        if isinstance(value, bytes):
                            value = value.hex()
                        exif_data[tag_name] = value
                    except Exception:
                        exif_data[tag_name] = str(value)
        except Exception:
            pass  # EXIF not available

        return ImageMetadata(
            width=image.width,
            height=image.height,
            format=image.format,
            mode=image.mode,
            exif=exif_data if exif_data else None,
            file_size_bytes=len(raw_bytes) if raw_bytes else None,
        )

    # -- File hashes -------------------------------------------------------

    def compute_file_hashes(self, data: bytes) -> dict[str, str]:
        """Compute MD5 and SHA-256 of raw file bytes."""
        return {
            "md5": hashlib.md5(data).hexdigest(),
            "sha256": hashlib.sha256(data).hexdigest(),
        }

    # -- Full analysis -----------------------------------------------------

    def analyze_image(self, image_data: bytes) -> ImageAnalysisResult:
        """Run complete image analysis: hashes + metadata + file digests."""
        image = self._load_image(image_data)
        hashes = self.compute_hashes(image)
        metadata = self.extract_metadata(image, raw_bytes=image_data)
        file_hashes = self.compute_file_hashes(image_data)

        return ImageAnalysisResult(
            hashes=hashes,
            metadata=metadata,
            md5=file_hashes["md5"],
            sha256=file_hashes["sha256"],
            timestamp=datetime.now(UTC).isoformat(),
        )

    # -- Comparison --------------------------------------------------------

    def compare_images(
        self,
        image1_data: bytes,
        image2_data: bytes,
    ) -> dict[str, Any]:
        """Compare two images using perceptual hashes.

        Returns match status, per-hash similarity scores, and the threshold used.
        """
        h1 = self.compute_hashes(self._load_image(image1_data))
        h2 = self.compute_hashes(self._load_image(image2_data))

        scores = {
            "phash": hamming_similarity(h1.phash, h2.phash),
            "dhash": hamming_similarity(h1.dhash, h2.dhash),
            "whash": hamming_similarity(h1.whash, h2.whash),
            "ahash": hamming_similarity(h1.ahash, h2.ahash),
        }

        match = any(s >= self.similarity_threshold for s in scores.values())

        return {
            "match": match,
            "similarity_scores": scores,
            "threshold": self.similarity_threshold,
        }

    # -- LLM search queries ------------------------------------------------

    async def generate_search_queries(
        self,
        image_description: str,
    ) -> dict[str, Any]:
        """Generate reverse-image search queries via LM Studio."""
        return await self.lm_bridge.generate_image_search_queries(image_description)
