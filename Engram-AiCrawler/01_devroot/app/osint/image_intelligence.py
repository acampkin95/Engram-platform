"""Image Intelligence & Identity Verification — Phase 3.

Orchestrates the full image pipeline for OSINT investigations:

  3.1  Image Catalog   — download, hash (pHash/dHash/MD5/SHA256), deduplicate,
                         persist to disk, track per entity.
  3.2  Face Clustering — detect faces, build encoding clusters, link photos of
                         the same person across different sources.
  3.3  Reverse Search  — submit images to Google Images (via SerpAPI / scrape),
                         TinEye (API), and Yandex (scrape) for cross-platform
                         identity matching.
  3.4  EXIF Extraction — pull GPS, device make/model, software, timestamps,
                         and convert GPS DMS → decimal degrees.
  3.5  Identity Score  — combine face-match confidence + EXIF consistency +
                         cross-platform presence into a 0–1 confidence score.
  3.6  Fake ID Signals — stock-photo fingerprints, AI-generation indicators,
                         metadata anomalies, and implausible timestamp gaps.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import re
import uuid
from datetime import datetime, UTC
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import httpx
import imagehash
import numpy as np
from PIL import Image, ExifTags
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CATALOG_ROOT = Path("/app/data/image_catalog")
_MAX_BYTES = 20 * 1024 * 1024  # 20 MB
_MIN_BYTES = 100
_DOWNLOAD_TIMEOUT = 30.0
_DOWNLOAD_RETRIES = 3
_SIMILARITY_THRESHOLD = 0.90  # pHash Hamming similarity for dedup
_FACE_CLUSTER_THRESHOLD = 0.55  # face_recognition distance for clustering

# Known AI-generation artefact strings in EXIF Software field
_AI_SOFTWARE_PATTERNS = [
    r"midjourney",
    r"stable[\s_-]diffusion",
    r"dall[\s_-]e",
    r"firefly",
    r"imagen",
    r"nightcafe",
    r"artbreeder",
    r"runway",
    r"invoke[\s_-]ai",
    r"automatic1111",
]

# Stock-photo watermark phrases sometimes embedded in EXIF / filename
_STOCK_WATERMARK_PATTERNS = [
    r"shutterstock",
    r"gettyimages",
    r"istockphoto",
    r"depositphotos",
    r"alamy",
    r"dreamstime",
    r"123rf",
    r"adobe[\s_-]stock",
]


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class GpsCoordinates(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float | None = None
    accuracy_note: str | None = None


class ExifSummary(BaseModel):
    """Parsed EXIF fields relevant to OSINT."""

    make: str | None = None
    model: str | None = None
    software: str | None = None
    datetime_original: str | None = None
    datetime_digitized: str | None = None
    gps: GpsCoordinates | None = None
    orientation: int | None = None
    # Raw dump for completeness
    raw: dict[str, Any] = Field(default_factory=dict)


class ImageHashes(BaseModel):
    phash: str
    dhash: str
    ahash: str
    md5: str
    sha256: str


class CatalogEntry(BaseModel):
    """A single image stored in the catalog."""

    image_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    entity_id: str | None = None
    source_url: str | None = None
    local_path: str | None = None
    hashes: ImageHashes | None = None
    exif: ExifSummary | None = None
    width: int = 0
    height: int = 0
    format: str | None = None
    file_size_bytes: int = 0
    faces_detected: int = 0
    cluster_id: str | None = None  # Face cluster this image belongs to
    is_duplicate: bool = False
    duplicate_of: str | None = None  # image_id of canonical copy
    added_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class FaceCluster(BaseModel):
    """Group of images believed to show the same face."""

    cluster_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    entity_id: str | None = None
    image_ids: list[str] = Field(default_factory=list)
    representative_image_id: str | None = None  # Best-quality image
    confidence: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ReverseSearchResult(BaseModel):
    """One hit from a reverse image search engine."""

    engine: str  # "google" | "tineye" | "yandex"
    title: str | None = None
    url: str
    thumbnail_url: str | None = None
    similarity_score: float | None = None
    found_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class FakeIdSignals(BaseModel):
    """Signals that suggest a fake or synthetic identity."""

    is_likely_ai_generated: bool = False
    ai_generation_evidence: list[str] = Field(default_factory=list)
    is_likely_stock_photo: bool = False
    stock_photo_evidence: list[str] = Field(default_factory=list)
    metadata_anomalies: list[str] = Field(default_factory=list)
    timestamp_gap_days: float | None = None  # Gap between capture & upload
    missing_exif: bool = False
    stripped_exif: bool = False  # Has image but zero EXIF (suspicious)
    overall_suspicion_score: float = 0.0  # 0.0 = clean, 1.0 = very suspicious


class IdentityVerificationScore(BaseModel):
    """Composite identity confidence for an entity's image set."""

    entity_id: str
    total_images: int
    unique_images: int  # After deduplication
    face_clusters: int
    cross_platform_hits: int  # Reverse search hits across platforms
    face_match_confidence: float = 0.0
    exif_consistency_score: float = 0.0
    cross_platform_score: float = 0.0
    overall_confidence: float = 0.0  # Weighted composite
    fake_id_signals: FakeIdSignals | None = None
    computed_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ImageIntelligenceReport(BaseModel):
    """Full Phase-3 report for an entity."""

    entity_id: str
    catalog: list[CatalogEntry] = Field(default_factory=list)
    face_clusters: list[FaceCluster] = Field(default_factory=list)
    reverse_search_results: list[ReverseSearchResult] = Field(default_factory=list)
    identity_score: IdentityVerificationScore | None = None
    fake_id_signals: FakeIdSignals | None = None
    generated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# ---------------------------------------------------------------------------
