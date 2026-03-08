"""Tests for Redis Streams event bus."""

import pytest
import json
from unittest.mock import AsyncMock, patch

from app.services.event_bus import (
    EventBus,
    EventType,
    STREAM_MAPPING,
    DEFAULT_STREAM,
    STREAM_MAXLEN,
    get_event_bus,
    close_event_bus,
)


class TestEventType:
    """Tests for EventType enum."""

    def test_event_type_values(self):
        """EventType has expected values."""
        assert EventType.CRAWL_STARTED == "crawl.started"
        assert EventType.CRAWL_COMPLETED == "crawl.completed"
        assert EventType.CRAWL_FAILED == "crawl.failed"
        assert EventType.ENTITY_EXTRACTED == "entity.extracted"
        assert EventType.SCAN_PROGRESS == "scan.progress"
        assert EventType.GRAPH_UPDATED == "graph.updated"

    def test_event_type_is_string(self):
        """EventType values are strings."""
        assert isinstance(EventType.CRAWL_STARTED.value, str)


class TestStreamMapping:
    """Tests for stream mapping configuration."""

    def test_crawl_events_mapping(self):
        """Crawl events map to crawl_events stream."""
        assert STREAM_MAPPING[EventType.CRAWL_STARTED] == "crawl_events"
        assert STREAM_MAPPING[EventType.CRAWL_COMPLETED] == "crawl_events"
        assert STREAM_MAPPING[EventType.CRAWL_FAILED] == "crawl_events"

    def test_entity_events_mapping(self):
        """Entity events map to entity_events stream."""
        assert STREAM_MAPPING[EventType.ENTITY_EXTRACTED] == "entity_events"

    def test_default_stream_defined(self):
        """Default stream is defined."""
        assert DEFAULT_STREAM == "default_events"

    def test_maxlen_defined(self):
        """Stream max length is defined."""
        assert STREAM_MAXLEN == 10_000


class TestEventBus:
    """Tests for EventBus class."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis = AsyncMock()
        redis.close = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234567890-0")
        redis.xlen = AsyncMock(return_value=0)
        redis.ping = AsyncMock(return_value=True)
        return redis

    @pytest.fixture
    def event_bus(self, mock_redis):
        """Create EventBus with mocked Redis."""
        bus = EventBus(redis_url="redis://localhost:6379/0")
        bus._redis = mock_redis
        return bus

    @pytest.mark.asyncio
    async def test_connect_creates_redis_client(self):
        """Connect creates Redis client."""
        bus = EventBus(redis_url="redis://localhost:6379/0")

        with patch("app.services.event_bus.aioredis.from_url") as mock_from_url:
            mock_redis = AsyncMock()
            mock_from_url.return_value = mock_redis

            await bus.connect()

            mock_from_url.assert_called_once()
            assert bus._redis is mock_redis

    @pytest.mark.asyncio
    async def test_close_closes_redis_connection(self, event_bus, mock_redis):
        """Close closes Redis connection."""
        await event_bus.close()

        mock_redis.close.assert_called_once()
        assert event_bus._redis is None

    @pytest.mark.asyncio
    async def test_publish_sends_to_correct_stream(self, event_bus, mock_redis):
        """Publish sends event to mapped stream."""
        result = await event_bus.publish(
            EventType.CRAWL_COMPLETED,
            {"url": "https://example.com"},
        )

        assert result == "1234567890-0"
        mock_redis.xadd.assert_called_once()

        call_args = mock_redis.xadd.call_args
        assert call_args[0][0] == "crawl_events"

    @pytest.mark.asyncio
    async def test_publish_includes_event_type(self, event_bus, mock_redis):
        """Publish includes event type in message."""
        await event_bus.publish(EventType.CRAWL_STARTED, {"url": "test"})

        call_args = mock_redis.xadd.call_args
        message = call_args[0][1]

        assert message["type"] == "crawl.started"

    @pytest.mark.asyncio
    async def test_publish_serializes_payload(self, event_bus, mock_redis):
        """Publish serializes payload to JSON."""
        payload = {"url": "https://example.com", "count": 42}
        await event_bus.publish(EventType.CRAWL_COMPLETED, payload)

        call_args = mock_redis.xadd.call_args
        message = call_args[0][1]

        assert json.loads(message["payload"]) == payload

    @pytest.mark.asyncio
    async def test_publish_includes_timestamp(self, event_bus, mock_redis):
        """Publish includes ISO timestamp."""
        await event_bus.publish(EventType.CRAWL_STARTED, {"url": "test"})

        call_args = mock_redis.xadd.call_args
        message = call_args[0][1]

        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_publish_custom_stream(self, event_bus, mock_redis):
        """Publish to custom stream overrides mapping."""
        await event_bus.publish(
            EventType.CRAWL_COMPLETED,
            {"url": "test"},
            stream="custom_stream",
        )

        call_args = mock_redis.xadd.call_args
        assert call_args[0][0] == "custom_stream"

    @pytest.mark.asyncio
    async def test_publish_returns_none_on_error(self, event_bus, mock_redis):
        """Publish returns None on Redis error."""
        mock_redis.xadd.side_effect = Exception("Redis error")

        result = await event_bus.publish(EventType.CRAWL_COMPLETED, {"url": "test"})

        assert result is None

    @pytest.mark.asyncio
    async def test_stream_length_returns_count(self, event_bus, mock_redis):
        """stream_length returns stream entry count."""
        mock_redis.xlen.return_value = 42

        result = await event_bus.stream_length("crawl_events")

        mock_redis.xlen.assert_called_once_with("crawl_events")
        assert result == 42

    @pytest.mark.asyncio
    async def test_stream_length_returns_zero_on_error(self, event_bus, mock_redis):
        """stream_length returns 0 on error."""
        mock_redis.xlen.side_effect = Exception("Redis error")

        result = await event_bus.stream_length("crawl_events")

        assert result == 0


class TestEventBusSingleton:
    """Tests for global EventBus singleton."""

    def test_get_event_bus_returns_singleton(self):
        """get_event_bus returns the same instance."""
        import app.services.event_bus as module

        module._event_bus = None

        bus1 = get_event_bus()
        bus2 = get_event_bus()

        assert bus1 is bus2

    @pytest.mark.asyncio
    async def test_close_event_bus_closes_connection(self):
        """close_event_bus closes global bus connection."""
        import app.services.event_bus as module

        bus = get_event_bus()
        mock_redis = AsyncMock()
        mock_redis.close = AsyncMock()
        bus._redis = mock_redis

        await close_event_bus()

        mock_redis.close.assert_called_once()
        assert module._event_bus is None
