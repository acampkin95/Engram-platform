"""
Memory analysis for self-management: auto-importance, contradiction detection, deduplication.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from memory_system.memory import Memory, MemoryAnalysis, MemoryTier

if TYPE_CHECKING:
    from memory_system.system import MemorySystem

logger = logging.getLogger(__name__)


class MemoryAnalyzer:
    """Analyzes memory content for self-management features."""

    def __init__(self, system: MemorySystem) -> None:
        self._system = system
        self._settings = system.settings
        self._llm_client = None

    async def analyze(self, memory: Memory) -> MemoryAnalysis:
        """Run full analysis pipeline on a memory."""
        project_id = memory.project_id or "default"
        tenant_id = memory.tenant_id or self._settings.default_tenant_id

        recent_memories = await self._get_project_context(project_id, tenant_id)

        if self._settings.auto_importance_enabled or self._settings.contradiction_detection_enabled:
            try:
                llm_result = await self._analyze_with_llm(memory, recent_memories)
            except Exception as e:
                logger.warning(f"LLM analysis failed, using heuristic fallback: {e}")
                llm_result = await self._analyze_with_heuristic(memory, recent_memories)
        else:
            llm_result = None

        importance = None
        importance_reasoning = None
        contradicts = []
        similar_to = []
        suggested_tags = []
        method = "heuristic"

        if llm_result:
            importance = llm_result.get("importance")
            importance_reasoning = llm_result.get("reasoning")
            contradicts = [UUID(mid) for mid in llm_result.get("contradicts", []) if mid]
            similar_to = [UUID(mid) for mid in llm_result.get("similar_to", []) if mid]
            suggested_tags = llm_result.get("suggested_tags", [])
            method = "llm"

        if self._settings.deduplication_enabled and not similar_to:
            similar_to = await self._find_similar_memories(memory, project_id, tenant_id)

        return MemoryAnalysis(
            memory_id=memory.id,
            project_id=project_id,
            tenant_id=tenant_id,
            importance=importance,
            importance_reasoning=importance_reasoning,
            contradicts=contradicts,
            similar_to=similar_to,
            suggested_tags=suggested_tags,
            analysis_method=method,
            analyzed_at=datetime.now(),
        )

    async def _get_project_context(
        self, project_id: str, tenant_id: str, limit: int = 10
    ) -> list[Memory]:
        """Get recent memories from the same project for context."""
        try:
            results = await self._system.search(
                query="",
                tier=MemoryTier.PROJECT,
                project_id=project_id,
                tenant_id=tenant_id,
                limit=limit,
            )
            return [r.memory for r in results]
        except Exception:
            return []

    async def _analyze_with_llm(self, memory: Memory, recent_memories: list[Memory]) -> dict | None:
        """Use LLM to analyze memory for importance and contradictions."""
        # Quick availability check before building the prompt
        llm = await self._get_llm()
        if not llm:
            return None

        context_parts = []
        for mem in recent_memories[:5]:
            context_parts.append(f"- [{mem.memory_type}] {mem.content[:200]}")

        context_str = "\n".join(context_parts) or "No recent memories in this project."

        prompt = f"""You are analyzing a memory for importance and potential conflicts.

Project context (recent memories):
{context_str}

New memory to analyze:
Content: {memory.content}
Type: {memory.memory_type}