# 3.4  EXIF Extraction helpers
# ---------------------------------------------------------------------------


def _dms_to_decimal(dms_tuple: Any, ref: str) -> float | None:
    """Convert GPS DMS IFDRational tuple to decimal degrees."""
    try:
        d, m, s = float(dms_tuple[0]), float(dms_tuple[1]), float(dms_tuple[2])
        decimal = d + m / 60.0 + s / 3600.0
        if ref in ("S", "W"):
            decimal = -decimal
        return round(decimal, 7)
    except Exception:
        return None


def extract_exif(image: Image.Image) -> ExifSummary:
    """Pull OSINT-relevant EXIF fields from a PIL Image."""
    raw: dict[str, Any] = {}
    exif_obj = image.getexif()

    if not exif_obj:
        return ExifSummary(raw={})

    for tag_id, value in exif_obj.items():
        tag = ExifTags.TAGS.get(tag_id, str(tag_id))
        try:
            raw[tag] = value if not isinstance(value, bytes) else value.hex()
        except Exception:
            raw[tag] = str(value)

    # GPS sub-IFD (tag 34853)
    gps_info = exif_obj.get_ifd(0x8825)
    gps: GpsCoordinates | None = None
    if gps_info:
        lat = _dms_to_decimal(gps_info.get(2), gps_info.get(1, "N"))
        lon = _dms_to_decimal(gps_info.get(4), gps_info.get(3, "E"))
        alt_raw = gps_info.get(6)
        alt: float | None = None
        if alt_raw is not None:
            try:
                alt = round(float(alt_raw), 2)
            except Exception:
                pass
        if lat is not None and lon is not None:
            gps = GpsCoordinates(latitude=lat, longitude=lon, altitude_m=alt)

    return ExifSummary(
        make=raw.get("Make"),
        model=raw.get("Model"),
        software=raw.get("Software"),
        datetime_original=raw.get("DateTimeOriginal"),
        datetime_digitized=raw.get("DateTimeDigitized"),
        gps=gps,
        orientation=raw.get("Orientation"),
        raw=raw,
    )


# ---------------------------------------------------------------------------
# 3.6  Fake ID signal detection helpers
# ---------------------------------------------------------------------------


def _check_ai_generation(exif: ExifSummary | None, filename: str) -> list[str]:
    evidence: list[str] = []
    haystack = " ".join(
        filter(
            None,
            [
                exif.software if exif else None,
                exif.make if exif else None,
                exif.model if exif else None,
                filename,
            ],
        )
    ).lower()
    for pat in _AI_SOFTWARE_PATTERNS:
        if re.search(pat, haystack, re.IGNORECASE):
            evidence.append(f"AI software pattern matched: '{pat}'")
    return evidence


