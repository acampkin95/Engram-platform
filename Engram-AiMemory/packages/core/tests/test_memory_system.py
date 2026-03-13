"""
Integration tests for the AI Memory System.

Run with: pytest packages/core/tests/ -v
"""

import asyncio
from uuid import uuid4

import pytest

from memory_system import MemorySystem, MemoryTier, MemoryType, MemorySource


@pytest.fixture
async def memory_system():
    """Create a memory system for testing."""
    # Use test configuration
    system = MemorySystem()
    # Note: In real tests, you'd mock Weaviate and Redis
    yield system
    await system.close()


class TestMemoryModels:
    """Tests for memory data models."""

    def test_memory_creation(self):
        """Test creating a memory object."""
        from memory_system.memory import Memory

        memory = Memory(
            content="Test memory content",
            tier=MemoryTier.PROJECT,
            memory_type=MemoryType.FACT,
            project_id="test-project",
        )

        assert memory.content == "Test memory content"
        assert memory.tier == MemoryTier.PROJECT
        assert memory.memory_type == MemoryType.FACT
        assert memory.project_id == "test-project"
        assert memory.id is not None

    def test_memory_with_metadata(self):
        """Test memory with custom metadata."""
        from memory_system.memory import Memory

        memory = Memory(
            content="Test",
            metadata={"key": "value", "nested": {"data": 123}},
        )

        assert memory.metadata["key"] == "value"
        assert memory.metadata["nested"]["data"] == 123

    def test_memory_search_result(self):
        """Test search result model."""
        from memory_system.memory import Memory, MemorySearchResult

        memory = Memory(content="Test")
        result = MemorySearchResult(memory=memory, score=0.95, distance=0.05)

        assert result.score == 0.95
        assert result.distance == 0.05
        assert result.memory.content == "Test"


class TestMemoryQuery:
    """Tests for memory query model."""

    def test_query_creation(self):
        """Test creating a memory query."""
        from memory_system.memory import MemoryQuery

        query = MemoryQuery(
            query="search term",
            tier=MemoryTier.PROJECT,
            limit=20,
        )

        assert query.query == "search term"
        assert query.tier == MemoryTier.PROJECT
        assert query.limit == 20

    def test_query_with_filters(self):
        """Test query with multiple filters."""
        from memory_system.memory import MemoryQuery

        query = MemoryQuery(
            query="test",
            project_id="proj-123",
            user_id="user-456",
            tags=["important", "code"],
            min_importance=0.5,
        )

        assert query.project_id == "proj-123"
        assert query.user_id == "user-456"
        assert query.tags == ["important", "code"]
        assert query.min_importance == 0.5


class TestConfiguration:
    """Tests for configuration management."""

    def test_default_settings(self):
        """Test default configuration values."""
        from memory_system.config import Settings

        settings = Settings()

        assert settings.weaviate_url == "http://localhost:8080"
        assert settings.redis_url == "redis://localhost:6379"
        assert settings.default_memory_tier == 1
        assert settings.multi_tenancy_enabled is True

    def test_settings_validation(self):
        """Test settings validation."""
        from pydantic import ValidationError
        from memory_system.config import Settings

        # Invalid tier
        with pytest.raises(ValidationError):
            Settings(default_memory_tier=5)

        # Invalid dimensions
        with pytest.raises(ValidationError):
            Settings(embedding_dimensions=64)


class TestMemoryStats:
    """Tests for memory statistics."""

    def test_empty_stats(self):
        """Test empty statistics."""
        from memory_system.memory import MemoryStats

        stats = MemoryStats()

        assert stats.total_memories == 0
        assert stats.tier1_count == 0
        assert stats.tier2_count == 0
        assert stats.tier3_count == 0


class TestCompatibilityLayer:
    """Tests for memory file compatibility."""

    def test_claude_md_parsing(self):
        """Test CLAUDE.md file parsing."""
        from memory_system.compat import ClaudeMDFile, MemoryFileType
        from pathlib import Path

        content = """# Project Instructions

This is the main project context.

## Code Patterns

Use TypeScript for all new files.

## Key Decisions

- Use PostgreSQL for storage
- Implement caching with Redis
"""
        file = ClaudeMDFile(
            path=Path("/test/CLAUDE.md"),
            content=content,
            file_type=MemoryFileType.CLAUDE_MD,
        )

        memories = file.to_memories()

        assert len(memories) >= 2
        assert any("Project Instructions" in m["content"] for m in memories)
        assert any("Code Patterns" in m["content"] for m in memories)

    def test_cursor_rules_parsing(self):
        """Test .cursorrules file parsing."""
        from memory_system.compat import CursorRulesFile, MemoryFileType
        from pathlib import Path

        content = """# TypeScript Rules

Always use strict mode.

---

# React Rules

Use functional components only.
"""
        file = CursorRulesFile(
            path=Path("/test/.cursorrules"),
            content=content,
            file_type=MemoryFileType.CURSOR_RULES,
        )

        memories = file.to_memories()

        assert len(memories) >= 2
        assert any("TypeScript Rules" in m["content"] for m in memories)

    def test_claude_settings_parsing(self):
        """Test .claude/settings.json parsing."""
        from memory_system.compat import ClaudeSettingsFile, MemoryFileType
        from pathlib import Path

        content = """{
            "preferences": {
                "language": "TypeScript",
                "framework": "Next.js"
            },
            "customInstructions": "Always write tests."
        }"""
        file = ClaudeSettingsFile(
            path=Path("/test/.claude/settings.json"),
            content=content,
            file_type=MemoryFileType.CLAUDE_SETTINGS,
        )

        memories = file.to_memories()

        assert len(memories) >= 2
        assert any("preferences" in m["content"].lower() for m in memories)
        assert any("custom instructions" in m["content"].lower() for m in memories)


class TestRedisCache:
    """Tests for Redis caching layer."""

    def test_cache_key_generation(self):
        """Test cache key generation."""
        from memory_system.cache import RedisCache

        cache = RedisCache()

        # Embedding key
        key = cache._embedding_key("abc123")
        assert key == "emb:abc123"

        # Memory key
        key = cache._memory_key("mem-456", 1)
        assert key == "mem:1:mem-456"

        # Session key
        key = cache._session_key("sess-789")
        assert key == "sess:sess-789"


class TestWeaviateClient:
    """Tests for Weaviate client."""

    def test_tier_collection_mapping(self):
        """Test tier to collection mapping."""
        from memory_system.client import WeaviateMemoryClient
        from memory_system.memory import MemoryTier

        client = WeaviateMemoryClient()

        assert client.TIER_COLLECTIONS[MemoryTier.PROJECT] == "MemoryProject"
        assert client.TIER_COLLECTIONS[MemoryTier.GENERAL] == "MemoryGeneral"
        assert client.TIER_COLLECTIONS[MemoryTier.GLOBAL] == "MemoryGlobal"


# Async tests that would require actual Weaviate/Redis connections
@pytest.mark.asyncio
class TestMemorySystemIntegration:
    """Integration tests requiring actual services."""

    async def test_add_and_search_memory(self, memory_system):
        """Test adding and searching for a memory."""
        # This test would require running Weaviate and Redis
        pytest.skip("Requires running Weaviate and Redis services")

        # Example of what the test would look like:
        # await memory_system.initialize()
        #
        # memory_id = await memory_system.add(
        #     content="Test memory for search",
        #     tier=MemoryTier.PROJECT,
        #     project_id="test-project",
        # )
        #
        # results = await memory_system.search(
        #     query="test search",
        #     project_id="test-project",
        # )
        #
        # assert len(results) >= 1
        # assert results[0].memory.id == memory_id

    async def test_multi_tenant_isolation(self, memory_system):
        """Test that tenants are properly isolated."""
        pytest.skip("Requires running Weaviate and Redis services")

    async def test_cache_invalidation(self, memory_system):
        """Test cache invalidation on memory updates."""
        pytest.skip("Requires running Weaviate and Redis services")


