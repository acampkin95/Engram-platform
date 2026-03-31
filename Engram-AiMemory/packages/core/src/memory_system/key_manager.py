"""
API Key Management with Redis-backed storage.

Keys are SHA-256 hashed before storage (like GitHub PATs).
Supports CRUD operations, migration from env vars, and usage tracking.
"""

import hashlib
import hmac
import json
import secrets
import string
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis

from memory_system.config import get_settings

# Key prefix for Redis storage
KEY_PREFIX = "engram:api_keys:"
KEY_INDEX = "engram:api_keys:index"

# Key ID prefix
KEY_ID_PREFIX = "ek_"


def _generate_key() -> str:
    """Generate a cryptographically secure API key."""
    alphabet = string.ascii_letters + string.digits + "-_"
    return "".join(secrets.choice(alphabet) for _ in range(48))


def _hash_key(key: str) -> str:
    """SHA-256 hash an API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def _generate_id() -> str:
    """Generate a short unique key ID."""
    return KEY_ID_PREFIX + secrets.token_hex(8)


class KeyManager:
    """Redis-backed API key manager."""

    def __init__(self, redis_client: redis.Redis):
        self._redis = redis_client
        self._migrated = False

    async def migrate_env_keys(self) -> int:
        """Migrate static API_KEYS from env vars to Redis (idempotent)."""
        if self._migrated:
            return 0

        settings = get_settings()
        env_keys = settings.api_keys if isinstance(settings.api_keys, list) else []
        if not env_keys:
            self._migrated = True
            return 0

        migrated = 0
        for i, key in enumerate(env_keys):
            key_hash = _hash_key(key)
            # Check if already migrated
            existing = await self._find_by_hash(key_hash)
            if existing:
                continue

            key_id = _generate_id()
            prefix = key[:8] + "..." + key[-4:]
            metadata = {
                "id": key_id,
                "name": f"Environment Key {i + 1}",
                "key_hash": key_hash,
                "prefix": prefix,
                "created_at": datetime.now(UTC).isoformat(),
                "created_by": "system (env migration)",
                "last_used_at": "",
                "status": "active",
                "request_count": "0",
                "source": "env",
            }
            await self._redis.hset(f"{KEY_PREFIX}{key_id}", mapping=metadata)
            await self._redis.sadd(KEY_INDEX, key_id)
            migrated += 1

        self._migrated = True
        return migrated

    async def create_key(self, name: str, created_by: str = "admin") -> dict[str, Any]:
        """Create a new API key. Returns metadata including the full key (shown once)."""
        raw_key = _generate_key()
        key_id = _generate_id()
        key_hash = _hash_key(raw_key)
        prefix = raw_key[:8] + "..." + raw_key[-4:]
        now = datetime.now(UTC).isoformat()

        metadata = {
            "id": key_id,
            "name": name,
            "key_hash": key_hash,
            "prefix": prefix,
            "created_at": now,
            "created_by": created_by,
            "last_used_at": "",
            "status": "active",
            "request_count": "0",
            "source": "api",
        }
        await self._redis.hset(f"{KEY_PREFIX}{key_id}", mapping=metadata)
        await self._redis.sadd(KEY_INDEX, key_id)

        return {
            "id": key_id,
            "name": name,
            "key": raw_key,  # Only returned on creation
            "prefix": prefix,
            "created_at": now,
        }

    async def list_keys(self) -> list[dict[str, Any]]:
        """List all API keys with metadata (keys are masked)."""
        key_ids = await self._redis.smembers(KEY_INDEX)
        keys = []
        for key_id in sorted(key_ids):
            kid = key_id if isinstance(key_id, str) else key_id.decode()
            data = await self._redis.hgetall(f"{KEY_PREFIX}{kid}")
            if not data:
                continue
            entry = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in data.items()}
            entry.pop("key_hash", None)  # Never expose hash
            entry["request_count"] = int(entry.get("request_count", "0"))
            keys.append(entry)
        return keys

    async def update_key(self, key_id: str, name: str | None = None, status: str | None = None) -> dict[str, Any] | None:
        """Update key metadata (name or status)."""
        redis_key = f"{KEY_PREFIX}{key_id}"
        if not await self._redis.exists(redis_key):
            return None

        updates: dict[str, str] = {}
        if name is not None:
            updates["name"] = name
        if status is not None and status in ("active", "revoked"):
            updates["status"] = status

        if updates:
            await self._redis.hset(redis_key, mapping=updates)

        data = await self._redis.hgetall(redis_key)
        entry = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in data.items()}
        entry.pop("key_hash", None)
        entry["request_count"] = int(entry.get("request_count", "0"))
        return entry

    async def revoke_key(self, key_id: str) -> bool:
        """Soft-delete a key by setting status to revoked."""
        redis_key = f"{KEY_PREFIX}{key_id}"
        if not await self._redis.exists(redis_key):
            return False
        await self._redis.hset(redis_key, "status", "revoked")
        return True

    async def validate_key(self, raw_key: str) -> dict[str, Any] | None:
        """Validate an API key against Redis store. Returns key metadata if valid."""
        key_hash = _hash_key(raw_key)
        return await self._find_by_hash(key_hash)

    async def record_usage(self, key_id: str) -> None:
        """Update last_used_at and increment request_count."""
        redis_key = f"{KEY_PREFIX}{key_id}"
        pipe = self._redis.pipeline()
        pipe.hset(redis_key, "last_used_at", datetime.now(UTC).isoformat())
        pipe.hincrby(redis_key, "request_count", 1)
        await pipe.execute()

    async def _find_by_hash(self, key_hash: str) -> dict[str, Any] | None:
        """Find a key by its hash. Returns metadata if found and active."""
        key_ids = await self._redis.smembers(KEY_INDEX)
        for key_id in key_ids:
            kid = key_id if isinstance(key_id, str) else key_id.decode()
            stored_hash = await self._redis.hget(f"{KEY_PREFIX}{kid}", "key_hash")
            if stored_hash is None:
                continue
            sh = stored_hash if isinstance(stored_hash, str) else stored_hash.decode()
            if hmac.compare_digest(sh, key_hash):
                status = await self._redis.hget(f"{KEY_PREFIX}{kid}", "status")
                st = status.decode() if isinstance(status, bytes) else status
                if st == "revoked":
                    return None
                data = await self._redis.hgetall(f"{KEY_PREFIX}{kid}")
                return {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in data.items()}
        return None