def _check_stock_photo(exif: ExifSummary | None, filename: str, source_url: str) -> list[str]:
    evidence: list[str] = []
    haystack = " ".join(
        filter(
            None,
            [
                exif.software if exif else None,
                filename,
                source_url,
            ],
        )
    ).lower()
    for pat in _STOCK_WATERMARK_PATTERNS:
        if re.search(pat, haystack, re.IGNORECASE):
            evidence.append(f"Stock-photo source matched: '{pat}'")
    return evidence


def _check_metadata_anomalies(exif: ExifSummary | None) -> list[str]:
    anomalies: list[str] = []
    if exif is None:
        return anomalies

    # Timestamp gap: DateTimeOriginal vs DateTimeDigitized
    if exif.datetime_original and exif.datetime_digitized:
        try:
            fmt = "%Y:%m:%d %H:%M:%S"
            orig = datetime.strptime(exif.datetime_original, fmt)
            digi = datetime.strptime(exif.datetime_digitized, fmt)
            gap = abs((digi - orig).total_seconds()) / 86400
            if gap > 365:
                anomalies.append(f"DateTimeOriginal and DateTimeDigitized differ by {gap:.0f} days")
        except Exception:
            pass

    # Future-dated EXIF
    if exif.datetime_original:
        try:
            fmt = "%Y:%m:%d %H:%M:%S"
            orig = datetime.strptime(exif.datetime_original, fmt)
            if orig > datetime.now():
                anomalies.append("DateTimeOriginal is in the future")
        except Exception:
            pass

    # Implausible GPS (0,0 = null island)
    if exif.gps:
        if exif.gps.latitude == 0.0 and exif.gps.longitude == 0.0:
            anomalies.append("GPS coordinates are (0, 0) — likely placeholder")

    return anomalies


def detect_fake_id_signals(
    entry: CatalogEntry,
    has_exif_data: bool,
    image_has_faces: bool,
) -> FakeIdSignals:
    """Aggregate fake-identity signals for a single image."""
    exif = entry.exif
    source_url = entry.source_url or ""
    filename = Path(entry.local_path or "").name

    ai_evidence = _check_ai_generation(exif, filename)
    stock_evidence = _check_stock_photo(exif, filename, source_url)
    anomalies = _check_metadata_anomalies(exif)

    # Missing vs stripped EXIF
    missing_exif = not has_exif_data
    stripped_exif = (
        has_exif_data
        and exif is not None
        and not exif.make
        and not exif.model
        and not exif.datetime_original
        and not exif.gps
    )

    # Suspicion score: weighted sum capped at 1.0
    score = 0.0
    if ai_evidence:
        score += 0.5
    if stock_evidence:
        score += 0.4
    if anomalies:
        score += min(0.1 * len(anomalies), 0.3)
    if stripped_exif:
        score += 0.2
    score = min(score, 1.0)

    return FakeIdSignals(
        is_likely_ai_generated=bool(ai_evidence),
        ai_generation_evidence=ai_evidence,
        is_likely_stock_photo=bool(stock_evidence),
        stock_photo_evidence=stock_evidence,
        metadata_anomalies=anomalies,
        missing_exif=missing_exif,
        stripped_exif=stripped_exif,
        overall_suspicion_score=round(score, 3),
    )


# ---------------------------------------------------------------------------
# 3.1  Image Catalog
# ---------------------------------------------------------------------------