class TestAPIEndpoints:
    """Tests for FastAPI endpoints."""

    def test_health_response_model(self):
        """Test health response model."""
        from memory_system.api import HealthResponse

        response = HealthResponse(
            status="healthy",
            weaviate=True,
            redis=True,
            initialized=True,
        )

        assert response.status == "healthy"
        assert response.weaviate is True

    def test_add_memory_request_validation(self):
        """Test add memory request validation."""
        from memory_system.api import AddMemoryRequest
        from pydantic import ValidationError

        # Valid request
        req = AddMemoryRequest(content="Test content")
        assert req.content == "Test content"
        assert req.tier == 1  # Default

        # Invalid tier
        with pytest.raises(ValidationError):
            AddMemoryRequest(content="Test", tier=5)

        # Empty content
        with pytest.raises(ValidationError):
            AddMemoryRequest(content="")

    def test_search_request_validation(self):
        """Test search request validation."""
        from memory_system.api import SearchRequest
        from pydantic import ValidationError

        # Valid request
        req = SearchRequest(query="search term")
        assert req.query == "search term"
        assert req.limit == 10  # Default

        # Invalid limit
        with pytest.raises(ValidationError):
            SearchRequest(query="test", limit=200)


class TestMCPServerTools:
    """Tests for MCP server tool schemas (validated via JSON)."""

    def test_add_memory_tool_schema(self):
        """Test add_memory tool schema structure."""
        import json
        from pathlib import Path

        # Read the TypeScript tool definitions as JSON reference
        tools_path = (
            Path(__file__).parent.parent.parent / "mcp-server" / "src" / "tools" / "memory-tools.ts"
        )
        assert tools_path.exists(), f"MCP tools file not found: {tools_path}"

        content = tools_path.read_text()
        # Verify the tool definition exists in the source
        assert '"add_memory"' in content
        assert '"content"' in content

    def test_search_memory_tool_schema(self):
        """Test search_memory tool schema structure."""
        from pathlib import Path

        tools_path = (
            Path(__file__).parent.parent.parent / "mcp-server" / "src" / "tools" / "memory-tools.ts"
        )
        assert tools_path.exists(), f"MCP tools file not found: {tools_path}"

        content = tools_path.read_text()
        assert '"search_memory"' in content
        assert '"query"' in content


class TestAPIErrorHandling:
    """Tests for API error handling."""

    def test_add_memory_empty_content(self):
        """Test that empty content raises validation error."""
        from memory_system.api import AddMemoryRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            AddMemoryRequest(content="")
        assert "String should have at least 1 character" in str(exc_info.value)

    def test_add_memory_invalid_tier(self):
        """Test invalid tier validation."""
        from memory_system.api import AddMemoryRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            AddMemoryRequest(content="test", tier=0)
        assert "Input should be greater than or equal to 1" in str(exc_info.value)

    def test_add_memory_invalid_importance(self):
        """Test importance bounds validation."""
        from memory_system.api import AddMemoryRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            AddMemoryRequest(content="test", importance=1.5)

    def test_search_invalid_limit(self):
        """Test search limit bounds validation."""
        from memory_system.api import SearchRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            SearchRequest(query="test", limit=0)
        assert "Input should be greater than or equal to 1" in str(exc_info.value)


class TestCacheMethods:
    """Tests for Redis cache methods."""

    def test_cache_ttl_constants(self):
        """Test cache TTL constants are defined."""
        from datetime import timedelta
        from memory_system.cache import RedisCache

        assert RedisCache.EMBEDDING_TTL == timedelta(days=7)
        assert RedisCache.SEARCH_TTL == timedelta(hours=1)
        assert RedisCache.MEMORY_TTL == timedelta(hours=24)

    def test_search_key_generation(self):
        """Test search key generation is deterministic."""
        from memory_system.cache import RedisCache
        from memory_system.memory import MemoryQuery, MemoryTier

        cache = RedisCache()
        query = MemoryQuery(query="test", tier=MemoryTier.PROJECT, limit=10)

        key1 = cache._search_key(query)
        key2 = cache._search_key(query)

        assert key1 == key2
        assert key1.startswith("search:")

    def test_memory_key_generation(self):
        """Test memory key includes tier."""
        from memory_system.cache import RedisCache

        cache = RedisCache()

        key1 = cache._memory_key("abc123", 1)
        key2 = cache._memory_key("abc123", 2)

        assert key1 == "mem:1:abc123"
        assert key2 == "mem:2:abc123"


class TestMemorySystemErrors:
    """Tests for MemorySystem error handling."""

    @pytest.mark.asyncio
    async def test_add_before_initialize_raises(self):
        """Test that add() raises if not initialized."""
        from memory_system.system import MemorySystem

        system = MemorySystem()

        with pytest.raises(RuntimeError) as exc_info:
            await system.add(content="test")

        assert "not initialized" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_search_before_initialize_raises(self):
        """Test that search() raises if not initialized."""
        from memory_system.system import MemorySystem

        system = MemorySystem()

        with pytest.raises(RuntimeError) as exc_info:
            await system.search(query="test")

        assert "not initialized" in str(exc_info.value).lower()

    def test_system_properties_before_init(self):
        """Test system properties before initialization."""
        from memory_system.system import MemorySystem

        system = MemorySystem()

        # These should return False before init
        assert system.is_initialized is False
        assert system.is_healthy is False


class TestMemoryTierEnum:
    """Tests for MemoryTier enum."""

    def test_tier_values(self):
        """Test tier enum values."""
        from memory_system.memory import MemoryTier

        assert MemoryTier.PROJECT.value == 1
        assert MemoryTier.GENERAL.value == 2
        assert MemoryTier.GLOBAL.value == 3

    def test_tier_from_int(self):
        """Test tier conversion from int."""
        from memory_system.memory import MemoryTier

        assert MemoryTier(1) == MemoryTier.PROJECT
        assert MemoryTier(2) == MemoryTier.GENERAL
        assert MemoryTier(3) == MemoryTier.GLOBAL


class TestMemoryTypeEnum:
    """Tests for MemoryType enum."""

    def test_default_memory_types(self):
        """Test default memory types exist."""
        from memory_system.memory import MemoryType

        assert hasattr(MemoryType, "FACT")
        assert hasattr(MemoryType, "INSIGHT")
        assert hasattr(MemoryType, "CODE")
        assert hasattr(MemoryType, "CONVERSATION")

    def test_memory_type_values(self):
        """Test memory type enum values."""
        from memory_system.memory import MemoryType

        assert MemoryType.FACT.value == "fact"
        assert MemoryType.CODE.value == "code"
        assert MemoryType.INSIGHT.value == "insight"


class TestAPIHelpers:
    """Tests for API helper functions."""

    def test_tier_from_int(self):
        """Test tier conversion helper."""
        from memory_system.api import _tier_from_int

        assert _tier_from_int(1).name == "PROJECT"
        assert _tier_from_int(2).name == "GENERAL"
        assert _tier_from_int(3).name == "GLOBAL"

    def test_type_from_str_valid(self):
        """Test memory type conversion with valid input."""
        from memory_system.api import _type_from_str

        assert _type_from_str("fact").name == "FACT"
        assert _type_from_str("CODE").name == "CODE"
        assert _type_from_str("insight").name == "INSIGHT"

    def test_type_from_str_invalid(self):
        """Test memory type conversion with invalid input defaults to FACT."""
        from memory_system.api import _type_from_str

        result = _type_from_str("invalid_type")
        assert result.name == "FACT"

    def test_source_from_str_valid(self):
        """Test source conversion with valid input."""
        from memory_system.api import _source_from_str

        assert _source_from_str("agent").name == "AGENT"
        assert _source_from_str("USER").name == "USER"

    def test_source_from_str_invalid(self):
        """Test source conversion with invalid input defaults to AGENT."""
        from memory_system.api import _source_from_str

        result = _source_from_str("invalid")
        assert result.name == "AGENT"


