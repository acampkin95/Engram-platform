"""
Comprehensive tests for WeaviateMemoryClient.

Tests all public methods, conversion helpers, tenant management,
and knowledge graph operations WITHOUT requiring a live Weaviate instance.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from memory_system.client import WeaviateMemoryClient
from memory_system.config import (
    ENTITY_COLLECTION,
    TIER1_COLLECTION,
    Settings,
)
from memory_system.memory import (
    GraphQueryResult,
    KnowledgeEntity,
    KnowledgeRelation,
    Memory,
    MemoryQuery,
    MemorySearchResult,
    MemorySource,
    MemoryStats,
    MemoryTier,
    MemoryType,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings(multi_tenancy: bool = False) -> MagicMock:
    """Build a MagicMock that quacks like Settings."""
    s = MagicMock(spec=Settings)
    s.weaviate_url = "http://localhost:8080"
    s.weaviate_api_key = None
    s.weaviate_grpc_url = "http://localhost:50051"
    s.multi_tenancy_enabled = multi_tenancy
    s.default_tenant_id = "default"
    s.embedding_dimensions = 768
    s.clean_schema_migration = False
    s.search_retrieval_mode = "vector"
    s.hybrid_alpha = 0.7
    return s


def _make_client(multi_tenancy: bool = False) -> WeaviateMemoryClient:
    """Create a WeaviateMemoryClient with a mocked internal weaviate client."""
    client = WeaviateMemoryClient(settings=_make_settings(multi_tenancy))
    mock_weaviate = MagicMock()
    client._client = mock_weaviate
    return client


def _make_memory(**overrides) -> Memory:
    """Build a Memory object with sane defaults, accepting overrides."""
    defaults = dict(
        content="Test content",
        tier=MemoryTier.PROJECT,
        memory_type=MemoryType.FACT,
        source=MemorySource.AGENT,
        project_id="proj-1",
        user_id="user-1",
        tenant_id="default",
        importance=0.7,
        confidence=1.0,
        tags=["test"],
        vector=[0.1] * 768,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    defaults.update(overrides)
    return Memory(**defaults)


def _make_weaviate_obj(
    uuid: str | None = None,
    props: dict | None = None,
    certainty: float = 0.85,
    distance: float = 0.15,
) -> MagicMock:
    """Build a mock Weaviate result object with .uuid, .properties, .metadata."""
    obj = MagicMock()
    obj.uuid = uuid or str(uuid4())
    default_props = {
        "content": "Test content",
        "summary": "",
        "memory_type": "fact",
        "source": "agent",
        "project_id": "proj-1",
        "user_id": "user-1",
        "tenant_id": "default",
        "session_id": "",
        "importance": 0.7,
        "confidence": 1.0,
        "tags": ["test"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "access_count": 0,
        "decay_factor": 1.0,
        "is_canonical": True,
        "embedding_model": None,
        "embedding_dimension": None,
        "canonical_id": None,
    }
    if props:
        default_props.update(props)
    obj.properties = default_props
    obj.metadata = MagicMock()
    obj.metadata.certainty = certainty
    obj.metadata.distance = distance
    return obj


def _make_entity_obj(uuid: str | None = None, props: dict | None = None) -> MagicMock:
    """Build a mock Weaviate object that looks like a KnowledgeEntity row."""
    obj = MagicMock()
    obj.uuid = uuid or str(uuid4())
    default_props = {
        "name": "TestEntity",
        "entity_type": "concept",
        "description": "A test entity",
        "project_id": "proj-1",
        "tenant_id": "default",
        "aliases": [],
        "metadata": "{}",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if props:
        default_props.update(props)
    obj.properties = default_props
    return obj


def _make_relation_obj(
    uuid: str | None = None,
    source_id: str | None = None,
    target_id: str | None = None,
    props: dict | None = None,
) -> MagicMock:
    """Build a mock Weaviate object for a KnowledgeRelation row."""
    obj = MagicMock()
    obj.uuid = uuid or str(uuid4())
    default_props = {
        "source_entity_id": source_id or str(uuid4()),
        "target_entity_id": target_id or str(uuid4()),
        "relation_type": "related_to",
        "weight": 0.8,
        "project_id": "proj-1",
        "tenant_id": "default",
        "context": "test context",
        "created_at": datetime.now(timezone.utc),
    }
    if props:
        default_props.update(props)
    obj.properties = default_props
    return obj


# ---------------------------------------------------------------------------
# Tests: __init__
# ---------------------------------------------------------------------------


class TestInit:
    def test_init_with_custom_settings(self):
        settings = _make_settings()
        client = WeaviateMemoryClient(settings=settings)
        assert client.settings is settings
        assert client._client is None

    def test_init_without_settings_uses_get_settings(self):
        with patch("memory_system.client.get_settings") as mock_gs:
            mock_gs.return_value = _make_settings()
            client = WeaviateMemoryClient()
            mock_gs.assert_called_once()
            assert client.settings is mock_gs.return_value


# ---------------------------------------------------------------------------
# Tests: _memory_to_properties
# ---------------------------------------------------------------------------


class TestMemoryToProperties:
    def test_converts_all_fields(self):
        client = _make_client()
        memory = _make_memory(summary="A summary", expires_at=datetime.now())
        props = client._memory_to_properties(memory)

        assert props["content"] == "Test content"
        assert props["summary"] == "A summary"
        assert props["memory_type"] == "fact"
        assert props["source"] == "agent"
        assert props["project_id"] == "proj-1"
        assert props["user_id"] == "user-1"
        assert props["tenant_id"] == "default"
        assert props["importance"] == 0.7
        assert props["confidence"] == 1.0
        assert props["tags"] == ["test"]
        assert props["access_count"] == 0
        assert props["decay_factor"] == 1.0
        assert props["is_canonical"] is True
        # expires_at set
        assert props["expires_at"] != ""

    def test_includes_advanced_persisted_fields(self):
        client = _make_client()
        memory = _make_memory(is_event=True, cause_ids=["a"], effect_ids=["b"])

        props = client._memory_to_properties(memory)

        assert "overall_confidence" in props
        assert "confidence_factors" in props
        assert "provenance" in props
        assert "modification_history" in props
        assert "contradictions" in props
        assert "supporting_evidence_ids" in props
        assert "temporal_bounds" in props
        assert props["is_event"] is True
        assert props["cause_ids"] == ["a"]
        assert props["effect_ids"] == ["b"]


class TestBuildMemoryProperties:
    def test_schema_includes_advanced_fields(self):
        client = _make_client()

        properties = client._build_memory_properties()
        names = {prop.name for prop in properties}

        assert "overall_confidence" in names
        assert "confidence_factors" in names
        assert "provenance" in names
        assert "modification_history" in names
        assert "contradictions_resolved" in names
        assert "supporting_evidence_ids" in names
        assert "temporal_bounds" in names
        assert "is_event" in names
        assert "cause_ids" in names
        assert "effect_ids" in names

    def test_none_optional_fields(self):
        client = _make_client()
        memory = _make_memory(summary=None, expires_at=None, project_id=None)
        props = client._memory_to_properties(memory)

        assert props["summary"] == ""
        assert props["expires_at"] == ""
        assert props["project_id"] == ""


# ---------------------------------------------------------------------------
# Tests: _obj_to_memory
# ---------------------------------------------------------------------------


class TestObjToMemory:
    def test_converts_weaviate_obj_to_memory(self):
        client = _make_client()
        uid = str(uuid4())
        obj = _make_weaviate_obj(uuid=uid)
        memory = client._obj_to_memory(obj, MemoryTier.PROJECT)

        assert str(memory.id) == uid
        assert memory.content == "Test content"
        assert memory.tier == MemoryTier.PROJECT
        assert memory.importance == 0.7
        assert memory.tags == ["test"]

    def test_uses_defaults_for_missing_props(self):
        """When Weaviate returns sparse properties, defaults fill in."""
        client = _make_client()
        obj = MagicMock()
        obj.uuid = str(uuid4())
        # Provide only the fields Memory absolutely requires (content min_length=1, datetimes)
        obj.properties = {
            "content": "x",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        memory = client._obj_to_memory(obj, MemoryTier.GENERAL)

        assert memory.content == "x"
        assert memory.importance == 0.5  # default
        assert memory.confidence == 1.0  # default
        assert memory.tags == []  # default
        assert memory.tier == MemoryTier.GENERAL


# ---------------------------------------------------------------------------
# Tests: _obj_to_entity
# ---------------------------------------------------------------------------


class TestObjToEntity:
    def test_converts_entity_obj(self):
        client = _make_client()
        uid = str(uuid4())
        obj = _make_entity_obj(uuid=uid, props={"metadata": '{"key": "val"}'})
        entity = client._obj_to_entity(obj)

        assert str(entity.id) == uid
        assert entity.name == "TestEntity"
        assert entity.entity_type == "concept"
        assert entity.metadata == {"key": "val"}

    def test_handles_invalid_metadata_json(self):
        client = _make_client()
        obj = _make_entity_obj(props={"metadata": "not-valid-json"})
        entity = client._obj_to_entity(obj)
        assert entity.metadata == {}

    def test_handles_empty_metadata(self):
        client = _make_client()
        obj = _make_entity_obj(props={"metadata": ""})
        entity = client._obj_to_entity(obj)
        assert entity.metadata == {}


# ---------------------------------------------------------------------------
# Tests: _obj_to_relation
# ---------------------------------------------------------------------------


class TestObjToRelation:
    def test_converts_relation_obj(self):
        client = _make_client()
        src = str(uuid4())
        tgt = str(uuid4())
        obj = _make_relation_obj(source_id=src, target_id=tgt)
        rel = client._obj_to_relation(obj)

        assert rel is not None
        assert str(rel.source_entity_id) == src
        assert str(rel.target_entity_id) == tgt
        assert rel.relation_type == "related_to"
        assert rel.weight == 0.8

    def test_returns_none_on_bad_data(self):
        client = _make_client()
        obj = MagicMock()
        obj.uuid = "not-a-uuid"
        obj.properties = {"source_entity_id": "bad", "target_entity_id": "bad"}
        result = client._obj_to_relation(obj)
        assert result is None


# ---------------------------------------------------------------------------
# Tests: add_memory
# ---------------------------------------------------------------------------


class TestAddMemory:
    async def test_add_memory_no_multitenancy(self):
        client = _make_client(multi_tenancy=False)
        memory = _make_memory()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        result = await client.add_memory(memory)

        assert result == memory.id
        collection.data.insert.assert_called_once()
        call_kwargs = collection.data.insert.call_args
        assert call_kwargs.kwargs["uuid"] == str(memory.id)
        assert call_kwargs.kwargs["vector"] == memory.vector

    async def test_add_memory_with_multitenancy(self):
        client = _make_client(multi_tenancy=True)
        memory = _make_memory(tenant_id="tenant-x")
        collection = MagicMock()
        tenant_coll = MagicMock()
        collection.with_tenant.return_value = tenant_coll
        collection.tenants.get.return_value = {}
        client._client.collections.get.return_value = collection

        result = await client.add_memory(memory)

        assert result == memory.id
        collection.with_tenant.assert_called()
        tenant_coll.data.insert.assert_called_once()


# ---------------------------------------------------------------------------
# Tests: search
# ---------------------------------------------------------------------------


class TestSearch:
    async def test_search_with_tier_filter(self):
        client = _make_client()
        collection = MagicMock()
        obj = _make_weaviate_obj()
        search_response = MagicMock()
        search_response.objects = [obj]
        collection.query.near_vector.return_value = search_response
        client._client.collections.get.return_value = collection

        query = MemoryQuery(query="test", tier=MemoryTier.PROJECT, limit=5)
        results = await client.search(query, [0.1] * 768)

        assert len(results) == 1
        assert isinstance(results[0], MemorySearchResult)
        assert results[0].score == 0.85
        collection.query.near_vector.assert_called_once()

    async def test_search_all_tiers(self):
        client = _make_client()
        obj = _make_weaviate_obj()
        search_response = MagicMock()
        search_response.objects = [obj]
        collection = MagicMock()
        collection.query.near_vector.return_value = search_response
        client._client.collections.get.return_value = collection

        query = MemoryQuery(query="test", tier=None, limit=10)
        results = await client.search(query, [0.1] * 768)

        # 3 tiers each return 1 result
        assert len(results) == 3
        # get was called 3 times (once per tier)
        assert client._client.collections.get.call_count == 3

    async def test_search_with_filters(self):
        client = _make_client()
        collection = MagicMock()
        search_response = MagicMock()
        search_response.objects = []
        collection.query.near_vector.return_value = search_response
        client._client.collections.get.return_value = collection

        query = MemoryQuery(
            query="test",
            tier=MemoryTier.PROJECT,
            project_id="proj-1",
            user_id="user-1",
            tags=["important"],
            min_importance=0.5,
            limit=5,
        )
        results = await client.search(query, [0.1] * 768)

        assert results == []
        # near_vector called with filters
        call_kwargs = collection.query.near_vector.call_args.kwargs
        assert call_kwargs["filters"] is not None

    async def test_search_with_multitenancy(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        tenant_coll = MagicMock()
        search_response = MagicMock()
        search_response.objects = []
        tenant_coll.query.near_vector.return_value = search_response
        collection.with_tenant.return_value = tenant_coll
        collection.tenants.get.return_value = {}
        client._client.collections.get.return_value = collection

        query = MemoryQuery(query="test", tier=MemoryTier.PROJECT, tenant_id="t1", limit=5)
        results = await client.search(query, [0.1] * 768)

        assert results == []
        collection.with_tenant.assert_called()

    async def test_search_uses_hybrid_when_configured(self):
        client = _make_client()
        client.settings.search_retrieval_mode = "hybrid"
        collection = MagicMock()
        search_response = MagicMock()
        search_response.objects = []
        collection.query.hybrid.return_value = search_response
        client._client.collections.get.return_value = collection

        query = MemoryQuery(query="test", tier=MemoryTier.PROJECT, limit=5)
        results = await client.search(query, [0.1] * 768)

        assert results == []
        collection.query.hybrid.assert_called_once()
        collection.query.near_vector.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: get_memory
# ---------------------------------------------------------------------------


class TestGetMemory:
    async def test_get_memory_success(self):
        client = _make_client()
        uid = uuid4()
        obj = _make_weaviate_obj(uuid=str(uid))
        collection = MagicMock()
        collection.query.fetch_object_by_id.return_value = obj
        client._client.collections.get.return_value = collection

        result = await client.get_memory(uid, MemoryTier.PROJECT)

        assert result is not None
        assert result.id == uid

    async def test_get_memory_not_found(self):
        client = _make_client()
        collection = MagicMock()
        collection.query.fetch_object_by_id.return_value = None
        client._client.collections.get.return_value = collection

        result = await client.get_memory(uuid4(), MemoryTier.PROJECT)
        assert result is None

    async def test_get_memory_exception(self):
        client = _make_client()
        collection = MagicMock()
        collection.query.fetch_object_by_id.side_effect = RuntimeError("boom")
        client._client.collections.get.return_value = collection

        result = await client.get_memory(uuid4(), MemoryTier.PROJECT)
        assert result is None


# ---------------------------------------------------------------------------
# Tests: list_memories
# ---------------------------------------------------------------------------


class TestListMemories:
    async def test_list_single_tier(self):
        client = _make_client()
        obj = _make_weaviate_obj()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = [obj]
        collection.query.fetch_objects.return_value = fetch_result
        aggregate_result = MagicMock()
        aggregate_result.total_count = 1
        collection.aggregate.over_all.return_value = aggregate_result
        client._client.collections.get.return_value = collection

        memories, total = await client.list_memories(tier=MemoryTier.PROJECT)

        assert len(memories) == 1
        assert total == 1

    async def test_list_all_tiers(self):
        client = _make_client()
        obj = _make_weaviate_obj()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = [obj]
        collection.query.fetch_objects.return_value = fetch_result
        aggregate_result = MagicMock()
        aggregate_result.total_count = 1
        collection.aggregate.over_all.return_value = aggregate_result
        client._client.collections.get.return_value = collection

        memories, total = await client.list_memories(tier=None, limit=10)

        # 3 tiers, each returns 1 object → total_count summed
        assert total == 3
        # global offset+limit slice applied
        assert len(memories) <= 10

    async def test_list_with_filters(self):
        client = _make_client()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = []
        collection.query.fetch_objects.return_value = fetch_result
        aggregate_result = MagicMock()
        aggregate_result.total_count = 0
        collection.aggregate.over_all.return_value = aggregate_result
        client._client.collections.get.return_value = collection

        memories, total = await client.list_memories(
            tier=MemoryTier.PROJECT, project_id="proj-1", tenant_id="t1"
        )

        assert memories == []
        assert total == 0


# ---------------------------------------------------------------------------
# Tests: delete_memory
# ---------------------------------------------------------------------------


class TestDeleteMemory:
    async def test_delete_success(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        result = await client.delete_memory(uuid4(), MemoryTier.PROJECT)
        assert result is True
        collection.data.delete_by_id.assert_called_once()

    async def test_delete_failure(self):
        client = _make_client()
        collection = MagicMock()
        collection.data.delete_by_id.side_effect = RuntimeError("fail")
        client._client.collections.get.return_value = collection

        result = await client.delete_memory(uuid4(), MemoryTier.PROJECT)
        assert result is False


# ---------------------------------------------------------------------------
# Tests: add_memories_batch
# ---------------------------------------------------------------------------


class TestAddMemoriesBatch:
    async def test_batch_success(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        m1 = _make_memory()
        m2 = _make_memory()
        successful, failed = await client.add_memories_batch([m1, m2])

        assert len(successful) == 2
        assert len(failed) == 0

    async def test_batch_partial_failure(self):
        client = _make_client()
        collection = MagicMock()
        # First insert OK, second raises
        call_count = 0

        def _side_effect(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise RuntimeError("insert failed")

        collection.data.insert.side_effect = _side_effect
        client._client.collections.get.return_value = collection

        m1 = _make_memory()
        m2 = _make_memory()
        successful, failed = await client.add_memories_batch([m1, m2])

        assert len(successful) == 1
        assert len(failed) == 1


# ---------------------------------------------------------------------------
# Tests: get_stats
# ---------------------------------------------------------------------------


class TestGetStats:
    async def test_get_stats_no_multitenancy(self):
        client = _make_client()
        collection = MagicMock()
        aggregate_result = MagicMock()
        aggregate_result.total_count = 10
        collection.aggregate.over_all.return_value = aggregate_result
        client._client.collections.get.return_value = collection

        stats = await client.get_stats()

        assert isinstance(stats, MemoryStats)
        # 3 tiers × 10 each
        assert stats.total_memories == 30
        assert stats.tier1_count == 10
        assert stats.tier2_count == 10
        assert stats.tier3_count == 10

    async def test_get_stats_with_multitenancy(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        tenant_coll = MagicMock()
        aggregate_result = MagicMock()
        aggregate_result.total_count = 5
        tenant_coll.aggregate.over_all.return_value = aggregate_result
        collection.with_tenant.return_value = tenant_coll
        collection.tenants.get.return_value = {}
        client._client.collections.get.return_value = collection

        stats = await client.get_stats(tenant_id="t1")

        assert stats.total_memories == 15


# ---------------------------------------------------------------------------
# Tests: close & is_connected
# ---------------------------------------------------------------------------


class TestCloseAndConnected:
    async def test_close_with_client(self):
        client = _make_client()
        await client.close()
        client._client.close.assert_called_once()

    async def test_close_without_client(self):
        client = WeaviateMemoryClient(settings=_make_settings())
        # _client is None — should not raise
        await client.close()

    def test_is_connected_true(self):
        client = _make_client()
        client._client.is_ready.return_value = True
        assert client.is_connected is True

    def test_is_connected_false_no_client(self):
        client = WeaviateMemoryClient(settings=_make_settings())
        assert client.is_connected is False


# ---------------------------------------------------------------------------
# Tests: increment_access_count
# ---------------------------------------------------------------------------


class TestIncrementAccessCount:
    async def test_increments_count(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        uid = uuid4()
        await client.increment_access_count(uid, MemoryTier.PROJECT, current_count=3)

        collection.data.update.assert_called_once()
        call_kwargs = collection.data.update.call_args.kwargs
        assert call_kwargs["properties"]["access_count"] == 4
        assert "last_accessed_at" in call_kwargs["properties"]


# ---------------------------------------------------------------------------
# Tests: update_memory_fields
# ---------------------------------------------------------------------------


class TestUpdateMemoryFields:
    async def test_update_success(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        result = await client.update_memory_fields(uuid4(), MemoryTier.PROJECT, {"importance": 0.9})
        assert result is True
        collection.data.update.assert_called_once()

    async def test_update_failure(self):
        client = _make_client()
        collection = MagicMock()
        collection.data.update.side_effect = RuntimeError("fail")
        client._client.collections.get.return_value = collection

        result = await client.update_memory_fields(uuid4(), MemoryTier.PROJECT, {"importance": 0.9})
        assert result is False

    async def test_update_with_multitenancy(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        tenant_coll = MagicMock()
        collection.with_tenant.return_value = tenant_coll
        client._client.collections.get.return_value = collection

        result = await client.update_memory_fields(
            uuid4(), MemoryTier.PROJECT, {"importance": 0.9}, tenant_id="t1"
        )
        assert result is True
        tenant_coll.data.update.assert_called_once()


# ---------------------------------------------------------------------------
# Tests: update_memory_metadata
# ---------------------------------------------------------------------------


class TestUpdateMemoryMetadata:
    async def test_delegates_to_update_memory_fields(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        uid = uuid4()
        result = await client.update_memory_metadata(uid, MemoryTier.PROJECT, {"key": "val"})
        assert result is True
        collection.data.update.assert_called_once()


# ---------------------------------------------------------------------------
# Tests: delete_expired_memories
# ---------------------------------------------------------------------------


class TestDeleteExpiredMemories:
    async def test_deletes_expired(self):
        client = _make_client()
        collection = MagicMock()
        expired_obj = _make_weaviate_obj()
        fetch_result = MagicMock()
        fetch_result.objects = [expired_obj, expired_obj]
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        count = await client.delete_expired_memories(MemoryTier.PROJECT)
        assert count == 2

    async def test_empty_results(self):
        client = _make_client()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = []
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        count = await client.delete_expired_memories(MemoryTier.GENERAL)
        assert count == 0

    async def test_exception_returns_zero(self):
        client = _make_client()
        collection = MagicMock()
        collection.query.fetch_objects.side_effect = RuntimeError("fail")
        client._client.collections.get.return_value = collection

        count = await client.delete_expired_memories(MemoryTier.PROJECT)
        assert count == 0


# ---------------------------------------------------------------------------
# Tests: find_similar_memories_by_vector
# ---------------------------------------------------------------------------


class TestFindSimilarByVector:
    async def test_finds_similar(self):
        client = _make_client()
        collection = MagicMock()
        obj = _make_weaviate_obj(distance=0.05)
        search_response = MagicMock()
        search_response.objects = [obj]
        collection.query.near_vector.return_value = search_response
        client._client.collections.get.return_value = collection

        memories = await client.find_similar_memories_by_vector(
            vector=[0.1] * 768, tier=MemoryTier.PROJECT, threshold=0.9
        )

        assert len(memories) == 1

    async def test_exception_returns_empty(self):
        client = _make_client()
        collection = MagicMock()
        collection.query.near_vector.side_effect = RuntimeError("fail")
        client._client.collections.get.return_value = collection

        memories = await client.find_similar_memories_by_vector(
            vector=[0.1] * 768, tier=MemoryTier.PROJECT
        )
        assert memories == []


# ---------------------------------------------------------------------------
# Tests: find_consolidation_candidates
# ---------------------------------------------------------------------------


class TestFindConsolidationCandidates:
    async def test_finds_candidates(self):
        client = _make_client()
        collection = MagicMock()
        obj = _make_weaviate_obj()
        fetch_result = MagicMock()
        fetch_result.objects = [obj]
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        memories = await client.find_consolidation_candidates(tier=MemoryTier.PROJECT)
        assert len(memories) == 1

    async def test_exception_returns_empty(self):
        client = _make_client()
        collection = MagicMock()
        collection.query.fetch_objects.side_effect = RuntimeError("fail")
        client._client.collections.get.return_value = collection

        memories = await client.find_consolidation_candidates(tier=MemoryTier.PROJECT)
        assert memories == []


# ---------------------------------------------------------------------------
# Tests: add_analysis (stub)
# ---------------------------------------------------------------------------


class TestAddAnalysis:
    async def test_is_noop(self):
        client = _make_client()
        result = await client.add_analysis(object())
        assert result is None


# ---------------------------------------------------------------------------
# Tests: Tenant management
# ---------------------------------------------------------------------------


class TestTenantManagement:
    async def test_create_tenant_success(self):
        client = _make_client()
        collection = MagicMock()
        collection.tenants.get.return_value = {}
        client._client.collections.get.return_value = collection

        result = await client.create_tenant("new-tenant")
        assert result is True
        # Called for all 5 collections
        assert collection.tenants.create.call_count == 5

    async def test_create_tenant_already_exists(self):
        client = _make_client()
        collection = MagicMock()
        existing = MagicMock()
        existing.name = "existing-t"
        collection.tenants.get.return_value = {"existing-t": existing}
        client._client.collections.get.return_value = collection

        result = await client.create_tenant("existing-t")
        assert result is True
        # No create calls since tenant exists in every collection
        collection.tenants.create.assert_not_called()

    async def test_create_tenant_failure(self):
        client = _make_client()
        client._client.collections.get.side_effect = RuntimeError("fail")

        result = await client.create_tenant("bad-tenant")
        assert result is False

    async def test_delete_tenant_success(self):
        client = _make_client()
        collection = MagicMock()
        existing = MagicMock()
        existing.name = "t-del"
        collection.tenants.get.return_value = {"t-del": existing}
        client._client.collections.get.return_value = collection

        result = await client.delete_tenant("t-del")
        assert result is True
        assert collection.tenants.remove.call_count == 5

    async def test_delete_tenant_failure(self):
        client = _make_client()
        client._client.collections.get.side_effect = RuntimeError("fail")

        result = await client.delete_tenant("t-del")
        assert result is False

    async def test_list_tenants(self):
        client = _make_client()
        collection = MagicMock()
        t1 = MagicMock()
        t1.name = "default"
        t2 = MagicMock()
        t2.name = "tenant-a"
        collection.tenants.get.return_value = {"default": t1, "tenant-a": t2}
        client._client.collections.get.return_value = collection

        result = await client.list_tenants()
        assert set(result) == {"default", "tenant-a"}

    async def test_list_tenants_failure(self):
        client = _make_client()
        client._client.collections.get.side_effect = RuntimeError("fail")

        result = await client.list_tenants()
        assert result == []


# ---------------------------------------------------------------------------
# Tests: _ensure_memory_tenant
# ---------------------------------------------------------------------------


class TestEnsureMemoryTenant:
    async def test_creates_tenant_when_missing(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        collection.tenants.get.return_value = {}
        client._client.collections.get.return_value = collection

        await client._ensure_memory_tenant("new-t", TIER1_COLLECTION)
        collection.tenants.create.assert_called_once()

    async def test_skips_when_exists(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        existing = MagicMock()
        existing.name = "existing-t"
        collection.tenants.get.return_value = {"existing-t": existing}
        client._client.collections.get.return_value = collection

        await client._ensure_memory_tenant("existing-t", TIER1_COLLECTION)
        collection.tenants.create.assert_not_called()

    async def test_skips_when_disabled(self):
        client = _make_client(multi_tenancy=False)
        await client._ensure_memory_tenant("t1", TIER1_COLLECTION)
        # _client.collections.get should not be called
        client._client.collections.get.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: Knowledge graph CRUD
# ---------------------------------------------------------------------------


class TestKnowledgeGraphCRUD:
    async def test_add_entity(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        entity = KnowledgeEntity(
            name="Test",
            entity_type="concept",
            project_id="proj-1",
            tenant_id="default",
            metadata={"key": "val"},
        )
        result = await client.add_entity(entity)

        assert result == entity.id
        collection.data.insert.assert_called_once()
        call_kwargs = collection.data.insert.call_args.kwargs
        assert call_kwargs["properties"]["name"] == "Test"
        # metadata serialized as JSON string
        assert json.loads(call_kwargs["properties"]["metadata"]) == {"key": "val"}

    async def test_get_entity_success(self):
        client = _make_client()
        uid = uuid4()
        obj = _make_entity_obj(uuid=str(uid))
        collection = MagicMock()
        collection.query.fetch_object_by_id.return_value = obj
        client._client.collections.get.return_value = collection

        result = await client.get_entity(uid)
        assert result is not None
        assert result.name == "TestEntity"

    async def test_get_entity_not_found(self):
        client = _make_client()
        collection = MagicMock()
        collection.query.fetch_object_by_id.return_value = None
        client._client.collections.get.return_value = collection

        result = await client.get_entity(uuid4())
        assert result is None

    async def test_find_entity_by_name(self):
        client = _make_client()
        obj = _make_entity_obj()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = [obj]
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        result = await client.find_entity_by_name("TestEntity", project_id="proj-1")
        assert result is not None
        assert result.name == "TestEntity"

    async def test_find_entity_by_name_not_found(self):
        client = _make_client()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = []
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        result = await client.find_entity_by_name("NoSuchEntity")
        assert result is None

    async def test_list_entities(self):
        client = _make_client()
        obj = _make_entity_obj()
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = [obj, obj]
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        entities = await client.list_entities(project_id="proj-1")
        assert len(entities) == 2

    async def test_add_relation(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        rel = KnowledgeRelation(
            source_entity_id=uuid4(),
            target_entity_id=uuid4(),
            relation_type="uses",
            project_id="proj-1",
            tenant_id="default",
        )
        result = await client.add_relation(rel)
        assert result == rel.id
        collection.data.insert.assert_called_once()

    async def test_delete_entity_success(self):
        client = _make_client()
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        result = await client.delete_entity(uuid4())
        assert result is True

    async def test_delete_entity_failure(self):
        client = _make_client()
        collection = MagicMock()
        collection.data.delete_by_id.side_effect = RuntimeError("fail")
        client._client.collections.get.return_value = collection

        result = await client.delete_entity(uuid4())
        assert result is False


# ---------------------------------------------------------------------------
# Tests: _get_graph_collection
# ---------------------------------------------------------------------------


class TestGetGraphCollection:
    def test_without_multitenancy(self):
        client = _make_client(multi_tenancy=False)
        collection = MagicMock()
        client._client.collections.get.return_value = collection

        result = client._get_graph_collection(ENTITY_COLLECTION, tenant_id="t1")
        assert result is collection
        collection.with_tenant.assert_not_called()

    def test_with_multitenancy(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        tenant_coll = MagicMock()
        collection.with_tenant.return_value = tenant_coll
        client._client.collections.get.return_value = collection

        result = client._get_graph_collection(ENTITY_COLLECTION, tenant_id="t1")
        assert result is tenant_coll
        collection.with_tenant.assert_called_with("t1")

    def test_with_multitenancy_default_tenant(self):
        client = _make_client(multi_tenancy=True)
        collection = MagicMock()
        tenant_coll = MagicMock()
        collection.with_tenant.return_value = tenant_coll
        client._client.collections.get.return_value = collection

        result = client._get_graph_collection(ENTITY_COLLECTION, tenant_id=None)
        assert result is tenant_coll
        collection.with_tenant.assert_called_with("default")


# ---------------------------------------------------------------------------
# Tests: _get_relations_for_entity
# ---------------------------------------------------------------------------


class TestGetRelationsForEntity:
    async def test_returns_relations(self):
        client = _make_client()
        src_id = uuid4()
        tgt_id = uuid4()
        rel_obj = _make_relation_obj(source_id=str(src_id), target_id=str(tgt_id))
        collection = MagicMock()
        fetch_result = MagicMock()
        fetch_result.objects = [rel_obj]
        collection.query.fetch_objects.return_value = fetch_result
        client._client.collections.get.return_value = collection

        relations = await client._get_relations_for_entity(src_id)
        # Called twice (source + target), each returns 1 relation
        assert len(relations) == 2


# ---------------------------------------------------------------------------
# Tests: query_graph (BFS)
# ---------------------------------------------------------------------------


class TestQueryGraph:
    async def test_bfs_traversal(self):
        client = _make_client()
        root_id = uuid4()
        neighbor_id = uuid4()

        root_entity = KnowledgeEntity(
            id=root_id, name="Root", entity_type="concept", project_id="proj-1"
        )
        neighbor_entity = KnowledgeEntity(
            id=neighbor_id, name="Neighbor", entity_type="concept", project_id="proj-1"
        )
        rel = KnowledgeRelation(
            source_entity_id=root_id,
            target_entity_id=neighbor_id,
            relation_type="related_to",
        )

        # Mock get_entity to return root first, then neighbor
        async def mock_get_entity(eid, tid=None):
            if eid == root_id:
                return root_entity
            if eid == neighbor_id:
                return neighbor_entity
            return None

        # Mock _get_relations_for_entity
        async def mock_get_relations(eid, project_id=None, tenant_id=None):
            if eid == root_id:
                return [rel]
            return []

        client.get_entity = mock_get_entity
        client._get_relations_for_entity = mock_get_relations

        result = await client.query_graph(root_id, depth=1)

        assert isinstance(result, GraphQueryResult)
        assert result.entity.id == root_id
        assert len(result.neighbors) == 1
        assert result.neighbors[0].id == neighbor_id
        assert result.depth_reached == 1

    async def test_bfs_root_not_found(self):
        client = _make_client()

        async def mock_get_entity(eid, tid=None):
            return None

        client.get_entity = mock_get_entity

        with pytest.raises(ValueError, match="not found"):
            await client.query_graph(uuid4(), depth=1)
