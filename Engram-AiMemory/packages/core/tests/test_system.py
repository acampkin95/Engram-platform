"""
Comprehensive unit tests for memory_system.system.MemorySystem.

All external dependencies (Weaviate, Redis, OpenAI, Nomic, Ollama) are mocked.
No live services required.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

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
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_settings():
    """Minimal Settings-like namespace for tests."""
    s = MagicMock()
    s.weaviate_url = "http://localhost:8080"
    s.redis_url = "redis://localhost:6379"
    s.embedding_provider = "nomic"
    s.embedding_model = "text-embedding-3-small"
    s.embedding_dimensions = 768
    s.default_tenant_id = "default"
    s.memory_retention_days = 30
    s.deduplication_enabled = False
    s.deduplication_threshold = 0.95
    s.deduplication_action = "skip"
    s.contradiction_detection_enabled = False
    s.contradiction_action = "flag"
    s.auto_importance_enabled = False
    s.auto_importance_threshold = 0.7
    s.reranker_enabled = False
    s.reranker_model = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    s.ollama_host = None
    s.consolidation_hours_back = 48
    s.consolidation_min_group_size = 3
    s.consolidation_confidence = 0.6
    s.rag_max_context_tokens = 4000
    s.rag_default_limit = 10
    s.openai_api_key = "test-key"
    s.ollama_request_timeout = 30
    return s


@pytest.fixture
def system(mock_settings):
    """Return an initialized MemorySystem with mocked internals."""
    with (
        patch("memory_system.system.WeaviateMemoryClient") as MockWeaviate,
        patch("memory_system.system.RedisCache") as MockCache,
    ):
        mock_weaviate = AsyncMock()
        mock_cache = AsyncMock()
        MockWeaviate.return_value = mock_weaviate
        MockCache.return_value = mock_cache

        from memory_system.system import MemorySystem

        sys_obj = MemorySystem(settings=mock_settings)
        sys_obj._weaviate = mock_weaviate
        sys_obj._cache = mock_cache
        sys_obj._initialized = True
        yield sys_obj


@pytest.fixture
def uninit_system(mock_settings):
    """Return an un-initialized MemorySystem."""
    with (
        patch("memory_system.system.WeaviateMemoryClient") as MockWeaviate,
        patch("memory_system.system.RedisCache") as MockCache,
    ):
        MockWeaviate.return_value = AsyncMock()
        MockCache.return_value = AsyncMock()

        from memory_system.system import MemorySystem

        sys_obj = MemorySystem(settings=mock_settings)
        # _initialized defaults to False
        yield sys_obj


def _make_memory(**overrides) -> Memory:
    """Helper to create a Memory with sensible defaults."""
    defaults = dict(
        id=uuid4(),
        content="Test memory content",
        tier=MemoryTier.PROJECT,
        memory_type=MemoryType.FACT,
        source=MemorySource.AGENT,
        project_id="test-project",
        tenant_id="default",
        importance=0.5,
        confidence=1.0,
        tags=["test"],
        metadata={},
        vector=[0.1] * 768,
    )
    defaults.update(overrides)
    return Memory(**defaults)


def _make_search_result(memory: Memory | None = None) -> MemorySearchResult:
    mem = memory or _make_memory()
    return MemorySearchResult(
        memory=mem,
        score=0.85,
        distance=0.15,
        similarity_score=0.85,
        recency_score=0.9,
        importance_score=0.7,
        composite_score=0.82,
    )


# ===================================================================
# __init__
# ===================================================================


class TestInit:
    def test_init_with_custom_settings(self, mock_settings):
        with (
            patch("memory_system.system.WeaviateMemoryClient"),
            patch("memory_system.system.RedisCache"),
        ):
            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            assert ms.settings is mock_settings
            assert ms._initialized is False
            assert ms._embedding_client is None

    def test_init_without_settings(self):
        with (
            patch("memory_system.system.WeaviateMemoryClient"),
            patch("memory_system.system.RedisCache"),
            patch("memory_system.system.get_settings") as mock_get,
        ):
            sentinel = MagicMock()
            mock_get.return_value = sentinel

            from memory_system.system import MemorySystem

            ms = MemorySystem()
            assert ms.settings is sentinel


# ===================================================================
# initialize
# ===================================================================


class TestInitialize:
    async def test_initialize_nomic(self, mock_settings):
        mock_settings.embedding_provider = "nomic"
        mock_settings.ollama_host = None

        with (
            patch("memory_system.system.WeaviateMemoryClient") as MockW,
            patch("memory_system.system.RedisCache") as MockC,
            patch("memory_system.embeddings.NomicEmbedder") as MockNomic,
        ):
            MockW.return_value = AsyncMock()
            MockC.return_value = AsyncMock()
            MockNomic.return_value = MagicMock()

            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            await ms.initialize()

            assert ms._initialized is True
            MockW.return_value.connect.assert_awaited_once()
            MockC.return_value.connect.assert_awaited_once()

    async def test_initialize_openai(self, mock_settings):
        mock_settings.embedding_provider = "openai"
        mock_settings.ollama_host = None

        mock_openai_mod = MagicMock()
        mock_async_client = MagicMock()
        mock_openai_mod.AsyncOpenAI = MagicMock(return_value=mock_async_client)

        with (
            patch("memory_system.system.WeaviateMemoryClient") as MockW,
            patch("memory_system.system.RedisCache") as MockC,
            patch.dict(sys.modules, {"openai": mock_openai_mod}),
        ):
            MockW.return_value = AsyncMock()
            MockC.return_value = AsyncMock()

            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            await ms.initialize()

            assert ms._initialized is True
            assert ms._embedding_client is mock_async_client

    async def test_initialize_local(self, mock_settings):
        mock_settings.embedding_provider = "local"
        mock_settings.ollama_host = None

        with (
            patch("memory_system.system.WeaviateMemoryClient") as MockW,
            patch("memory_system.system.RedisCache") as MockC,
        ):
            MockW.return_value = AsyncMock()
            MockC.return_value = AsyncMock()

            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            await ms.initialize()

            assert ms._initialized is True
            assert ms._embedding_client is None

    async def test_initialize_ollama_embedding(self, mock_settings):
        mock_settings.embedding_provider = "ollama"
        mock_settings.ollama_host = None
        mock_settings.ollama_embedding_model = "nomic-embed-text:v1.5"

        with (
            patch("memory_system.system.WeaviateMemoryClient") as MockW,
            patch("memory_system.system.RedisCache") as MockC,
            patch("memory_system.embeddings.OllamaEmbedder") as MockOllama,
        ):
            MockW.return_value = AsyncMock()
            MockC.return_value = AsyncMock()
            MockOllama.return_value = MagicMock()

            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            await ms.initialize()

            assert ms._initialized is True
            assert ms._nomic_embedder is not None

    async def test_initialize_with_ollama_client_available(self, mock_settings):
        mock_settings.embedding_provider = "local"
        mock_settings.ollama_host = "http://localhost:11434"

        with (
            patch("memory_system.system.WeaviateMemoryClient") as MockW,
            patch("memory_system.system.RedisCache") as MockC,
            patch("memory_system.ollama_client.OllamaClient") as MockOllamaClient,
        ):
            MockW.return_value = AsyncMock()
            MockC.return_value = AsyncMock()
            mock_client = AsyncMock()
            mock_client.is_available = AsyncMock(return_value=True)
            MockOllamaClient.return_value = mock_client

            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            await ms.initialize()

            assert ms._initialized is True
            assert ms._ollama is not None

    async def test_initialize_with_ollama_unavailable(self, mock_settings):
        mock_settings.embedding_provider = "local"
        mock_settings.ollama_host = "http://localhost:11434"

        with (
            patch("memory_system.system.WeaviateMemoryClient") as MockW,
            patch("memory_system.system.RedisCache") as MockC,
            patch("memory_system.ollama_client.OllamaClient") as MockOllamaClient,
        ):
            MockW.return_value = AsyncMock()
            MockC.return_value = AsyncMock()
            mock_client = AsyncMock()
            mock_client.is_available = AsyncMock(return_value=False)
            MockOllamaClient.return_value = mock_client

            from memory_system.system import MemorySystem

            ms = MemorySystem(settings=mock_settings)
            await ms.initialize()

            assert ms._initialized is True
            assert ms._ollama is None  # Set to None when unavailable


# ===================================================================
# _get_embedding
# ===================================================================


class TestGetEmbedding:
    async def test_cache_hit(self, system):
        system._cache.get_embedding = AsyncMock(return_value=[0.5] * 768)

        result = await system._get_embedding("hello")
        assert result == [0.5] * 768
        # Should not generate a new embedding
        system._cache.set_embedding.assert_not_awaited()

    async def test_cache_miss_nomic(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        mock_embedder = MagicMock()
        mock_embedder.embed_query = MagicMock(return_value=[0.1] * 768)
        system._nomic_embedder = mock_embedder

        result = await system._get_embedding("hello")
        assert len(result) == 768
        system._cache.set_embedding.assert_awaited_once()

    async def test_cache_miss_openai(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None

        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.2] * 768)]
        mock_client = AsyncMock()
        mock_client.embeddings.create = AsyncMock(return_value=mock_response)
        system._embedding_client = mock_client

        result = await system._get_embedding("hello")
        assert result == [0.2] * 768
        system._cache.set_embedding.assert_awaited_once()

    async def test_cache_miss_mock_embedding(self, system):
        """When no embedder or client, falls back to random mock."""
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        result = await system._get_embedding("hello")
        assert len(result) == system.settings.embedding_dimensions
        system._cache.set_embedding.assert_awaited_once()


# ===================================================================
# _get_embeddings_batch
# ===================================================================


class TestGetEmbeddingsBatch:
    async def test_nomic_batch(self, system):
        mock_embedder = MagicMock()
        mock_embedder.embed_batch = MagicMock(return_value=[[0.1] * 768, [0.2] * 768])
        system._nomic_embedder = mock_embedder

        result = await system._get_embeddings_batch(["a", "b"])
        assert len(result) == 2
        assert len(result[0]) == 768

    async def test_openai_batch(self, system):
        system._nomic_embedder = None

        item_0 = MagicMock(index=0, embedding=[0.1] * 768)
        item_1 = MagicMock(index=1, embedding=[0.2] * 768)
        mock_response = MagicMock()
        mock_response.data = [item_1, item_0]  # Out of order to test sort

        mock_client = AsyncMock()
        mock_client.embeddings.create = AsyncMock(return_value=mock_response)
        system._embedding_client = mock_client

        result = await system._get_embeddings_batch(["a", "b"])
        assert len(result) == 2
        assert result[0] == [0.1] * 768  # Sorted by index
        assert result[1] == [0.2] * 768

    async def test_mock_batch(self, system):
        system._nomic_embedder = None
        system._embedding_client = None

        result = await system._get_embeddings_batch(["a", "b", "c"])
        assert len(result) == 3
        for emb in result:
            assert len(emb) == system.settings.embedding_dimensions


# ===================================================================
# add
# ===================================================================


class TestAdd:
    async def test_basic_add(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None
        new_id = uuid4()
        system._weaviate.add_memory = AsyncMock(return_value=new_id)

        result = await system.add(content="Test memory", project_id="proj")
        assert result == new_id
        system._weaviate.add_memory.assert_awaited_once()
        system._cache.invalidate_stats.assert_awaited()

    async def test_add_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.add(content="Test")

    async def test_add_with_expiration(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None
        new_id = uuid4()
        system._weaviate.add_memory = AsyncMock(return_value=new_id)

        result = await system.add(content="Expiring", expires_in_days=7)
        assert result == new_id

        # Verify the Memory passed to add_memory has expires_at set
        call_args = system._weaviate.add_memory.call_args
        memory_arg = call_args[0][0]
        assert memory_arg.expires_at is not None
        assert memory_arg.expires_at > datetime.now(timezone)

    async def test_add_default_expiration_from_settings(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None
        system.settings.memory_retention_days = 30
        system._weaviate.add_memory = AsyncMock(return_value=uuid4())

        await system.add(content="Auto-expiring")
        call_args = system._weaviate.add_memory.call_args
        memory_arg = call_args[0][0]
        assert memory_arg.expires_at is not None

    async def test_add_deduplication_skip(self, system):
        system.settings.deduplication_enabled = True
        system.settings.deduplication_action = "skip"
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        existing_id = uuid4()
        existing_mem = _make_memory(id=existing_id)
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=[existing_mem])

        result = await system.add(content="Duplicate", project_id="proj")
        assert result == existing_id
        system._weaviate.add_memory.assert_not_awaited()

    async def test_add_deduplication_update(self, system):
        system.settings.deduplication_enabled = True
        system.settings.deduplication_action = "update"
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        existing_id = uuid4()
        existing_mem = _make_memory(id=existing_id, metadata={"reinforcement_count": 2})
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=[existing_mem])

        result = await system.add(content="Duplicate", project_id="proj")
        assert result == existing_id
        system._weaviate.update_memory_metadata.assert_awaited_once()

    async def test_add_deduplication_merge(self, system):
        system.settings.deduplication_enabled = True
        system.settings.deduplication_action = "merge"
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        existing_id = uuid4()
        existing_mem = _make_memory(id=existing_id)
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=[existing_mem])

        result = await system.add(content="New info", project_id="proj")
        assert result == existing_id
        system._weaviate.update_memory_metadata.assert_awaited_once()

    async def test_add_contradiction_reject(self, system):
        system.settings.contradiction_detection_enabled = True
        system.settings.contradiction_action = "reject"
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        conflict_id = uuid4()
        conflict_mem = _make_memory(
            id=conflict_id,
            content="Python is not a compiled language",
            project_id="proj",
        )
        system._weaviate.find_consolidation_candidates = AsyncMock(return_value=[conflict_mem])

        with pytest.raises(ValueError, match="contradicts existing memory"):
            await system.add(
                content="Python is a compiled language with four shared words minimum",
                project_id="proj",
            )


# ===================================================================
# add_batch
# ===================================================================


class TestAddBatch:
    async def test_add_batch_success(self, system):
        system._nomic_embedder = None
        system._embedding_client = None

        ids = [uuid4(), uuid4()]
        system._weaviate.add_memories_batch = AsyncMock(return_value=(ids, []))

        result_ids, failed = await system.add_batch([
            {"content": "Memory 1"},
            {"content": "Memory 2"},
        ])
        assert result_ids == ids
        assert failed == 0
        system._cache.invalidate_stats.assert_awaited()

    async def test_add_batch_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.add_batch([{"content": "x"}])


# ===================================================================
# search
# ===================================================================


class TestSearch:
    async def test_basic_search(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._cache.get_search_results = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        sr = _make_search_result()
        system._weaviate.search = AsyncMock(return_value=[sr])

        results = await system.search("test query", project_id="proj")
        assert len(results) == 1
        assert results[0].memory.content == "Test memory content"
        system._cache.set_search_results.assert_awaited_once()

    async def test_search_cached(self, system):
        cached_data = [_make_search_result().model_dump(mode="json")]
        system._cache.get_search_results = AsyncMock(return_value=cached_data)

        results = await system.search("cached query")
        assert len(results) == 1
        system._weaviate.search.assert_not_awaited()

    async def test_search_with_reranking(self, system):
        system.settings.reranker_enabled = True
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._cache.get_search_results = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        sr1 = _make_search_result(_make_memory(content="Result A"))
        sr2 = _make_search_result(_make_memory(content="Result B"))
        system._weaviate.search = AsyncMock(return_value=[sr1, sr2])

        mock_bge = MagicMock()
        mock_bge.rerank = MagicMock(return_value=[(1, 0.9), (0, 0.7)])

        with patch("memory_system.embeddings.BGEReranker", return_value=mock_bge):
            results = await system.search("query")
            assert len(results) == 2
            assert results[0].rerank_score == 0.9

    async def test_search_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.search("test")


# ===================================================================
# get
# ===================================================================


class TestGet:
    async def test_cache_hit(self, system):
        mem = _make_memory()
        system._cache.get_memory = AsyncMock(return_value=mem.model_dump(mode="json"))

        result = await system.get(mem.id, MemoryTier.PROJECT)
        assert result is not None
        assert result.content == "Test memory content"
        system._weaviate.get_memory.assert_not_awaited()

    async def test_cache_miss(self, system):
        mem = _make_memory()
        system._cache.get_memory = AsyncMock(return_value=None)
        system._weaviate.get_memory = AsyncMock(return_value=mem)

        result = await system.get(mem.id, MemoryTier.PROJECT)
        assert result is not None
        system._cache.set_memory.assert_awaited_once()

    async def test_string_id_conversion(self, system):
        mem = _make_memory()
        system._cache.get_memory = AsyncMock(return_value=None)
        system._weaviate.get_memory = AsyncMock(return_value=mem)

        result = await system.get(str(mem.id), MemoryTier.PROJECT)
        assert result is not None

    async def test_get_not_found(self, system):
        system._cache.get_memory = AsyncMock(return_value=None)
        system._weaviate.get_memory = AsyncMock(return_value=None)

        result = await system.get(uuid4(), MemoryTier.PROJECT)
        assert result is None


# ===================================================================
# list_memories
# ===================================================================


class TestListMemories:
    async def test_basic_list(self, system):
        mem = _make_memory()
        system._weaviate.list_memories = AsyncMock(return_value=([mem], 1))

        memories, total = await system.list_memories()
        assert len(memories) == 1
        assert total == 1

    async def test_list_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.list_memories()


# ===================================================================
# delete
# ===================================================================


class TestDelete:
    async def test_delete_success(self, system):
        mid = uuid4()
        system._weaviate.delete_memory = AsyncMock(return_value=True)

        result = await system.delete(mid, MemoryTier.PROJECT)
        assert result is True
        system._cache.delete_memory.assert_awaited_once()
        system._cache.invalidate_stats.assert_awaited_once()

    async def test_delete_failure(self, system):
        mid = uuid4()
        system._weaviate.delete_memory = AsyncMock(return_value=False)

        result = await system.delete(mid, MemoryTier.PROJECT)
        assert result is False
        system._cache.delete_memory.assert_not_awaited()

    async def test_delete_string_id(self, system):
        mid = uuid4()
        system._weaviate.delete_memory = AsyncMock(return_value=True)

        result = await system.delete(str(mid), MemoryTier.PROJECT)
        assert result is True


# ===================================================================
# get_stats
# ===================================================================


class TestGetStats:
    async def test_cached_stats(self, system):
        cached = {
            "total_memories": 42,
            "tier1_count": 20,
            "tier2_count": 15,
            "tier3_count": 7,
            "by_type": {},
            "by_project": {},
            "oldest_memory": None,
            "newest_memory": None,
            "avg_importance": 0.5,
        }
        system._cache.get_stats = AsyncMock(return_value=cached)

        result = await system.get_stats()
        assert isinstance(result, MemoryStats)
        assert result.total_memories == 42
        system._weaviate.get_stats.assert_not_awaited()

    async def test_uncached_stats(self, system):
        system._cache.get_stats = AsyncMock(return_value=None)
        stats = MemoryStats(total_memories=10, tier1_count=5, tier2_count=3, tier3_count=2)
        system._weaviate.get_stats = AsyncMock(return_value=stats)

        result = await system.get_stats()
        assert result.total_memories == 10
        system._cache.set_stats.assert_awaited_once()


# ===================================================================
# consolidate
# ===================================================================


class TestConsolidate:
    async def test_consolidate_with_candidates(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        mems = [
            _make_memory(content=f"Fact {i}", memory_type=MemoryType.FACT)
            for i in range(4)
        ]
        # First call for consolidation, second for promotion
        system._weaviate.find_consolidation_candidates = AsyncMock(
            side_effect=[mems, []]
        )
        system._weaviate.add_memory = AsyncMock(return_value=uuid4())

        result = await system.consolidate(project_id="proj")
        assert result == 4  # 4 memories processed
        system._weaviate.add_memory.assert_awaited()
        system._cache.invalidate_stats.assert_awaited()

    async def test_consolidate_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.consolidate()

    async def test_consolidate_no_candidates(self, system):
        system._weaviate.find_consolidation_candidates = AsyncMock(
            side_effect=[[], []]
        )

        result = await system.consolidate()
        assert result == 0

    async def test_consolidate_with_promotion(self, system):
        system._cache.get_embedding = AsyncMock(return_value=None)
        system._nomic_embedder = None
        system._embedding_client = None

        high_importance = _make_memory(importance=0.9)
        system._weaviate.find_consolidation_candidates = AsyncMock(
            side_effect=[[], [high_importance]]  # No consolidation, 1 promotion
        )
        system._weaviate.add_memory = AsyncMock(return_value=uuid4())

        result = await system.consolidate()
        assert result == 1  # 1 promoted


# ===================================================================
# cleanup_expired
# ===================================================================


class TestCleanupExpired:
    async def test_cleanup_expired(self, system):
        system._weaviate.delete_expired_memories = AsyncMock(
            side_effect=[2, 1, 0]  # One call per tier
        )

        result = await system.cleanup_expired()
        assert result == 3
        system._cache.invalidate_stats.assert_awaited()

    async def test_cleanup_expired_nothing_deleted(self, system):
        system._weaviate.delete_expired_memories = AsyncMock(return_value=0)

        result = await system.cleanup_expired()
        assert result == 0
        # invalidate_stats should NOT be called when nothing deleted
        system._cache.invalidate_stats.assert_not_awaited()

    async def test_cleanup_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.cleanup_expired()


# ===================================================================
# build_context & rag_query
# ===================================================================


class TestContextAndRag:
    async def test_build_context(self, system):
        mock_builder = MagicMock()
        mock_builder.build_context = AsyncMock(return_value="Context string")
        system._context_builder = mock_builder

        result = await system.build_context("query", project_id="proj")
        assert result == "Context string"

    async def test_build_context_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.build_context("test")

    async def test_rag_query(self, system):
        mock_rag = MagicMock()
        mock_rag.answer_with_full_context = AsyncMock(return_value={"answer": "test"})
        system._rag = mock_rag

        result = await system.rag_query("question")
        assert result == {"answer": "test"}

    async def test_rag_query_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.rag_query("test")


# ===================================================================
# Tenant management
# ===================================================================


class TestTenants:
    async def test_create_tenant(self, system):
        system._weaviate.create_tenant = AsyncMock(return_value=True)

        result = await system.create_tenant("new-tenant")
        assert result is True

    async def test_delete_tenant_success(self, system):
        system._weaviate.delete_tenant = AsyncMock(return_value=True)

        result = await system.delete_tenant("old-tenant")
        assert result is True
        system._cache.invalidate_stats.assert_awaited_once()

    async def test_delete_tenant_failure(self, system):
        system._weaviate.delete_tenant = AsyncMock(return_value=False)

        result = await system.delete_tenant("missing")
        assert result is False
        system._cache.invalidate_stats.assert_not_awaited()

    async def test_list_tenants(self, system):
        system._weaviate.list_tenants = AsyncMock(return_value=["default", "a"])

        result = await system.list_tenants()
        assert result == ["default", "a"]

    async def test_create_tenant_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.create_tenant("t")

    async def test_delete_tenant_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.delete_tenant("t")

    async def test_list_tenants_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.list_tenants()


# ===================================================================
# close
# ===================================================================


class TestClose:
    async def test_close(self, system):
        await system.close()
        system._weaviate.close.assert_awaited_once()
        system._cache.close.assert_awaited_once()
        assert system._initialized is False


# ===================================================================
# Properties
# ===================================================================


class TestProperties:
    def test_is_initialized_true(self, system):
        assert system.is_initialized is True

    def test_is_initialized_false(self, uninit_system):
        assert uninit_system.is_initialized is False

    def test_is_healthy(self, system):
        system._weaviate.is_connected = True
        system._cache.is_connected = True
        assert system.is_healthy is True

    def test_is_healthy_when_not_initialized(self, uninit_system):
        assert uninit_system.is_healthy is False


# ===================================================================
# _heuristic_consolidation
# ===================================================================


class TestHeuristicConsolidation:
    def test_empty_list(self, system):
        result = system._heuristic_consolidation([], "fact")
        assert result is None

    def test_with_memories(self, system):
        mems = [
            _make_memory(importance=0.6, tags=["python", "testing"]),
            _make_memory(importance=0.8, tags=["python", "code"]),
            _make_memory(importance=0.4, tags=["testing", "debug"]),
        ]
        result = system._heuristic_consolidation(mems, "fact")
        assert result is not None
        assert "3 observations" in result
        assert "60%" in result  # avg importance ~0.6

    def test_common_tags_included(self, system):
        mems = [
            _make_memory(tags=["python", "api"]),
            _make_memory(tags=["python", "api"]),
        ]
        result = system._heuristic_consolidation(mems, "code")
        assert "python" in result
        assert "api" in result

    def test_no_common_tags(self, system):
        mems = [
            _make_memory(tags=["a"]),
            _make_memory(tags=["b"]),
        ]
        result = system._heuristic_consolidation(mems, "fact")
        assert result is not None
        assert "common themes" not in result


# ===================================================================
# Knowledge Graph methods
# ===================================================================


class TestKnowledgeGraph:
    async def test_add_entity(self, system):
        eid = uuid4()
        system._weaviate.add_entity = AsyncMock(return_value=eid)

        result = await system.add_entity(name="TestEntity", entity_type="concept")
        assert result == eid

    async def test_get_entity(self, system):
        entity = KnowledgeEntity(name="Test", entity_type="concept")
        system._weaviate.get_entity = AsyncMock(return_value=entity)

        result = await system.get_entity(entity.id)
        assert result.name == "Test"

    async def test_get_entity_string_id(self, system):
        entity = KnowledgeEntity(name="Test", entity_type="concept")
        system._weaviate.get_entity = AsyncMock(return_value=entity)

        result = await system.get_entity(str(entity.id))
        assert result is not None

    async def test_find_entity_by_name(self, system):
        entity = KnowledgeEntity(name="Python", entity_type="language")
        system._weaviate.find_entity_by_name = AsyncMock(return_value=entity)

        result = await system.find_entity_by_name("Python", project_id="proj")
        assert result.name == "Python"

    async def test_list_entities(self, system):
        entities = [KnowledgeEntity(name="A", entity_type="concept")]
        system._weaviate.list_entities = AsyncMock(return_value=entities)

        result = await system.list_entities(project_id="proj")
        assert len(result) == 1

    async def test_add_relation(self, system):
        rid = uuid4()
        system._weaviate.add_relation = AsyncMock(return_value=rid)

        result = await system.add_relation(
            source_entity_id=uuid4(),
            target_entity_id=uuid4(),
            relation_type="depends_on",
        )
        assert result == rid

    async def test_add_relation_string_ids(self, system):
        rid = uuid4()
        system._weaviate.add_relation = AsyncMock(return_value=rid)

        result = await system.add_relation(
            source_entity_id=str(uuid4()),
            target_entity_id=str(uuid4()),
            relation_type="uses",
        )
        assert result == rid

    async def test_query_graph(self, system):
        entity = KnowledgeEntity(name="Root", entity_type="concept")
        gr = GraphQueryResult(entity=entity, depth_reached=1)
        system._weaviate.query_graph = AsyncMock(return_value=gr)

        result = await system.query_graph(entity.id)
        assert result.entity.name == "Root"

    async def test_query_graph_string_id(self, system):
        entity = KnowledgeEntity(name="Root", entity_type="concept")
        gr = GraphQueryResult(entity=entity, depth_reached=1)
        system._weaviate.query_graph = AsyncMock(return_value=gr)

        result = await system.query_graph(str(entity.id))
        assert result.depth_reached == 1

    async def test_delete_entity(self, system):
        system._weaviate.delete_entity = AsyncMock(return_value=True)

        result = await system.delete_entity(uuid4())
        assert result is True

    async def test_delete_entity_string_id(self, system):
        system._weaviate.delete_entity = AsyncMock(return_value=True)

        result = await system.delete_entity(str(uuid4()))
        assert result is True

    async def test_kg_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            await uninit_system.add_entity(name="x", entity_type="y")


# ===================================================================
# _require_initialized
# ===================================================================


class TestRequireInitialized:
    def test_raises_when_not_initialized(self, uninit_system):
        with pytest.raises(RuntimeError, match="not initialized"):
            uninit_system._require_initialized()

    def test_passes_when_initialized(self, system):
        system._require_initialized()  # Should not raise


# ===================================================================
# _run_assessment
# ===================================================================


class TestRunAssessment:
    async def test_contradiction_flag(self, system):
        system.settings.contradiction_detection_enabled = True
        system.settings.contradiction_action = "flag"
        system.settings.auto_importance_enabled = False

        mem = _make_memory()
        mid = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.contradicts = [uuid4()]
        mock_analysis.importance = None
        mock_analysis.suggested_tags = []

        mock_analyzer = AsyncMock()
        mock_analyzer.analyze = AsyncMock(return_value=mock_analysis)
        system._analyzer = mock_analyzer

        await system._run_assessment(mem, mid)

        system._weaviate.update_memory_metadata.assert_awaited()
        system._weaviate.add_analysis.assert_awaited_once()

    async def test_contradiction_merge(self, system):
        system.settings.contradiction_detection_enabled = True
        system.settings.contradiction_action = "merge"
        system.settings.auto_importance_enabled = False

        mem = _make_memory()
        mid = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.contradicts = [uuid4()]
        mock_analysis.importance = None
        mock_analysis.suggested_tags = []

        mock_analyzer = AsyncMock()
        mock_analyzer.analyze = AsyncMock(return_value=mock_analysis)
        system._analyzer = mock_analyzer

        await system._run_assessment(mem, mid)

        # Should add a resolution memory
        system._weaviate.add_memory.assert_awaited()

    async def test_auto_importance(self, system):
        system.settings.contradiction_detection_enabled = False
        system.settings.auto_importance_enabled = True
        system.settings.auto_importance_threshold = 0.7

        mem = _make_memory()
        mid = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.contradicts = []
        mock_analysis.importance = 0.85
        mock_analysis.importance_reasoning = "High value content"
        mock_analysis.suggested_tags = []

        mock_analyzer = AsyncMock()
        mock_analyzer.analyze = AsyncMock(return_value=mock_analysis)
        system._analyzer = mock_analyzer

        await system._run_assessment(mem, mid)

        system._weaviate.update_memory_fields.assert_awaited()
        system._weaviate.update_memory_metadata.assert_awaited()

    async def test_suggested_tags(self, system):
        system.settings.contradiction_detection_enabled = False
        system.settings.auto_importance_enabled = False

        mem = _make_memory(tags=["existing"])
        mid = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.contradicts = []
        mock_analysis.importance = None
        mock_analysis.suggested_tags = ["python", "testing"]

        mock_analyzer = AsyncMock()
        mock_analyzer.analyze = AsyncMock(return_value=mock_analysis)
        system._analyzer = mock_analyzer

        await system._run_assessment(mem, mid)

        # Should update tags
        call_args = system._weaviate.update_memory_fields.call_args
        new_tags = call_args[1]["fields"]["tags"]
        assert "existing" in new_tags
        assert "python" in new_tags
        assert "testing" in new_tags

    async def test_assessment_error_handled(self, system):
        """Assessment failure should not raise — it's fire-and-forget."""
        mock_analyzer = AsyncMock()
        mock_analyzer.analyze = AsyncMock(side_effect=Exception("Analysis failed"))
        system._analyzer = mock_analyzer

        mem = _make_memory()
        mid = uuid4()

        # Should not raise
        await system._run_assessment(mem, mid)