class TestBatchAddRequestModel:
    """Tests for BatchAddRequest validation."""

    def test_batch_add_request_valid(self):
        """Test valid batch request with multiple memories."""
        from memory_system.api import BatchAddRequest, AddMemoryRequest

        req = BatchAddRequest(
            memories=[
                AddMemoryRequest(content="Memory 1"),
                AddMemoryRequest(content="Memory 2"),
                AddMemoryRequest(content="Memory 3"),
            ]
        )

        assert len(req.memories) == 3
        assert req.memories[0].content == "Memory 1"

    def test_batch_add_request_single_memory(self):
        """Test batch request with exactly one memory (minimum)."""
        from memory_system.api import BatchAddRequest, AddMemoryRequest

        req = BatchAddRequest(memories=[AddMemoryRequest(content="Single")])
        assert len(req.memories) == 1

    def test_batch_add_request_empty_list_rejected(self):
        """Test that empty memories list is rejected."""
        from memory_system.api import BatchAddRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            BatchAddRequest(memories=[])

    def test_batch_add_request_over_100_rejected(self):
        """Test that more than 100 memories is rejected."""
        from memory_system.api import BatchAddRequest, AddMemoryRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            BatchAddRequest(memories=[AddMemoryRequest(content=f"Mem {i}") for i in range(101)])

    def test_batch_add_request_exactly_100_accepted(self):
        """Test that exactly 100 memories is accepted."""
        from memory_system.api import BatchAddRequest, AddMemoryRequest

        req = BatchAddRequest(memories=[AddMemoryRequest(content=f"Mem {i}") for i in range(100)])
        assert len(req.memories) == 100

    def test_batch_add_request_inherits_per_memory_validation(self):
        """Test that individual memory validation still applies in batch."""
        from memory_system.api import BatchAddRequest, AddMemoryRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            BatchAddRequest(
                memories=[AddMemoryRequest(content="")]  # Empty content invalid
            )


class TestBatchAddResponseModel:
    """Tests for BatchAddResponse model."""

    def test_batch_add_response_all_successful(self):
        """Test response when all memories succeed."""
        from memory_system.api import BatchAddResponse

        resp = BatchAddResponse(
            memory_ids=["id-1", "id-2", "id-3"],
            failed=0,
            total=3,
        )

        assert len(resp.memory_ids) == 3
        assert resp.failed == 0
        assert resp.total == 3

    def test_batch_add_response_partial_failure(self):
        """Test response with some failures."""
        from memory_system.api import BatchAddResponse

        resp = BatchAddResponse(
            memory_ids=["id-1", "id-2"],
            failed=1,
            total=3,
        )

        assert len(resp.memory_ids) == 2
        assert resp.failed == 1
        assert resp.total == 3


class TestBatchSystemErrors:
    """Tests for MemorySystem.add_batch error handling."""

    @pytest.mark.asyncio
    async def test_add_batch_before_initialize_raises(self):
        """Test that add_batch raises if not initialized."""
        from memory_system.system import MemorySystem

        system = MemorySystem()

        with pytest.raises(RuntimeError) as exc_info:
            await system.add_batch([{"content": "test memory"}])

        assert "not initialized" in str(exc_info.value).lower()


class TestClientPropertyExtraction:
    """Tests for client _memory_to_properties helper."""

    def test_memory_to_properties_basic(self):
        """Test basic memory to properties conversion."""
        from memory_system.client import WeaviateMemoryClient
        from memory_system.memory import Memory, MemoryTier, MemoryType, MemorySource

        client = WeaviateMemoryClient()
        memory = Memory(
            content="Test content",
            tier=MemoryTier.PROJECT,
            memory_type=MemoryType.FACT,
            source=MemorySource.AGENT,
            project_id="proj-1",
            tenant_id="tenant-1",
            importance=0.8,
            confidence=0.9,
            tags=["tag1", "tag2"],
        )

        props = client._memory_to_properties(memory)

        assert props["content"] == "Test content"
        assert props["project_id"] == "proj-1"
        assert props["tenant_id"] == "tenant-1"
        assert props["importance"] == 0.8
        assert props["confidence"] == 0.9
        assert props["tags"] == ["tag1", "tag2"]

    def test_memory_to_properties_optional_fields(self):
        """Test properties for memory with missing optional fields."""
        from memory_system.client import WeaviateMemoryClient
        from memory_system.memory import Memory

        client = WeaviateMemoryClient()
        memory = Memory(content="Minimal memory")

        props = client._memory_to_properties(memory)

        assert props["content"] == "Minimal memory"
        assert props["summary"] == ""
        assert props["project_id"] == ""
        assert props["user_id"] == ""
        assert props["session_id"] == ""
        assert props["parent_memory_id"] == ""


class TestConsolidationConfig:
    """Tests for consolidation configuration fields."""

    def test_consolidation_defaults(self):
        """Test consolidation settings have correct defaults."""
        from memory_system.config import Settings

        settings = Settings()

        assert settings.consolidation_min_group_size == 3
        assert settings.consolidation_hours_back == 48
        assert settings.consolidation_confidence == 0.7

    def test_consolidation_custom_values(self):
        """Test consolidation settings accept custom values."""
        from memory_system.config import Settings

        settings = Settings(
            consolidation_min_group_size=5,
            consolidation_hours_back=24,
            consolidation_confidence=0.9,
        )

        assert settings.consolidation_min_group_size == 5
        assert settings.consolidation_hours_back == 24
        assert settings.consolidation_confidence == 0.9


class TestConsolidatedMemoryType:
    """Tests for CONSOLIDATED memory type enum."""

    def test_consolidated_type_exists(self):
        """Test MemoryType has CONSOLIDATED value."""
        from memory_system.memory import MemoryType

        assert hasattr(MemoryType, "CONSOLIDATED")
        assert MemoryType.CONSOLIDATED.value == "consolidated"

    def test_consolidated_memory_creation(self):
        """Test creating a memory with CONSOLIDATED type."""
        from memory_system.memory import Memory, MemoryType

        memory = Memory(
            content="Consolidated fact from 5 episodes",
            memory_type=MemoryType.CONSOLIDATED,
        )

        assert memory.memory_type == MemoryType.CONSOLIDATED


