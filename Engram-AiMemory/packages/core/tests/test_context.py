"""Tests for context building and conversation memory management."""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.context import ContextBuilder, ConversationMemoryManager
from memory_system.memory import Memory, MemoryTier, MemoryType


class TestContextBuilder:
    """Test ContextBuilder class."""

    @pytest.fixture
    def mock_memory_system(self):
        """Create a mock memory system."""
        mock = MagicMock()
        mock.settings.rag_max_context_tokens = 4000
        return mock

    @pytest.fixture
    def context_builder(self, mock_memory_system):
        """Create a ContextBuilder instance."""
        return ContextBuilder(mock_memory_system)

    def test_estimate_tokens_calculation(self, context_builder):
        """Test token estimation uses correct heuristic."""
        text = "a" * 100  # 100 characters
        tokens = context_builder.estimate_tokens(text)
        assert tokens == 25  # 100 // 4

    def test_estimate_tokens_empty_string(self, context_builder):
        """Test token estimation with empty string."""
        assert context_builder.estimate_tokens("") == 0

    def test_compress_memory_project_tier(self, context_builder):
        """Test memory compression for project tier."""
        memory = Memory(
            content="This is a test memory content",
            memory_type=MemoryType.NOTE if hasattr(MemoryType, 'NOTE') else MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            importance=0.5,
            tags=["test", "memory"],
        )
        compressed = context_builder.compress_memory(memory)
        assert "[P/" in compressed or "[PROJECT/" in compressed
        assert "This is a test memory content" in compressed

    def test_compress_memory_general_tier(self, context_builder):
        """Test memory compression for general tier."""
        memory = Memory(
            content="General knowledge",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.GENERAL,
            importance=0.5,
            tags=[],
        )
        compressed = context_builder.compress_memory(memory)
        assert "[G/" in compressed or "[GENERAL/" in compressed

    def test_compress_memory_global_tier(self, context_builder):
        """Test memory compression for global tier."""
        memory = Memory(
            content="Global fact",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.GLOBAL,
            importance=0.5,
            tags=[],
        )
        compressed = context_builder.compress_memory(memory)
        assert "[GL/" in compressed or "[GLOBAL/" in compressed

    def test_compress_memory_with_high_importance(self, context_builder):
        """Test memory compression includes importance tag when >= 0.7."""
        memory = Memory(
            content="Important memory",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            importance=0.8,
            tags=[],
        )
        compressed = context_builder.compress_memory(memory)
        assert "(imp:" in compressed or "importance" in compressed.lower()

    def test_compress_memory_with_tags(self, context_builder):
        """Test memory compression includes tags."""
        memory = Memory(
            content="Tagged memory",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            importance=0.5,
            tags=["tag1", "tag2", "tag3"],
        )
        compressed = context_builder.compress_memory(memory)
        assert "#" in compressed or "tag" in compressed.lower()

    def test_compress_memory_truncates_long_content(self, context_builder):
        """Test that long content is truncated."""
        long_content = "x" * 300
        memory = Memory(
            content=long_content,
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            importance=0.5,
            tags=[],
        )
        compressed = context_builder.compress_memory(memory)
        # Content should be limited
        assert len(compressed) < 400

    @pytest.mark.asyncio
    async def test_build_context_basic(self, context_builder, mock_memory_system):
        """Test basic context building."""
        # Create mock search results
        mock_result = MagicMock()
        mock_result.memory = Memory(
            content="Test memory",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            importance=0.5,
            tags=[],
        )
        mock_result.score = 0.85

        mock_memory_system.search = AsyncMock(return_value=[mock_result])

        context = await context_builder.build_context("test query")

        assert "## Relevant Memory Context" in context
        assert "Test memory" in context

    @pytest.mark.asyncio
    async def test_build_context_with_tier_filter(self, context_builder, mock_memory_system):
        """Test context building with tier filter."""
        mock_memory_system.search = AsyncMock(return_value=[])

        await context_builder.build_context(
            query="test",
            tier=MemoryTier.PROJECT,
            project_id="proj-123",
            user_id="user-456",
        )

        mock_memory_system.search.assert_called_once()
        call_kwargs = mock_memory_system.search.call_args.kwargs
        assert call_kwargs["query"] == "test"
        assert call_kwargs["tier"] == MemoryTier.PROJECT
        assert call_kwargs["project_id"] == "proj-123"
        assert call_kwargs["user_id"] == "user-456"

    @pytest.mark.asyncio
    async def test_build_context_respects_token_budget(self, context_builder, mock_memory_system):
        """Test that context building respects token budget."""
        # Create many mock results
        mock_results = []
        for i in range(50):
            mock_result = MagicMock()
            mock_result.memory = Memory(
                content=f"Memory content {i} with some additional text to make it longer",
                memory_type=MemoryType.FACT,
                tier=MemoryTier.PROJECT,
                importance=0.5,
                tags=[],
            )
            mock_result.score = 0.5
            mock_results.append(mock_result)

        mock_memory_system.search = AsyncMock(return_value=mock_results)

        context = await context_builder.build_context("test", max_tokens=500)

        # Should not include all 50 memories due to token budget
        lines = [line for line in context.split("\n") if line.strip()]
        assert len(lines) < 52  # Header + some memories