# ===================================================================
# _ai_enrich_memory
# ===================================================================


class TestAiEnrichMemory:
    async def test_enrich_with_importance_and_summary(self, system):
        system.settings.auto_importance_enabled = True
        mock_ollama = AsyncMock()
        mock_ollama.score_importance = AsyncMock(return_value=(0.9, "Very important"))
        mock_ollama.summarize = AsyncMock(return_value="Short summary")
        system._ollama = mock_ollama

        mem = _make_memory(content="A" * 250)  # >200 chars
        mid = uuid4()

        await system._ai_enrich_memory(mid, mem)

        system._weaviate.update_memory_metadata.assert_awaited()
        system._weaviate.update_memory_fields.assert_awaited()

    async def test_enrich_no_ollama(self, system):
        """Should return early when _ollama is None."""
        system._ollama = None
        mem = _make_memory(content="A" * 250)

        await system._ai_enrich_memory(uuid4(), mem)
        system._weaviate.update_memory_fields.assert_not_awaited()

    async def test_enrich_error_handled(self, system):
        mock_ollama = AsyncMock()
        mock_ollama.score_importance = AsyncMock(side_effect=Exception("Ollama down"))
        system._ollama = mock_ollama
        system.settings.auto_importance_enabled = True

        mem = _make_memory(content="A" * 250)

        # Should not raise
        await system._ai_enrich_memory(uuid4(), mem)


