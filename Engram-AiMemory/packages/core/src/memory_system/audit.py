"""
Audit logging via Redis Streams.

Logs API requests with key identity, method, path, status, and latency.
Supports paginated queries with filtering by key_id, path, and time range.
"""

import json
import time
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis

AUDIT_STREAM = "engram:audit_log"
MAX_ENTRIES = 10000


class AuditLogger:
    """Redis Stream-backed audit logger."""

    def __init__(self, redis_client: redis.Redis):
        self._redis = redis_client

    async def log(
        self,
        *,
        key_id: str = "",
        key_name: str = "",
        method: str = "",
        path: str = "",
        status_code: int = 0,
        ip: str = "",
        latency_ms: float = 0,
        tenant_id: str = "default",
        identity: str = "",
    ) -> str | None:
        """Log an API request to the audit stream. Returns the stream entry ID."""
        entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "key_id": key_id,
            "key_name": key_name,
            "identity": identity,
            "method": method,
            "path": path,
            "status_code": str(status_code),
            "ip": ip,
            "latency_ms": f"{latency_ms:.1f}",
            "tenant_id": tenant_id,
        }
        result = await self._redis.xadd(
            AUDIT_STREAM,
            entry,
            maxlen=MAX_ENTRIES,
            approximate=True,
        )
        return result.decode() if isinstance(result, bytes) else result

    async def query(
        self,
        *,
        key_id: str | None = None,
        path: str | None = None,
        method: str | None = None,
        min_status: int | None = None,
        limit: int = 50,
        offset: int = 0,
        start: str = "-",
        end: str = "+",
    ) -> dict[str, Any]:
        """Query audit log with optional filters. Returns paginated results."""
        # Read more than needed to account for filtering
        fetch_count = (limit + offset) * 3 if (key_id or path or method or min_status) else limit + offset
        fetch_count = min(fetch_count, MAX_ENTRIES)

        raw = await self._redis.xrevrange(AUDIT_STREAM, max=end, min=start, count=fetch_count)

        entries = []
        for entry_id, fields in raw:
            eid = entry_id.decode() if isinstance(entry_id, bytes) else entry_id
            record = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in fields.items()}
            record["id"] = eid

            # Apply filters
            if key_id and record.get("key_id") != key_id:
                continue
            if path and path not in record.get("path", ""):
                continue
            if method and record.get("method") != method.upper():
                continue
            if min_status and int(record.get("status_code", "0")) < min_status:
                continue

            entries.append(record)

        total = len(entries)
        paginated = entries[offset : offset + limit]

        return {
            "entries": paginated,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total,
        }

    async def summary(self, hours: int = 24) -> dict[str, Any]:
        """Get summary stats for the last N hours."""
        # Use stream length for total
        stream_len = await self._redis.xlen(AUDIT_STREAM)

        # Read recent entries for stats
        raw = await self._redis.xrevrange(AUDIT_STREAM, count=min(stream_len, 1000))

        cutoff = datetime.now(UTC).timestamp() - (hours * 3600)
        total = 0
        errors = 0
        endpoints: dict[str, int] = {}
        keys_used: dict[str, int] = {}

        for _, fields in raw:
            record = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in fields.items()}
            ts = record.get("timestamp", "")
            try:
                entry_ts = datetime.fromisoformat(ts).timestamp()
            except (ValueError, TypeError):
                continue

            if entry_ts < cutoff:
                break

            total += 1
            status = int(record.get("status_code", "0"))
            if status >= 400:
                errors += 1

            ep = record.get("path", "unknown")
            endpoints[ep] = endpoints.get(ep, 0) + 1

            kn = record.get("key_name") or record.get("key_id") or "unknown"
            keys_used[kn] = keys_used.get(kn, 0) + 1

        top_endpoints = sorted(endpoints.items(), key=lambda x: x[1], reverse=True)[:10]
        top_keys = sorted(keys_used.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "period_hours": hours,
            "total_requests": total,
            "error_count": errors,
            "error_rate": round(errors / total * 100, 1) if total else 0,
            "top_endpoints": [{"path": p, "count": c} for p, c in top_endpoints],
            "top_keys": [{"key": k, "count": c} for k, c in top_keys],
            "stream_size": stream_len,
        }
