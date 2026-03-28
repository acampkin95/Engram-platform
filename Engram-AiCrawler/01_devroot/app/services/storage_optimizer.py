"""Storage Optimizer — Phase 6.1 + 6.2.

Responsibilities:
  6.1  Tiered storage manager
       - Metadata index for every artifact stored across hot/warm/cold/archive
       - OSINT-aware write helpers (scan result, entity data, image, case export)
       - Manual tier promotion/demotion
       - Orphan cleanup (artifacts not linked to any active case/scan)
       - Per-tier stats (size, file count, age distribution)

  6.2  OSINT-specific Redis caching layer
       - Wraps the existing CacheLayer with OSINT-domain key helpers
       - Scan result caching (keyed by entity hash)
       - Entity profile caching
       - Platform crawl result caching
       - Fraud-score caching
       - Cache-aside helper with automatic TTL selection
"""

from __future__ import annotations

import asyncio
import gzip
import hashlib
import json
import logging
import os
import shutil
from datetime import datetime, UTC

from enum import StrEnum

from pathlib import Path
from typing import Any
from collections.abc import Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tier definitions
# ---------------------------------------------------------------------------

class StorageTier(StrEnum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    ARCHIVE = "archive"

# Seconds before promotion to next tier
_TIER_AGE_SECONDS: dict[StorageTier, int] = {
    StorageTier.HOT: int(os.getenv("DATA_HOT_MAX_AGE_HOURS", "24")) * 3600,
    StorageTier.WARM: int(os.getenv("DATA_WARM_MAX_AGE_DAYS", "3")) * 86400,
    StorageTier.COLD: int(os.getenv("DATA_COLD_MAX_AGE_DAYS", "7")) * 86400,
    StorageTier.ARCHIVE: 0,  # Terminal tier
}

_TIER_PATHS: dict[StorageTier, Path] = {
    StorageTier.HOT: Path(os.getenv("DATA_HOT_PATH", "/app/data/tiers/hot")),
    StorageTier.WARM: Path(os.getenv("DATA_WARM_PATH", "/app/data/tiers/warm")),
    StorageTier.COLD: Path(os.getenv("DATA_COLD_PATH", "/app/data/tiers/cold")),
    StorageTier.ARCHIVE: Path(os.getenv("DATA_ARCHIVE_PATH", "/app/data/tiers/archive")),
}

_TIER_ORDER = [StorageTier.HOT, StorageTier.WARM, StorageTier.COLD, StorageTier.ARCHIVE]

# ---------------------------------------------------------------------------
# Artifact types
# ---------------------------------------------------------------------------

class ArtifactType(StrEnum):
    SCAN_RESULT = "scan_result"
    ENTITY_PROFILE = "entity_profile"
    IMAGE = "image"
    CASE_EXPORT = "case_export"
    CRAWL_RAW = "crawl_raw"
    FRAUD_GRAPH = "fraud_graph"
    DEEP_CRAWL = "deep_crawl"

# ---------------------------------------------------------------------------
# 6.1  StorageOptimizer
# ---------------------------------------------------------------------------

class StorageOptimizer:
    """OSINT-aware tiered storage manager.

    Wraps the raw tier directories with:
    - A per-artifact metadata index (JSON sidecar: {artifact_id}.meta.json)
    - Domain-specific write helpers
    - Tier migration with gzip compression on archive
    - Orphan detection and cleanup
    - Rich per-tier statistics
    """

    _INDEX_FILENAME = "_index.json"

    def __init__(self, tier_paths: dict[StorageTier, Path] | None = None) -> None:
        self.paths = tier_paths or _TIER_PATHS
        for p in self.paths.values():
            p.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Index helpers
    # ------------------------------------------------------------------

    def _index_path(self, tier: StorageTier) -> Path:
        return self.paths[tier] / self._INDEX_FILENAME

    def _load_index(self, tier: StorageTier) -> dict[str, dict[str, Any]]:
        p = self._index_path(tier)
        if not p.exists():
            return {}
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save_index(self, tier: StorageTier, index: dict[str, dict[str, Any]]) -> None:
        p = self._index_path(tier)
        p.write_text(json.dumps(index, indent=2, default=str), encoding="utf-8")

    def _register(
        self,
        tier: StorageTier,
        artifact_id: str,
        artifact_type: ArtifactType,
        filename: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        index = self._load_index(tier)
        index[artifact_id] = {
            "artifact_id": artifact_id,
            "artifact_type": artifact_type.value,
            "filename": filename,
            "tier": tier.value,
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
            **(metadata or {}),
        }
        self._save_index(tier, index)

    def _unregister(self, tier: StorageTier, artifact_id: str) -> None:
        index = self._load_index(tier)
        index.pop(artifact_id, None)
        self._save_index(tier, index)

    # ------------------------------------------------------------------
    # Write helpers
    # ------------------------------------------------------------------

    def _artifact_filename(
        self, artifact_id: str, artifact_type: ArtifactType, ext: str = "json"
    ) -> str:
        return f"{artifact_type.value}_{artifact_id}.{ext}"

    def write_json(
        self,
        artifact_id: str,
        artifact_type: ArtifactType,
        data: Any,
        tier: StorageTier = StorageTier.HOT,
        metadata: dict[str, Any] | None = None,
    ) -> Path:
        """Serialize *data* as JSON and store in *tier*. Returns the file path."""
        filename = self._artifact_filename(artifact_id, artifact_type, "json")
        path = self.paths[tier] / filename
        payload = json.dumps(data, indent=2, default=str)
        path.write_text(payload, encoding="utf-8")
        self._register(tier, artifact_id, artifact_type, filename, metadata)
        logger.debug("Stored %s/%s → %s", tier.value, artifact_id, path.name)
        return path

    def write_bytes(
        self,
        artifact_id: str,
        artifact_type: ArtifactType,
        data: bytes,
        ext: str = "bin",
        tier: StorageTier = StorageTier.HOT,
        metadata: dict[str, Any] | None = None,
    ) -> Path:
        """Store raw bytes in *tier*. Returns the file path."""
        filename = self._artifact_filename(artifact_id, artifact_type, ext)
        path = self.paths[tier] / filename
        path.write_bytes(data)
        self._register(tier, artifact_id, artifact_type, filename, metadata)
        return path

    # ------------------------------------------------------------------
    # Domain-specific write helpers
    # ------------------------------------------------------------------

    def store_scan_result(
        self,
        scan_id: str,
        result: dict[str, Any],
        entity_name: str | None = None,
    ) -> Path:
        return self.write_json(
            scan_id,
            ArtifactType.SCAN_RESULT,
            result,
            tier=StorageTier.HOT,
            metadata={"entity_name": entity_name, "scan_id": scan_id},
        )

    def store_entity_profile(
        self,
        entity_id: str,
        profile: dict[str, Any],
    ) -> Path:
        return self.write_json(
            entity_id,
            ArtifactType.ENTITY_PROFILE,
            profile,
            tier=StorageTier.HOT,
            metadata={"entity_id": entity_id},
        )

    def store_image(
        self,
        image_id: str,
        image_bytes: bytes,
        ext: str = "jpg",
        metadata: dict[str, Any] | None = None,
    ) -> Path:
        return self.write_bytes(
            image_id,
            ArtifactType.IMAGE,
            image_bytes,
            ext=ext,
            tier=StorageTier.HOT,
            metadata=metadata,
        )

    def store_case_export(
        self,
        case_id: str,
        export_data: bytes,
        fmt: str = "json",
    ) -> Path:
        return self.write_bytes(
            case_id,
            ArtifactType.CASE_EXPORT,
            export_data,
            ext=fmt,
            tier=StorageTier.WARM,
            metadata={"case_id": case_id, "format": fmt},
        )

    def store_fraud_graph(
        self,
        graph_id: str,
        graph_data: dict[str, Any],
    ) -> Path:
        return self.write_json(
            graph_id,
            ArtifactType.FRAUD_GRAPH,
            graph_data,
            tier=StorageTier.HOT,
            metadata={"graph_id": graph_id},
        )

    # ------------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------------

    def read_json(self, artifact_id: str) -> dict[str, Any] | None:
        """Find and deserialize a JSON artifact from any tier."""
        for tier in _TIER_ORDER:
            index = self._load_index(tier)
            if artifact_id in index:
                entry = index[artifact_id]
                path = self.paths[tier] / entry["filename"]
                if path.exists():
                    try:
                        return json.loads(path.read_text(encoding="utf-8"))
                    except Exception as exc:
                        logger.warning("Corrupt artifact %s: %s", artifact_id, exc)
                        return None
                # Archived (compressed)
                gz_path = path.with_suffix(path.suffix + ".gz")
                if gz_path.exists():
                    try:
                        with gzip.open(gz_path, "rt", encoding="utf-8") as fh:
                            return json.loads(fh.read())
                    except Exception as exc:
                        logger.warning("Corrupt gz artifact %s: %s", artifact_id, exc)
                        return None
        return None

    def locate(self, artifact_id: str) -> tuple[StorageTier, dict[str, Any]] | None:
        """Return (tier, index_entry) for an artifact, or None if not found."""
        for tier in _TIER_ORDER:
            index = self._load_index(tier)
            if artifact_id in index:
                return tier, index[artifact_id]
        return None

    # ------------------------------------------------------------------
    # Tier migration
    # ------------------------------------------------------------------

    def promote(self, artifact_id: str, target_tier: StorageTier) -> bool:
        """Manually move an artifact to *target_tier* (any direction)."""
        loc = self.locate(artifact_id)
        if loc is None:
            logger.warning("promote: artifact %s not found", artifact_id)
            return False
        current_tier, entry = loc
        if current_tier == target_tier:
            return True

        src_path = self.paths[current_tier] / entry["filename"]
        dst_filename = entry["filename"]
        dst_path = self.paths[target_tier] / dst_filename

        if not src_path.exists():
            logger.warning("promote: source file missing for %s", artifact_id)
            return False

        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src_path), str(dst_path))

        # Update indices
        self._unregister(current_tier, artifact_id)
        updated_entry = {
            **entry,
            "tier": target_tier.value,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        index = self._load_index(target_tier)
        index[artifact_id] = updated_entry
        self._save_index(target_tier, index)
        logger.info(
            "Moved artifact %s: %s → %s", artifact_id, current_tier.value, target_tier.value
        )
        return True

    def _find_aged_artifacts(
        self, src_tier: StorageTier, max_age: int, now: datetime
    ) -> list[str]:
        to_migrate = []
        index = self._load_index(src_tier)
        for artifact_id, entry in index.items():
            try:
                created = datetime.fromisoformat(entry["created_at"])
                if (now - created).total_seconds() > max_age:
                    to_migrate.append(artifact_id)
            except Exception:
                pass
        return to_migrate

    def _migrate_artifacts(
        self, to_migrate: list[str], dst_tier: StorageTier, label: str,
        counts: dict[str, int]
    ) -> None:
        for artifact_id in to_migrate:
            if self.promote(artifact_id, dst_tier):
                counts[label] += 1

    def _compress_archive_artifacts(self, archive_index: dict, counts: dict[str, int]) -> None:
        for artifact_id, entry in archive_index.items():
            path = self.paths[StorageTier.ARCHIVE] / entry["filename"]
            if path.exists() and not path.name.endswith(".gz"):
                gz_path = path.with_suffix(path.suffix + ".gz")
                try:
                    with open(path, "rb") as f_in, gzip.open(gz_path, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)
                    path.unlink()
                    entry["filename"] = gz_path.name
                    archive_index[artifact_id] = entry
                    counts["archived"] += 1
                except Exception as exc:
                    logger.warning("Failed to compress archive artifact %s: %s", artifact_id, exc)

    def run_lifecycle_cycle(self) -> dict[str, int]:
        """Migrate aged artifacts down the tier chain. Returns migration counts."""
        counts: dict[str, int] = {"hot→warm": 0, "warm→cold": 0, "cold→archive": 0, "archived": 0}
        now = datetime.now(UTC)

        transitions = [
            (StorageTier.HOT, StorageTier.WARM, "hot→warm"),
            (StorageTier.WARM, StorageTier.COLD, "warm→cold"),
            (StorageTier.COLD, StorageTier.ARCHIVE, "cold→archive"),
        ]

        for src_tier, dst_tier, label in transitions:
            max_age = _TIER_AGE_SECONDS[src_tier]
            if max_age <= 0:
                continue
            to_migrate = self._find_aged_artifacts(src_tier, max_age, now)
            self._migrate_artifacts(to_migrate, dst_tier, label, counts)

        archive_index = self._load_index(StorageTier.ARCHIVE)
        self._compress_archive_artifacts(archive_index, counts)
        self._save_index(StorageTier.ARCHIVE, archive_index)

        logger.info("Lifecycle cycle: %s", counts)
        return counts

    # ------------------------------------------------------------------
    # Orphan cleanup
    # ------------------------------------------------------------------

    def find_orphans(self, active_ids: set) -> list[str]:
        """Return artifact_ids not in *active_ids* across all tiers."""
        orphans = []
        for tier in _TIER_ORDER:
            index = self._load_index(tier)
            for artifact_id in index:
                if artifact_id not in active_ids:
                    orphans.append(artifact_id)
        return orphans

    def delete_artifact(self, artifact_id: str) -> bool:
        """Delete an artifact from whichever tier it's in."""
        loc = self.locate(artifact_id)
        if loc is None:
            return False
        tier, entry = loc
        path = self.paths[tier] / entry["filename"]
        gz_path = path.with_suffix(path.suffix + ".gz")
        for p in (path, gz_path):
            if p.exists():
                p.unlink()
        self._unregister(tier, artifact_id)
        return True

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def tier_stats(self) -> dict[str, Any]:
        """Return per-tier statistics: file count, total size, age distribution."""
        stats: dict[str, Any] = {}
        now = datetime.now(UTC)

        for tier in _TIER_ORDER:
            index = self._load_index(tier)
            tier_path = self.paths[tier]

            total_bytes = 0
            file_count = 0
            age_buckets = {"<1h": 0, "1h-24h": 0, "1d-7d": 0, ">7d": 0}
            type_counts: dict[str, int] = {}

            for artifact_id, entry in index.items():
                filename = entry.get("filename", "")
                path = tier_path / filename
                gz_path = (
                    path.with_suffix(path.suffix + ".gz") if not filename.endswith(".gz") else path
                )

                for p in (path, gz_path):
                    if p.exists():
                        try:
                            total_bytes += p.stat().st_size
                            file_count += 1
                        except OSError:
                            pass
                        break

                # Age bucket
                try:
                    created = datetime.fromisoformat(entry["created_at"])
                    age_secs = (now - created).total_seconds()
                    if age_secs < 3600:
                        age_buckets["<1h"] += 1
                    elif age_secs < 86400:
                        age_buckets["1h-24h"] += 1
                    elif age_secs < 604800:
                        age_buckets["1d-7d"] += 1
                    else:
                        age_buckets[">7d"] += 1
                except Exception:
                    pass

                # Type count
                atype = entry.get("artifact_type", "unknown")
                type_counts[atype] = type_counts.get(atype, 0) + 1

            stats[tier.value] = {
                "artifact_count": len(index),
                "file_count": file_count,
                "total_bytes": total_bytes,
                "total_mb": round(total_bytes / (1024**2), 2),
                "age_distribution": age_buckets,
                "type_distribution": type_counts,
                "path": str(tier_path),
                "max_age_seconds": _TIER_AGE_SECONDS.get(tier, 0),
            }

        # Overall totals
        stats["total"] = {
            "artifact_count": sum(
                s["artifact_count"] for s in stats.values() if isinstance(s, dict)
            ),
            "total_bytes": sum(
                s.get("total_bytes", 0) for s in stats.values() if isinstance(s, dict)
            ),
            "total_mb": round(
                sum(s.get("total_mb", 0) for s in stats.values() if isinstance(s, dict)), 2
            ),
        }
        return stats

    def list_artifacts(
        self,
        tier: StorageTier | None = None,
        artifact_type: ArtifactType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List artifacts with optional filters."""
        results = []
        tiers_to_check = [tier] if tier else _TIER_ORDER
        for t in tiers_to_check:
            index = self._load_index(t)
            for entry in index.values():
                if artifact_type and entry.get("artifact_type") != artifact_type.value:
                    continue
                results.append(entry)

        results.sort(key=lambda e: e.get("created_at", ""), reverse=True)
        return results[offset : offset + limit]

# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_optimizer_instance: StorageOptimizer | None = None

def get_storage_optimizer() -> StorageOptimizer:
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = StorageOptimizer()
    return _optimizer_instance

# ---------------------------------------------------------------------------
# 6.2  OSINT Redis Cache Layer
# ---------------------------------------------------------------------------

class OsintCacheKeys:
    """Canonical Redis key builders for OSINT pipeline caching."""

    PREFIX = "osint:"

    @staticmethod
    def _hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()[:24]

    @classmethod
    def scan_result(cls, entity_fingerprint: str) -> str:
        """Key for a full OSINT scan result keyed by entity fingerprint."""
        return f"{cls.PREFIX}scan:{cls._hash(entity_fingerprint)}"

    @classmethod
    def entity_profile(cls, entity_id: str) -> str:
        return f"{cls.PREFIX}entity:{entity_id}"

    @classmethod
    def platform_crawl(cls, platform: str, query: str) -> str:
        return f"{cls.PREFIX}platform:{platform}:{cls._hash(query)}"

    @classmethod
    def fraud_score(cls, entity_id: str) -> str:
        return f"{cls.PREFIX}fraud_score:{entity_id}"

    @classmethod
    def image_hash(cls, image_id: str) -> str:
        return f"{cls.PREFIX}image_hash:{image_id}"

    @classmethod
    def alias_set(cls, username: str) -> str:
        return f"{cls.PREFIX}aliases:{cls._hash(username)}"

    @classmethod
    def dedup_check(cls, fingerprint: str) -> str:
        return f"{cls.PREFIX}dedup:{cls._hash(fingerprint)}"

# TTL constants (seconds)
class OsintCacheTTL:
    SCAN_RESULT = 3600 * 6  # 6 hours — scans are expensive
    ENTITY_PROFILE = 3600 * 12  # 12 hours
    PLATFORM_CRAWL = 3600 * 2  # 2 hours — platform data changes
    FRAUD_SCORE = 3600 * 4  # 4 hours
    IMAGE_HASH = 3600 * 24  # 24 hours — hashes are stable
    ALIAS_SET = 3600 * 6  # 6 hours
    DEDUP_CHECK = 3600 * 1  # 1 hour

class OsintCache:
    """OSINT-domain cache layer on top of Redis.

    Uses the existing cache infrastructure (app.services.cache) but
    provides OSINT-specific key helpers and TTL policies.

    Fail-open: all methods silently return None/False on Redis errors
    so OSINT pipelines continue without cache.
    """

    def __init__(self) -> None:
        self._client = None  # Lazy-initialised

    async def _get_client(self):
        if self._client is None:
            try:
                from app.services.cache import get_cache_client

                self._client = await get_cache_client()
            except Exception as exc:
                logger.warning("OsintCache: Redis unavailable (%s) — running without cache", exc)
                self._client = _NullRedis()
        return self._client

    # -- Generic helpers ---------------------------------------------------

    async def get(self, key: str) -> Any | None:
        try:
            client = await self._get_client()
            raw = await client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.debug("OsintCache.get error: %s", exc)
            return None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        try:
            client = await self._get_client()
            await client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception as exc:
            logger.debug("OsintCache.set error: %s", exc)
            return False

    async def delete(self, key: str) -> bool:
        try:
            client = await self._get_client()
            await client.delete(key)
            return True
        except Exception as exc:
            logger.debug("OsintCache.delete error: %s", exc)
            return False

    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable,
        ttl: int = 3600,
    ) -> Any:
        """Cache-aside: return cached value or compute+cache it."""
        cached = await self.get(key)
        if cached is not None:
            logger.debug("OsintCache HIT: %s", key)
            return cached
        logger.debug("OsintCache MISS: %s", key)
        result = await compute_fn() if asyncio.iscoroutinefunction(compute_fn) else compute_fn()
        if result is not None:
            await self.set(key, result, ttl)
        return result

    # -- Domain-specific helpers -------------------------------------------

    async def get_scan_result(self, entity_fingerprint: str) -> dict[str, Any] | None:
        return await self.get(OsintCacheKeys.scan_result(entity_fingerprint))

    async def set_scan_result(self, entity_fingerprint: str, result: dict[str, Any]) -> bool:
        return await self.set(
            OsintCacheKeys.scan_result(entity_fingerprint), result, OsintCacheTTL.SCAN_RESULT
        )

    async def get_entity_profile(self, entity_id: str) -> dict[str, Any] | None:
        return await self.get(OsintCacheKeys.entity_profile(entity_id))

    async def set_entity_profile(self, entity_id: str, profile: dict[str, Any]) -> bool:
        return await self.set(
            OsintCacheKeys.entity_profile(entity_id), profile, OsintCacheTTL.ENTITY_PROFILE
        )

    async def get_platform_crawl(self, platform: str, query: str) -> dict[str, Any] | None:
        return await self.get(OsintCacheKeys.platform_crawl(platform, query))

    async def set_platform_crawl(self, platform: str, query: str, result: dict[str, Any]) -> bool:
        return await self.set(
            OsintCacheKeys.platform_crawl(platform, query), result, OsintCacheTTL.PLATFORM_CRAWL
        )

    async def get_fraud_score(self, entity_id: str) -> dict[str, Any] | None:
        return await self.get(OsintCacheKeys.fraud_score(entity_id))

    async def set_fraud_score(self, entity_id: str, score_data: dict[str, Any]) -> bool:
        return await self.set(
            OsintCacheKeys.fraud_score(entity_id), score_data, OsintCacheTTL.FRAUD_SCORE
        )

    async def get_alias_set(self, username: str) -> list[str] | None:
        return await self.get(OsintCacheKeys.alias_set(username))

    async def set_alias_set(self, username: str, aliases: list[str]) -> bool:
        return await self.set(OsintCacheKeys.alias_set(username), aliases, OsintCacheTTL.ALIAS_SET)

    async def invalidate_entity(self, entity_id: str) -> None:
        """Invalidate all cached data for an entity (after re-scan)."""
        keys = [
            OsintCacheKeys.entity_profile(entity_id),
            OsintCacheKeys.fraud_score(entity_id),
        ]
        for key in keys:
            await self.delete(key)

    async def cache_stats(self) -> dict[str, Any]:
        """Return cache stats (key count per namespace, memory usage if available)."""
        try:
            client = await self._get_client()
            info = await client.info("memory")
            osint_keys = await client.keys(f"{OsintCacheKeys.PREFIX}*")
            by_type: dict[str, int] = {}
            for k in osint_keys:
                parts = k.split(":") if isinstance(k, str) else k.decode().split(":")
                ns = parts[1] if len(parts) > 1 else "unknown"
                by_type[ns] = by_type.get(ns, 0) + 1
            return {
                "total_osint_keys": len(osint_keys),
                "by_namespace": by_type,
                "used_memory_human": info.get("used_memory_human", "N/A"),
                "maxmemory_human": info.get("maxmemory_human", "N/A"),
            }
        except Exception as exc:
            return {"error": str(exc)}

class _NullRedis:
    """No-op Redis stub for when Redis is unavailable."""

    async def get(self, *a, **kw):
        return None

    async def setex(self, *a, **kw):
        pass

    async def delete(self, *a, **kw):
        pass

    async def keys(self, *a, **kw):
        return []

    async def info(self, *a, **kw):
        return {}

# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_osint_cache_instance: OsintCache | None = None

def get_osint_cache() -> OsintCache:
    global _osint_cache_instance
    if _osint_cache_instance is None:
        _osint_cache_instance = OsintCache()
    return _osint_cache_instance
