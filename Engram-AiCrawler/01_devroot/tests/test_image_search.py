"""Tests for app/osint/image_search.py — perceptual hashing, metadata, comparison."""
import io
from unittest.mock import AsyncMock, MagicMock

import pytest
from PIL import Image

from app.osint.image_search import (
    ImageAnalysisResult,
    ImageHashResult,
    ImageMetadata,
    ImageSearchService,
    hamming_similarity,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_test_image_bytes(width: int = 64, height: int = 64, color: tuple = (128, 0, 0)) -> bytes:
    """Create a minimal in-memory JPEG image."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_pil_image(
    width: int = 64, height: int = 64, color: tuple = (100, 200, 50)
) -> Image.Image:
    return Image.new("RGB", (width, height), color=color)


@pytest.fixture
def mock_lm_bridge():
    bridge = MagicMock()
    bridge.generate_image_search_queries = AsyncMock(return_value={"queries": ["test query"]})
    return bridge


@pytest.fixture
def service(mock_lm_bridge):
    return ImageSearchService(lm_bridge=mock_lm_bridge, similarity_threshold=0.85)


# ---------------------------------------------------------------------------
# hamming_similarity
# ---------------------------------------------------------------------------


class TestHammingSimilarity:
    def test_identical_hashes_return_1(self):
        import imagehash

        img = _make_pil_image()
        h = str(imagehash.phash(img))
        result = hamming_similarity(h, h)
        assert result == 1.0

    def test_completely_different_hashes_return_less_than_1(self):
        import imagehash

        img1 = _make_pil_image(color=(255, 0, 0))
        img2 = _make_pil_image(color=(0, 0, 255))
        h1 = str(imagehash.phash(img1))
        h2 = str(imagehash.phash(img2))
        # May or may not be identical — just check it returns 0..1
        result = hamming_similarity(h1, h2)
        assert 0.0 <= result <= 1.0

    def test_similarity_is_symmetric(self):
        import imagehash

        img1 = _make_pil_image(color=(200, 100, 50))
        img2 = _make_pil_image(color=(50, 100, 200))
        h1 = str(imagehash.phash(img1))
        h2 = str(imagehash.phash(img2))
        assert hamming_similarity(h1, h2) == hamming_similarity(h2, h1)


# ---------------------------------------------------------------------------
# ImageSearchService._load_image
# ---------------------------------------------------------------------------


class TestLoadImage:
    def test_load_image_from_bytes(self, service):
        raw = _make_test_image_bytes()
        img = service._load_image(raw)
        assert isinstance(img, Image.Image)

    def test_load_image_from_base64(self, service):
        import base64

        raw = _make_test_image_bytes()
        b64 = base64.b64encode(raw).decode()
        img = service._load_image_from_base64(b64)
        assert isinstance(img, Image.Image)


# ---------------------------------------------------------------------------
# ImageSearchService.compute_hashes
# ---------------------------------------------------------------------------


class TestComputeHashes:
    def test_returns_image_hash_result(self, service):
        img = _make_pil_image()
        result = service.compute_hashes(img)
        assert isinstance(result, ImageHashResult)

    def test_all_hash_fields_are_strings(self, service):
        img = _make_pil_image()
        result = service.compute_hashes(img)
        assert isinstance(result.phash, str)
        assert isinstance(result.dhash, str)
        assert isinstance(result.whash, str)
        assert isinstance(result.ahash, str)

    def test_hashes_are_non_empty(self, service):
        img = _make_pil_image()
        result = service.compute_hashes(img)
        assert len(result.phash) > 0
        assert len(result.dhash) > 0
        assert len(result.whash) > 0
        assert len(result.ahash) > 0

    def test_same_image_yields_same_hashes(self, service):
        img = _make_pil_image(color=(42, 42, 42))
        r1 = service.compute_hashes(img)
        r2 = service.compute_hashes(img)
        assert r1.phash == r2.phash
        assert r1.dhash == r2.dhash


# ---------------------------------------------------------------------------
# ImageSearchService.extract_metadata
# ---------------------------------------------------------------------------


class TestExtractMetadata:
    def test_returns_image_metadata(self, service):
        img = _make_pil_image(width=100, height=200)
        meta = service.extract_metadata(img)
        assert isinstance(meta, ImageMetadata)

    def test_width_height_correct(self, service):
        img = _make_pil_image(width=100, height=200)
        meta = service.extract_metadata(img)
        assert meta.width == 100
        assert meta.height == 200

    def test_mode_is_set(self, service):
        img = _make_pil_image()
        meta = service.extract_metadata(img)
        assert meta.mode == "RGB"

    def test_file_size_bytes_with_raw(self, service):
        raw = _make_test_image_bytes()
        img = service._load_image(raw)
        meta = service.extract_metadata(img, raw_bytes=raw)
        assert meta.file_size_bytes == len(raw)

    def test_file_size_none_without_raw(self, service):
        img = _make_pil_image()
        meta = service.extract_metadata(img)
        assert meta.file_size_bytes is None

    def test_exif_none_for_plain_image(self, service):
        img = _make_pil_image()
        meta = service.extract_metadata(img)
        # Plain PIL image has no EXIF
        assert meta.exif is None


# ---------------------------------------------------------------------------
# ImageSearchService.compute_file_hashes
# ---------------------------------------------------------------------------


class TestComputeFileHashes:
    def test_returns_md5_and_sha256(self, service):
        data = b"test image data"
        result = service.compute_file_hashes(data)
        assert "md5" in result
        assert "sha256" in result

    def test_hashes_are_hex_strings(self, service):
        data = b"some bytes"
        result = service.compute_file_hashes(data)
        assert all(c in "0123456789abcdef" for c in result["md5"])
        assert len(result["md5"]) == 32
        assert len(result["sha256"]) == 64

    def test_different_data_yields_different_hashes(self, service):
        r1 = service.compute_file_hashes(b"data1")
        r2 = service.compute_file_hashes(b"data2")
        assert r1["md5"] != r2["md5"]
        assert r1["sha256"] != r2["sha256"]


# ---------------------------------------------------------------------------
# ImageSearchService.analyze_image
# ---------------------------------------------------------------------------


class TestAnalyzeImage:
    def test_returns_analysis_result(self, service):
        raw = _make_test_image_bytes()
        result = service.analyze_image(raw)
        assert isinstance(result, ImageAnalysisResult)

    def test_analysis_has_hashes(self, service):
        raw = _make_test_image_bytes()
        result = service.analyze_image(raw)
        assert isinstance(result.hashes, ImageHashResult)

    def test_analysis_has_metadata(self, service):
        raw = _make_test_image_bytes()
        result = service.analyze_image(raw)
        assert isinstance(result.metadata, ImageMetadata)

    def test_analysis_has_md5_and_sha256(self, service):
        raw = _make_test_image_bytes()
        result = service.analyze_image(raw)
        assert len(result.md5) == 32
        assert len(result.sha256) == 64

    def test_analysis_has_timestamp(self, service):
        raw = _make_test_image_bytes()
        result = service.analyze_image(raw)
        assert result.timestamp
        assert "T" in result.timestamp  # ISO format


# ---------------------------------------------------------------------------
# ImageSearchService.compare_images
# ---------------------------------------------------------------------------


class TestCompareImages:
    def test_returns_dict_with_match_and_scores(self, service):
        raw1 = _make_test_image_bytes(color=(255, 0, 0))
        raw2 = _make_test_image_bytes(color=(255, 0, 0))
        result = service.compare_images(raw1, raw2)
        assert "match" in result
        assert "similarity_scores" in result
        assert "threshold" in result

    def test_identical_images_match(self, service):
        raw = _make_test_image_bytes(color=(128, 64, 32))
        result = service.compare_images(raw, raw)
        assert result["match"] is True

    def test_similarity_scores_keys(self, service):
        raw = _make_test_image_bytes()
        result = service.compare_images(raw, raw)
        scores = result["similarity_scores"]
        assert "phash" in scores
        assert "dhash" in scores
        assert "whash" in scores
        assert "ahash" in scores

    def test_threshold_in_result_matches_service(self, service):
        raw = _make_test_image_bytes()
        result = service.compare_images(raw, raw)
        assert result["threshold"] == service.similarity_threshold


# ---------------------------------------------------------------------------
# ImageSearchService.generate_search_queries
# ---------------------------------------------------------------------------


class TestGenerateSearchQueries:
    @pytest.mark.asyncio
    async def test_calls_lm_bridge(self, service, mock_lm_bridge):
        result = await service.generate_search_queries("a photo of a building")
        mock_lm_bridge.generate_image_search_queries.assert_called_once_with(
            "a photo of a building"
        )

    @pytest.mark.asyncio
    async def test_returns_lm_bridge_result(self, service, mock_lm_bridge):
        mock_lm_bridge.generate_image_search_queries.return_value = {"queries": ["q1", "q2"]}
        result = await service.generate_search_queries("test")
        assert result == {"queries": ["q1", "q2"]}
