import pytest
"""
Unit tests for memory_system.rag — MemoryRAG pipeline.

Mocks MemorySystem.search and ContextBuilder (external services).
Tests the real RAG assembly/formatting logic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4


from memory_system.memory import (
    Memory,
    MemorySearchResult,
    MemorySource,
    MemoryTier,
    MemoryType,
)
from memory_system.rag import MemoryRAG


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_memory(
    content: str = "Test memory content",
    tier: MemoryTier = MemoryTier.PROJECT,
    memory_type: MemoryType = MemoryType.FACT,
    project_id: str = "test-project",
    importance: float = 0.7,
) -> Memory:
    return Memory(
        id=uuid4(),
        content=content,
        tier=tier,
        memory_type=memory_type,
        source=MemorySource.AGENT,
        project_id=project_id,
        user_id="test-user",
        tenant_id="default",
        importance=importance,
        confidence=0.9,
        tags=["test"],
        metadata={},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _make_search_result(memory: Memory | None = None, score: float = 0.85) -> MemorySearchResult:
    mem = memory or _make_memory()
    return MemorySearchResult(
        memory=mem,
        score=score,
        distance=1.0 - score,
        similarity_score=score,
        recency_score=0.9,
        importance_score=mem.importance,
        composite_score=score,
    )


def _make_rag(search_results: list[MemorySearchResult] | None = None) -> MemoryRAG:
    """Create a MemoryRAG with mocked MemorySystem and ContextBuilder."""
    mock_system = MagicMock()
    mock_system.search = AsyncMock(return_value=search_results or [])
    mock_settings = MagicMock()
    mock_settings.rag_default_limit = 5
    mock_settings.rag_synthesis_prompt = "Synthesize the following memories:"
    mock_system.settings = mock_settings

    mock_context = MagicMock()
    mock_context.compress_memory = MagicMock(side_effect=lambda m: f"[compressed] {m.content[:50]}")
    mock_context.build_rag_context = AsyncMock(
        return_value={
            "formatted_context": "Formatted context block",
            "total_memories": 3,
            "memories": ["mem1", "mem2", "mem3"],
        }
    )

    return MemoryRAG(memory_system=mock_system, context_builder=mock_context)


# ---------------------------------------------------------------------------
# generate_with_context
# ---------------------------------------------------------------------------


class TestGenerateWithContext:
    async def test_returns_context_only_mode(self) -> None:
        mem = _make_memory(content="Python is a programming language")
        result_item = _make_search_result(mem, score=0.9)
        rag = _make_rag(search_results=[result_item])

        result = await rag.generate_with_context("What is Python?")

        assert result["query"] == "What is Python?"
        assert result["mode"] == "context_only"
        assert result["source_count"] == 1
        assert len(result["individual_insights"]) == 1

    async def test_individual_insights_contain_correct_fields(self) -> None:
        mem = _make_memory(content="FastAPI is a web framework", memory_type=MemoryType.FACT)
        result_item = _make_search_result(mem, score=0.88)
        rag = _make_rag(search_results=[result_item])

        result = await rag.generate_with_context("Tell me about FastAPI")
        insight = result["individual_insights"][0]

        assert insight["memory_id"] == str(mem.id)
        assert insight["content"] == "FastAPI is a web framework"
        assert "compressed" in insight
        assert insight["score"] == pytest.approx(0.88)
        assert insight["tier"] == MemoryTier.PROJECT.value

    async def test_empty_results_returns_zero_count(self) -> None:
        rag = _make_rag(search_results=[])
        result = await rag.generate_with_context("nonexistent topic")
        assert result["source_count"] == 0
        assert result["individual_insights"] == []

    async def test_uses_default_limit_from_settings(self) -> None:
        rag = _make_rag()
        await rag.generate_with_context("test query")
        rag._system.search.assert_called_once_with(
            query="test query", tier=None, project_id=None, limit=5
        )

    async def test_custom_limit_overrides_default(self) -> None:
        rag = _make_rag()
        await rag.generate_with_context("test query", limit=10)
        rag._system.search.assert_called_once_with(
            query="test query", tier=None, project_id=None, limit=10
        )

    async def test_tier_and_project_passed_to_search(self) -> None:
        rag = _make_rag()
        await rag.generate_with_context("test", tier=MemoryTier.GENERAL, project_id="my-proj")
        rag._system.search.assert_called_once_with(
            query="test", tier=MemoryTier.GENERAL, project_id="my-proj", limit=5
        )

    async def test_multiple_results(self) -> None:
        mems = [_make_memory(content=f"Memory {i}") for i in range(3)]
        results = [_make_search_result(m, score=0.9 - i * 0.1) for i, m in enumerate(mems)]
        rag = _make_rag(search_results=results)

        output = await rag.generate_with_context("test")
        assert output["source_count"] == 3
        assert len(output["individual_insights"]) == 3


# ---------------------------------------------------------------------------
# generate_synthesis
# ---------------------------------------------------------------------------


class TestGenerateSynthesis:
    async def test_returns_synthesis_prompt(self) -> None:
        mem = _make_memory(content="Important finding about memory systems")
        rag = _make_rag(search_results=[_make_search_result(mem)])

        result = await rag.generate_synthesis("How do memory systems work?")

        assert result["mode"] == "context_only"
        assert "synthesis_prompt" in result
        assert "synthesis_context" in result
        assert result["source_count"] == 1

    async def test_synthesis_prompt_contains_query_and_context(self) -> None:
        mem = _make_memory(content="Key insight here")
        rag = _make_rag(search_results=[_make_search_result(mem)])

        result = await rag.generate_synthesis("my question")

        assert "my question" in result["synthesis_prompt"]
        assert "Synthesize" in result["synthesis_prompt"]

    async def test_source_memories_truncated_to_200_chars(self) -> None:
        long_content = "x" * 500
        mem = _make_memory(content=long_content)
        rag = _make_rag(search_results=[_make_search_result(mem)])

        result = await rag.generate_synthesis("test")
        source = result["source_memories"][0]
        assert len(source["content"]) == 200

    async def test_empty_results(self) -> None:
        rag = _make_rag(search_results=[])
        result = await rag.generate_synthesis("test")
        assert result["source_count"] == 0
        assert result["source_memories"] == []


# ---------------------------------------------------------------------------
# answer_with_full_context
# ---------------------------------------------------------------------------


class TestAnswerWithFullContext:
    async def test_returns_context_only_mode(self) -> None:
        rag = _make_rag()
        result = await rag.answer_with_full_context("What happened?")

        assert result["mode"] == "context_only"
        assert "synthesis_prompt" in result
        assert result["source_count"] == 3  # from mock build_rag_context

    async def test_synthesis_prompt_includes_query(self) -> None:
        rag = _make_rag()
        result = await rag.answer_with_full_context("My specific question")
        assert "My specific question" in result["synthesis_prompt"]

    async def test_passes_all_params_to_context_builder(self) -> None:
        rag = _make_rag()
        await rag.answer_with_full_context(
            "test", user_id="user-1", session_id="sess-1", project_id="proj-1"
        )
        rag._context.build_rag_context.assert_called_once_with(
            query="test", project_id="proj-1", user_id="user-1", session_id="sess-1"
        )

    async def test_includes_formatted_context_in_prompt(self) -> None:
        rag = _make_rag()
        result = await rag.answer_with_full_context("test")
        assert "Formatted context block" in result["synthesis_prompt"]


# ---------------------------------------------------------------------------
# multi_tier_rag
# ---------------------------------------------------------------------------


class TestMultiTierRag:
    async def test_searches_across_default_tiers(self) -> None:
        rag = _make_rag()
        result = await rag.multi_tier_rag("test query")

        # Should search PROJECT, GENERAL, GLOBAL
        assert rag._system.search.call_count == 3

    async def test_custom_tiers(self) -> None:
        rag = _make_rag()
        await rag.multi_tier_rag("test", tiers=[MemoryTier.PROJECT])
        assert rag._system.search.call_count == 1

    async def test_results_sorted_by_score(self) -> None:
        mem1 = _make_memory(content="Low score", tier=MemoryTier.PROJECT)
        mem2 = _make_memory(content="High score", tier=MemoryTier.GENERAL)
        results_tier1 = [_make_search_result(mem1, score=0.5)]
        results_tier2 = [_make_search_result(mem2, score=0.9)]

        mock_system = MagicMock()
        mock_system.search = AsyncMock(side_effect=[results_tier1, results_tier2, []])
        mock_settings = MagicMock()
        mock_settings.rag_default_limit = 5
        mock_system.settings = mock_settings

        mock_context = MagicMock()
        rag = MemoryRAG(memory_system=mock_system, context_builder=mock_context)

        result = await rag.multi_tier_rag("test")
        assert result["results"][0]["score"] == pytest.approx(0.9)  # High score first
        assert result["results"][1]["score"] == pytest.approx(0.5)

    async def test_tier_counts_reported(self) -> None:
        mem = _make_memory()
        rag_results = [_make_search_result(mem)]

        mock_system = MagicMock()
        mock_system.search = AsyncMock(side_effect=[rag_results, [], []])
        mock_settings = MagicMock()
        mock_settings.rag_default_limit = 5
        mock_system.settings = mock_settings

        rag = MemoryRAG(memory_system=mock_system, context_builder=MagicMock())
        result = await rag.multi_tier_rag("test")

        assert "tier_counts" in result
        assert result["tier_counts"]["PROJECT"] == 1
        assert result["total_results"] == 1

    async def test_context_limited_to_10(self) -> None:
        """Context assembly should limit to top 10 results."""
        mems = [_make_memory(content=f"Memory {i}") for i in range(15)]
        results = [_make_search_result(m, score=0.5) for m in mems]

        mock_system = MagicMock()
        mock_system.search = AsyncMock(side_effect=[results[:5], results[5:10], results[10:]])
        mock_settings = MagicMock()
        mock_settings.rag_default_limit = 5
        mock_system.settings = mock_settings

        rag = MemoryRAG(memory_system=mock_system, context_builder=MagicMock())
        result = await rag.multi_tier_rag("test", limit_per_tier=5)

        # Context should only have 10 entries max
        context_lines = result["context"].split("\n")
        assert len(context_lines) <= 10

    async def test_project_id_only_passed_for_project_tier(self) -> None:
        rag = _make_rag()
        await rag.multi_tier_rag("test", project_id="my-proj")

        calls = rag._system.search.call_args_list
        # First call (PROJECT tier) should include project_id
        assert calls[0][1]["project_id"] == "my-proj"
        # Other tiers should have project_id=None
        assert calls[1][1]["project_id"] is None
        assert calls[2][1]["project_id"] is None