class ImageCatalog:
    """Download, hash, deduplicate, and persist images for an entity.

    On-disk layout::

        {catalog_root}/{entity_id}/{image_id}.{ext}
        {catalog_root}/{entity_id}/catalog.json
    """

    def __init__(self, catalog_root: Path = _CATALOG_ROOT) -> None:
        self.catalog_root = catalog_root
        self.catalog_root.mkdir(parents=True, exist_ok=True)

    # -- Persistence -----------------------------------------------------------

    def _entity_dir(self, entity_id: str) -> Path:
        p = self.catalog_root / entity_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _catalog_path(self, entity_id: str) -> Path:
        return self._entity_dir(entity_id) / "catalog.json"

    def load_catalog(self, entity_id: str) -> list[CatalogEntry]:
        path = self._catalog_path(entity_id)
        if not path.exists():
            return []
        try:
            data = json.loads(path.read_text())
            return [CatalogEntry(**e) for e in data]
        except Exception as exc:
            logger.warning("Corrupt catalog for %s: %s", entity_id, exc)
            return []

    def save_catalog(self, entity_id: str, entries: list[CatalogEntry]) -> None:
        path = self._catalog_path(entity_id)
        path.write_text(json.dumps([e.model_dump() for e in entries], indent=2, default=str))

    # -- Hashing ---------------------------------------------------------------

    @staticmethod
    def compute_hashes(image: Image.Image, raw: bytes) -> ImageHashes:
        return ImageHashes(
            phash=str(imagehash.phash(image)),
            dhash=str(imagehash.dhash(image)),
            ahash=str(imagehash.average_hash(image)),
            md5=hashlib.md5(raw).hexdigest(),
            sha256=hashlib.sha256(raw).hexdigest(),
        )

    @staticmethod
    def _phash_similarity(h1: str, h2: str) -> float:
        try:
            ih1 = imagehash.hex_to_hash(h1)
            ih2 = imagehash.hex_to_hash(h2)
            dist = ih1 - ih2
            total = ih1.hash.size
            return 1.0 - dist / total if total else 0.0
        except Exception:
            return 0.0

    # -- Deduplication ---------------------------------------------------------

    def find_duplicate(
        self,
        hashes: ImageHashes,
        existing: list[CatalogEntry],
    ) -> str | None:
        """Return image_id of an existing entry that matches *hashes*, or None."""
        # Exact match first (fastest)
        for entry in existing:
            if entry.hashes and entry.hashes.sha256 == hashes.sha256:
                return entry.image_id

        # Perceptual similarity
        for entry in existing:
            if entry.hashes and not entry.is_duplicate:
                sim = self._phash_similarity(hashes.phash, entry.hashes.phash)
                if sim >= _SIMILARITY_THRESHOLD:
                    return entry.image_id

        return None

    # -- Download --------------------------------------------------------------

    async def _download(self, url: str) -> bytes:
        last_exc: Exception | None = None
        for attempt in range(_DOWNLOAD_RETRIES):
            try:
                async with httpx.AsyncClient(
                    timeout=_DOWNLOAD_TIMEOUT,
                    follow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; OSINTBot/1.0)"},
                ) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    data = resp.content
                    if len(data) < _MIN_BYTES:
                        raise ValueError(f"Response too small ({len(data)} bytes)")
                    if len(data) > _MAX_BYTES:
                        raise ValueError(f"Image too large ({len(data) / 1024 / 1024:.1f} MB)")
                    return data
            except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout) as exc:
                last_exc = exc
                await asyncio.sleep(1.5**attempt)
        raise RuntimeError(f"Failed to download {url}: {last_exc}")

    # -- Core ingest -----------------------------------------------------------

    async def ingest_url(
        self,
        url: str,
        entity_id: str,
    ) -> CatalogEntry:
        """Download, hash, deduplicate, and catalog an image from *url*."""
        raw = await self._download(url)
        return await self._ingest_bytes(raw, entity_id, source_url=url)

    async def ingest_bytes(
        self,
        raw: bytes,
        entity_id: str,
        source_url: str | None = None,
    ) -> CatalogEntry:
        """Catalog raw image bytes (already downloaded)."""
        return await self._ingest_bytes(raw, entity_id, source_url=source_url)

    async def _ingest_bytes(
        self,
        raw: bytes,
        entity_id: str,
        source_url: str | None = None,
    ) -> CatalogEntry:
        try:
            image = Image.open(io.BytesIO(raw))
        except Exception as exc:
            raise ValueError(f"Cannot decode image: {exc}") from exc

        hashes = self.compute_hashes(image, raw)
        existing = self.load_catalog(entity_id)
        dup_id = self.find_duplicate(hashes, existing)

        exif_summary = extract_exif(image)
        bool(exif_summary.raw)

        entry = CatalogEntry(
            entity_id=entity_id,
            source_url=source_url,
            hashes=hashes,
            exif=exif_summary,
            width=image.width,
            height=image.height,
            format=image.format,
            file_size_bytes=len(raw),
        )

        if dup_id:
            entry.is_duplicate = True
            entry.duplicate_of = dup_id
            logger.debug("Image from %s is duplicate of %s", source_url, dup_id)
        else:
            # Save to disk
            ext = (image.format or "jpg").lower()
            local_path = self._entity_dir(entity_id) / f"{entry.image_id}.{ext}"
            local_path.write_bytes(raw)
            entry.local_path = str(local_path)

        existing.append(entry)
        self.save_catalog(entity_id, existing)
        return entry

    async def ingest_many(
        self,
        urls: list[str],
        entity_id: str,
        max_concurrent: int = 5,
    ) -> list[CatalogEntry]:
        """Ingest multiple image URLs concurrently."""
        sem = asyncio.Semaphore(max_concurrent)

        async def _one(url: str) -> CatalogEntry | None:
            async with sem:
                try:
                    return await self.ingest_url(url, entity_id)
                except Exception as exc:
                    logger.warning("Failed to ingest %s: %s", url, exc)
                    return None

        results = await asyncio.gather(*[_one(u) for u in urls])
        return [r for r in results if r is not None]