Respond with ONLY valid JSON (no markdown or explanation):
{{
    "importance": 0.0-1.0,
    "contradicts": ["memory_id1", "memory_id2"] (list of IDs this conflicts with, empty if none),
    "similar_to": ["memory_id1"] (list of IDs this is redundant with, empty if none),
    "suggested_tags": ["tag1", "tag2"],
    "reasoning": "brief explanation"
}}
"""

        try:
            content = await self._call_llm(prompt)
            if content:
                return json.loads(content)
        except Exception as e:
            logger.warning(f"LLM call failed: {e}")
            raise

        return None

    async def _analyze_with_heuristic(self, memory: Memory, recent_memories: list[Memory]) -> dict:
        """Fallback heuristic analysis when LLM unavailable."""
        importance = 0.5

        content_lower = memory.content.lower()
        high_importance_keywords = [
            "important",
            "critical",
            "bug",
            "fix",
            "error",
            "security",
            "performance",
            "architect",
            "decision",
        ]
        if any(kw in content_lower for kw in high_importance_keywords):
            importance = 0.7
        if "todo" in content_lower or "fixme" in content_lower:
            importance = 0.8

        contradicts = []
        similar_to = []

        negation_words = ["not", "never", "no", "don't", "doesn't", "won't", "isn't"]
        has_negation = any(neg in content_lower for neg in negation_words)

        for mem in recent_memories:
            mem_lower = mem.content.lower()
            mem_has_negation = any(neg in mem_lower for neg in negation_words)

            if has_negation != mem_has_negation:
                words_set = set(content_lower.split()) & set(mem_lower.split())
                if len(words_set) > 3:
                    contradicts.append(str(mem.id))

            if self._settings.deduplication_enabled and self._is_similar_content(memory.content, mem.content):
                similar_to.append(str(mem.id))

        return {
            "importance": importance,
            "contradicts": contradicts,
            "similar_to": similar_to,
            "suggested_tags": [],
            "reasoning": "heuristic analysis (LLM unavailable)",
        }

    async def _find_similar_memories(
        self, memory: Memory, project_id: str, tenant_id: str
    ) -> list[UUID]:
        """Find similar memories by vector similarity via the Weaviate client."""
        if not memory.vector:
            return []
        try:
            similar = await self._system._weaviate.find_similar_memories_by_vector(
                vector=memory.vector,
                tier=memory.tier,
                project_id=project_id,
                tenant_id=tenant_id,
                threshold=self._settings.deduplication_threshold,
                limit=5,
            )
            return [m.id for m in similar]
        except Exception:
            return []

    def _is_similar_content(self, content1: str, content2: str, threshold: float = 0.8) -> bool:
        """Simple word overlap similarity check."""
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())
        if not words1 or not words2:
            return False
        overlap = len(words1 & words2) / min(len(words1), len(words2))
        return overlap >= threshold

    async def _get_llm(self):
        """Lazy init LLM client. Returns AIRouter if available, else AsyncOpenAI, else None."""
        # Prefer ai_router if the parent system has one configured
        ai_router = getattr(self._system, "ai_router", None)
        if ai_router is not None:
            return ai_router

        if self._llm_client is not None:
            return self._llm_client

        if self._settings.llm_provider == "openai":
            try:
                from openai import AsyncOpenAI

                self._llm_client = AsyncOpenAI(api_key=self._settings.openai_api_key)
            except Exception:
                logger.warning("OpenAI client not available")
                return None

        if self._settings.llm_provider == "deepinfra":
            try:
                from openai import AsyncOpenAI

                self._llm_client = AsyncOpenAI(
                    base_url="https://api.deepinfra.com/v1/openai",
                    api_key=getattr(self._settings, "deepinfra_api_key", None) or "",
                )
            except Exception:
                logger.warning("DeepInfra client not available")
                return None

        return self._llm_client

    async def _call_llm(self, prompt: str) -> str | None:
        """
        Unified LLM call that works with both AIRouter and raw AsyncOpenAI client.
        Returns the response string or None on failure.
        """
        llm = await self._get_llm()
        if llm is None:
            return None
        try:
            from memory_system.ai_provider import AIRouter
            if isinstance(llm, AIRouter):
                return await llm.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    model=self._settings.llm_model,
                    temperature=0.3,
                    max_tokens=500,
                )
            else:
                # Raw AsyncOpenAI client
                response = await llm.chat.completions.create(
                    model=self._settings.llm_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=500,
                )
                content = response.choices[0].message.content
                return content.strip() if content else None
        except Exception as e:
            logger.warning(f"LLM call failed: {e}")
            raise
