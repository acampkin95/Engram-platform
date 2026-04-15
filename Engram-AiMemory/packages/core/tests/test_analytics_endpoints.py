# packages/core/tests/test_analytics_endpoints.py
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock


# Override auth for all tests — require_auth → always returns "test-user"
async def _override_auth():
    return "test-user"


@pytest.fixture
def mock_memory_system():
    """Mock MemorySystem with analytics methods."""
    system = MagicMock()
    system.get_stats = AsyncMock(
        return_value=MagicMock(
            total_memories=50,
            tier1_count=20,
            tier2_count=20,
            tier3_count=10,
            model_dump=lambda: {
                "total_memories": 50,
                "tier1_count": 20,
                "tier2_count": 20,
                "tier3_count": 10,
                "by_type": {"fact": 30, "procedure": 20},
                "oldest_memory": None,
                "newest_memory": None,
                "avg_importance": 0.6,
            },
        )
    )
    return system


@pytest.mark.asyncio
async def test_memory_growth_endpoint(mock_memory_system):
    from memory_system.api import app
    from memory_system.auth import require_auth
    from memory_system.routers import _state

    _state.memory_system = mock_memory_system
    app.dependency_overrides[require_auth] = _override_auth

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/analytics/memory-growth",
                params={"period": "daily"},
            )
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_activity_timeline_endpoint(mock_memory_system):
    from memory_system.api import app
    from memory_system.auth import require_auth
    from memory_system.routers import _state

    _state.memory_system = mock_memory_system
    app.dependency_overrides[require_auth] = _override_auth

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/analytics/activity-timeline",
                params={"year": 2025},
            )
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_system_metrics_endpoint():
    from memory_system.api import app
    from memory_system.auth import require_auth

    app.dependency_overrides[require_auth] = _override_auth

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/analytics/system-metrics")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.clear()