# ---------------------------------------------------------------------------
# 3.2  Face Clustering
# ---------------------------------------------------------------------------


class FaceClusterer:
    """Cluster images by the faces they contain.

    Uses the existing FaceRecognitionService for encoding, then groups
    images whose best-matching faces are within *threshold* distance.
    """

    def __init__(self, threshold: float = _FACE_CLUSTER_THRESHOLD) -> None:
        self.threshold = threshold
        try:
            from app.osint.face_recognition_service import FaceRecognitionService

            self._svc = FaceRecognitionService()
            self._available = True
        except Exception:
            self._svc = None  # type: ignore[assignment]
            self._available = False
            logger.warning("FaceRecognitionService unavailable — face clustering disabled")

    def cluster_catalog(
        self,
        entries: list[CatalogEntry],
        entity_id: str,
    ) -> list[FaceCluster]:
        """Return face clusters for non-duplicate entries with local files."""
        if not self._available:
            return []
        candidates = self._load_candidates(entries)
        if not candidates:
            return []
        encoding_map = self._build_encoding_map(candidates)
        if not encoding_map:
            return []
        return self._greedy_cluster(encoding_map, entity_id)

    def _load_candidates(self, entries: list[CatalogEntry]) -> list[tuple[CatalogEntry, bytes]]:
        candidates: list[tuple[CatalogEntry, bytes]] = []
        for entry in entries:
            if entry.is_duplicate or not entry.local_path:
                continue
            path = Path(entry.local_path)
            if path.exists():
                candidates.append((entry, path.read_bytes()))
        return candidates

    def _build_encoding_map(
        self, candidates: list[tuple[CatalogEntry, bytes]]
    ) -> dict[str, list]:
        encoding_map: dict[str, list] = {}
        for entry, raw in candidates:
            try:
                result = self._svc.detect_faces(raw)  # type: ignore[union-attr]
                entry.faces_detected = result.faces_detected
                if result.faces_detected > 0:
                    import face_recognition as _fr
                    import numpy as np

                    img_arr = self._svc._bytes_to_array(raw)  # type: ignore[union-attr]
                    locs = _fr.face_locations(img_arr)
                    encs = _fr.face_encodings(img_arr, known_face_locations=locs)
                    if encs:
                        encoding_map[entry.image_id] = list(encs)
            except Exception as exc:
                logger.debug("Face encoding failed for %s: %s", entry.image_id, exc)
        return encoding_map

    def _greedy_cluster(self, encoding_map: dict[str, list], entity_id: str) -> list[FaceCluster]:
        import face_recognition as _fr
        import numpy as np

        clusters: list[FaceCluster] = []
        assigned: dict[str, str] = {}
        image_ids = list(encoding_map.keys())

        for img_id in image_ids:
            if img_id in assigned:
                continue
            encs = encoding_map[img_id]
            cluster = FaceCluster(entity_id=entity_id)
            cluster.image_ids.append(img_id)
            cluster.representative_image_id = img_id
            assigned[img_id] = cluster.cluster_id

            for other_id in image_ids:
                if other_id in assigned:
                    continue
                try:
                    dists = _fr.face_distance(encs, encoding_map[other_id][0])
                    best = float(np.min(dists))
                    if best <= self.threshold:
                        cluster.image_ids.append(other_id)
                        assigned[other_id] = cluster.cluster_id
                        cluster.confidence = max(cluster.confidence, 1.0 - best)
                except Exception:
                    pass

            clusters.append(cluster)

        return clusters


# ---------------------------------------------------------------------------
# 3.3  Reverse Image Search
# ---------------------------------------------------------------------------


