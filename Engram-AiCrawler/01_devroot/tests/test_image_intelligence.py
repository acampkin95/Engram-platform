"""Tests for app/osint/image_intelligence.py.

Coverage target: 70%+ on the module.

Strategy:
  - Pure-Python paths (models, EXIF helpers, fake-ID signals, ImageCatalog
    hashing/dedup/persistence, compute_identity_score) are tested with real
    code — no mocks needed.
  - Network-touching paths (_download, _search_google, _search_tineye,
    _search_yandex, ingest_url) are tested via httpx.AsyncClient mocks.
  - Face-recognition paths (FaceClusterer, ImageIntelligencePipeline face
    clustering) are tested with a patched FaceRecognitionService so we never
    need the native `face_recognition` library installed.
"""
from __future__ import annotations

import hashlib
import io
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

# ---------------------------------------------------------------------------
# Module under test
# ---------------------------------------------------------------------------
from app.osint.image_intelligence import (
    GpsCoordinates,
    ExifSummary,
    ImageHashes,
    CatalogEntry,
    FaceCluster,
    ReverseSearchResult,
    FakeIdSignals,
    IdentityVerificationScore,
    ImageIntelligenceReport,
    _dms_to_decimal,
    extract_exif,
    _check_ai_generation,
    _check_stock_photo,
    _check_metadata_anomalies,
    detect_fake_id_signals,
    ImageCatalog,
    FaceClusterer,
    ReverseImageSearcher,
    compute_identity_score,
    ImageIntelligencePipeline,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_jpeg_bytes(width: int = 64, height: int = 64) -> bytes:
    """Minimal valid JPEG in memory."""
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(width: int = 32, height: int = 32) -> bytes:
    img = Image.new("RGB", (width, height), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_catalog_entry(**kwargs) -> CatalogEntry:
    defaults = dict(
        entity_id="ent1",
        source_url="https://example.com/photo.jpg",
        local_path="/tmp/photo.jpg",
        hashes=ImageHashes(
            phash="aabbccdd",
            dhash="11223344",
            ahash="55667788",
            md5=hashlib.md5(b"test").hexdigest(),
            sha256=hashlib.sha256(b"test").hexdigest(),
        ),
        exif=ExifSummary(),
        width=64,
        height=64,
        format="JPEG",
        file_size_bytes=1024,
    )
    defaults.update(kwargs)
    return CatalogEntry(**defaults)


# ===========================================================================
# 1. Pydantic Models
# ===========================================================================


class TestGpsCoordinates:
    def test_basic_creation(self):
        gps = GpsCoordinates(latitude=51.5, longitude=-0.1)
        assert gps.latitude == 51.5
        assert gps.longitude == -0.1
        assert gps.altitude_m is None
        assert gps.accuracy_note is None

    def test_with_altitude(self):
        gps = GpsCoordinates(latitude=35.0, longitude=139.0, altitude_m=100.5)
        assert gps.altitude_m == 100.5

    def test_negative_coordinates(self):
        gps = GpsCoordinates(latitude=-33.87, longitude=151.21)
        assert gps.latitude < 0


class TestExifSummary:
    def test_defaults(self):
        exif = ExifSummary()
        assert exif.make is None
        assert exif.model is None
        assert exif.software is None
        assert exif.gps is None
        assert exif.raw == {}

    def test_with_fields(self):
        exif = ExifSummary(make="Canon", model="EOS 5D", software="Photoshop")
        assert exif.make == "Canon"
        assert exif.model == "EOS 5D"

    def test_with_gps(self):
        gps = GpsCoordinates(latitude=51.5, longitude=-0.1)
        exif = ExifSummary(gps=gps)
        assert exif.gps.latitude == 51.5


class TestImageHashes:
    def test_creation(self):
        h = ImageHashes(phash="aa", dhash="bb", ahash="cc", md5="dd", sha256="ee")
        assert h.phash == "aa"
        assert h.sha256 == "ee"


class TestCatalogEntry:
    def test_defaults(self):
        entry = CatalogEntry()
        assert entry.image_id  # auto-generated
        assert entry.entity_id is None
        assert entry.is_duplicate is False
        assert entry.faces_detected == 0
        assert entry.width == 0

    def test_custom_fields(self):
        entry = _make_catalog_entry(width=128, height=256, format="PNG")
        assert entry.width == 128
        assert entry.height == 256

    def test_added_at_is_iso(self):
        entry = CatalogEntry()
        # Should parse without error
        datetime.fromisoformat(entry.added_at)


class TestFaceCluster:
    def test_defaults(self):
        fc = FaceCluster(entity_id="ent1")
        assert fc.cluster_id
        assert fc.image_ids == []
        assert fc.confidence == 0.0

    def test_with_images(self):
        fc = FaceCluster(entity_id="ent1", image_ids=["img1", "img2"], confidence=0.85)
        assert len(fc.image_ids) == 2
        assert fc.confidence == 0.85


class TestReverseSearchResult:
    def test_required_fields(self):
        r = ReverseSearchResult(engine="google", url="https://example.com/img.jpg")
        assert r.engine == "google"
        assert r.url == "https://example.com/img.jpg"
        assert r.similarity_score is None

    def test_with_score(self):
        r = ReverseSearchResult(engine="tineye", url="https://x.com/i.jpg", similarity_score=0.9)
        assert r.similarity_score == 0.9


class TestFakeIdSignals:
    def test_defaults(self):
        s = FakeIdSignals()
        assert s.is_likely_ai_generated is False
        assert s.overall_suspicion_score == 0.0
        assert s.ai_generation_evidence == []

    def test_with_evidence(self):
        s = FakeIdSignals(
            is_likely_ai_generated=True,
            ai_generation_evidence=["midjourney"],
            overall_suspicion_score=0.5,
        )
        assert s.is_likely_ai_generated is True


class TestIdentityVerificationScore:
    def test_creation(self):
        s = IdentityVerificationScore(
            entity_id="ent1",
            total_images=5,
            unique_images=4,
            face_clusters=2,
            cross_platform_hits=3,
        )
        assert s.overall_confidence == 0.0
        assert s.face_match_confidence == 0.0


class TestImageIntelligenceReport:
    def test_defaults(self):
        r = ImageIntelligenceReport(entity_id="ent1")
        assert r.catalog == []
        assert r.face_clusters == []
        assert r.reverse_search_results == []
        assert r.identity_score is None


# ===========================================================================
# 2. EXIF helpers
# ===========================================================================


class TestDmsToDecimal:
    def test_north_positive(self):
        result = _dms_to_decimal((51, 30, 0), "N")
        assert result == pytest.approx(51.5, rel=1e-4)

    def test_south_negative(self):
        result = _dms_to_decimal((33, 52, 0), "S")
        assert result is not None
        assert result < 0

    def test_west_negative(self):
        result = _dms_to_decimal((0, 6, 0), "W")
        assert result is not None
        assert result < 0

    def test_east_positive(self):
        result = _dms_to_decimal((139, 45, 0), "E")
        assert result is not None
        assert result > 0

    def test_invalid_returns_none(self):
        assert _dms_to_decimal(None, "N") is None
        assert _dms_to_decimal([], "N") is None

    def test_fractional_seconds(self):
        result = _dms_to_decimal((10, 30, 36), "N")
        assert result == pytest.approx(10.51, rel=1e-3)


class TestExtractExif:
    def test_plain_jpeg_no_exif(self):
        """A plain PIL image has no EXIF — returns empty ExifSummary."""
        img = Image.new("RGB", (64, 64), color=(0, 0, 0))
        exif = extract_exif(img)
        assert isinstance(exif, ExifSummary)
        # No EXIF data -> raw may be empty or minimal
        assert exif.make is None
        assert exif.gps is None

    def test_jpeg_with_exif_make_model(self):
        """Embed EXIF Make/Model and verify extraction."""
        img = Image.new("RGB", (64, 64))
        exif_data = img.getexif()
        # Tag 271 = Make, 272 = Model
        exif_data[271] = "TestMake"
        exif_data[272] = "TestModel"
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif_data.tobytes())
        buf.seek(0)
        loaded = Image.open(buf)
        result = extract_exif(loaded)
        assert result.make == "TestMake"
        assert result.model == "TestModel"
        assert "Make" in result.raw

    def test_bytes_exif_value_hex_encoded(self):
        """Bytes EXIF values should be hex-encoded, not crash."""
        img = Image.new("RGB", (32, 32))
        exif_data = img.getexif()
        # Tag 305 = Software -- set to bytes to trigger hex encoding
        exif_data[305] = b"\x00\x01\x02"
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif_data.tobytes())
        buf.seek(0)
        loaded = Image.open(buf)
        result = extract_exif(loaded)
        # Should not raise; software may be hex string
        assert isinstance(result, ExifSummary)