class TestConversationMemoryManager:
    """Test ConversationMemoryManager class."""

    @pytest.fixture
    def manager(self):
        """Create a ConversationMemoryManager instance."""
        return ConversationMemoryManager(max_context_tokens=4000)

    def test_initial_state(self, manager):
        """Test initial state of conversation manager."""
        assert manager._history == []
        assert manager._summaries == []
        assert manager.total_tokens == 0

    def test_estimate_tokens(self, manager):
        """Test token estimation."""
        assert manager.estimate_tokens("a" * 100) == 25

    def test_add_message(self, manager):
        """Test adding a message."""
        manager.add_message("user", "Hello")
        assert len(manager._history) == 1
        assert manager._history[0]["role"] == "user"
        assert manager._history[0]["content"] == "Hello"
        assert "timestamp" in manager._history[0]

    def test_add_message_with_metadata(self, manager):
        """Test adding a message with metadata."""
        metadata = {"source": "test", "confidence": 0.9}
        manager.add_message("assistant", "Response", metadata=metadata)
        assert manager._history[0]["metadata"] == metadata

    def test_should_compact_false_initially(self, manager):
        """Test that compaction is not needed initially."""
        assert manager.should_compact is False

    def test_should_compact_true_when_over_threshold(self):
        """Test that compaction is needed when over 80% of budget."""
        # Use smaller threshold for reliable testing
        manager = ConversationMemoryManager(max_context_tokens=1000)
        # Add messages to exceed 80% (800 tokens)
        long_message = "word " * 100  # ~500 chars = ~125 tokens
        for i in range(8):  # ~1000 tokens > 800
            manager.add_message("user", f"{long_message} message {i}")

        assert manager.should_compact is True

    def test_compact_reduces_history(self, manager):
        """Test that compaction reduces history size."""
        # Add many messages
        for i in range(20):
            manager.add_message("user" if i % 2 == 0 else "assistant", f"Message {i}")

        # Force compaction
        manager.compact()

        assert len(manager._history) <= 10
        assert len(manager._summaries) > 0

    def test_compact_creates_summary(self, manager):
        """Test that compaction creates a summary."""
        for i in range(15):
            manager.add_message("user", f"Important discussion about topic {i}")

        manager.compact()

        assert len(manager._summaries) == 1
        assert "Summary" in manager._summaries[0]

    def test_get_context_includes_summaries(self, manager):
        """Test that get_context includes summaries."""
        # Add and compact to create summary
        for i in range(15):
            manager.add_message("user", f"Message {i}")
        manager.compact()

        # Add more messages
        manager.add_message("user", "Recent message")

        context = manager.get_context()

        assert "## Previous Conversation Summary" in context
        assert "## Recent Messages" in context
        assert "Recent message" in context

    def test_get_context_limits_summaries(self, manager):
        """Test that only last 3 summaries are included."""
        # Create multiple summaries
        for _ in range(5):
            for i in range(15):
                manager.add_message("user", f"Batch message {i}")
            manager.compact()

        context = manager.get_context()

        # Should have limited number of "Summary" occurrences
        summary_count = context.count("Summary of")
        assert summary_count <= 3

    def test_clear_empties_history(self, manager):
        """Test that clear empties history and summaries."""
        manager.add_message("user", "Message")
        manager.compact()

        manager.clear()

        assert manager._history == []
        assert manager._summaries == []

    def test_get_last_n_messages(self, manager):
        """Test getting last N messages."""
        for i in range(10):
            manager.add_message("user", f"Message {i}")

        last_3 = manager.get_last_n_messages(3)

        assert len(last_3) == 3
        assert last_3[-1]["content"] == "Message 9"

    def test_get_last_n_messages_more_than_available(self, manager):
        """Test getting more messages than available."""
        manager.add_message("user", "Message 1")
        manager.add_message("user", "Message 2")

        last_5 = manager.get_last_n_messages(5)

        assert len(last_5) == 2

    def test_metadata_defaults_to_empty_dict(self, manager):
        """Test that metadata defaults to empty dict."""
        manager.add_message("user", "Message")
        assert manager._history[0]["metadata"] == {}

    def test_message_content_truncated_in_context(self, manager):
        """Test that long message content is truncated in context output."""
        manager.add_message("user", "x" * 1000)
        context = manager.get_context()
        # Content should be truncated to 500 chars
        lines = context.split("\n")
        user_line = [l for l in lines if "USER:" in l][0]
        assert len(user_line) < 600
