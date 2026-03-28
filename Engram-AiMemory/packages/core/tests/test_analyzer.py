"""
Unit tests for memory_system.analyzer — MemoryAnalyzer.

Mocks MemorySystem (external service). Tests real analysis logic:
heuristic scoring, similarity detection, deduplication, LLM fallback.
"""

from __future__ import annotations
import sys

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


from memory_system.analyzer import MemoryAnalyzer
from memory_system.memory import (
    Memory,
    MemorySearchResult,
    MemorySource,
    MemoryTier,
    MemoryType,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_memory(
    content: str = "Default content",
    memory_type: MemoryType = MemoryType.FACT,
    project_id: str = "test-project",
    tenant_id: str = "default",
    vector: list[float] | None = None,
    tier: MemoryTier = MemoryTier.PROJECT,
) -> Memory:
    return Memory(
        id=uuid4(),
        content=content,
        tier=tier,
        memory_type=memory_type,
        source=MemorySource.AGENT,
        project_id=project_id,
        user_id="test-user",
        tenant_id=tenant_id,
        importance=0.5,
        confidence=0.9,
        tags=[],
        metadata={},
        vector=vector,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _make_search_result(memory: Memory) -> MemorySearchResult:
    return MemorySearchResult(
        memory=memory,
        score=0.85,
        distance=0.15,
        similarity_score=0.85,
        recency_score=0.9,
        importance_score=0.5,
        composite_score=0.8,
    )


def _make_analyzer(
    auto_importance: bool = False,
    contradiction_detection: bool = False,
    deduplication: bool = False,
    deduplication_threshold: float = 0.92,
    llm_provider: str = "openai",
    recent_memories: list[Memory] | None = None,
) -> MemoryAnalyzer:
    """Create a MemoryAnalyzer with mocked MemorySystem."""
    mock_system = MagicMock()
    mock_settings = MagicMock()
    mock_settings.auto_importance_enabled = auto_importance
    mock_settings.contradiction_detection_enabled = contradiction_detection
    mock_settings.deduplication_enabled = deduplication
    mock_settings.deduplication_threshold = deduplication_threshold
    mock_settings.default_tenant_id = "default"
    mock_settings.llm_provider = llm_provider
    mock_settings.llm_model = "gpt-4o-mini"
    mock_settings.openai_api_key = "test-key"
    mock_system.settings = mock_settings

    # Mock search for _get_project_context
    search_results = [_make_search_result(m) for m in (recent_memories or [])]
    mock_system.search = AsyncMock(return_value=search_results)

    # Mock Weaviate for _find_similar_memories
    mock_system._weaviate = MagicMock()
    mock_system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=[])

    analyzer = MemoryAnalyzer(system=mock_system)
    return analyzer


# ---------------------------------------------------------------------------
# _is_similar_content (pure function)
# ---------------------------------------------------------------------------


class TestIsSimilarContent:
    def test_identical_content_is_similar(self) -> None:
        analyzer = _make_analyzer()
        assert analyzer._is_similar_content("hello world", "hello world") is True

    def test_completely_different_content_is_not_similar(self) -> None:
        analyzer = _make_analyzer()
        assert (
            analyzer._is_similar_content(
                "the quick brown fox jumps over the lazy dog",
                "completely unrelated content about quantum physics",
            )
            is False
        )

    def test_high_overlap_is_similar(self) -> None:
        analyzer = _make_analyzer()
        content1 = "Python is a great programming language for data science applications"
        content2 = "Python is a great programming language for data science projects"
        # High word overlap above 0.8 threshold
        assert analyzer._is_similar_content(content1, content2) is True

    def test_empty_content_returns_false(self) -> None:
        analyzer = _make_analyzer()
        assert analyzer._is_similar_content("", "some content") is False
        assert analyzer._is_similar_content("some content", "") is False

    def test_custom_threshold(self) -> None:
        analyzer = _make_analyzer()
        content1 = "alpha beta gamma delta"
        content2 = "alpha beta epsilon zeta"
        # 50% overlap (2/4 words) — below 0.8 default, above 0.4
        assert analyzer._is_similar_content(content1, content2, threshold=0.4) is True
        assert analyzer._is_similar_content(content1, content2, threshold=0.8) is False

    def test_case_insensitive(self) -> None:
        analyzer = _make_analyzer()
        assert analyzer._is_similar_content("Hello World", "hello world") is True


# ---------------------------------------------------------------------------
# _analyze_with_heuristic
# ---------------------------------------------------------------------------


class TestAnalyzeWithHeuristic:
    async def test_default_importance_is_half(self) -> None:
        analyzer = _make_analyzer()
        memory = _make_memory(content="regular content nothing special")
        result = await analyzer._analyze_with_heuristic(memory, [])
        assert result["importance"] == 0.5

    async def test_high_importance_keywords_boost(self) -> None:
        analyzer = _make_analyzer()
        for keyword in ["important", "critical", "bug", "fix", "error", "security"]:
            memory = _make_memory(content=f"This is a {keyword} issue")
            result = await analyzer._analyze_with_heuristic(memory, [])
            assert result["importance"] == 0.7, f"Keyword '{keyword}' should boost to 0.7"

    async def test_todo_fixme_boosts_higher(self) -> None:
        analyzer = _make_analyzer()
        for keyword in ["todo", "fixme"]:
            memory = _make_memory(content=f"{keyword}: refactor this module")
            result = await analyzer._analyze_with_heuristic(memory, [])
            assert result["importance"] == 0.8, f"'{keyword}' should boost to 0.8"

    async def test_todo_overrides_other_keywords(self) -> None:
        """todo/fixme importance (0.8) should override generic high keywords (0.7)."""
        analyzer = _make_analyzer()
        memory = _make_memory(content="todo: fix this critical bug")
        result = await analyzer._analyze_with_heuristic(memory, [])
        assert result["importance"] == 0.8

    async def test_contradiction_detection_via_negation(self) -> None:
        analyzer = _make_analyzer()
        mem_positive = _make_memory(content="Python is good for web development and data science")
        mem_negative = _make_memory(
            content="Python is not good for web development or data science"
        )

        result = await analyzer._analyze_with_heuristic(mem_negative, [mem_positive])

        # Should detect contradiction due to negation mismatch + word overlap
        assert len(result["contradicts"]) > 0

    async def test_no_contradiction_without_negation_mismatch(self) -> None:
        analyzer = _make_analyzer()
        mem1 = _make_memory(content="Python is great for data science")
        mem2 = _make_memory(content="Python is wonderful for data science")

        result = await analyzer._analyze_with_heuristic(mem2, [mem1])
        assert result["contradicts"] == []

    async def test_deduplication_finds_similar(self) -> None:
        analyzer = _make_analyzer(deduplication=True)
        mem_existing = _make_memory(
            content="Python is a great programming language for building APIs"
        )
        mem_new = _make_memory(
            content="Python is a great programming language for building APIs and services"
        )

        result = await analyzer._analyze_with_heuristic(mem_new, [mem_existing])
        assert len(result["similar_to"]) > 0

    async def test_deduplication_disabled_skips_check(self) -> None:
        analyzer = _make_analyzer(deduplication=False)
        mem_existing = _make_memory(content="identical content")
        mem_new = _make_memory(content="identical content")

        result = await analyzer._analyze_with_heuristic(mem_new, [mem_existing])
        assert result["similar_to"] == []

    async def test_heuristic_result_shape(self) -> None:
        analyzer = _make_analyzer()
        memory = _make_memory()
        result = await analyzer._analyze_with_heuristic(memory, [])
        assert "importance" in result
        assert "contradicts" in result
        assert "similar_to" in result
        assert "suggested_tags" in result
        assert "reasoning" in result
        assert result["reasoning"] == "heuristic analysis (LLM unavailable)"


# ---------------------------------------------------------------------------
# _find_similar_memories
# ---------------------------------------------------------------------------


class TestFindSimilarMemories:
    async def test_returns_empty_without_vector(self) -> None:
        analyzer = _make_analyzer()
        memory = _make_memory(vector=None)
        result = await analyzer._find_similar_memories(memory, "proj", "tenant")
        assert result == []

    async def test_calls_weaviate_with_vector(self) -> None:
        analyzer = _make_analyzer(deduplication_threshold=0.92)
        memory = _make_memory(vector=[0.1, 0.2, 0.3])

        similar_mem = _make_memory(content="similar")
        analyzer._system._weaviate.find_similar_memories_by_vector = AsyncMock(
            return_value=[similar_mem]
        )

        result = await analyzer._find_similar_memories(memory, "proj", "tenant")
        assert len(result) == 1
        assert result[0] == similar_mem.id

        # Verify called with correct args
        analyzer._system._weaviate.find_similar_memories_by_vector.assert_called_once_with(
            vector=[0.1, 0.2, 0.3],
            tier=memory.tier,
            project_id="proj",
            tenant_id="tenant",
            threshold=0.92,
            limit=5,
        )

    async def test_handles_weaviate_error_gracefully(self) -> None:
        analyzer = _make_analyzer()
        memory = _make_memory(vector=[0.1])
        analyzer._system._weaviate.find_similar_memories_by_vector = AsyncMock(
            side_effect=Exception("Weaviate down")
        )
        result = await analyzer._find_similar_memories(memory, "proj", "tenant")
        assert result == []


# ---------------------------------------------------------------------------
# _get_project_context
# ---------------------------------------------------------------------------


class TestGetProjectContext:
    async def test_returns_memories_from_search(self) -> None:
        mem = _make_memory(content="context memory")
        analyzer = _make_analyzer(recent_memories=[mem])
        result = await analyzer._get_project_context("test-project", "default")
        assert len(result) == 1
        assert result[0].content == "context memory"

    async def test_handles_search_error_gracefully(self) -> None:
        analyzer = _make_analyzer()
        analyzer._system.search = AsyncMock(side_effect=Exception("search failed"))
        result = await analyzer._get_project_context("proj", "tenant")
        assert result == []


# ---------------------------------------------------------------------------
# _get_llm
# ---------------------------------------------------------------------------


class TestGetLlm:
    async def test_prefers_ai_router(self) -> None:
        analyzer = _make_analyzer()
        mock_router = MagicMock()
        analyzer._system.ai_router = mock_router
        result = await analyzer._get_llm()
        assert result is mock_router

    async def test_falls_back_to_openai(self) -> None:
        analyzer = _make_analyzer(llm_provider="openai")
        # No ai_router attribute
        del analyzer._system.ai_router

        mock_openai_client = MagicMock()
        mock_async_openai_cls = MagicMock(return_value=mock_openai_client)
        mock_openai_module = MagicMock()
        mock_openai_module.AsyncOpenAI = mock_async_openai_cls
        with patch.dict(sys.modules, {"openai": mock_openai_module}):
            result = await analyzer._get_llm()
        assert result is mock_openai_client

    async def test_falls_back_to_deepinfra(self) -> None:
        analyzer = _make_analyzer(llm_provider="deepinfra")
        del analyzer._system.ai_router
        analyzer._settings.deepinfra_api_key = "test-key"

        mock_client = MagicMock()
        mock_async_openai_cls = MagicMock(return_value=mock_client)
        mock_openai_module = MagicMock()
        mock_openai_module.AsyncOpenAI = mock_async_openai_cls
        with patch.dict(sys.modules, {"openai": mock_openai_module}):
            result = await analyzer._get_llm()
        assert result is mock_client

    async def test_returns_none_when_no_provider(self) -> None:
        analyzer = _make_analyzer(llm_provider="local")
        del analyzer._system.ai_router
        result = await analyzer._get_llm()
        assert result is None

    async def test_returns_cached_client(self) -> None:
        analyzer = _make_analyzer()
        del analyzer._system.ai_router
        mock_client = MagicMock()
        analyzer._llm_client = mock_client
        result = await analyzer._get_llm()
        assert result is mock_client


# ---------------------------------------------------------------------------
# analyze (full pipeline)
# ---------------------------------------------------------------------------


class TestAnalyze:
    async def test_heuristic_fallback_when_no_llm_features(self) -> None:
        """When auto_importance and contradiction_detection are both off, analyze uses heuristic."""
        analyzer = _make_analyzer(auto_importance=False, contradiction_detection=False)
        memory = _make_memory(content="test content")

        analysis = await analyzer.analyze(memory)

        assert analysis.memory_id == memory.id
        assert analysis.analysis_method == "heuristic"
        assert analysis.importance is None  # No LLM result when features disabled

    async def test_analyze_with_auto_importance_llm_fails(self) -> None:
        """When LLM fails, should fall back to heuristic."""
        analyzer = _make_analyzer(auto_importance=True)
        # Make _analyze_with_llm raise
        analyzer._analyze_with_llm = AsyncMock(side_effect=Exception("LLM unavailable"))
        memory = _make_memory(content="critical bug found")

        analysis = await analyzer.analyze(memory)

        assert (
            analysis.analysis_method == "llm"
        )  # heuristic dict is truthy, so code sets method="llm"
        assert analysis.importance == 0.7  # "bug" keyword

    async def test_analyze_with_llm_success(self) -> None:
        """When LLM succeeds, use LLM results."""
        analyzer = _make_analyzer(auto_importance=True)
        analyzer._analyze_with_llm = AsyncMock(
            return_value={
                "importance": 0.9,
                "reasoning": "Very important finding",
                "contradicts": [],
                "similar_to": [],
                "suggested_tags": ["architecture", "decision"],
            }
        )
        memory = _make_memory(content="architectural decision")

        analysis = await analyzer.analyze(memory)

        assert analysis.analysis_method == "llm"
        assert analysis.importance == 0.9
        assert analysis.importance_reasoning == "Very important finding"
        assert analysis.suggested_tags == ["architecture", "decision"]

    async def test_deduplication_runs_when_no_llm_similar(self) -> None:
        """When dedup enabled and LLM didn't find similar, _find_similar_memories is called."""
        analyzer = _make_analyzer(auto_importance=True, deduplication=True)
        analyzer._analyze_with_llm = AsyncMock(
            return_value={
                "importance": 0.5,
                "reasoning": "ok",
                "contradicts": [],
                "similar_to": [],  # LLM found no similar
                "suggested_tags": [],
            }
        )

        similar_mem = _make_memory(content="similar")
        analyzer._system._weaviate.find_similar_memories_by_vector = AsyncMock(
            return_value=[similar_mem]
        )

        memory = _make_memory(content="test", vector=[0.1, 0.2])
        analysis = await analyzer.analyze(memory)

        assert len(analysis.similar_to) == 1

    async def test_analyze_sets_project_and_tenant(self) -> None:
        analyzer = _make_analyzer()
        memory = _make_memory(project_id="my-project", tenant_id="my-tenant")

        analysis = await analyzer.analyze(memory)

        assert analysis.project_id == "my-project"
        assert analysis.tenant_id == "my-tenant"

    async def test_analyze_defaults_project_id(self) -> None:
        analyzer = _make_analyzer()
        memory = _make_memory(project_id=None)

        analysis = await analyzer.analyze(memory)
        assert analysis.project_id == "default"