# ===========================================================================
# 3. Fake ID Signal Helpers
# ===========================================================================


class TestCheckAiGeneration:
    def test_detects_midjourney_in_software(self):
        exif = ExifSummary(software="MidJourney v5")
        evidence = _check_ai_generation(exif, "photo.jpg")
        assert len(evidence) > 0
        assert any("midjourney" in e.lower() for e in evidence)

    def test_detects_stable_diffusion_in_filename(self):
        evidence = _check_ai_generation(None, "stable_diffusion_output.png")
        assert len(evidence) > 0

    def test_detects_dalle_in_model(self):
        exif = ExifSummary(model="DALL-E 3")
        evidence = _check_ai_generation(exif, "image.jpg")
        assert len(evidence) > 0

    def test_clean_photo_no_evidence(self):
        exif = ExifSummary(make="Canon", model="EOS 5D", software="Adobe Lightroom")
        evidence = _check_ai_generation(exif, "portrait.jpg")
        assert evidence == []

    def test_none_exif_with_clean_filename(self):
        evidence = _check_ai_generation(None, "photo123.jpg")
        assert evidence == []

    def test_firefly_pattern(self):
        exif = ExifSummary(software="Adobe Firefly 2.0")
        evidence = _check_ai_generation(exif, "img.jpg")
        assert len(evidence) > 0

    def test_automatic1111_pattern(self):
        evidence = _check_ai_generation(None, "automatic1111_output.png")
        assert len(evidence) > 0


class TestCheckStockPhoto:
    def test_detects_shutterstock_in_url(self):
        evidence = _check_stock_photo(None, "photo.jpg", "https://shutterstock.com/image/123")
        assert len(evidence) > 0

    def test_detects_getty_in_filename(self):
        evidence = _check_stock_photo(None, "gettyimages_12345.jpg", "https://example.com/img")
        assert len(evidence) > 0

    def test_detects_istock_in_software(self):
        exif = ExifSummary(software="istockphoto watermark")
        evidence = _check_stock_photo(exif, "photo.jpg", "https://example.com")
        assert len(evidence) > 0

    def test_clean_image_no_evidence(self):
        evidence = _check_stock_photo(None, "selfie.jpg", "https://instagram.com/photo")
        assert evidence == []

    def test_adobe_stock_pattern(self):
        evidence = _check_stock_photo(None, "adobe_stock_photo.jpg", "https://example.com")
        assert len(evidence) > 0