class ReverseImageSearcher:
    """Submit images to reverse-search engines and collect hits.

    Engines:
      - Google Images  (via scraping the search results page)
      - TinEye         (via official API if key available, else scrape)
      - Yandex Images  (via scraping)
    """

    GOOGLE_LENS_URL = "https://lens.google.com/uploadbyurl?url={url}"
    GOOGLE_SEARCH_URL = "https://www.google.com/searchbyimage?image_url={url}&safe=off"
    TINEYE_API_URL = "https://api.tineye.com/rest/search/"
    YANDEX_URL = "https://yandex.com/images/search?rpt=imageview&url={url}"

    def __init__(
        self,
        tineye_api_key: str | None = None,
        tineye_api_secret: str | None = None,
    ) -> None:
        self.tineye_key = tineye_api_key
        self.tineye_secret = tineye_api_secret

    async def search_all(
        self,
        image_url: str,
        engines: list[str] | None = None,
    ) -> list[ReverseSearchResult]:
        """Run reverse search across all requested engines concurrently."""
        if engines is None:
            engines = ["google", "tineye", "yandex"]

        tasks = []
        if "google" in engines:
            tasks.append(self._search_google(image_url))
        if "tineye" in engines:
            tasks.append(self._search_tineye(image_url))
        if "yandex" in engines:
            tasks.append(self._search_yandex(image_url))

        results: list[ReverseSearchResult] = []
        for coro_result in await asyncio.gather(*tasks, return_exceptions=True):
            if isinstance(coro_result, Exception):
                logger.debug("Reverse search engine error: %s", coro_result)
            elif isinstance(coro_result, list):
                results.extend(coro_result)

        return results

    async def _search_google(self, image_url: str) -> list[ReverseSearchResult]:
        """Scrape Google reverse image search results."""
        search_url = self.GOOGLE_SEARCH_URL.format(url=quote_plus(image_url))
        try:
            async with httpx.AsyncClient(
                timeout=20.0,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                },
            ) as client:
                resp = await client.get(search_url)
                resp.raise_for_status()
                html = resp.text

            # Extract result links from Google HTML
            results: list[ReverseSearchResult] = []
            # Pattern: href="/url?q=<url>&..."
            for m in re.finditer(r'href="/url\?q=([^&"]+)', html):
                url = m.group(1)
                if url.startswith("http") and "google.com" not in url:
                    results.append(
                        ReverseSearchResult(
                            engine="google",
                            url=url,
                        )
                    )
                    if len(results) >= 10:
                        break
            return results
        except Exception as exc:
            logger.debug("Google reverse search failed: %s", exc)
            return []

    async def _search_tineye(self, image_url: str) -> list[ReverseSearchResult]:
        """Use TinEye API (if key available) or return empty."""
        if not self.tineye_key:
            logger.debug("TinEye API key not configured — skipping")
            return []
        try:
            params: dict[str, str] = {
                "api_key": self.tineye_key,
                "image_url": image_url,
                "offset": "0",
                "limit": "10",
                "sort": "score",
                "order": "desc",
            }
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(self.TINEYE_API_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

            results: list[ReverseSearchResult] = []
            for match in data.get("results", {}).get("matches", []):
                for backlink in match.get("backlinks", [])[:2]:
                    results.append(
                        ReverseSearchResult(
                            engine="tineye",
                            title=backlink.get("backlink"),
                            url=backlink.get("url", ""),
                            similarity_score=match.get("score"),
                        )
                    )
            return results
        except Exception as exc:
            logger.debug("TinEye search failed: %s", exc)
            return []

    async def _search_yandex(self, image_url: str) -> list[ReverseSearchResult]:
        """Scrape Yandex reverse image search results."""
        search_url = self.YANDEX_URL.format(url=quote_plus(image_url))
        try:
            async with httpx.AsyncClient(
                timeout=20.0,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " "AppleWebKit/537.36"
                    )
                },
            ) as client:
                resp = await client.get(search_url)
                resp.raise_for_status()
                html = resp.text

            results: list[ReverseSearchResult] = []
            # Yandex embeds result URLs as data-bem JSON or href links
            for m in re.finditer(r'"url":"(https?://[^"]+)"', html):
                url = m.group(1)
                if "yandex" not in url:
                    results.append(ReverseSearchResult(engine="yandex", url=url))
                    if len(results) >= 10:
                        break
            return results
        except Exception as exc:
            logger.debug("Yandex reverse search failed: %s", exc)
            return []


