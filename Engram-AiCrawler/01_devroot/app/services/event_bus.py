"""Redis Streams event bus for inter-service communication.

Provides decoupled publish/subscribe messaging between pipeline components
using Redis Streams with consumer groups for parallel processing.

Architecture Decision: ADR-001 Section 5 — Redis Streams
"""

from __future__ import annotations
import json
import logging
import os
from datetime import datetime, UTC
from enum import Enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


from typing import Any, Union
from collections.abc import AsyncIterator

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class EventType(StrEnum):
    """Typed event taxonomy for the OSINT pipeline."""

    CRAWL_STARTED = "crawl.started"
    CRAWL_COMPLETED = "crawl.completed"
    CRAWL_FAILED = "crawl.failed"
    ENTITY_EXTRACTED = "entity.extracted"
    SCAN_PROGRESS = "scan.progress"
    GRAPH_UPDATED = "graph.updated"


# Map event types to their Redis stream names
STREAM_MAPPING: dict[str, str] = {
    EventType.CRAWL_STARTED: "crawl_events",
    EventType.CRAWL_COMPLETED: "crawl_events",
    EventType.CRAWL_FAILED: "crawl_events",
    EventType.ENTITY_EXTRACTED: "entity_events",
    EventType.SCAN_PROGRESS: "scan_events",
    EventType.GRAPH_UPDATED: "graph_events",
}

# Default stream for unmapped event types
DEFAULT_STREAM = "default_events"

# Maximum entries per stream (prevents unbounded growth)
STREAM_MAXLEN = 10_000


class EventBus:
    """Redis Streams-based event bus for inter-service communication.

    Uses consumer groups to enable parallel processing of events across
    multiple worker instances while ensuring at-least-once delivery.

    Usage:
        bus = EventBus()
        await bus.connect()

        # Publishing
        await bus.publish(EventType.CRAWL_COMPLETED, {
            "url": "https://example.com",
            "scan_id": "scan_123",
        })

        # Subscribing (consumer loop)
        async for msg_id, event_type, payload in bus.subscribe(
            stream="crawl_events",
            group="pipeline_processors",
            consumer="worker_1",
        ):
            await process(event_type, payload)
    """

    def __init__(self, redis_url: str | None = None):
        self._redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379/0")
        self._redis: aioredis.Redis | None = None

    async def connect(self) -> None:
        """Establish Redis connection for the event bus."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
            )
            logger.info("EventBus connected to Redis")

    async def close(self) -> None:
        """Close the Redis connection."""
        if self._redis is not None:
            await self._redis.close()
            self._redis = None
            logger.info("EventBus connection closed")

    async def _get_redis(self) -> aioredis.Redis:
        """Get Redis client, auto-connecting if needed."""
        if self._redis is None:
            await self.connect()
        assert self._redis is not None
        return self._redis

    async def publish(
        self,
        event_type: Union[str, EventType],
        payload: dict[str, Any],
        stream: str | None = None,
        maxlen: int = STREAM_MAXLEN,
    ) -> str | None:
        """Publish an event to the appropriate Redis stream.

        Args:
            event_type: Event type string or EventType enum value.
            payload: Event payload dictionary (must be JSON-serializable).
            stream: Override stream name (uses STREAM_MAPPING by default).
            maxlen: Maximum stream length (approximate trimming).

        Returns:
            Message ID if published successfully, None on failure.
        """
        event_str = event_type.value if isinstance(event_type, EventType) else event_type
        target_stream = stream or STREAM_MAPPING.get(event_str, DEFAULT_STREAM)

        message = {
            "type": event_str,
            "payload": json.dumps(payload, default=str),
            "timestamp": datetime.now(UTC).isoformat(),
        }

        try:
            client = await self._get_redis()
            msg_id = await client.xadd(
                target_stream,
                message,
                maxlen=maxlen,
                approximate=True,
            )
            logger.debug(f"EventBus published {event_str} to {target_stream} (id={msg_id})")
            return msg_id
        except Exception as e:
            logger.error(f"EventBus publish failed for {event_str}: {e}")
            return None

    async def subscribe(
        self,
        stream: str,
        group: str,
        consumer: str,
        count: int = 10,
        block_ms: int = 5000,
    ) -> AsyncIterator[tuple[str, str, dict[str, Any]]]:
        """Subscribe to a stream via consumer group.

        Creates the consumer group if it doesn't exist.
        Yields (message_id, event_type, payload) tuples.

        Args:
            stream: Redis stream name to consume from.
            group: Consumer group name.
            consumer: Consumer name within the group.
            count: Max messages to read per iteration.
            block_ms: Block timeout in milliseconds (0 = forever).

        Yields:
            Tuple of (message_id, event_type, parsed_payload).
        """
        # Create consumer group (idempotent)
        while True:
            try:
                client = await self._get_redis()
                try:
                    await client.xgroup_create(stream, group, id="0", mkstream=True)
                    logger.info(f"Created consumer group '{group}' on stream '{stream}'")
                except aioredis.ResponseError as e:
                    if "BUSYGROUP" not in str(e):
                        raise

                messages = await client.xreadgroup(
                    groupname=group,
                    consumername=consumer,
                    streams={stream: ">"},
                    count=count,
                    block=block_ms,
                )

                if not messages:
                    continue

                for stream_name, entries in messages:
                    for msg_id, data in entries:
                        event_type = data.get("type", "unknown")
                        try:
                            payload = json.loads(data.get("payload", "{}"))
                        except (json.JSONDecodeError, TypeError):
                            payload = {}
                            logger.warning(f"Failed to parse payload for message {msg_id}")

                        yield msg_id, event_type, payload

                        # Acknowledge after successful yield
                        await client.xack(stream_name, group, msg_id)

            except (aioredis.ConnectionError, ConnectionError) as e:
                logger.error(f"EventBus connection lost: {e}, reconnecting...")
                self._redis = None
                await self.connect()
            except Exception as e:
                logger.error(f"EventBus subscribe error: {e}")
                raise

    async def stream_length(self, stream: str) -> int:
        """Get the current length of a stream."""
        try:
            client = await self._get_redis()
            return await client.xlen(stream)
        except Exception:
            return 0

    async def trim_stream(self, stream: str, maxlen: int = STREAM_MAXLEN) -> int:
        """Manually trim a stream to maxlen entries.

        Returns:
            Number of entries removed.
        """
        try:
            client = await self._get_redis()
            before = await client.xlen(stream)
            await client.xtrim(stream, maxlen=maxlen, approximate=True)
            after = await client.xlen(stream)
            removed = before - after
            if removed > 0:
                logger.info(f"Trimmed {removed} entries from stream '{stream}'")
            return removed
        except Exception as e:
            logger.error(f"Failed to trim stream '{stream}': {e}")
            return 0


# Global singleton
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Get the global EventBus singleton."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


async def close_event_bus() -> None:
    """Close the global EventBus connection."""
    global _event_bus
    if _event_bus is not None:
        await _event_bus.close()
        _event_bus = None