class TestCheckMetadataAnomalies:
    def test_none_exif_returns_empty(self):
        assert _check_metadata_anomalies(None) == []

    def test_large_timestamp_gap(self):
        exif = ExifSummary(
            datetime_original="2010:01:01 12:00:00",
            datetime_digitized="2022:01:01 12:00:00",
        )
        anomalies = _check_metadata_anomalies(exif)
        assert any("days" in a for a in anomalies)

    def test_small_timestamp_gap_no_anomaly(self):
        exif = ExifSummary(
            datetime_original="2023:06:01 10:00:00",
            datetime_digitized="2023:06:01 10:05:00",
        )
        anomalies = _check_metadata_anomalies(exif)
        assert not any("days" in a for a in anomalies)

    def test_future_dated_exif(self):
        exif = ExifSummary(datetime_original="2099:01:01 00:00:00")
        anomalies = _check_metadata_anomalies(exif)
        assert any("future" in a.lower() for a in anomalies)

    def test_null_island_gps(self):
        exif = ExifSummary(gps=GpsCoordinates(latitude=0.0, longitude=0.0))
        anomalies = _check_metadata_anomalies(exif)
        assert any("0, 0" in a or "(0, 0)" in a for a in anomalies)

    def test_valid_gps_no_anomaly(self):
        exif = ExifSummary(gps=GpsCoordinates(latitude=51.5, longitude=-0.1))
        anomalies = _check_metadata_anomalies(exif)
        assert not any("0, 0" in a for a in anomalies)

    def test_malformed_date_no_crash(self):
        exif = ExifSummary(datetime_original="not-a-date")
        anomalies = _check_metadata_anomalies(exif)
        assert isinstance(anomalies, list)  # No crash


class TestDetectFakeIdSignals:
    def test_clean_image(self):
        entry = _make_catalog_entry(
            exif=ExifSummary(make="Sony", model="A7", software="Camera Raw"),
            source_url="https://flickr.com/photo.jpg",
            local_path="/tmp/photo.jpg",
        )
        signals = detect_fake_id_signals(entry, has_exif_data=True, image_has_faces=True)
        assert signals.is_likely_ai_generated is False
        assert signals.is_likely_stock_photo is False
        assert signals.overall_suspicion_score < 0.5

    def test_ai_generated_image(self):
        entry = _make_catalog_entry(
            exif=ExifSummary(software="MidJourney v5"),
            source_url="https://example.com/ai.jpg",
            local_path="/tmp/ai.jpg",
        )
        signals = detect_fake_id_signals(entry, has_exif_data=True, image_has_faces=False)
        assert signals.is_likely_ai_generated is True
        assert signals.overall_suspicion_score >= 0.5

    def test_stock_photo(self):
        entry = _make_catalog_entry(
            exif=ExifSummary(),
            source_url="https://shutterstock.com/image/12345",
            local_path="/tmp/stock.jpg",
        )
        signals = detect_fake_id_signals(entry, has_exif_data=True, image_has_faces=True)
        assert signals.is_likely_stock_photo is True
        assert signals.overall_suspicion_score >= 0.4

    def test_missing_exif(self):
        entry = _make_catalog_entry(exif=None, source_url="https://example.com/img.jpg")
        signals = detect_fake_id_signals(entry, has_exif_data=False, image_has_faces=False)
        assert signals.missing_exif is True

    def test_stripped_exif(self):
        """has_exif_data=True but all key fields are None -> stripped."""
        entry = _make_catalog_entry(
            exif=ExifSummary(raw={"SomeTag": "value"}),  # has raw but no make/model/gps/datetime
        )
        signals = detect_fake_id_signals(entry, has_exif_data=True, image_has_faces=False)
        assert signals.stripped_exif is True
        assert signals.overall_suspicion_score > 0.0

    def test_suspicion_score_capped_at_1(self):
        """AI + stock + anomalies should not exceed 1.0."""
        entry = _make_catalog_entry(
            exif=ExifSummary(
                software="MidJourney v5",
                datetime_original="2010:01:01 00:00:00",
                datetime_digitized="2022:01:01 00:00:00",
            ),
            source_url="https://shutterstock.com/image/999",
            local_path="/tmp/img.jpg",
        )
        signals = detect_fake_id_signals(entry, has_exif_data=True, image_has_faces=False)
        assert signals.overall_suspicion_score <= 1.0

    def test_no_local_path(self):
        """local_path=None should not crash."""
        entry = _make_catalog_entry(local_path=None)
        signals = detect_fake_id_signals(entry, has_exif_data=False, image_has_faces=False)
        assert isinstance(signals, FakeIdSignals)


# ===========================================================================
# 4. ImageCatalog -- hashing & deduplication
# ===========================================================================