# ---------------------------------------------------------------------------
# 3.5  Identity Verification Scoring
# ---------------------------------------------------------------------------


def compute_identity_score(
    entity_id: str,
    catalog: list[CatalogEntry],
    clusters: list[FaceCluster],
    reverse_results: list[ReverseSearchResult],
) -> IdentityVerificationScore:
    """Compute a composite identity confidence score.

    Weights:
      - Face match confidence  40%
      - EXIF consistency       30%
      - Cross-platform hits    30%
    """
    total = len(catalog)
    unique = sum(1 for e in catalog if not e.is_duplicate)

    # Face match confidence: average cluster confidence, weighted by cluster size
    face_conf = 0.0
    if clusters:
        weighted = sum(c.confidence * len(c.image_ids) for c in clusters)
        total_clustered = sum(len(c.image_ids) for c in clusters)
        face_conf = weighted / total_clustered if total_clustered else 0.0

    # EXIF consistency: fraction of non-duplicate images sharing same make/model
    exif_score = 0.0
    non_dup = [e for e in catalog if not e.is_duplicate and e.exif]
    if non_dup:
        makes = [e.exif.make for e in non_dup if e.exif and e.exif.make]  # type: ignore[union-attr]
        if makes:
            most_common_count = max(makes.count(m) for m in set(makes))
            exif_score = most_common_count / len(non_dup)

    # Cross-platform score: unique domains found in reverse search
    domains: set = set()
    for r in reverse_results:
        m = re.search(r"https?://([^/]+)", r.url)
        if m:
            domains.add(m.group(1).lower().lstrip("www."))
    cross_score = min(len(domains) / 5.0, 1.0)  # Cap at 5 unique domains = 1.0

    overall = round(0.40 * face_conf + 0.30 * exif_score + 0.30 * cross_score, 3)

    return IdentityVerificationScore(
        entity_id=entity_id,
        total_images=total,
        unique_images=unique,
        face_clusters=len(clusters),
        cross_platform_hits=len(reverse_results),
        face_match_confidence=round(face_conf, 3),
        exif_consistency_score=round(exif_score, 3),
        cross_platform_score=round(cross_score, 3),
        overall_confidence=overall,
    )


# ---------------------------------------------------------------------------
# Orchestrator — ties everything together
# ---------------------------------------------------------------------------


