"""Tests for FaceRecognitionService."""
import io
import json
import pytest
import asyncio
import numpy as np
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from PIL import Image

from app.osint.face_recognition_service import (
    FaceRecognitionService,
    FaceAnalysisResult,
    FaceMatchResult,
    FaceMatch,
    FaceEncoding,
    FaceLocation,
    ReferencePhoto,
    _IMAGE_MAGIC_BYTES,
    _MAX_IMAGE_SIZE_BYTES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_jpeg_bytes(width: int = 64, height: int = 64) -> bytes:
    """Create a minimal valid JPEG image in memory."""
    img = Image.new("RGB", (width, height), color=(128, 64, 32))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(width: int = 32, height: int = 32) -> bytes:
    img = Image.new("RGB", (width, height), color=(0, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_fake_encoding() -> np.ndarray:
    """Create a fake 128-d face encoding."""
    return np.zeros(128, dtype=np.float64)


@pytest.fixture
def svc(tmp_path: Path) -> FaceRecognitionService:
    return FaceRecognitionService(reference_dir=str(tmp_path / "refs"))


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------


class TestFaceLocation:
    def test_fields_stored(self):
        loc = FaceLocation(top=10, right=100, bottom=90, left=20)
        assert loc.top == 10
        assert loc.right == 100
        assert loc.bottom == 90
        assert loc.left == 20


class TestFaceEncoding:
    def test_fields_stored(self):
        enc = FaceEncoding(
            face_id="abc123",
            location=FaceLocation(top=0, right=10, bottom=10, left=0),
            encoding_hash="deadbeef",
        )
        assert enc.face_id == "abc123"
        assert enc.encoding_hash == "deadbeef"


class TestFaceMatch:
    def test_match_true_when_below_threshold(self):
        m = FaceMatch(
            reference_id="ref1",
            reference_label="Alice",
            face_id="f1",
            distance=0.3,
            confidence=0.7,
            match=True,
        )
        assert m.match is True

    def test_match_false_when_above_threshold(self):
        m = FaceMatch(
            reference_id="ref1",
            reference_label="Alice",
            face_id="f1",
            distance=0.8,
            confidence=0.2,
            match=False,
        )
        assert m.match is False


class TestFaceAnalysisResult:
    def test_defaults(self):
        r = FaceAnalysisResult(faces_detected=0, faces=[], timestamp="2026-01-01T00:00:00+00:00")
        assert r.faces_detected == 0
        assert r.faces == []


class TestFaceMatchResult:
    def test_defaults(self):
        r = FaceMatchResult(
            matches=[],
            total_faces_analyzed=0,
            total_matches=0,
            threshold=0.6,
            timestamp="2026-01-01T00:00:00+00:00",
        )
        assert r.total_matches == 0
        assert r.threshold == 0.6


class TestReferencePhoto:
    def test_fields(self):
        p = ReferencePhoto(
            photo_id="pid1",
            label="Bob",
            filename="bob.jpg",
            file_size_bytes=1024,
            faces_detected=1,
            created_at="2026-01-01T00:00:00+00:00",
        )
        assert p.photo_id == "pid1"
        assert p.label == "Bob"


# ---------------------------------------------------------------------------
# _validate_image tests
# ---------------------------------------------------------------------------


class TestValidateImage:
    def test_valid_jpeg_passes(self):
        data = _make_jpeg_bytes()
        # Should not raise
        FaceRecognitionService._validate_image(data)

    def test_valid_png_passes(self):
        data = _make_png_bytes()
        FaceRecognitionService._validate_image(data)

    def test_too_small_raises(self):
        with pytest.raises(ValueError, match="too small"):
            FaceRecognitionService._validate_image(b"\xff\xd8\xff")  # Only 3 bytes

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="too small"):
            FaceRecognitionService._validate_image(b"")

    def test_too_large_raises(self):
        # Create fake data that starts with JPEG magic but is too large
        big_data = b"\xff\xd8\xff" + b"x" * (_MAX_IMAGE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="too large"):
            FaceRecognitionService._validate_image(big_data)

    def test_unknown_format_raises(self):
        # Valid size but no known magic bytes
        data = b"\x00\x01\x02\x03" * 100  # 400 bytes, unknown format
        with pytest.raises(ValueError, match="Unsupported image format"):
            FaceRecognitionService._validate_image(data)

    def test_all_magic_bytes_accepted(self):
        """Each magic byte prefix should be accepted if data is large enough."""
        for magic, fmt in _IMAGE_MAGIC_BYTES.items():
            # Pad to exceed minimum size
            data = magic + b"x" * 200
            # Should not raise (unless it happens to be > max, which it won't)
            FaceRecognitionService._validate_image(data)


# ---------------------------------------------------------------------------
# _bytes_to_array tests
# ---------------------------------------------------------------------------


class TestBytesToArray:
    def test_jpeg_converts_to_array(self):
        data = _make_jpeg_bytes(32, 32)
        arr = FaceRecognitionService._bytes_to_array(data)
        assert isinstance(arr, np.ndarray)
        assert arr.shape == (32, 32, 3)

    def test_png_converts_to_array(self):
        data = _make_png_bytes(16, 16)
        arr = FaceRecognitionService._bytes_to_array(data)
        assert isinstance(arr, np.ndarray)
        assert arr.shape == (16, 16, 3)

    def test_returns_rgb_not_bgr(self):
        # PIL produces RGB; verify the array is 3-channel
        data = _make_jpeg_bytes()
        arr = FaceRecognitionService._bytes_to_array(data)
        assert arr.ndim == 3
        assert arr.shape[2] == 3


# ---------------------------------------------------------------------------
# is_available tests
# ---------------------------------------------------------------------------


class TestIsAvailable:
    def test_returns_bool(self):
        result = FaceRecognitionService.is_available()
        assert isinstance(result, bool)

    def test_false_when_fr_is_none(self):
        with patch("app.osint.face_recognition_service._fr", None):
            assert FaceRecognitionService.is_available() is False

    def test_true_when_fr_is_present(self):
        mock_fr = MagicMock()
        with patch("app.osint.face_recognition_service._fr", mock_fr):
            assert FaceRecognitionService.is_available() is True


# ---------------------------------------------------------------------------
# detect_faces tests
# ---------------------------------------------------------------------------


class TestDetectFaces:
    def test_returns_empty_result_when_fr_not_installed(self, svc):
        with patch("app.osint.face_recognition_service._fr", None):
            result = svc.detect_faces(_make_jpeg_bytes())
        assert result.faces_detected == 0
        assert result.faces == []
        assert result.timestamp

    def test_detect_faces_with_mock_fr(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.detect_faces(_make_jpeg_bytes())

        assert result.faces_detected == 1
        assert len(result.faces) == 1
        assert result.faces[0].location.top == 10
        assert result.faces[0].location.right == 100

    def test_detect_faces_no_faces_found(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.detect_faces(_make_jpeg_bytes())

        assert result.faces_detected == 0
        assert result.faces == []

    def test_detect_faces_multiple_faces(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [
            (10, 100, 90, 20),
            (110, 200, 190, 120),
        ]
        mock_fr.face_encodings.return_value = [
            _make_fake_encoding(),
            _make_fake_encoding() + 0.1,
        ]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.detect_faces(_make_jpeg_bytes())

        assert result.faces_detected == 2
        assert len(result.faces) == 2

    def test_detect_faces_encoding_hash_is_hex_string(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.detect_faces(_make_jpeg_bytes())

        assert len(result.faces[0].encoding_hash) == 64  # SHA256 hex

    def test_detect_faces_validates_image_first(self, svc):
        mock_fr = MagicMock()
        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with pytest.raises(ValueError, match="too small"):
                svc.detect_faces(b"tiny")


# ---------------------------------------------------------------------------
# match_faces tests
# ---------------------------------------------------------------------------


class TestMatchFaces:
    def test_returns_empty_result_when_fr_not_installed(self, svc):
        with patch("app.osint.face_recognition_service._fr", None):
            result = svc.match_faces(_make_jpeg_bytes())
        assert result.matches == []
        assert result.total_faces_analyzed == 0
        assert result.total_matches == 0

    def test_returns_empty_when_no_references(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.match_faces(_make_jpeg_bytes())

        assert result.matches == []
        assert result.total_faces_analyzed == 1

    def test_match_found_when_distance_below_tolerance(self, svc, tmp_path):
        """Set up a reference and verify a close face matches."""
        # Manually write a reference encoding file
        photo_id = "test-photo-001"
        photo_dir = svc.reference_dir / photo_id
        photo_dir.mkdir(parents=True)
        enc = _make_fake_encoding()
        import base64

        enc_b64 = base64.b64encode(enc.tobytes()).decode("ascii")
        enc_data = {
            "label": "Alice",
            "photo_id": photo_id,
            "filename": "alice.jpg",
            "faces": [
                {
                    "location": {"top": 0, "right": 10, "bottom": 10, "left": 0},
                    "encoding_b64": enc_b64,
                    "dtype": "float64",
                    "shape": [128],
                }
            ],
        }
        (photo_dir / "encodings.json").write_text(json.dumps(enc_data))

        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        # Same encoding = distance 0.0 = perfect match
        mock_fr.face_encodings.return_value = [enc]
        mock_fr.face_distance.return_value = np.array([0.0])

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.match_faces(_make_jpeg_bytes())

        assert result.total_matches == 1
        assert result.matches[0].match is True
        assert result.matches[0].reference_label == "Alice"

    def test_no_match_when_distance_above_tolerance(self, svc):
        """Set up a reference and verify a distant face doesn't match."""
        photo_id = "test-photo-002"
        photo_dir = svc.reference_dir / photo_id
        photo_dir.mkdir(parents=True)
        enc = _make_fake_encoding()
        import base64

        enc_b64 = base64.b64encode(enc.tobytes()).decode("ascii")
        enc_data = {
            "label": "Bob",
            "photo_id": photo_id,
            "filename": "bob.jpg",
            "faces": [
                {
                    "location": {"top": 0, "right": 10, "bottom": 10, "left": 0},
                    "encoding_b64": enc_b64,
                    "dtype": "float64",
                    "shape": [128],
                }
            ],
        }
        (photo_dir / "encodings.json").write_text(json.dumps(enc_data))

        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding() + 1.0]
        mock_fr.face_distance.return_value = np.array([0.9])  # Far away

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc.match_faces(_make_jpeg_bytes())

        assert result.total_matches == 0
        assert result.matches[0].match is False

    def test_match_faces_validates_image(self, svc):
        mock_fr = MagicMock()
        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with pytest.raises(ValueError, match="too small"):
                svc.match_faces(b"tiny")

    def test_match_faces_threshold_in_result(self, svc):
        svc2 = FaceRecognitionService(
            reference_dir=str(svc.reference_dir),
            tolerance=0.4,
        )
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            result = svc2.match_faces(_make_jpeg_bytes())

        assert result.threshold == 0.4


# ---------------------------------------------------------------------------
# save_reference_photo tests
# ---------------------------------------------------------------------------


class TestSaveReferencePhoto:
    def test_raises_when_fr_not_installed(self, svc):
        with patch("app.osint.face_recognition_service._fr", None):
            with pytest.raises(RuntimeError, match="not installed"):
                svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

    def test_saves_photo_and_returns_metadata(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        assert ref.label == "Alice"
        assert ref.filename == "alice.jpg"
        assert ref.faces_detected == 1
        assert ref.photo_id

    def test_saves_encodings_json_to_disk(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        enc_path = svc.reference_dir / ref.photo_id / "encodings.json"
        assert enc_path.exists()
        meta = json.loads(enc_path.read_text())
        assert meta["label"] == "Alice"
        assert meta["photo_id"] == ref.photo_id

    def test_cleans_up_on_failure(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.side_effect = RuntimeError("face_recognition crashed")

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with pytest.raises(RuntimeError):
                svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        # Directory should have been cleaned up
        dirs = list(svc.reference_dir.iterdir())
        assert len(dirs) == 0

    def test_validates_image_before_saving(self, svc):
        mock_fr = MagicMock()
        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with pytest.raises(ValueError, match="too small"):
                svc.save_reference_photo("Alice", b"tiny", "alice.jpg")

    def test_no_faces_detected_still_saves(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        assert ref.faces_detected == 0


# ---------------------------------------------------------------------------
# list_reference_photos tests
# ---------------------------------------------------------------------------


class TestListReferencePhotos:
    def test_empty_when_no_references(self, svc):
        result = svc.list_reference_photos()
        assert result == []

    def test_lists_saved_references(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")
            svc.save_reference_photo("Bob", _make_jpeg_bytes(), "bob.jpg")

        photos = svc.list_reference_photos()
        assert len(photos) == 2
        labels = {p.label for p in photos}
        assert "Alice" in labels
        assert "Bob" in labels

    def test_skips_corrupt_dirs(self, svc, tmp_path):
        # Create a dir without encodings.json
        bad_dir = svc.reference_dir / "bad-photo-id"
        bad_dir.mkdir(parents=True)
        (bad_dir / "photo.jpg").write_bytes(b"fake")

        result = svc.list_reference_photos()
        assert result == []

    def test_skips_corrupt_json(self, svc):
        bad_dir = svc.reference_dir / "corrupt-id"
        bad_dir.mkdir(parents=True)
        (bad_dir / "encodings.json").write_text("not valid json")

        result = svc.list_reference_photos()
        assert result == []

    def test_returns_reference_photo_objects(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            svc.save_reference_photo("Charlie", _make_jpeg_bytes(), "charlie.jpg")

        photos = svc.list_reference_photos()
        assert all(isinstance(p, ReferencePhoto) for p in photos)


# ---------------------------------------------------------------------------
# delete_reference_photo tests
# ---------------------------------------------------------------------------


class TestDeleteReferencePhoto:
    def test_delete_existing_returns_true(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        result = svc.delete_reference_photo(ref.photo_id)
        assert result is True

    def test_delete_removes_from_disk(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        svc.delete_reference_photo(ref.photo_id)
        assert not (svc.reference_dir / ref.photo_id).exists()

    def test_delete_nonexistent_returns_false(self, svc):
        result = svc.delete_reference_photo("nonexistent-id")
        assert result is False

    def test_delete_then_list_is_empty(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        svc.delete_reference_photo(ref.photo_id)
        assert svc.list_reference_photos() == []


# ---------------------------------------------------------------------------
# get_reference_encodings tests
# ---------------------------------------------------------------------------


class TestGetReferenceEncodings:
    def test_returns_empty_when_no_references(self, svc):
        result = svc.get_reference_encodings()
        assert result == {}

    def test_returns_encodings_for_saved_photo(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        encodings = svc.get_reference_encodings()
        assert ref.photo_id in encodings
        assert encodings[ref.photo_id]["label"] == "Alice"
        assert len(encodings[ref.photo_id]["encodings"]) == 1

    def test_filter_by_label(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")
            svc.save_reference_photo("Bob", _make_jpeg_bytes(), "bob.jpg")

        alice_encs = svc.get_reference_encodings(label="Alice")
        assert len(alice_encs) == 1
        assert list(alice_encs.values())[0]["label"] == "Alice"

    def test_encodings_are_numpy_arrays(self, svc):
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = [(10, 100, 90, 20)]
        mock_fr.face_encodings.return_value = [_make_fake_encoding()]

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            ref = svc.save_reference_photo("Alice", _make_jpeg_bytes(), "alice.jpg")

        encodings = svc.get_reference_encodings()
        arr = encodings[ref.photo_id]["encodings"][0]
        assert isinstance(arr, np.ndarray)

    def test_skips_corrupt_json_in_encodings(self, svc):
        bad_dir = svc.reference_dir / "bad-id"
        bad_dir.mkdir(parents=True)
        # Corrupt JSON — JSONDecodeError should be caught
        (bad_dir / "encodings.json").write_text("not valid json at all")

        result = svc.get_reference_encodings()
        assert result == {}

    def test_skips_missing_key_in_encodings(self, svc):
        bad_dir = svc.reference_dir / "bad-id2"
        bad_dir.mkdir(parents=True)
        # Missing required key 'photo_id' — KeyError should be caught
        (bad_dir / "encodings.json").write_text('{"label": "X", "faces": []}')

        result = svc.get_reference_encodings()
        assert result == {}


# ---------------------------------------------------------------------------
# match_from_url tests
# ---------------------------------------------------------------------------


class TestMatchFromUrl:
    @pytest.mark.asyncio
    async def test_downloads_and_matches(self, svc):
        jpeg = _make_jpeg_bytes()
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with patch.object(svc, "_download_image", new=AsyncMock(return_value=jpeg)):
                result = await svc.match_from_url("https://example.com/photo.jpg")

        assert isinstance(result, FaceMatchResult)

    @pytest.mark.asyncio
    async def test_raises_timeout_on_slow_download(self, svc):
        async def slow_download(url):
            await asyncio.sleep(9999)
            return b""

        with patch.object(svc, "_download_image", new=slow_download):
            with patch("app.osint.face_recognition_service._MATCH_URL_TIMEOUT_SECONDS", 0.01):
                with pytest.raises(TimeoutError):
                    await svc.match_from_url("https://example.com/photo.jpg")

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_download_failure(self, svc):
        with patch.object(
            svc, "_download_image", new=AsyncMock(side_effect=RuntimeError("network error"))
        ):
            with pytest.raises(RuntimeError, match="Failed to download"):
                await svc.match_from_url("https://example.com/photo.jpg")


# ---------------------------------------------------------------------------
# batch_match_urls tests
# ---------------------------------------------------------------------------


class TestBatchMatchUrls:
    @pytest.mark.asyncio
    async def test_returns_list_of_results(self, svc):
        jpeg = _make_jpeg_bytes()
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with patch.object(svc, "_download_image", new=AsyncMock(return_value=jpeg)):
                results = await svc.batch_match_urls(["https://a.com/1.jpg", "https://b.com/2.jpg"])

        assert len(results) == 2
        assert all(r["success"] is True for r in results)

    @pytest.mark.asyncio
    async def test_handles_failed_urls_gracefully(self, svc):
        with patch.object(
            svc, "_download_image", new=AsyncMock(side_effect=RuntimeError("connection refused"))
        ):
            results = await svc.batch_match_urls(["https://bad.example.com/photo.jpg"])

        assert len(results) == 1
        assert results[0]["success"] is False
        assert "error" in results[0]

    @pytest.mark.asyncio
    async def test_empty_url_list_returns_empty(self, svc):
        results = await svc.batch_match_urls([])
        assert results == []

    @pytest.mark.asyncio
    async def test_concurrency_limit_respected(self, svc):
        """Verify semaphore doesn't crash with many URLs."""
        jpeg = _make_jpeg_bytes()
        mock_fr = MagicMock()
        mock_fr.face_locations.return_value = []
        mock_fr.face_encodings.return_value = []

        with patch("app.osint.face_recognition_service._fr", mock_fr):
            with patch.object(svc, "_download_image", new=AsyncMock(return_value=jpeg)):
                results = await svc.batch_match_urls(
                    [f"https://example.com/{i}.jpg" for i in range(10)],
                    max_concurrent=3,
                )

        assert len(results) == 10


# ---------------------------------------------------------------------------
# FaceRecognitionService constructor tests
# ---------------------------------------------------------------------------


class TestServiceConstructor:
    def test_default_tolerance(self, tmp_path):
        svc = FaceRecognitionService(reference_dir=str(tmp_path / "refs"))
        assert svc.tolerance == 0.6

    def test_custom_tolerance(self, tmp_path):
        svc = FaceRecognitionService(
            reference_dir=str(tmp_path / "refs"),
            tolerance=0.4,
        )
        assert svc.tolerance == 0.4

    def test_creates_reference_dir(self, tmp_path):
        ref_dir = tmp_path / "new" / "nested" / "refs"
        svc = FaceRecognitionService(reference_dir=str(ref_dir))
        assert ref_dir.exists()
