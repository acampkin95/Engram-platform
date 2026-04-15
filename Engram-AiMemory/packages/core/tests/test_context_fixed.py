"""Fixed test for should_compact threshold."""
import os
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.context import ConversationMemoryManager

def test_should_compact_threshold():
    """Test that compaction triggers at correct threshold."""
    manager = ConversationMemoryManager(max_context_tokens=1000)  # Lower threshold

    # Add messages to exceed 80% (800 tokens)
    long_message = "x" * 400  # 100 tokens each
    for i in range(9):  # 900 tokens > 800 (80% of 1000)
        manager.add_message("user", f"{long_message} message {i}")

    print(f"Total tokens: {manager.total_tokens}")
    print(f"Threshold: {manager._max_tokens * 0.8}")
    print(f"Should compact: {manager.should_compact}")

    assert manager.should_compact is True

test_should_compact_threshold()