class TestHeuristicConsolidation:
    """Tests for heuristic consolidation logic in MemorySystem."""

    def test_heuristic_produces_fact_string(self):
        """Test heuristic consolidation returns a non-empty fact."""
        from memory_system.memory import Memory, MemoryType

        memories = [
            Memory(
                content="Use async patterns for DB calls",
                memory_type=MemoryType.FACT,
                tags=["database", "async"],
                importance=0.7,
                confidence=0.9,
            ),
            Memory(
                content="Always use async for external API calls",
                memory_type=MemoryType.FACT,
                tags=["async", "api"],
                importance=0.6,
                confidence=0.85,
            ),
            Memory(
                content="Async DB patterns improve throughput",
                memory_type=MemoryType.FACT,
                tags=["database", "async", "performance"],
                importance=0.8,
                confidence=0.95,
            ),
        ]

        from memory_system.system import MemorySystem

        system = MemorySystem()
        fact = system._heuristic_consolidation(memories, "fact")

        assert fact is not None
        assert len(fact) > 0
        assert "fact" in fact.lower()

    def test_heuristic_includes_tag_frequency(self):
        """Test heuristic consolidation reports common tags."""
        from memory_system.memory import Memory, MemoryType

        memories = [
            Memory(content="A", memory_type=MemoryType.FACT, tags=["python", "async"]),
            Memory(content="B", memory_type=MemoryType.FACT, tags=["python", "typing"]),
            Memory(content="C", memory_type=MemoryType.FACT, tags=["python", "async"]),
        ]

        from memory_system.system import MemorySystem

        system = MemorySystem()
        fact = system._heuristic_consolidation(memories, "fact")

        # "python" appears 3 times, "async" appears 2 times — both should be mentioned
        assert "python" in fact
        assert "async" in fact

    def test_heuristic_includes_average_importance(self):
        """Test heuristic includes average importance score."""
        from memory_system.memory import Memory, MemoryType

        memories = [
            Memory(content="A", memory_type=MemoryType.FACT, importance=0.6),
            Memory(content="B", memory_type=MemoryType.FACT, importance=0.8),
            Memory(content="C", memory_type=MemoryType.FACT, importance=1.0),
        ]

        from memory_system.system import MemorySystem

        system = MemorySystem()
        fact = system._heuristic_consolidation(memories, "fact")

        # Average is 0.8 → should appear as "80%"
        assert "80%" in fact

    def test_heuristic_empty_memories_returns_none(self):
        """Test heuristic returns None for empty input."""
        from memory_system.system import MemorySystem

        system = MemorySystem()
        fact = system._heuristic_consolidation([], "fact")

        assert fact is None


class TestContextBuilderPureFunctions:
    """Tests for ContextBuilder pure functions (no async, no MemorySystem)."""

    def test_estimate_tokens_empty(self):
        from memory_system.context import ContextBuilder

        system = MemorySystem()
        builder = ContextBuilder(system)
        assert builder.estimate_tokens("") == 0

    def test_estimate_tokens_known_length(self):
        from memory_system.context import ContextBuilder

        system = MemorySystem()
        builder = ContextBuilder(system)
        assert builder.estimate_tokens("a" * 400) == 100

    def test_estimate_tokens_short_text(self):
        from memory_system.context import ContextBuilder

        system = MemorySystem()
        builder = ContextBuilder(system)
        assert builder.estimate_tokens("hi") == 0

    def test_compress_memory_project_tier(self):
        from memory_system.context import ContextBuilder
        from memory_system.memory import Memory, MemoryTier, MemoryType

        system = MemorySystem()
        builder = ContextBuilder(system)
        memory = Memory(
            content="Use async patterns for DB",
            tier=MemoryTier.PROJECT,
            memory_type=MemoryType.FACT,
            importance=0.9,
            tags=["database", "async"],
        )
        compressed = builder.compress_memory(memory)

        assert "[P/fact]" in compressed
        assert "Use async patterns" in compressed
        assert "(imp:0.9)" in compressed
        assert "#database,async" in compressed

    def test_compress_memory_general_tier(self):
        from memory_system.context import ContextBuilder
        from memory_system.memory import Memory, MemoryTier, MemoryType

        system = MemorySystem()
        builder = ContextBuilder(system)
        memory = Memory(
            content="General knowledge item",
            tier=MemoryTier.GENERAL,
            memory_type=MemoryType.INSIGHT,
            importance=0.5,
        )
        compressed = builder.compress_memory(memory)

        assert "[G/insight]" in compressed
        assert "(imp:" not in compressed

    def test_compress_memory_global_tier(self):
        from memory_system.context import ContextBuilder
        from memory_system.memory import Memory, MemoryTier, MemoryType

        system = MemorySystem()
        builder = ContextBuilder(system)
        memory = Memory(
            content="Global best practice",
            tier=MemoryTier.GLOBAL,
            memory_type=MemoryType.FACT,
            importance=0.3,
        )
        compressed = builder.compress_memory(memory)

        assert "[GL/fact]" in compressed

    def test_compress_memory_truncates_long_content(self):
        from memory_system.context import ContextBuilder
        from memory_system.memory import Memory

        system = MemorySystem()
        builder = ContextBuilder(system)
        memory = Memory(content="x" * 500)
        compressed = builder.compress_memory(memory)

        assert len(compressed) < 500


