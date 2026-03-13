"""
Shared pytest fixtures for AI Memory System integration tests.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from memory_system.api import app
from memory_system.auth import require_auth
from memory_system.memory import (
    Memory,
    MemorySearchResult,
    MemorySource,
    MemoryStats,
    MemoryTier,
    MemoryType,
)

timezone = timezone


# ---------------------------------------------------------------------------
# Auth override helper
# ---------------------------------------------------------------------------


async def _override_auth() -> str:
    """Bypass JWT validation — always returns a test identity."""
    return "test-user"


# ---------------------------------------------------------------------------
# Settings fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def test_settings():
    """Return a minimal Settings-like namespace for tests."""
    settings = MagicMock()
    settings.admin_username = "admin"
    settings.admin_password_hash = (
        "$2b$12$KIX/2Kx7UkX4YBqZ5VkPOOQ.Hq0VfAIYbH2dUBhJZ1kqhGm5YXWS"  # "password"
    )
    settings.jwt_secret = "test-secret-key-for-testing-only"
    settings.jwt_expire_hours = 24
    settings.multi_tenancy_enabled = True
    settings.default_tenant_id = "default"
    return settings


# ---------------------------------------------------------------------------
# Mock MemorySystem
# ---------------------------------------------------------------------------


def _make_mock_memory() -> Memory:
    """Build a minimal Memory object for use in mock returns."""
    return Memory(
        id=uuid4(),
        content="Test memory content",
        tier=MemoryTier.PROJECT,
        memory_type=MemoryType.FACT,
        source=MemorySource.AGENT,
        project_id="test-project",
        user_id="test-user",
        tenant_id="default",
        session_id=None,
        importance=0.7,
        confidence=0.9,
        tags=["test"],
        metadata={},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        expires_at=None,
    )


def _make_mock_search_result(memory: Memory | None = None) -> MemorySearchResult:
    """Build a minimal MemorySearchResult for mock returns."""
    mem = memory or _make_mock_memory()
    return MemorySearchResult(
        memory=mem,
        score=0.85,
        distance=0.15,
        similarity_score=0.85,
        recency_score=0.9,
        importance_score=0.7,
        composite_score=0.82,
    )


def _make_mock_stats() -> MagicMock:
    """Build a MagicMock that mimics MemoryStats.model_dump()."""
    stats = MagicMock(spec=MemoryStats)
    stats.total_memories = 50
    stats.tier1_count = 20
    stats.tier2_count = 20
    stats.tier3_count = 10
    stats.by_type = {"fact": 30, "procedure": 20}
    stats.oldest_memory = None
    stats.newest_memory = None
    stats.avg_importance = 0.6
    stats.model_dump = lambda: {
        "total_memories": 50,
        "tier1_count": 20,
        "tier2_count": 20,
        "tier3_count": 10,
        "by_type": {"fact": 30, "procedure": 20},
        "oldest_memory": None,
        "newest_memory": None,
        "avg_importance": 0.6,
    }
    return stats


@pytest.fixture
def mock_memory_system() -> MagicMock:
    """
    AsyncMock-backed MemorySystem with all methods used by api.py pre-configured.

    Covers every _memory_system.* call in api.py.
    """
    system = MagicMock()

    mem = _make_mock_memory()
    search_result = _make_mock_search_result(mem)
    stats = _make_mock_stats()

    # Core CRUD
    system.add = AsyncMock(return_value=mem.id)
    system.add_batch = AsyncMock(return_value=([mem.id], 0))
    system.search = AsyncMock(return_value=[search_result])
    system.get = AsyncMock(return_value=mem)
    system.delete = AsyncMock(return_value=True)
    system.list_memories = AsyncMock(return_value=([mem], 1))

    # Context / RAG
    system.build_context = AsyncMock(return_value="Built context string for query.")
    system.rag_query = AsyncMock(
        return_value={
            "query": "test query",
            "mode": "rag",
            "synthesis_prompt": "Based on these memories...",
            "source_count": 1,
            "context": {"memories": ["Test memory content"]},
        }
    )

    # Maintenance
    system.consolidate = AsyncMock(return_value=3)
    system.cleanup_expired = AsyncMock(return_value=5)

    # Stats
    system.get_stats = AsyncMock(return_value=stats)

    # Tenant management
    system.create_tenant = AsyncMock(return_value=True)
    system.delete_tenant = AsyncMock(return_value=True)
    system.list_tenants = AsyncMock(return_value=["default", "tenant-a"])

    # Knowledge graph — entities
    entity_id = uuid4()
    mock_entity = MagicMock()
    mock_entity.id = entity_id
    mock_entity.name = "TestEntity"
    mock_entity.entity_type = "concept"
    mock_entity.description = "A test entity"
    mock_entity.project_id = "test-project"
    mock_entity.tenant_id = "default"
    mock_entity.aliases = []
    mock_entity.metadata = {}
    mock_entity.created_at = datetime.now(timezone.utc)
    mock_entity.updated_at = datetime.now(timezone.utc)

    system.add_entity = AsyncMock(return_value=entity_id)
    system.list_entities = AsyncMock(return_value=[mock_entity])
    system.find_entity_by_name = AsyncMock(return_value=mock_entity)
    system.get_entity = AsyncMock(return_value=mock_entity)
    system.delete_entity = AsyncMock(return_value=True)

    # Knowledge graph — relations
    relation_id = uuid4()
    system.add_relation = AsyncMock(return_value=relation_id)

    # Knowledge graph — traversal
    graph_result = MagicMock()
    graph_result.entity = mock_entity
    graph_result.neighbors = []
    graph_result.relations = []
    graph_result.depth_reached = 1
    system.query_graph = AsyncMock(return_value=graph_result)

    # Lifecycle
    system.close = AsyncMock()
    system.initialize = AsyncMock()

    # Health attributes
    system.is_healthy = True
    system.is_initialized = True
    system._weaviate = MagicMock()
    system._weaviate.is_connected = True
    system._cache = MagicMock()
    system._cache.is_connected = True

    return system


# ---------------------------------------------------------------------------
# Authenticated async client fixture
# ---------------------------------------------------------------------------


@pytest.fixture
async def auth_client(mock_memory_system: MagicMock) -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient with:
      - require_auth dependency overridden to return "test-user"
      - memory_system.api._memory_system patched with mock_memory_system
    """
    import memory_system.api as api_module

    original_memory_system = api_module._memory_system
    api_module._memory_system = mock_memory_system
    app.dependency_overrides[require_auth] = _override_auth

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        api_module._memory_system = original_memory_system


@pytest.fixture
async def unauth_client() -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient with NO auth override — tests 401 behaviour.
    _memory_system is left as-is (may be None in test env, which is fine for auth tests).
    """
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def no_system_client() -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient with auth overridden but _memory_system set to None.
    Used to test 503 responses when the system is not initialised.
    """
    import memory_system.api as api_module

    original_memory_system = api_module._memory_system
    api_module._memory_system = None
    app.dependency_overrides[require_auth] = _override_auth

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        api_module._memory_system = original_memory_system