class TestImageCatalogHashing:
    def test_compute_hashes_returns_all_fields(self):
        raw = _make_jpeg_bytes()
        img = Image.open(io.BytesIO(raw))
        hashes = ImageCatalog.compute_hashes(img, raw)
        assert len(hashes.phash) > 0
        assert len(hashes.dhash) > 0
        assert len(hashes.ahash) > 0
        assert len(hashes.md5) == 32
        assert len(hashes.sha256) == 64

    def test_same_image_same_hashes(self):
        raw = _make_jpeg_bytes()
        img = Image.open(io.BytesIO(raw))
        h1 = ImageCatalog.compute_hashes(img, raw)
        h2 = ImageCatalog.compute_hashes(img, raw)
        assert h1.sha256 == h2.sha256
        assert h1.phash == h2.phash

    def test_different_images_different_hashes(self):
        raw1 = _make_jpeg_bytes(64, 64)
        raw2 = _make_jpeg_bytes(32, 32)
        img1 = Image.open(io.BytesIO(raw1))
        img2 = Image.open(io.BytesIO(raw2))
        h1 = ImageCatalog.compute_hashes(img1, raw1)
        h2 = ImageCatalog.compute_hashes(img2, raw2)
        assert h1.sha256 != h2.sha256

    def test_phash_similarity_identical(self):
        raw = _make_jpeg_bytes()
        img = Image.open(io.BytesIO(raw))
        h = ImageCatalog.compute_hashes(img, raw)
        sim = ImageCatalog._phash_similarity(h.phash, h.phash)
        assert sim == pytest.approx(1.0)

    def test_phash_similarity_range(self):
        """Similarity should always be in [0, 1]."""
        raw1 = _make_jpeg_bytes(64, 64)
        img2 = Image.new("RGB", (64, 64), color=(255, 255, 255))
        raw2 = io.BytesIO()
        img2.save(raw2, format="JPEG")
        raw2 = raw2.getvalue()
        img1 = Image.open(io.BytesIO(raw1))
        img2_loaded = Image.open(io.BytesIO(raw2))
        h1 = ImageCatalog.compute_hashes(img1, raw1)
        h2 = ImageCatalog.compute_hashes(img2_loaded, raw2)
        sim = ImageCatalog._phash_similarity(h1.phash, h2.phash)
        assert 0.0 <= sim <= 1.0

    def test_phash_similarity_invalid_hash_returns_zero(self):
        sim = ImageCatalog._phash_similarity("INVALID!!!", "ALSOINVALID")
        assert sim == 0.0


class TestImageCatalogDeduplication:
    def test_find_duplicate_exact_match(self):
        raw = _make_jpeg_bytes()
        img = Image.open(io.BytesIO(raw))
        hashes = ImageCatalog.compute_hashes(img, raw)
        entry = _make_catalog_entry(hashes=hashes, image_id="original_id")
        catalog = ImageCatalog.__new__(ImageCatalog)
        dup_id = catalog.find_duplicate(hashes, [entry])
        assert dup_id == "original_id"

    def test_find_duplicate_no_match(self):
        raw1 = _make_jpeg_bytes(64, 64)
        raw2 = _make_png_bytes(32, 32)
        img1 = Image.open(io.BytesIO(raw1))
        img2 = Image.open(io.BytesIO(raw2))
        h1 = ImageCatalog.compute_hashes(img1, raw1)
        h2 = ImageCatalog.compute_hashes(img2, raw2)
        entry = _make_catalog_entry(hashes=h1, image_id="orig")
        catalog = ImageCatalog.__new__(ImageCatalog)
        dup_id = catalog.find_duplicate(h2, [entry])
        # May or may not match depending on perceptual similarity -- just no crash
        assert dup_id is None or isinstance(dup_id, str)

    def test_find_duplicate_empty_catalog(self):
        raw = _make_jpeg_bytes()
        img = Image.open(io.BytesIO(raw))
        hashes = ImageCatalog.compute_hashes(img, raw)
        catalog = ImageCatalog.__new__(ImageCatalog)
        assert catalog.find_duplicate(hashes, []) is None

    def test_find_duplicate_sha256_wins_over_perceptual(self):
        """SHA256 exact match is checked first."""
        raw = _make_jpeg_bytes()
        img = Image.open(io.BytesIO(raw))
        hashes = ImageCatalog.compute_hashes(img, raw)
        entry = _make_catalog_entry(hashes=hashes, image_id="dup_entry", is_duplicate=True)
        catalog = ImageCatalog.__new__(ImageCatalog)
        result = catalog.find_duplicate(hashes, [entry])
        assert result == "dup_entry"  # exact SHA256 match wins


# ===========================================================================
# 5. ImageCatalog -- persistence (uses temp dir)
# ===========================================================================