# ===================================================================
# _check_contradiction_sync
# ===================================================================


class TestCheckContradictionSync:
    async def test_contradiction_found(self, system):
        conflict_id = uuid4()
        existing = _make_memory(
            id=conflict_id,
            content="Python is not a compiled language at all ever",
            project_id="proj",
        )
        system._weaviate.find_consolidation_candidates = AsyncMock(return_value=[existing])

        new_mem = _make_memory(
            content="Python is a compiled language for sure definitely",
            project_id="proj",
        )

        result = await system._check_contradiction_sync(new_mem, "proj")
        assert result == conflict_id

    async def test_no_contradiction(self, system):
        existing = _make_memory(
            content="Python is a great language for scripting",
            project_id="proj",
        )
        system._weaviate.find_consolidation_candidates = AsyncMock(return_value=[existing])

        new_mem = _make_memory(
            content="JavaScript is used for web development frontend backend",
            project_id="proj",
        )

        result = await system._check_contradiction_sync(new_mem, "proj")
        assert result is None

    async def test_contradiction_check_handles_error(self, system):
        system._weaviate.find_consolidation_candidates = AsyncMock(
            side_effect=Exception("DB error")
        )

        new_mem = _make_memory(content="Some content")
        result = await system._check_contradiction_sync(new_mem, "proj")
        assert result is None
