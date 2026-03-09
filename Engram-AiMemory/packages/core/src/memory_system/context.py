"""
Context building for LLM integration with token-budgeted memory assembly.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from memory_system.memory import Memory, MemoryTier

if TYPE_CHECKING:
    from memory_system.system import MemorySystem


class ContextBuilder:
    """
    Build LLM context from memories with token budget management.

    Takes a MemorySystem instance and assembles context strings
    from search results, respecting a configurable token limit.
    """

    def __init__(self, memory_system: MemorySystem) -> None:
        self._system = memory_system
        self._settings = memory_system.settings

    def estimate_tokens(self, text: str) -> int:
        """~4 characters per token heuristic."""
        return len(text) // 4

    def compress_memory(self, memory: Memory) -> str:
        tier = MemoryTier(memory.tier) if isinstance(memory.tier, int) else memory.tier
        mem_type = memory.memory_type

        if tier == MemoryTier.PROJECT:
            prefix = f"[P/{mem_type}]"
        elif tier == MemoryTier.GENERAL:
            prefix = f"[G/{mem_type}]"
        else:
            prefix = f"[GL/{mem_type}]"

        content = memory.content[:200]
        importance_tag = f"(imp:{memory.importance:.1f})" if memory.importance >= 0.7 else ""
        tags_tag = f" #{','.join(memory.tags[:3])}" if memory.tags else ""

        return f"{prefix} {content}{importance_tag}{tags_tag}"

    async def build_context(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        max_tokens: int | None = None,
    ) -> str:
        max_tokens = max_tokens or self._settings.rag_max_context_tokens

        results = await self._system.search(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            limit=20,
        )

        parts: list[str] = ["## Relevant Memory Context\n"]
        token_budget = max_tokens

        for result in results:
            compressed = self.compress_memory(result.memory)
            score_info = f" (score:{result.score:.2f})"
            line = f"- {compressed}{score_info}"
            tokens = self.estimate_tokens(line)

            if token_budget - tokens < 0:
                break

            parts.append(line)
            token_budget -= tokens

        if session_id and token_budget > 500:
            session_results = await self._system.search(
                query=query,
                tier=MemoryTier.PROJECT,
                project_id=project_id,
                limit=5,
            )

            session_memories = [r for r in session_results if r.memory.session_id == session_id]

            if session_memories:
                parts.append("\n## Session Context\n")
                for result in session_memories:
                    compressed = self.compress_memory(result.memory)
                    tokens = self.estimate_tokens(compressed)
                    if token_budget - tokens < 0:
                        break
                    parts.append(f"- {compressed}")
                    token_budget -= tokens

        return "\n".join(parts)

    async def build_rag_context(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        max_tokens = max_tokens or self._settings.rag_max_context_tokens

        results = await self._system.search(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            limit=self._settings.rag_default_limit * 2,
        )

        memories_by_type: dict[str, list[dict[str, Any]]] = {}
        for result in results:
            mem = result.memory
            mem_type = (
                mem.memory_type if isinstance(mem.memory_type, str) else mem.memory_type.value
            )
            if mem_type not in memories_by_type:
                memories_by_type[mem_type] = []
            memories_by_type[mem_type].append(
                {
                    "id": str(mem.id),
                    "content": mem.content,
                    "tier": mem.tier if isinstance(mem.tier, int) else mem.tier.value,
                    "importance": mem.importance,
                    "tags": mem.tags,
                    "score": result.score,
                }
            )

        formatted_context = await self.build_context(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            max_tokens=max_tokens,
        )

        return {
            "query": query,
            "memories_by_type": memories_by_type,
            "formatted_context": formatted_context,
            "total_memories": len(results),
            "token_estimate": self.estimate_tokens(formatted_context),
        }


class ConversationMemoryManager:
    """
    Manage conversation history with automatic compaction
    when history exceeds token budget.
    """

    def __init__(self, max_context_tokens: int = 4000) -> None:
        self._max_tokens = max_context_tokens
        self._history: list[dict[str, Any]] = []
        self._summaries: list[str] = []

    def estimate_tokens(self, text: str) -> int:
        return len(text) // 4

    @property
    def total_tokens(self) -> int:
        history_tokens = sum(self.estimate_tokens(msg.get("content", "")) for msg in self._history)
        summary_tokens = sum(self.estimate_tokens(s) for s in self._summaries)
        return history_tokens + summary_tokens

    @property
    def should_compact(self) -> bool:
        return self.total_tokens > int(self._max_tokens * 0.8)

    def add_message(self, role: str, content: str, metadata: dict[str, Any] | None = None) -> None:
        self._history.append(
            {
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata or {},
            }
        )

        if self.should_compact and len(self._history) > 10:
            self.compact()

    def compact(self) -> None:
        keep_count = 5
        to_summarize = self._history[:-keep_count]

        if to_summarize:
            summary = self._create_summary(to_summarize)
            self._summaries.append(summary)
            self._history = self._history[-keep_count:]

    def _create_summary(self, messages: list[dict[str, Any]]) -> str:
        topics: set[str] = set()
        for msg in messages:
            words = msg.get("content", "").split()[:10]
            topics.update(w for w in words if len(w) > 4)

        return f"[Summary of {len(messages)} messages. Topics: {', '.join(list(topics)[:5])}]"

    def get_context(self) -> str:
        parts: list[str] = []

        if self._summaries:
            parts.append("## Previous Conversation Summary\n")
            for summary in self._summaries[-3:]:
                parts.append(f"{summary}\n")

        parts.append("## Recent Messages\n")
        for msg in self._history:
            role = msg["role"].upper()
            content = msg["content"][:500]
            parts.append(f"{role}: {content}")

        return "\n".join(parts)

    def clear(self) -> None:
        self._history = []
        self._summaries = []

    def get_last_n_messages(self, n: int = 5) -> list[dict[str, Any]]:
        return self._history[-n:]