class TestConversationMemoryManager:
    """Tests for ConversationMemoryManager."""

    def test_add_message(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager()
        mgr.add_message("user", "Hello world")

        assert len(mgr._history) == 1
        assert mgr._history[0]["role"] == "user"
        assert mgr._history[0]["content"] == "Hello world"

    def test_total_tokens(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager()
        mgr.add_message("user", "a" * 400)

        assert mgr.total_tokens == 100

    def test_should_compact_false_when_under_budget(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager(max_context_tokens=4000)
        mgr.add_message("user", "short message")

        assert mgr.should_compact is False

    def test_compact_moves_old_to_summary(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager(max_context_tokens=4000)
        for i in range(15):
            mgr.add_message("user", f"Message {i} " + "x" * 200)

        mgr.compact()
        assert len(mgr._history) <= 5
        assert len(mgr._summaries) >= 1

    def test_get_context_includes_recent(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager()
        mgr.add_message("user", "Hello")
        mgr.add_message("assistant", "Hi there")

        ctx = mgr.get_context()
        assert "USER: Hello" in ctx
        assert "ASSISTANT: Hi there" in ctx

    def test_clear_resets_state(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager()
        mgr.add_message("user", "msg")
        mgr.clear()

        assert len(mgr._history) == 0
        assert len(mgr._summaries) == 0

    def test_get_last_n_messages(self):
        from memory_system.context import ConversationMemoryManager

        mgr = ConversationMemoryManager()
        for i in range(10):
            mgr.add_message("user", f"msg-{i}")

        last_3 = mgr.get_last_n_messages(3)
        assert len(last_3) == 3
        assert last_3[0]["content"] == "msg-7"


class TestRAGConfigDefaults:
    """Tests for RAG configuration fields."""

    def test_rag_config_defaults(self):
        from memory_system.config import Settings

        settings = Settings()

        assert settings.rag_max_context_tokens == 4000
        assert settings.rag_default_limit == 5
        assert "memories" in settings.rag_synthesis_prompt.lower()

    def test_rag_config_custom_values(self):
        from memory_system.config import Settings

        settings = Settings(
            rag_max_context_tokens=8000,
            rag_default_limit=10,
            rag_synthesis_prompt="Custom prompt for synthesis",
        )

        assert settings.rag_max_context_tokens == 8000
        assert settings.rag_default_limit == 10
        assert settings.rag_synthesis_prompt == "Custom prompt for synthesis"

    def test_rag_limit_bounds(self):
        from memory_system.config import Settings
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Settings(rag_default_limit=0)

        with pytest.raises(ValidationError):
            Settings(rag_default_limit=51)


class TestRAGAPIModels:
    """Tests for RAG API request/response models."""

    def test_context_request_valid(self):
        from memory_system.api import ContextRequest

        req = ContextRequest(query="What patterns exist?")
        assert req.query == "What patterns exist?"
        assert req.tier is None
        assert req.max_tokens is None

    def test_context_request_with_options(self):
        from memory_system.api import ContextRequest

        req = ContextRequest(
            query="search",
            tier=1,
            project_id="proj-1",
            user_id="user-1",
            session_id="sess-1",
            max_tokens=2000,
        )

        assert req.tier == 1
        assert req.project_id == "proj-1"
        assert req.max_tokens == 2000

    def test_context_request_empty_query_rejected(self):
        from memory_system.api import ContextRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ContextRequest(query="")

    def test_context_response_model(self):
        from memory_system.api import ContextResponse

        resp = ContextResponse(
            query="test",
            context="## Relevant Memory Context\n- [P/fact] test",
            token_estimate=12,
        )

        assert resp.query == "test"
        assert resp.token_estimate == 12

    def test_rag_request_valid(self):
        from memory_system.api import RAGRequest

        req = RAGRequest(query="How does auth work?")
        assert req.query == "How does auth work?"

    def test_rag_request_empty_query_rejected(self):
        from memory_system.api import RAGRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RAGRequest(query="")

    def test_rag_response_model(self):
        from memory_system.api import RAGResponse

        resp = RAGResponse(
            query="test",
            mode="context_only",
            synthesis_prompt="Based on these memories...",
            source_count=3,
            context={"formatted_context": "context here", "total_memories": 3},
        )

        assert resp.mode == "context_only"
        assert resp.source_count == 3


class TestMemorySystemRAGErrors:
    """Tests for MemorySystem RAG convenience methods error handling."""

    @pytest.mark.asyncio
    async def test_build_context_before_initialize_raises(self):
        system = MemorySystem()

        with pytest.raises(RuntimeError) as exc_info:
            await system.build_context(query="test")

        assert "not initialized" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_rag_query_before_initialize_raises(self):
        system = MemorySystem()

        with pytest.raises(RuntimeError) as exc_info:
            await system.rag_query(query="test")

        assert "not initialized" in str(exc_info.value).lower()

    def test_lazy_context_builder_init(self):
        system = MemorySystem()
        assert system._context_builder is None

        builder = system._get_context_builder()
        assert builder is not None
        assert system._get_context_builder() is builder

    def test_lazy_rag_init(self):
        system = MemorySystem()
        assert system._rag is None

        rag = system._get_rag()
        assert rag is not None
        assert system._get_rag() is rag


class TestMemoryDecayScoring:
    """Tests for MemoryDecay recency and fitness calculations."""

    def test_brand_new_memory_score_is_one(self):
        from memory_system.decay import MemoryDecay
        from datetime import datetime, timezone

        decay = MemoryDecay(half_life_days=7)
        now = datetime.now(timezone.utc)
        assert decay.calculate_recency_score(now, now) == 1.0

    def test_half_life_gives_half_score(self):
        from memory_system.decay import MemoryDecay
        from datetime import datetime, timedelta, timezone

        decay = MemoryDecay(half_life_days=7)
        now = datetime.now(timezone.utc)
        created = now - timedelta(days=7)
        score = decay.calculate_recency_score(created, now)
        assert abs(score - 0.5) < 0.01

    def test_very_old_memory_near_zero(self):
        from memory_system.decay import MemoryDecay
        from datetime import datetime, timedelta, timezone

        decay = MemoryDecay(half_life_days=7)
        now = datetime.now(timezone.utc)
        created = now - timedelta(days=365)
        score = decay.calculate_recency_score(created, now)
        assert score < 0.01

    def test_future_memory_clamped_to_one(self):
        from memory_system.decay import MemoryDecay
        from datetime import datetime, timedelta, timezone

        decay = MemoryDecay(half_life_days=7)
        now = datetime.now(timezone.utc)
        future = now + timedelta(days=1)
        assert decay.calculate_recency_score(future, now) == 1.0

    def test_custom_half_life(self):
        from memory_system.decay import MemoryDecay
        from datetime import datetime, timedelta, timezone

        decay = MemoryDecay(half_life_days=30)
        now = datetime.now(timezone.utc)
        created = now - timedelta(days=30)
        score = decay.calculate_recency_score(created, now)
        assert abs(score - 0.5) < 0.01

    def test_fitness_high_access_high_importance(self):
        from memory_system.decay import MemoryDecay

        decay = MemoryDecay()
        score = decay.calculate_memory_fitness(access_count=100, importance=0.9, recency_score=0.8)
        assert score > 0.7

    def test_fitness_zero_access_low_importance(self):
        from memory_system.decay import MemoryDecay

        decay = MemoryDecay()
        score = decay.calculate_memory_fitness(access_count=0, importance=0.1, recency_score=0.1)
        assert score < 0.2

    def test_fitness_score_range(self):
        from memory_system.decay import MemoryDecay

        decay = MemoryDecay()
        score = decay.calculate_memory_fitness(access_count=50, importance=0.5, recency_score=0.5)
        assert 0.0 <= score <= 1.0


class TestSearchScoringWeights:
    """Tests for search scoring weight configuration."""

    def test_default_weights_sum_to_one(self):
        from memory_system.config import Settings

        s = Settings()
        total = s.search_similarity_weight + s.search_recency_weight + s.search_importance_weight
        assert abs(total - 1.0) < 0.001

    def test_hybrid_alpha_default(self):
        from memory_system.config import Settings

        s = Settings()
        assert s.hybrid_alpha == 0.7

    def test_decay_half_life_default(self):
        from memory_system.config import Settings

        s = Settings()
        assert s.decay_half_life_days == 30.0  # Updated default: 30 days (was 7)

    def test_custom_weights(self):
        from memory_system.config import Settings

        s = Settings(
            search_similarity_weight=0.6,
            search_recency_weight=0.2,
            search_importance_weight=0.2,
        )
        assert s.search_similarity_weight == 0.6
        assert s.search_recency_weight == 0.2

    def test_hybrid_alpha_bounds(self):
        from memory_system.config import Settings
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Settings(hybrid_alpha=1.5)
        with pytest.raises(ValidationError):
            Settings(hybrid_alpha=-0.1)


class TestMemorySearchResultScores:
    """Tests for MemorySearchResult composite score fields."""

    def test_search_result_score_fields(self):
        from memory_system.memory import Memory, MemorySearchResult

        memory = Memory(content="test")
        result = MemorySearchResult(
            memory=memory,
            score=0.85,
            distance=0.15,
            similarity_score=0.9,
            recency_score=0.8,
            importance_score=0.7,
            composite_score=0.85,
        )
        assert result.similarity_score == 0.9
        assert result.recency_score == 0.8
        assert result.importance_score == 0.7
        assert result.composite_score == 0.85

    def test_search_result_default_scores(self):
        from memory_system.memory import Memory, MemorySearchResult

        memory = Memory(content="test")
        result = MemorySearchResult(memory=memory, score=0.5)
        assert result.similarity_score == 0.0
        assert result.recency_score == 0.0
        assert result.importance_score == 0.0
        assert result.composite_score == 0.0

    def test_memory_access_count_field(self):
        from memory_system.memory import Memory

        memory = Memory(content="test", access_count=5)
        assert memory.access_count == 5

    def test_memory_access_count_default(self):
        from memory_system.memory import Memory

        memory = Memory(content="test")
        assert memory.access_count == 0

    def test_memory_recency_score_field(self):
        from memory_system.memory import Memory

        memory = Memory(content="test", recency_score=0.75)
        assert memory.recency_score == 0.75


class TestRerankerConfig:
    """Tests for reranker configuration fields."""

    def test_reranker_disabled_by_default(self):
        from memory_system.config import Settings

        s = Settings()
        assert s.reranker_enabled is False

    def test_reranker_default_model(self):
        from memory_system.config import Settings

        s = Settings()
        assert "cross-encoder" in s.reranker_model

    def test_reranker_top_k_default(self):
        from memory_system.config import Settings

        s = Settings()
        assert s.reranker_top_k == 20

    def test_reranker_custom_values(self):
        from memory_system.config import Settings

        s = Settings(reranker_enabled=True, reranker_model="custom-model", reranker_top_k=50)
        assert s.reranker_enabled is True
        assert s.reranker_model == "custom-model"
        assert s.reranker_top_k == 50


class TestMemoryRerankerFallback:
    """Tests for MemoryReranker graceful fallback."""

    def test_reranker_returns_results_when_no_model(self):
        from memory_system.decay import MemoryReranker
        from memory_system.memory import Memory, MemorySearchResult

        reranker = MemoryReranker()
        # Model won't load in test env (sentence-transformers not installed)
        memory = Memory(content="test")
        results = [MemorySearchResult(memory=memory, score=0.5, composite_score=0.5)]
        reranked = reranker.rerank("query", results)
        assert len(reranked) == 1
        assert reranked[0].memory.content == "test"

    def test_reranker_empty_results(self):
        from memory_system.decay import MemoryReranker

        reranker = MemoryReranker()
        assert reranker.rerank("query", []) == []


class TestTenantLifecycleErrors:
    """Tests for tenant lifecycle management error handling."""

    @pytest.mark.asyncio
    async def test_create_tenant_before_initialize_raises(self):
        from memory_system.system import MemorySystem

        system = MemorySystem()
        with pytest.raises(RuntimeError) as exc_info:
            await system.create_tenant("test-tenant")
        assert "not initialized" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_delete_tenant_before_initialize_raises(self):
        from memory_system.system import MemorySystem

        system = MemorySystem()
        with pytest.raises(RuntimeError) as exc_info:
            await system.delete_tenant("test-tenant")
        assert "not initialized" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_list_tenants_before_initialize_raises(self):
        from memory_system.system import MemorySystem

        system = MemorySystem()
        with pytest.raises(RuntimeError) as exc_info:
            await system.list_tenants()
        assert "not initialized" in str(exc_info.value).lower()


class TestTenantAPIModels:
    """Tests for tenant management API models."""

    def test_create_tenant_request_valid(self):
        from memory_system.api import CreateTenantRequest

        req = CreateTenantRequest(tenant_id="my-tenant")
        assert req.tenant_id == "my-tenant"

    def test_create_tenant_request_empty_rejected(self):
        from memory_system.api import CreateTenantRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            CreateTenantRequest(tenant_id="")

    def test_tenant_list_response(self):
        from memory_system.api import TenantListResponse

        resp = TenantListResponse(tenants=["tenant-1", "tenant-2"], total=2)
        assert len(resp.tenants) == 2
        assert resp.total == 2


class TestConsolidateCleanupAPIEndpoints:
    """Tests for consolidate and cleanup API endpoints."""

    def test_consolidate_endpoint_exists(self):
        """Verify consolidate endpoint is registered."""
        from memory_system.api import app

        routes = [r.path for r in app.routes]
        assert "/memories/consolidate" in routes

    def test_cleanup_endpoint_exists(self):
        """Verify cleanup endpoint is registered."""
        from memory_system.api import app

        routes = [r.path for r in app.routes]
        assert "/memories/cleanup" in routes


class TestSystemRerankerLazyInit:
    """Tests for MemorySystem reranker lazy initialization."""

    def test_reranker_none_before_access(self):
        from memory_system.system import MemorySystem

        system = MemorySystem()
        assert system._reranker is None

    def test_reranker_lazy_init(self):
        from memory_system.system import MemorySystem

        system = MemorySystem()
        reranker = system._get_reranker()
        assert reranker is not None
        assert system._get_reranker() is reranker  # Same instance


class TestKnowledgeGraphModels:
    """Tests for knowledge graph data models (KnowledgeEntity, KnowledgeRelation, GraphQueryResult)."""

    def test_knowledge_entity_creation(self):
        """KnowledgeEntity is created with required fields and sensible defaults."""
        from memory_system.memory import KnowledgeEntity

        entity = KnowledgeEntity(name="Alice", entity_type="person")

        assert entity.name == "Alice"
        assert entity.entity_type == "person"
        assert entity.id is not None
        assert entity.aliases == []
        assert entity.metadata == {}
        assert entity.tenant_id == "default"

    def test_knowledge_entity_with_aliases(self):
        """KnowledgeEntity stores aliases correctly."""
        from memory_system.memory import KnowledgeEntity

        entity = KnowledgeEntity(
            name="Python",
            entity_type="language",
            aliases=["Python 3", "CPython"],
            description="A programming language",
        )

        assert entity.aliases == ["Python 3", "CPython"]
        assert entity.description == "A programming language"

    def test_knowledge_entity_project_scoped(self):
        """KnowledgeEntity respects project_id scoping."""
        from memory_system.memory import KnowledgeEntity

        entity = KnowledgeEntity(
            name="MyService",
            entity_type="service",
            project_id="proj-123",
            tenant_id="tenant-abc",
        )

        assert entity.project_id == "proj-123"
        assert entity.tenant_id == "tenant-abc"

    def test_knowledge_relation_creation(self):
        """KnowledgeRelation links two entities by UUID."""
        from uuid import uuid4

        from memory_system.memory import KnowledgeRelation

        src_id = uuid4()
        tgt_id = uuid4()
        relation = KnowledgeRelation(
            source_entity_id=src_id,
            target_entity_id=tgt_id,
            relation_type="depends_on",
        )

        assert relation.source_entity_id == src_id
        assert relation.target_entity_id == tgt_id
        assert relation.relation_type == "depends_on"
        assert relation.weight == 1.0
        assert relation.id is not None

    def test_knowledge_relation_weight_bounds(self):
        """KnowledgeRelation rejects weight outside [0, 1]."""
        import pytest

        from memory_system.memory import KnowledgeRelation

        with pytest.raises(Exception):
            KnowledgeRelation(
                source_entity_id=uuid4(),
                target_entity_id=uuid4(),
                relation_type="knows",
                weight=1.5,  # invalid
            )

    def test_knowledge_relation_tenant_isolation(self):
        """KnowledgeRelation carries tenant_id for isolation."""
        from memory_system.memory import KnowledgeRelation

        relation = KnowledgeRelation(
            source_entity_id=uuid4(),
            target_entity_id=uuid4(),
            relation_type="works_on",
            tenant_id="tenant-xyz",
            project_id="proj-456",
        )

        assert relation.tenant_id == "tenant-xyz"
        assert relation.project_id == "proj-456"

    def test_graph_query_result_creation(self):
        """GraphQueryResult holds root entity, neighbors, and relations."""
        from memory_system.memory import GraphQueryResult, KnowledgeEntity, KnowledgeRelation

        root = KnowledgeEntity(name="Root", entity_type="concept")
        neighbor = KnowledgeEntity(name="Neighbor", entity_type="concept")
        rel = KnowledgeRelation(
            source_entity_id=root.id,
            target_entity_id=neighbor.id,
            relation_type="related_to",
        )

        result = GraphQueryResult(
            entity=root,
            neighbors=[neighbor],
            relations=[rel],
            depth_reached=1,
        )

        assert result.entity.name == "Root"
        assert len(result.neighbors) == 1
        assert result.neighbors[0].name == "Neighbor"
        assert len(result.relations) == 1
        assert result.depth_reached == 1

    def test_graph_query_result_empty_defaults(self):
        """GraphQueryResult defaults to empty neighbors/relations at depth 0."""
        from memory_system.memory import GraphQueryResult, KnowledgeEntity

        root = KnowledgeEntity(name="Isolated", entity_type="concept")
        result = GraphQueryResult(entity=root)

        assert result.neighbors == []
        assert result.relations == []
        assert result.depth_reached == 0


class TestGraphAPIModels:
    """Tests for graph API request/response models in api.py."""

    def test_add_entity_request_defaults(self):
        """AddEntityRequest has correct defaults."""
        from memory_system.api import AddEntityRequest

        req = AddEntityRequest(name="TestEntity", entity_type="concept")

        assert req.name == "TestEntity"
        assert req.entity_type == "concept"
        assert req.tenant_id == "default"
        assert req.aliases == []
        assert req.metadata == {}
        assert req.project_id is None
        assert req.description is None

    def test_add_entity_request_name_required(self):
        """AddEntityRequest rejects empty name."""
        import pytest

        from memory_system.api import AddEntityRequest

        with pytest.raises(Exception):
            AddEntityRequest(name="", entity_type="concept")

    def test_add_relation_request_defaults(self):
        """AddRelationRequest has correct defaults."""
        from uuid import uuid4

        from memory_system.api import AddRelationRequest

        req = AddRelationRequest(
            source_entity_id=str(uuid4()),
            target_entity_id=str(uuid4()),
            relation_type="depends_on",
        )

        assert req.weight == 1.0
        assert req.tenant_id == "default"
        assert req.project_id is None
        assert req.context is None

    def test_add_relation_request_weight_validation(self):
        """AddRelationRequest rejects weight outside [0, 1]."""
        import pytest

        from memory_system.api import AddRelationRequest

        with pytest.raises(Exception):
            AddRelationRequest(
                source_entity_id=str(uuid4()),
                target_entity_id=str(uuid4()),
                relation_type="knows",
                weight=2.0,  # invalid
            )

    def test_graph_query_request_defaults(self):
        """GraphQueryRequest has correct defaults."""
        from uuid import uuid4

        from memory_system.api import GraphQueryRequest

        req = GraphQueryRequest(entity_id=str(uuid4()))

        assert req.depth == 1
        assert req.tenant_id == "default"
        assert req.project_id is None

    def test_graph_query_request_depth_bounds(self):
        """GraphQueryRequest rejects depth outside [1, 5]."""
        import pytest

        from memory_system.api import GraphQueryRequest

        with pytest.raises(Exception):
            GraphQueryRequest(entity_id=str(uuid4()), depth=0)

        with pytest.raises(Exception):
            GraphQueryRequest(entity_id=str(uuid4()), depth=6)


class TestGraphSystemDelegates:
    """Tests for MemorySystem graph delegate methods (without live Weaviate)."""

    def test_system_has_graph_methods(self):
        """MemorySystem exposes all required graph delegate methods."""
        from memory_system.system import MemorySystem

        system = MemorySystem()
        assert callable(getattr(system, "add_entity", None))
        assert callable(getattr(system, "get_entity", None))
        assert callable(getattr(system, "find_entity_by_name", None))
        assert callable(getattr(system, "add_relation", None))
        assert callable(getattr(system, "query_graph", None))
        assert callable(getattr(system, "delete_entity", None))

    def test_graph_methods_require_initialization(self):
        """Graph methods raise RuntimeError when system is not initialized."""
        import asyncio

        from memory_system.system import MemorySystem

        system = MemorySystem()

        with pytest.raises(RuntimeError, match="not initialized"):
            asyncio.get_event_loop().run_until_complete(
                system.add_entity(name="X", entity_type="concept")
            )

    def test_knowledge_entity_exported(self):
        """KnowledgeEntity, KnowledgeRelation, GraphQueryResult are exported from package."""
        from memory_system import GraphQueryResult, KnowledgeEntity, KnowledgeRelation

        assert KnowledgeEntity is not None
        assert KnowledgeRelation is not None
        assert GraphQueryResult is not None


class TestMemorySystemModels:
    """Tests for new API request/response models."""

    def test_list_memories_request_validation(self):
        """ListMemoriesRequest validates limit bounds."""
        from pydantic import ValidationError

        # This import will fail until we add the model -- that's the point
        from memory_system.api import ListMemoriesRequest

        req = ListMemoriesRequest(tenant_id="t1", limit=50)
        assert req.limit == 50
        assert req.offset == 0

        with pytest.raises(ValidationError):
            ListMemoriesRequest(tenant_id="t1", limit=0)  # below minimum

    def test_list_entities_response_model(self):
        """ListEntitiesResponse validates correctly."""
        from memory_system.api import ListEntitiesResponse

        resp = ListEntitiesResponse(entities=[], count=0, limit=50, offset=0)
        assert resp.count == 0


class TestListMemoriesPagination:
    """Tests for list_memories pagination fixes.

    These tests verify the two bugs that were fixed:
    1. total is the true count, not the page count
    2. limit/offset applied globally across tiers, not per-tier
    """

    def test_list_memories_response_total_differs_from_page_count(self):
        """ListMemoriesResponse can hold a total that differs from len(memories).

        This validates that the model supports true pagination where total > page size.
        """
        from memory_system.api import ListMemoriesResponse, SearchResult
        from datetime import datetime, timezone

        # Simulate: 200 total memories in the DB, but only 10 returned on this page
        page_items = [
            SearchResult(
                memory_id=f"id-{i}",
                content=f"Memory {i}",
                summary=None,
                tier=1,
                memory_type="fact",
                source="agent",
                project_id=None,
                user_id=None,
                tenant_id="default",
                importance=0.5,
                confidence=1.0,
                tags=[],
                created_at=datetime.now(timezone.utc),
                score=0.0,
                distance=None,
            )
            for i in range(10)
        ]

        resp = ListMemoriesResponse(
            memories=page_items,
            total=200,  # true total across all pages
            limit=10,
            offset=0,
        )

        # total reflects true count, NOT len(memories)
        assert resp.total == 200
        assert len(resp.memories) == 10
        assert resp.total != len(resp.memories)

    def test_list_memories_response_offset_pagination(self):
        """ListMemoriesResponse correctly stores offset for cursor-based pagination."""
        from memory_system.api import ListMemoriesResponse

        resp = ListMemoriesResponse(memories=[], total=75, limit=25, offset=50)

        assert resp.offset == 50
        assert resp.limit == 25
        assert resp.total == 75

    def test_list_memories_response_last_page(self):
        """ListMemoriesResponse works when fewer items returned than limit (last page)."""
        from memory_system.api import ListMemoriesResponse, SearchResult
        from datetime import datetime, timezone

        # Last page: only 3 items remain out of 53 total
        three_items = [
            SearchResult(
                memory_id=f"id-{i}",
                content=f"Memory {i}",
                summary=None,
                tier=2,
                memory_type="insight",
                source="user",
                project_id=None,
                user_id=None,
                tenant_id="tenant-1",
                importance=0.7,
                confidence=0.9,
                tags=["tag"],
                created_at=datetime.now(timezone.utc),
                score=0.0,
                distance=None,
            )
            for i in range(3)
        ]

        resp = ListMemoriesResponse(memories=three_items, total=53, limit=25, offset=50)

        assert len(resp.memories) == 3
        assert resp.total == 53  # true total, not 3
        assert resp.limit == 25
        assert resp.offset == 50

    @pytest.mark.asyncio
    async def test_list_memories_system_before_initialize_raises(self):
        """list_memories raises RuntimeError if system is not initialized."""
        from memory_system.system import MemorySystem

        system = MemorySystem()

        with pytest.raises(RuntimeError) as exc_info:
            await system.list_memories(limit=10, offset=0)

        assert "not initialized" in str(exc_info.value).lower()

    def test_list_memories_system_returns_tuple(self):
        """list_memories signature returns tuple[list[Memory], int] (type-level check)."""
        import inspect
        from memory_system.system import MemorySystem

        sig = inspect.signature(MemorySystem.list_memories)
        # Verify the return annotation mentions tuple
        return_ann = str(sig.return_annotation)
        assert "tuple" in return_ann.lower() or "Tuple" in return_ann

    def test_list_memories_endpoint_exists(self):
        """Verify the /memories/list endpoint is registered."""
        from memory_system.api import app

        routes = [r.path for r in app.routes]
        assert "/memories/list" in routes


class TestAuthSettings:
    """Tests for auth-related settings fields."""

    def test_api_keys_default_empty(self):
        """API_KEYS defaults to empty list (no auth required if not set)."""
        from memory_system.config import Settings

        s = Settings(_env_file=None, api_keys=[])
        assert s.api_keys == []

    def test_jwt_secret_accepts_secure_value(self):
        """JWT_SECRET accepts a secure random-like value."""
        from memory_system.config import Settings

        secure_secret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        s = Settings(_env_file=None, jwt_secret=secure_secret)
        assert s.jwt_secret == secure_secret

    def test_jwt_expire_hours_default(self):
        """JWT_EXPIRE_HOURS defaults to 24."""
        from memory_system.config import Settings

        s = Settings()
        assert s.jwt_expire_hours == 24

    def test_admin_username_default(self):
        """ADMIN_USERNAME defaults to 'admin'."""
        from memory_system.config import Settings

        s = Settings()
        assert s.admin_username == "admin"

    def test_admin_password_hash_default_none(self):
        """ADMIN_PASSWORD_HASH defaults to None (login disabled until set)."""
        from memory_system.config import Settings

        s = Settings()
        assert s.admin_password_hash is None

    def test_rate_limit_default(self):
        """RATE_LIMIT_PER_MINUTE defaults to 100."""
        from memory_system.config import Settings

        s = Settings(_env_file=None, rate_limit_per_minute=100)
        assert s.rate_limit_per_minute == 100

    def test_admin_password_hash_empty_string_is_none(self, monkeypatch):
        """Empty ADMIN_PASSWORD_HASH env var is treated as None (login disabled)."""
        monkeypatch.setenv("ADMIN_PASSWORD_HASH", "")
        from memory_system.config import Settings

        s = Settings()
        assert s.admin_password_hash is None

    def test_api_keys_parsed_from_comma_string(self, monkeypatch):
        monkeypatch.setenv("API_KEYS", "key1, key2 , , key3")
        from memory_system.config import Settings

        s = Settings()
        assert s.api_keys == ["key1", "key2", "key3"]

    def test_api_keys_empty_string_gives_empty_list(self, monkeypatch):
        monkeypatch.setenv("API_KEYS", "")
        from memory_system.config import Settings

        s = Settings()
        assert s.api_keys == []


class TestAuthModule:
    """Tests for auth.py — JWT creation, verification, and API key checking."""

    def test_create_access_token_returns_string(self):
        """create_access_token returns a non-empty string."""
        from memory_system.auth import create_access_token

        token = create_access_token({"sub": "admin"}, secret="test-secret", expire_hours=1)
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_is_decodable(self):
        """Token created by create_access_token can be decoded back."""
        from memory_system.auth import create_access_token, decode_access_token

        token = create_access_token({"sub": "testuser"}, secret="test-secret", expire_hours=1)
        payload = decode_access_token(token, secret="test-secret")
        assert payload["sub"] == "testuser"

    def test_decode_expired_token_raises(self):
        """decode_access_token raises ValueError for expired tokens."""
        from memory_system.auth import decode_access_token

        # expire_hours=0 is invalid but we can create a token with past expiry manually
        from jose import jwt
        from datetime import datetime, timedelta, timezone

        payload = {"sub": "admin", "exp": datetime.now(timezone.utc) - timedelta(hours=1)}
        expired_token = jwt.encode(payload, "test-secret", algorithm="HS256")
        with pytest.raises(ValueError, match="expired"):
            decode_access_token(expired_token, secret="test-secret")

    def test_decode_invalid_token_raises(self):
        """decode_access_token raises ValueError for garbage tokens."""
        from memory_system.auth import decode_access_token

        with pytest.raises(ValueError):
            decode_access_token("not.a.valid.token", secret="test-secret")

    def test_verify_api_key_valid(self):
        """verify_api_key returns True when key is in allowed list."""
        from memory_system.auth import check_api_key

        assert check_api_key("valid-key", allowed_keys=["valid-key", "other-key"]) is True

    def test_verify_api_key_invalid(self):
        """verify_api_key returns False when key is not in allowed list."""
        from memory_system.auth import check_api_key

        assert check_api_key("bad-key", allowed_keys=["valid-key"]) is False

    def test_verify_api_key_empty_list_returns_false(self):
        """verify_api_key returns False when allowed_keys is empty."""
        from memory_system.auth import check_api_key

        assert check_api_key("any-key", allowed_keys=[]) is False

    def test_hash_password_returns_bcrypt_hash(self):
        """hash_password returns a bcrypt hash string."""
        from memory_system.auth import hash_password

        hashed = hash_password("mypassword")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_verify_password_correct(self):
        """verify_password returns True for correct password."""
        from memory_system.auth import hash_password, verify_password

        hashed = hash_password("correct")
        assert verify_password("correct", hashed) is True

    def test_verify_password_wrong(self):
        """verify_password returns False for wrong password."""
        from memory_system.auth import hash_password, verify_password

        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False


class TestAuthAPIEndpoints:
    """Tests for /auth/login and /auth/refresh API endpoints."""

    def test_login_endpoint_exists(self):
        """POST /auth/login route is registered."""
        from memory_system.api import app

        routes = {r.path for r in app.routes}
        assert "/auth/login" in routes

    def test_refresh_endpoint_exists(self):
        """POST /auth/refresh route is registered."""
        from memory_system.api import app

        routes = {r.path for r in app.routes}
        assert "/auth/refresh" in routes

    def test_login_request_model_has_username_and_password(self):
        """LoginRequest model has username and password fields."""
        from memory_system.api import LoginRequest

        fields = LoginRequest.model_fields
        assert "username" in fields
        assert "password" in fields

    def test_login_response_model_has_access_token(self):
        """LoginResponse model has access_token and expires_in fields."""
        from memory_system.api import LoginResponse

        fields = LoginResponse.model_fields
        assert "access_token" in fields
        assert "expires_in" in fields

    def test_health_endpoint_has_no_auth_dependency(self):
        """GET /health route has no require_auth dependency."""
        from memory_system.api import app
        from memory_system.auth import require_auth

        for route in app.routes:
            if hasattr(route, "path") and route.path == "/health":
                deps = getattr(route, "dependencies", [])
                dep_calls = [d.dependency for d in deps]
                assert require_auth not in dep_calls

    def test_stats_endpoint_has_auth_dependency(self):
        """GET /stats route has require_auth dependency."""
        from memory_system.api import app
        from memory_system.auth import require_auth

        for route in app.routes:
            if hasattr(route, "path") and route.path == "/stats":
                deps = getattr(route, "dependencies", [])
                dep_calls = [d.dependency for d in deps]
                assert require_auth in dep_calls

    def test_memories_post_has_auth_dependency(self):
        """POST /memories route has require_auth dependency."""
        from memory_system.api import app
        from memory_system.auth import require_auth

        for route in app.routes:
            if hasattr(route, "path") and route.path == "/memories":
                if hasattr(route, "methods") and "POST" in route.methods:
                    deps = getattr(route, "dependencies", [])
                    dep_calls = [d.dependency for d in deps]
                    assert require_auth in dep_calls


class TestRateLimiting:
    """Tests for slowapi rate limiting middleware."""

    def test_limiter_attached_to_app(self):
        """App has a slowapi limiter in its state."""
        from memory_system.api import app

        assert hasattr(app.state, "limiter")

    def test_rate_limit_exception_handler_registered(self):
        """App has a handler for RateLimitExceeded."""
        from slowapi.errors import RateLimitExceeded
        from memory_system.api import app

        assert RateLimitExceeded in app.exception_handlers


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