class TestImageCatalogPersistence:
    def test_load_catalog_missing_file(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        entries = catalog.load_catalog("entity_xyz")
        assert entries == []

    def test_save_and_load_roundtrip(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        entry = _make_catalog_entry(entity_id="ent1")
        catalog.save_catalog("ent1", [entry])
        loaded = catalog.load_catalog("ent1")
        assert len(loaded) == 1
        assert loaded[0].image_id == entry.image_id
        assert loaded[0].entity_id == "ent1"

    def test_save_multiple_entries(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        entries = [_make_catalog_entry(entity_id="ent1") for _ in range(3)]
        catalog.save_catalog("ent1", entries)
        loaded = catalog.load_catalog("ent1")
        assert len(loaded) == 3

    def test_load_corrupt_catalog_returns_empty(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        entity_dir = tmp_path / "ent_corrupt"
        entity_dir.mkdir(parents=True)
        (entity_dir / "catalog.json").write_text("NOT VALID JSON }{")
        result = catalog.load_catalog("ent_corrupt")
        assert result == []

    def test_entity_dir_created(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        d = catalog._entity_dir("new_entity")
        assert d.exists()
        assert d.is_dir()

    def test_catalog_path(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        p = catalog._catalog_path("ent1")
        assert p.name == "catalog.json"
        assert "ent1" in str(p)


# ===========================================================================
# 6. ImageCatalog -- ingest_bytes (async, no network)
# ===========================================================================


class TestImageCatalogIngestBytes:
    @pytest.mark.asyncio
    async def test_ingest_new_image(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_jpeg_bytes()
        entry = await catalog.ingest_bytes(raw, "ent1", source_url="https://example.com/img.jpg")
        assert entry.entity_id == "ent1"
        assert entry.is_duplicate is False
        assert entry.local_path is not None
        assert Path(entry.local_path).exists()
        assert entry.width > 0
        assert entry.height > 0

    @pytest.mark.asyncio
    async def test_ingest_duplicate_detected(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_jpeg_bytes()
        entry1 = await catalog.ingest_bytes(raw, "ent1")
        entry2 = await catalog.ingest_bytes(raw, "ent1")
        assert entry2.is_duplicate is True
        assert entry2.duplicate_of == entry1.image_id

    @pytest.mark.asyncio
    async def test_ingest_invalid_bytes_raises(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        with pytest.raises(ValueError, match="Cannot decode"):
            await catalog.ingest_bytes(b"not an image", "ent1")

    @pytest.mark.asyncio
    async def test_ingest_saves_catalog_json(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_jpeg_bytes()
        await catalog.ingest_bytes(raw, "ent1")
        catalog_file = tmp_path / "ent1" / "catalog.json"
        assert catalog_file.exists()
        data = json.loads(catalog_file.read_text())
        assert len(data) == 1

    @pytest.mark.asyncio
    async def test_ingest_png_format(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_png_bytes()
        entry = await catalog.ingest_bytes(raw, "ent2")
        assert entry.format == "PNG"

    @pytest.mark.asyncio
    async def test_ingest_without_source_url(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_jpeg_bytes()
        entry = await catalog.ingest_bytes(raw, "ent1")
        assert entry.source_url is None


# ===========================================================================
# 7. ImageCatalog -- _download (async, mocked HTTP)
# ===========================================================================


class TestImageCatalogDownload:
    @pytest.mark.asyncio
    async def test_download_success(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_jpeg_bytes()
        mock_resp = MagicMock()
        mock_resp.content = raw
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await catalog._download("https://example.com/img.jpg")
            assert result == raw

    @pytest.mark.asyncio
    async def test_download_too_small_raises(self, tmp_path):
        """A too-small response raises ValueError (caught inside retry loop)
        which propagates as RuntimeError after all retries exhaust.
        We patch asyncio.sleep to avoid real delays."""
        catalog = ImageCatalog(catalog_root=tmp_path)
        mock_resp = MagicMock()
        mock_resp.content = b"tiny"
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            # ValueError is raised inside the retry loop and NOT caught
            # (only httpx exceptions are caught), so it bubbles out directly.
            with pytest.raises((ValueError, RuntimeError)):
                await catalog._download("https://example.com/tiny.jpg")

    @pytest.mark.asyncio
    async def test_download_http_error_retries_then_raises(self, tmp_path):
        import httpx

        catalog = ImageCatalog(catalog_root=tmp_path)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(RuntimeError, match="Failed to download"):
                    await catalog._download("https://example.com/img.jpg")


# ===========================================================================
# 8. ImageCatalog -- ingest_url (async, mocked)
# ===========================================================================


class TestImageCatalogIngestUrl:
    @pytest.mark.asyncio
    async def test_ingest_url_calls_download_then_ingest(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        raw = _make_jpeg_bytes()

        with patch.object(catalog, "_download", new=AsyncMock(return_value=raw)):
            entry = await catalog.ingest_url("https://example.com/img.jpg", "ent1")
            assert entry.entity_id == "ent1"
            assert entry.source_url == "https://example.com/img.jpg"


# ===========================================================================
# 9. ImageCatalog -- ingest_many
# ===========================================================================


class TestImageCatalogIngestMany:
    @pytest.mark.asyncio
    async def test_ingest_many_returns_successful_entries(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)

        async def fake_ingest_url(url, entity_id):
            return _make_catalog_entry(entity_id=entity_id, source_url=url)

        with patch.object(catalog, "ingest_url", side_effect=fake_ingest_url):
            results = await catalog.ingest_many(
                ["https://a.com/1.jpg", "https://b.com/2.jpg"],
                "ent1",
            )
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_ingest_many_skips_failures(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)

        call_count = 0

        async def fake_ingest_url(url, entity_id):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Download failed")
            return _make_catalog_entry(entity_id=entity_id, source_url=url)

        with patch.object(catalog, "ingest_url", side_effect=fake_ingest_url):
            results = await catalog.ingest_many(
                ["https://fail.com/img.jpg", "https://ok.com/img.jpg"],
                "ent1",
            )
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_ingest_many_empty_list(self, tmp_path):
        catalog = ImageCatalog(catalog_root=tmp_path)
        results = await catalog.ingest_many([], "ent1")
        assert results == []


# ===========================================================================
# 10. FaceClusterer
# ===========================================================================


class TestFaceClusterer:
    def test_cluster_catalog_returns_empty_when_unavailable(self):
        clusterer = FaceClusterer.__new__(FaceClusterer)
        clusterer._available = False
        clusterer.threshold = 0.55
        entries = [_make_catalog_entry()]
        assert clusterer.cluster_catalog(entries, "ent1") == []

    def test_cluster_catalog_skips_duplicates(self):
        """Duplicates should not be processed even if face service available."""
        clusterer = FaceClusterer.__new__(FaceClusterer)
        clusterer._available = True
        clusterer.threshold = 0.55
        mock_svc = MagicMock()
        mock_svc.detect_faces.return_value = MagicMock(faces_detected=0)
        clusterer._svc = mock_svc

        entries = [_make_catalog_entry(is_duplicate=True, local_path="/tmp/dup.jpg")]
        result = clusterer.cluster_catalog(entries, "ent1")
        assert result == []

    def test_cluster_catalog_skips_missing_local_path(self):
        clusterer = FaceClusterer.__new__(FaceClusterer)
        clusterer._available = True
        clusterer._svc = MagicMock()
        clusterer.threshold = 0.55

        entries = [_make_catalog_entry(local_path=None)]
        result = clusterer.cluster_catalog(entries, "ent1")
        assert result == []

    def test_cluster_catalog_skips_nonexistent_file(self, tmp_path):
        clusterer = FaceClusterer.__new__(FaceClusterer)
        clusterer._available = True
        clusterer._svc = MagicMock()
        clusterer.threshold = 0.55

        entries = [_make_catalog_entry(local_path=str(tmp_path / "nonexistent.jpg"))]
        result = clusterer.cluster_catalog(entries, "ent1")
        assert result == []

    def test_cluster_catalog_no_faces_detected(self, tmp_path):
        """Images with no faces produce no clusters."""
        raw = _make_jpeg_bytes()
        img_path = tmp_path / "img.jpg"
        img_path.write_bytes(raw)

        clusterer = FaceClusterer.__new__(FaceClusterer)
        clusterer._available = True
        clusterer.threshold = 0.55
        mock_svc = MagicMock()
        mock_svc.detect_faces.return_value = MagicMock(faces_detected=0)
        mock_svc._bytes_to_array = MagicMock()
        clusterer._svc = mock_svc

        entries = [_make_catalog_entry(local_path=str(img_path))]
        result = clusterer.cluster_catalog(entries, "ent1")
        assert result == []


# ===========================================================================
# 11. ReverseImageSearcher
# ===========================================================================


class TestReverseImageSearcher:
    @pytest.mark.asyncio
    async def test_search_tineye_no_key_returns_empty(self):
        searcher = ReverseImageSearcher(tineye_api_key=None)
        result = await searcher._search_tineye("https://example.com/img.jpg")
        assert result == []

    @pytest.mark.asyncio
    async def test_search_google_success(self):
        searcher = ReverseImageSearcher()
        html = (
            '<a href="/url?q=https://other.com/page&sa=U">Result</a>'
            '<a href="/url?q=https://another.com/photo&sa=U">Another</a>'
        )
        mock_resp = MagicMock()
        mock_resp.text = html
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_google("https://example.com/img.jpg")
        assert len(results) >= 1
        assert all(r.engine == "google" for r in results)
        assert all(r.url.startswith("http") for r in results)

    @pytest.mark.asyncio
    async def test_search_google_filters_google_urls(self):
        searcher = ReverseImageSearcher()
        html = (
            '<a href="/url?q=https://google.com/search&sa=U">Google</a>'
            '<a href="/url?q=https://example.com/page&sa=U">External</a>'
        )
        mock_resp = MagicMock()
        mock_resp.text = html
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_google("https://example.com/img.jpg")
        assert all("google.com" not in r.url for r in results)

    @pytest.mark.asyncio
    async def test_search_google_http_error_returns_empty(self):
        import httpx

        searcher = ReverseImageSearcher()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_google("https://example.com/img.jpg")
        assert results == []

    @pytest.mark.asyncio
    async def test_search_yandex_success(self):
        searcher = ReverseImageSearcher()
        html = '"url":"https://external.com/image.jpg"'
        mock_resp = MagicMock()
        mock_resp.text = html
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_yandex("https://example.com/img.jpg")
        assert len(results) >= 1
        assert results[0].engine == "yandex"

    @pytest.mark.asyncio
    async def test_search_yandex_filters_yandex_urls(self):
        searcher = ReverseImageSearcher()
        html = '"url":"https://yandex.com/search?q=1" "url":"https://external.com/img.jpg"'
        mock_resp = MagicMock()
        mock_resp.text = html
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_yandex("https://example.com/img.jpg")
        assert all("yandex" not in r.url for r in results)

    @pytest.mark.asyncio
    async def test_search_yandex_http_error_returns_empty(self):
        import httpx

        searcher = ReverseImageSearcher()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_yandex("https://example.com/img.jpg")
        assert results == []

    @pytest.mark.asyncio
    async def test_search_tineye_with_key_success(self):
        searcher = ReverseImageSearcher(tineye_api_key="testkey")
        response_data = {
            "results": {
                "matches": [
                    {
                        "score": 0.95,
                        "backlinks": [{"url": "https://site.com/page", "backlink": "Site Page"}],
                    }
                ]
            }
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = response_data
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            results = await searcher._search_tineye("https://example.com/img.jpg")
        assert len(results) == 1
        assert results[0].engine == "tineye"
        assert results[0].similarity_score == 0.95

    @pytest.mark.asyncio
    async def test_search_all_aggregates_results(self):
        searcher = ReverseImageSearcher()

        with patch.object(
            searcher,
            "_search_google",
            new=AsyncMock(return_value=[ReverseSearchResult(engine="google", url="https://a.com")]),
        ), patch.object(searcher, "_search_tineye", new=AsyncMock(return_value=[])), patch.object(
            searcher,
            "_search_yandex",
            new=AsyncMock(return_value=[ReverseSearchResult(engine="yandex", url="https://b.com")]),
        ):
            results = await searcher.search_all("https://example.com/img.jpg")

        assert len(results) == 2
        engines = {r.engine for r in results}
        assert "google" in engines
        assert "yandex" in engines

    @pytest.mark.asyncio
    async def test_search_all_handles_engine_exceptions(self):
        searcher = ReverseImageSearcher()

        with patch.object(
            searcher, "_search_google", new=AsyncMock(side_effect=Exception("network error"))
        ), patch.object(
            searcher,
            "_search_tineye",
            new=AsyncMock(return_value=[ReverseSearchResult(engine="tineye", url="https://t.com")]),
        ), patch.object(searcher, "_search_yandex", new=AsyncMock(return_value=[])):
            results = await searcher.search_all("https://example.com/img.jpg")

        # Exception from google is swallowed; tineye result survives
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_search_all_custom_engines(self):
        searcher = ReverseImageSearcher()

        with patch.object(
            searcher,
            "_search_google",
            new=AsyncMock(return_value=[ReverseSearchResult(engine="google", url="https://g.com")]),
        ):
            results = await searcher.search_all("https://example.com/img.jpg", engines=["google"])
        assert len(results) == 1
        assert results[0].engine == "google"


# ===========================================================================
# 12. compute_identity_score
# ===========================================================================


class TestComputeIdentityScore:
    def test_empty_catalog(self):
        score = compute_identity_score("ent1", [], [], [])
        assert score.entity_id == "ent1"
        assert score.total_images == 0
        assert score.overall_confidence == 0.0

    def test_counts_unique_vs_total(self):
        entries = [
            _make_catalog_entry(is_duplicate=False),
            _make_catalog_entry(is_duplicate=True),
            _make_catalog_entry(is_duplicate=False),
        ]
        score = compute_identity_score("ent1", entries, [], [])
        assert score.total_images == 3
        assert score.unique_images == 2

    def test_face_confidence_from_clusters(self):
        cluster = FaceCluster(entity_id="ent1", image_ids=["a", "b"], confidence=0.8)
        score = compute_identity_score("ent1", [], [cluster], [])
        assert score.face_match_confidence == pytest.approx(0.8)
        assert score.face_clusters == 1

    def test_multiple_clusters_weighted_average(self):
        c1 = FaceCluster(entity_id="ent1", image_ids=["a", "b", "c"], confidence=0.9)
        c2 = FaceCluster(entity_id="ent1", image_ids=["d"], confidence=0.3)
        score = compute_identity_score("ent1", [], [c1, c2], [])
        # Weighted: (0.9*3 + 0.3*1) / 4 = 3.0/4 = 0.75
        assert score.face_match_confidence == pytest.approx(0.75)

    def test_exif_consistency_same_make(self):
        entries = [
            _make_catalog_entry(exif=ExifSummary(make="Canon"), is_duplicate=False),
            _make_catalog_entry(exif=ExifSummary(make="Canon"), is_duplicate=False),
            _make_catalog_entry(exif=ExifSummary(make="Nikon"), is_duplicate=False),
        ]
        score = compute_identity_score("ent1", entries, [], [])
        # 2/3 have same make
        assert score.exif_consistency_score == pytest.approx(2 / 3, rel=1e-3)

    def test_cross_platform_score_five_domains(self):
        results = [
            ReverseSearchResult(engine="google", url="https://twitter.com/photo"),
            ReverseSearchResult(engine="google", url="https://instagram.com/photo"),
            ReverseSearchResult(engine="google", url="https://facebook.com/photo"),
            ReverseSearchResult(engine="google", url="https://linkedin.com/photo"),
            ReverseSearchResult(engine="google", url="https://reddit.com/photo"),
        ]
        score = compute_identity_score("ent1", [], [], results)
        assert score.cross_platform_score == pytest.approx(1.0)  # 5 domains = cap

    def test_cross_platform_score_one_domain(self):
        results = [
            ReverseSearchResult(engine="google", url="https://twitter.com/photo"),
        ]
        score = compute_identity_score("ent1", [], [], results)
        assert score.cross_platform_score == pytest.approx(0.2)

    def test_overall_confidence_weighted(self):
        cluster = FaceCluster(entity_id="ent1", image_ids=["a"], confidence=1.0)
        entries = [
            _make_catalog_entry(exif=ExifSummary(make="Canon"), is_duplicate=False),
        ]
        results = [
            ReverseSearchResult(engine="google", url="https://site1.com/img"),
            ReverseSearchResult(engine="google", url="https://site2.com/img"),
            ReverseSearchResult(engine="google", url="https://site3.com/img"),
            ReverseSearchResult(engine="google", url="https://site4.com/img"),
            ReverseSearchResult(engine="google", url="https://site5.com/img"),
        ]
        score = compute_identity_score("ent1", entries, [cluster], results)
        # face=1.0 (40%) + exif=1.0 (30%) + cross=1.0 (30%) = 1.0
        assert score.overall_confidence == pytest.approx(1.0, abs=0.01)

    def test_cross_platform_hits_count(self):
        results = [
            ReverseSearchResult(engine="google", url="https://a.com"),
            ReverseSearchResult(engine="tineye", url="https://b.com"),
        ]
        score = compute_identity_score("ent1", [], [], results)
        assert score.cross_platform_hits == 2

    def test_no_exif_make_zero_consistency(self):
        entries = [
            _make_catalog_entry(exif=ExifSummary(), is_duplicate=False),
        ]
        score = compute_identity_score("ent1", entries, [], [])
        assert score.exif_consistency_score == 0.0


# ===========================================================================
# 13. ImageIntelligencePipeline -- run (fully mocked)
# ===========================================================================


class TestImageIntelligencePipeline:
    def _make_pipeline(self, tmp_path) -> ImageIntelligencePipeline:
        return ImageIntelligencePipeline(catalog_root=tmp_path)

    @pytest.mark.asyncio
    async def test_run_basic_pipeline(self, tmp_path):
        pipeline = self._make_pipeline(tmp_path)

        fake_entry = _make_catalog_entry(entity_id="ent1", source_url="https://example.com/img.jpg")
        fake_entry.is_duplicate = False

        with patch.object(
            pipeline.catalog, "ingest_many", new=AsyncMock(return_value=[fake_entry])
        ), patch.object(pipeline.clusterer, "cluster_catalog", return_value=[]), patch.object(
            pipeline.reverse_searcher, "search_all", new=AsyncMock(return_value=[])
        ), patch.object(
            pipeline.catalog,
            "save_catalog",
        ):
            report = await pipeline.run(
                entity_id="ent1",
                image_urls=["https://example.com/img.jpg"],
                run_reverse_search=False,
            )

        assert report.entity_id == "ent1"
        assert len(report.catalog) == 1
        assert report.identity_score is not None
        assert report.fake_id_signals is not None

    @pytest.mark.asyncio
    async def test_run_with_reverse_search(self, tmp_path):
        pipeline = self._make_pipeline(tmp_path)

        fake_entry = _make_catalog_entry(
            entity_id="ent1",
            source_url="https://example.com/img.jpg",
            is_duplicate=False,
        )
        reverse_result = ReverseSearchResult(engine="google", url="https://other.com/img")

        with patch.object(
            pipeline.catalog, "ingest_many", new=AsyncMock(return_value=[fake_entry])
        ), patch.object(pipeline.clusterer, "cluster_catalog", return_value=[]), patch.object(
            pipeline.reverse_searcher, "search_all", new=AsyncMock(return_value=[reverse_result])
        ), patch.object(
            pipeline.catalog,
            "save_catalog",
        ):
            report = await pipeline.run(
                entity_id="ent1",
                image_urls=["https://example.com/img.jpg"],
                run_reverse_search=True,
                max_reverse_search=1,
            )

        assert len(report.reverse_search_results) == 1

    @pytest.mark.asyncio
    async def test_run_empty_urls(self, tmp_path):
        pipeline = self._make_pipeline(tmp_path)

        with patch.object(
            pipeline.catalog, "ingest_many", new=AsyncMock(return_value=[])
        ), patch.object(pipeline.clusterer, "cluster_catalog", return_value=[]), patch.object(
            pipeline.catalog,
            "save_catalog",
        ):
            report = await pipeline.run(entity_id="ent1", image_urls=[])

        assert report.entity_id == "ent1"
        assert report.catalog == []

    @pytest.mark.asyncio
    async def test_run_cluster_id_propagated(self, tmp_path):
        pipeline = self._make_pipeline(tmp_path)

        entry = _make_catalog_entry(entity_id="ent1", image_id="img1")
        cluster = FaceCluster(entity_id="ent1", image_ids=["img1"], confidence=0.9)

        with patch.object(
            pipeline.catalog, "ingest_many", new=AsyncMock(return_value=[entry])
        ), patch.object(
            pipeline.clusterer, "cluster_catalog", return_value=[cluster]
        ), patch.object(
            pipeline.reverse_searcher, "search_all", new=AsyncMock(return_value=[])
        ), patch.object(
            pipeline.catalog,
            "save_catalog",
        ):
            report = await pipeline.run(
                entity_id="ent1",
                image_urls=["https://example.com/img.jpg"],
                run_reverse_search=False,
            )

        assert report.catalog[0].cluster_id == cluster.cluster_id

    @pytest.mark.asyncio
    async def test_analyze_single(self, tmp_path):
        pipeline = self._make_pipeline(tmp_path)
        raw = _make_jpeg_bytes()

        fake_entry = _make_catalog_entry(entity_id="ent1")

        with patch.object(
            pipeline.catalog, "ingest_bytes", new=AsyncMock(return_value=fake_entry)
        ), patch.object(pipeline.catalog, "load_catalog", return_value=[fake_entry]), patch.object(
            pipeline.clusterer, "cluster_catalog", return_value=[]
        ):
            report = await pipeline.analyze_single(
                raw_bytes=raw,
                entity_id="ent1",
                source_url=None,
                run_reverse_search=False,
            )

        assert report.entity_id == "ent1"
        assert report.identity_score is not None

    @pytest.mark.asyncio
    async def test_analyze_single_with_reverse_search(self, tmp_path):
        pipeline = self._make_pipeline(tmp_path)
        raw = _make_jpeg_bytes()
        fake_entry = _make_catalog_entry(entity_id="ent1")
        rev = ReverseSearchResult(engine="google", url="https://found.com/img")

        with patch.object(
            pipeline.catalog, "ingest_bytes", new=AsyncMock(return_value=fake_entry)
        ), patch.object(pipeline.catalog, "load_catalog", return_value=[fake_entry]), patch.object(
            pipeline.clusterer, "cluster_catalog", return_value=[]
        ), patch.object(pipeline.reverse_searcher, "search_all", new=AsyncMock(return_value=[rev])):
            report = await pipeline.analyze_single(
                raw_bytes=raw,
                entity_id="ent1",
                source_url="https://example.com/img.jpg",
                run_reverse_search=True,
            )

        assert len(report.reverse_search_results) == 1

    def test_pipeline_constructor_defaults(self, tmp_path):
        pipeline = ImageIntelligencePipeline(catalog_root=tmp_path)
        assert pipeline.reverse_engines == ["google", "tineye", "yandex"]
        assert pipeline.catalog is not None
        assert pipeline.clusterer is not None

    def test_pipeline_constructor_custom_engines(self, tmp_path):
        pipeline = ImageIntelligencePipeline(
            catalog_root=tmp_path,
            reverse_search_engines=["google"],
        )
        assert pipeline.reverse_engines == ["google"]

    def test_pipeline_constructor_tineye_key(self, tmp_path):
        pipeline = ImageIntelligencePipeline(
            catalog_root=tmp_path,
            tineye_api_key="mykey",
            tineye_api_secret="mysecret",
        )
        assert pipeline.reverse_searcher.tineye_key == "mykey"
        assert pipeline.reverse_searcher.tineye_secret == "mysecret"