class ImageIntelligencePipeline:
    """Phase-3 orchestrator: catalog → cluster → reverse-search → score → signals.

    Usage::

        pipeline = ImageIntelligencePipeline()
        report = await pipeline.run(
            entity_id="abc123",
            image_urls=["https://..."],
        )
    """

    def __init__(
        self,
        catalog_root: Path = _CATALOG_ROOT,
        tineye_api_key: str | None = None,
        tineye_api_secret: str | None = None,
        reverse_search_engines: list[str] | None = None,
    ) -> None:
        self.catalog = ImageCatalog(catalog_root)
        self.clusterer = FaceClusterer()
        self.reverse_searcher = ReverseImageSearcher(
            tineye_api_key=tineye_api_key,
            tineye_api_secret=tineye_api_secret,
        )
        self.reverse_engines = reverse_search_engines or ["google", "tineye", "yandex"]

    async def run(
        self,
        entity_id: str,
        image_urls: list[str],
        run_reverse_search: bool = True,
        max_reverse_search: int = 3,  # Limit reverse searches to avoid rate limits
    ) -> ImageIntelligenceReport:
        """Execute the full image intelligence pipeline."""
        logger.info("Phase 3 pipeline: entity=%s, %d image URLs", entity_id, len(image_urls))

        # 3.1 Ingest & catalog
        catalog_entries = await self.catalog.ingest_many(image_urls, entity_id)
        logger.info("Cataloged %d images (%d URLs)", len(catalog_entries), len(image_urls))

        # 3.2 Face clustering
        clusters = self.clusterer.cluster_catalog(catalog_entries, entity_id)
        logger.info("Built %d face clusters", len(clusters))
        self._assign_cluster_ids(catalog_entries, clusters)

        # 3.3 Reverse image search (limit to unique, non-duplicate images with public URLs)
        reverse_results: list[ReverseSearchResult] = []
        if run_reverse_search:
            searchable = [e for e in catalog_entries if not e.is_duplicate and e.source_url][
                :max_reverse_search
            ]
            reverse_results = await self._gather_reverse_results(searchable)

        # 3.4 EXIF already extracted during catalog ingest

        # 3.5 Identity score
        identity_score = compute_identity_score(
            entity_id, catalog_entries, clusters, reverse_results
        )

        # 3.6 Fake ID signals
        fake_signals = self._aggregate_fake_signals(catalog_entries)
        identity_score.fake_id_signals = fake_signals

        # Persist updated catalog
        self.catalog.save_catalog(entity_id, catalog_entries)

        return ImageIntelligenceReport(
            entity_id=entity_id,
            catalog=catalog_entries,
            face_clusters=clusters,
            reverse_search_results=reverse_results,
            identity_score=identity_score,
            fake_id_signals=fake_signals,
        )

    def _assign_cluster_ids(
        self, catalog_entries: list[CatalogEntry], clusters: list[FaceCluster]
    ) -> None:
        for cluster in clusters:
            for img_id in cluster.image_ids:
                for entry in catalog_entries:
                    if entry.image_id == img_id:
                        entry.cluster_id = cluster.cluster_id

    async def _gather_reverse_results(
        self, searchable: list[CatalogEntry]
    ) -> list[ReverseSearchResult]:
        search_tasks = [
            self.reverse_searcher.search_all(e.source_url, self.reverse_engines)  # type: ignore[arg-type]
            for e in searchable
        ]
        gathered = await asyncio.gather(*search_tasks, return_exceptions=True)
        results: list[ReverseSearchResult] = []
        for r in gathered:
            if isinstance(r, list):
                results.extend(r)
        logger.info("Reverse search: %d results across %d images", len(results), len(searchable))
        return results

    def _aggregate_fake_signals(self, catalog_entries: list[CatalogEntry]) -> FakeIdSignals:
        all_ai_evidence: list[str] = []
        all_stock_evidence: list[str] = []
        all_anomalies: list[str] = []
        max_suspicion = 0.0
        stripped_count = 0
        missing_count = 0

        for entry in catalog_entries:
            if entry.is_duplicate:
                continue
            signals = detect_fake_id_signals(
                entry,
                has_exif_data=bool(entry.exif and entry.exif.raw),
                image_has_faces=entry.faces_detected > 0,
            )
            all_ai_evidence.extend(signals.ai_generation_evidence)
            all_stock_evidence.extend(signals.stock_photo_evidence)
            all_anomalies.extend(signals.metadata_anomalies)
            max_suspicion = max(max_suspicion, signals.overall_suspicion_score)
            if signals.stripped_exif:
                stripped_count += 1
            if signals.missing_exif:
                missing_count += 1

        return FakeIdSignals(
            is_likely_ai_generated=bool(all_ai_evidence),
            ai_generation_evidence=list(set(all_ai_evidence)),
            is_likely_stock_photo=bool(all_stock_evidence),
            stock_photo_evidence=list(set(all_stock_evidence)),
            metadata_anomalies=list(set(all_anomalies)),
            missing_exif=missing_count > 0,
            stripped_exif=stripped_count > 0,
            overall_suspicion_score=round(max_suspicion, 3),
        )

    async def analyze_single(
        self,
        raw_bytes: bytes,
        entity_id: str,
        source_url: str | None = None,
        run_reverse_search: bool = False,
    ) -> ImageIntelligenceReport:
        """Analyze a single image provided as raw bytes."""
        entry = await self.catalog.ingest_bytes(raw_bytes, entity_id, source_url)
        entries = self.catalog.load_catalog(entity_id)
        clusters = self.clusterer.cluster_catalog(entries, entity_id)

        reverse_results: list[ReverseSearchResult] = []
        if run_reverse_search and source_url:
            reverse_results = await self.reverse_searcher.search_all(
                source_url, self.reverse_engines
            )

        identity_score = compute_identity_score(entity_id, entries, clusters, reverse_results)
        signals = detect_fake_id_signals(
            entry,
            has_exif_data=bool(entry.exif and entry.exif.raw),
            image_has_faces=entry.faces_detected > 0,
        )
        identity_score.fake_id_signals = signals

        return ImageIntelligenceReport(
            entity_id=entity_id,
            catalog=entries,
            face_clusters=clusters,
            reverse_search_results=reverse_results,
            identity_score=identity_score,
            fake_id_signals=signals,
        )
