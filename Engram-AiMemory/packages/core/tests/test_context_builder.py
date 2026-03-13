"""
Unit tests for memory_system.context — ContextBuilder and ConversationMemoryManager.

Mocks MemorySystem for ContextBuilder. ConversationMemoryManager is standalone.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from memory_system.context import ContextBuilder, ConversationMemoryManager
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
    content: str = "Test memory content",
    tier: MemoryTier = MemoryTier.PROJECT,
    memory_type: MemoryType = MemoryType.FACT,
    importance: float = 0.5,
    tags: list[str] | None = None,
    session_id: str | None = None,
) -> Memory:
    return Memory(
        id=uuid4(),
        content=content,
        tier=tier,
        memory_type=memory_type,
        source=MemorySource.AGENT,
        project_id="test-project",
        user_id="test-user",
        tenant_id="default",
        session_id=session_id,
        importance=importance,
        confidence=1.0,
        tags=tags or [],
        metadata={},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _make_search_result(memory: Memory | None = None, score: float = 0.85) -> MemorySearchResult:
    mem = memory or _make_memory()
    return MemorySearchResult(memory=mem, score=score, distance=1.0 - score)


def _make_mock_system(
    search_results: list[MemorySearchResult] | None = None,
) -> MagicMock:
    system = MagicMock()
    settings = MagicMock()
    settings.rag_max_context_tokens = 4000
    settings.rag_default_limit = 10
    system.settings = settings
    system.search = AsyncMock(return_value=search_results or [])
    return system


# ---------------------------------------------------------------------------
# ContextBuilder — estimate_tokens
# ---------------------------------------------------------------------------


class TestEstimateTokens:
    def test_estimate_tokens_basic(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        assert builder.estimate_tokens("1234") == 1
        assert builder.estimate_tokens("12345678") == 2

    def test_estimate_tokens_empty(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        assert builder.estimate_tokens("") == 0


# ---------------------------------------------------------------------------
# ContextBuilder — compress_memory
# ---------------------------------------------------------------------------


class TestCompressMemory:
    def test_project_tier_prefix(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(tier=MemoryTier.PROJECT, memory_type=MemoryType.FACT)
        result = builder.compress_memory(mem)
        assert result.startswith("[P/")

    def test_general_tier_prefix(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(tier=MemoryTier.GENERAL, memory_type=MemoryType.INSIGHT)
        result = builder.compress_memory(mem)
        assert result.startswith("[G/")

    def test_global_tier_prefix(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(tier=MemoryTier.GLOBAL, memory_type=MemoryType.FACT)
        result = builder.compress_memory(mem)
        assert result.startswith("[GL/")

    def test_importance_tag_shown_when_high(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(importance=0.8)
        result = builder.compress_memory(mem)
        assert "(imp:0.8)" in result

    def test_importance_tag_hidden_when_low(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(importance=0.3)
        result = builder.compress_memory(mem)
        assert "(imp:" not in result

    def test_tags_included(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(tags=["python", "testing", "ci", "more"])
        result = builder.compress_memory(mem)
        # Only first 3 tags
        assert "#python,testing,ci" in result

    def test_no_tags(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        mem = _make_memory(tags=[])
        result = builder.compress_memory(mem)
        assert "#" not in result

    def test_content_truncated_to_200_chars(self) -> None:
        builder = ContextBuilder(_make_mock_system())
        long_content = "A" * 300
        mem = _make_memory(content=long_content)
        result = builder.compress_memory(mem)
        # The content portion should be at most 200 chars
        assert "A" * 200 in result
        assert "A" * 201 not in result


# ---------------------------------------------------------------------------
# ContextBuilder — build_context
# ---------------------------------------------------------------------------


class TestBuildContext:
    @pytest.mark.asyncio
    async def test_build_context_basic(self) -> None:
        result1 = _make_search_result(_make_memory(content="Memory one"))
        system = _make_mock_system(search_results=[result1])
        builder = ContextBuilder(system)

        context = await builder.build_context(query="test", project_id="proj-1")
        assert "## Relevant Memory Context" in context
        assert "Memory one" in context

    @pytest.mark.asyncio
    async def test_build_context_empty_results(self) -> None:
        system = _make_mock_system(search_results=[])
        builder = ContextBuilder(system)

        context = await builder.build_context(query="nothing")
        assert "## Relevant Memory Context" in context

    @pytest.mark.asyncio
    async def test_build_context_respects_token_budget(self) -> None:
        # Create results that exceed a tiny budget
        results = [_make_search_result(_make_memory(content="A" * 200)) for _ in range(20)]
        system = _make_mock_system(search_results=results)
        builder = ContextBuilder(system)

        context = await builder.build_context(query="test", max_tokens=50)
        # Should have the header but not all 20 results
        lines = [l for l in context.split("\n") if l.startswith("- ")]
        assert len(lines) < 20

    @pytest.mark.asyncio
    async def test_build_context_with_session_id(self) -> None:
        mem_with_session = _make_memory(content="Session memory", session_id="sess-1")
        result = _make_search_result(mem_with_session)
        system = _make_mock_system(search_results=[result])
        builder = ContextBuilder(system)

        context = await builder.build_context(
            query="test", session_id="sess-1", project_id="proj-1"
        )
        # search is called twice: once for main, once for session
        assert system.search.await_count == 2

    @pytest.mark.asyncio
    async def test_build_context_custom_max_tokens(self) -> None:
        system = _make_mock_system(search_results=[])
        builder = ContextBuilder(system)

        await builder.build_context(query="test", max_tokens=1000)
        # Just verify it runs without error; the default comes from settings

    @pytest.mark.asyncio
    async def test_build_context_session_skipped_when_budget_low(self) -> None:
        """Session context is skipped when remaining budget < 500 tokens."""
        results = [_make_search_result(_make_memory(content="A" * 200)) for _ in range(20)]
        system = _make_mock_system(search_results=results)
        builder = ContextBuilder(system)

        # Use a very small max_tokens so budget is exhausted by main results
        context = await builder.build_context(query="test", session_id="sess-1", max_tokens=100)
        # search should only be called once (session search skipped)
        assert system.search.await_count == 1


# ---------------------------------------------------------------------------
# ContextBuilder — build_rag_context
# ---------------------------------------------------------------------------


class TestBuildRagContext:
    @pytest.mark.asyncio
    async def test_build_rag_context_returns_dict(self) -> None:
        mem = _make_memory(content="RAG memory", memory_type=MemoryType.FACT)
        result = _make_search_result(mem)
        system = _make_mock_system(search_results=[result])
        builder = ContextBuilder(system)

        rag = await builder.build_rag_context(query="rag test", project_id="p1")
        assert rag["query"] == "rag test"
        assert rag["total_memories"] == 1
        assert "formatted_context" in rag
        assert "memories_by_type" in rag
        assert "token_estimate" in rag

    @pytest.mark.asyncio
    async def test_build_rag_context_groups_by_type(self) -> None:
        fact = _make_memory(content="Fact A", memory_type=MemoryType.FACT)
        insight = _make_memory(content="Insight B", memory_type=MemoryType.INSIGHT)
        results = [_make_search_result(fact), _make_search_result(insight)]
        system = _make_mock_system(search_results=results)
        builder = ContextBuilder(system)

        rag = await builder.build_rag_context(query="test")
        by_type = rag["memories_by_type"]
        assert "fact" in by_type or MemoryType.FACT in by_type
        assert rag["total_memories"] == 2

    @pytest.mark.asyncio
    async def test_build_rag_context_empty(self) -> None:
        system = _make_mock_system(search_results=[])
        builder = ContextBuilder(system)

        rag = await builder.build_rag_context(query="empty")
        assert rag["total_memories"] == 0
        assert rag["memories_by_type"] == {}


# ---------------------------------------------------------------------------
# ConversationMemoryManager
# ---------------------------------------------------------------------------


class TestConversationMemoryManager:
    def test_init(self) -> None:
        mgr = ConversationMemoryManager(max_context_tokens=2000)
        assert mgr._max_tokens == 2000
        assert mgr._history == []
        assert mgr._summaries == []

    def test_add_message(self) -> None:
        mgr = ConversationMemoryManager()
        mgr.add_message("user", "Hello!")
        assert len(mgr._history) == 1
        assert mgr._history[0]["role"] == "user"
        assert mgr._history[0]["content"] == "Hello!"
        assert "timestamp" in mgr._history[0]

    def test_add_message_with_metadata(self) -> None:
        mgr = ConversationMemoryManager()
        mgr.add_message("assistant", "Reply", metadata={"key": "val"})
        assert mgr._history[0]["metadata"] == {"key": "val"}

    def test_estimate_tokens(self) -> None:
        mgr = ConversationMemoryManager()
        assert mgr.estimate_tokens("12345678") == 2
        assert mgr.estimate_tokens("") == 0

    def test_total_tokens(self) -> None:
        mgr = ConversationMemoryManager()
        mgr.add_message("user", "A" * 100)  # 25 tokens
        assert mgr.total_tokens == 25

    def test_should_compact_false_initially(self) -> None:
        mgr = ConversationMemoryManager(max_context_tokens=4000)
        mgr.add_message("user", "short msg")
        assert mgr.should_compact is False

    def test_should_compact_true_when_over_threshold(self) -> None:
        mgr = ConversationMemoryManager(max_context_tokens=100)
        # Add enough content to exceed 80% of 100 tokens = 80 tokens
        for i in range(20):
            mgr.add_message("user", "A" * 50)  # 12.5 tokens each = 250 total
        assert mgr.should_compact is True

    def test_compact_reduces_history(self) -> None:
        mgr = ConversationMemoryManager()
        for i in range(15):
            mgr._history.append(
                {"role": "user", "content": f"Message {i}", "timestamp": "", "metadata": {}}
            )
        mgr.compact()
        assert len(mgr._history) == 5
        assert len(mgr._summaries) == 1

    def test_compact_noop_when_few_messages(self) -> None:
        mgr = ConversationMemoryManager()
        mgr._history.append(
            {"role": "user", "content": "Only one", "timestamp": "", "metadata": {}}
        )
        mgr.compact()
        # No change — compact requires > keep_count to_summarize
        assert len(mgr._history) == 1

    def test_auto_compact_on_add(self) -> None:
        mgr = ConversationMemoryManager(max_context_tokens=50)
        # Add 12 messages (need >10 for auto-compact) with enough content
        for i in range(12):
            mgr.add_message("user", "A" * 80)
        # Auto-compact should have triggered
        assert len(mgr._summaries) >= 1

    def test_get_context(self) -> None:
        mgr = ConversationMemoryManager()
        mgr.add_message("user", "Hello")
        mgr.add_message("assistant", "Hi there")
        context = mgr.get_context()
        assert "## Recent Messages" in context
        assert "USER: Hello" in context
        assert "ASSISTANT: Hi there" in context

    def test_get_context_with_summaries(self) -> None:
        mgr = ConversationMemoryManager()
        mgr._summaries = ["[Summary of 10 messages. Topics: python, testing]"]
        mgr.add_message("user", "Latest")
        context = mgr.get_context()
        assert "## Previous Conversation Summary" in context
        assert "python" in context

    def test_clear(self) -> None:
        mgr = ConversationMemoryManager()
        mgr.add_message("user", "Hello")
        mgr._summaries = ["summary"]
        mgr.clear()
        assert mgr._history == []
        assert mgr._summaries == []

    def test_get_last_n_messages(self) -> None:
        mgr = ConversationMemoryManager()
        for i in range(10):
            mgr.add_message("user", f"msg-{i}")
        last3 = mgr.get_last_n_messages(3)
        assert len(last3) == 3
        assert last3[-1]["content"] == "msg-9"

    def test_create_summary(self) -> None:
        mgr = ConversationMemoryManager()
        messages = [
            {"content": "The quick brown fox jumps"},
            {"content": "Another longer sentence here"},
        ]
        summary = mgr._create_summary(messages)
        assert "[Summary of 2 messages" in summary
        assert "Topics:" in summary
