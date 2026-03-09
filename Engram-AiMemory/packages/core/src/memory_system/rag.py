"""
RAG (Retrieval-Augmented Generation) pipeline with memory context.

Provides both generative-module-backed RAG (when Weaviate has a generative
module configured) and context-only fallback that returns assembled context
without server-side generation.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from memory_system.context import ContextBuilder
from memory_system.memory import MemoryTier

if TYPE_CHECKING:
    from memory_system.system import MemorySystem

logger = logging.getLogger(__name__)


class MemoryRAG:
    """
    RAG pipeline that retrieves memories and optionally generates
    responses via Weaviate's generative module.

    Falls back to context-only mode when no generative module is
    configured on the Weaviate instance.
    """

    def __init__(self, memory_system: MemorySystem, context_builder: ContextBuilder) -> None:
        self._system = memory_system
        self._context = context_builder
        self._settings = memory_system.settings

    async def generate_with_context(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        limit = limit or self._settings.rag_default_limit

        results = await self._system.search(
            query=query,
            tier=tier,
            project_id=project_id,
            limit=limit,
        )

        individual_insights: list[dict[str, Any]] = []
        for result in results:
            mem = result.memory
            compressed = self._context.compress_memory(mem)
            individual_insights.append(
                {
                    "memory_id": str(mem.id),
                    "content": mem.content,
                    "compressed": compressed,
                    "score": result.score,
                    "tier": mem.tier if isinstance(mem.tier, int) else mem.tier.value,
                    "memory_type": mem.memory_type
                    if isinstance(mem.memory_type, str)
                    else mem.memory_type.value,
                }
            )

        return {
            "query": query,
            "mode": "context_only",
            "individual_insights": individual_insights,
            "source_count": len(individual_insights),
        }

    async def generate_synthesis(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        limit = limit or self._settings.rag_default_limit

        results = await self._system.search(
            query=query,
            tier=tier,
            project_id=project_id,
            limit=limit,
        )

        source_memories: list[dict[str, Any]] = []
        context_parts: list[str] = []

        for result in results:
            mem = result.memory
            compressed = self._context.compress_memory(mem)
            context_parts.append(compressed)
            source_memories.append(
                {
                    "memory_id": str(mem.id),
                    "content": mem.content[:200],
                    "score": result.score,
                }
            )

        synthesis_context = "\n".join(context_parts)
        synthesis_prompt = (
            f"{self._settings.rag_synthesis_prompt}\n\n"
            f"Query: {query}\n\n"
            f"Memory Context:\n{synthesis_context}"
        )

        return {
            "query": query,
            "mode": "context_only",
            "synthesis_prompt": synthesis_prompt,
            "synthesis_context": synthesis_context,
            "source_memories": source_memories,
            "source_count": len(source_memories),
        }

    async def answer_with_full_context(
        self,
        query: str,
        user_id: str | None = None,
        session_id: str | None = None,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        rag_context = await self._context.build_rag_context(
            query=query,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
        )

        formatted = rag_context["formatted_context"]
        synthesis_prompt = (
            f"You have access to the following memory context:\n\n"
            f"{formatted}\n\n"
            f"Based on this context, answer: {query}\n\n"
            f"Provide a helpful, personalized response that draws on relevant memories. "
            f"If the memories don't contain relevant information, say so clearly."
        )

        return {
            "query": query,
            "mode": "context_only",
            "synthesis_prompt": synthesis_prompt,
            "context": rag_context,
            "source_count": rag_context["total_memories"],
        }

    async def multi_tier_rag(
        self,
        query: str,
        tiers: list[MemoryTier] | None = None,
        limit_per_tier: int = 3,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        tiers = tiers or [MemoryTier.PROJECT, MemoryTier.GENERAL, MemoryTier.GLOBAL]

        all_results: list[dict[str, Any]] = []
        tier_counts: dict[str, int] = {}

        for tier in tiers:
            results = await self._system.search(
                query=query,
                tier=tier,
                project_id=project_id if tier == MemoryTier.PROJECT else None,
                limit=limit_per_tier,
            )

            tier_name = tier.name if isinstance(tier, MemoryTier) else MemoryTier(tier).name
            tier_counts[tier_name] = len(results)

            for result in results:
                mem = result.memory
                all_results.append(
                    {
                        "memory_id": str(mem.id),
                        "content": mem.content[:200],
                        "tier": tier_name,
                        "memory_type": mem.memory_type
                        if isinstance(mem.memory_type, str)
                        else mem.memory_type.value,
                        "score": result.score,
                        "importance": mem.importance,
                    }
                )

        all_results.sort(key=lambda x: x["score"], reverse=True)

        context_parts: list[str] = []
        for r in all_results[:10]:
            context_parts.append(f"[{r['tier']}/{r['memory_type']}] {r['content']}")

        return {
            "query": query,
            "mode": "context_only",
            "results": all_results,
            "context": "\n".join(context_parts),
            "tier_counts": tier_counts,
            "total_results": len(all_results),
        }
