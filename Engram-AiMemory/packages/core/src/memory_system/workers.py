"""
Background maintenance service workers.

Runs 9 scheduled jobs via APScheduler:
1. Score importance (every 5min) — Qwen2.5-0.5B via AIRouter
2. Summarize new memories (every 15min) — LFM 2.5 1.2B via AIRouter
3. Contradiction detection (every 1hr) — LFM 2.5 1.2B via AIRouter
4. Entity extraction (every 6hr) — Qwen2.5-0.5B via AIRouter
5. Decay update (daily 2am) — CPU only
6. Consolidation scan (daily 3am) — LFM 2.5 1.2B via AIRouter
7. Delete expired memories (daily 4am) — CPU only, all tenants
8. Confidence maintenance (daily 4:30am) — CPU + optional LLM
9. Timeline event extraction (daily 5am) — via AIRouter

All LLM-dependent jobs use the AIRouter fallback chain (Ollama -> DeepInfra -> OpenAI -> LM Studio).
Jobs gracefully skip when no AI provider is available.

Usage:
    scheduler = MaintenanceScheduler(memory_system, ai_router=router)
    scheduler.start()
    # ... on shutdown:
    scheduler.stop()
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from rich.console import Console

from memory_system.temporal import TemporalExtractor

if TYPE_CHECKING:
    from memory_system.ai_provider import AIRouter
    from memory_system.ollama_client import OllamaClient
    from memory_system.system import MemorySystem

logger = logging.getLogger(__name__)
console = Console()


class MaintenanceScheduler:
    """
    Schedules and runs background maintenance jobs.

    Requires APScheduler: pip install apscheduler>=3.10.0
    All jobs are async and run in the event loop.
    """

    def __init__(
        self,
        memory_system: MemorySystem,
        ollama_client: OllamaClient | None = None,
        ai_router: AIRouter | None = None,
        batch_size: int = 10,
        max_concurrent: int = 2,
    ):
        self._ms = memory_system
        self._ollama = ollama_client
        self._ai_router = ai_router
        self._batch_size = batch_size
        self._max_concurrent = max_concurrent
        self._scheduler = None
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._ai_available: bool | None = None
        self._ai_last_checked: float = 0.0
        self._stats: dict = {
            "jobs_run": 0,
            "memories_scored": 0,
            "memories_summarized": 0,
            "contradictions_found": 0,
            "entities_extracted": 0,
            "memories_decayed": 0,
            "memories_consolidated": 0,
            "memories_deleted": 0,
            "confidence_updates": 0,
            "events_extracted": 0,
            "ai_jobs_skipped": 0,
            "last_run": {},
            "job_durations": {},
            "job_errors": {},
        }

    def start(self) -> None:
        """Start the scheduler. Call after MemorySystem.initialize()."""
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
        except ImportError:
            logger.warning(
                "APScheduler not installed — maintenance workers disabled. pip install apscheduler"
            )
            return

        self._scheduler = AsyncIOScheduler()
        assert self._scheduler is not None  # narrowed for mypy

        # Job 1: Score importance for new unprocessed memories
        self._scheduler.add_job(
            self._job_score_importance,
            "interval",
            minutes=5,
            id="score_importance",
            max_instances=1,
            coalesce=True,
        )

        # Job 2: Summarize new memories > 200 chars
        self._scheduler.add_job(
            self._job_summarize,
            "interval",
            minutes=15,
            id="summarize",
            max_instances=1,
            coalesce=True,
        )

        # Job 3: Contradiction detection for new memories
        self._scheduler.add_job(
            self._job_detect_contradictions,
            "interval",
            hours=1,
            id="contradiction_detection",
            max_instances=1,
            coalesce=True,
        )

        # Job 4: Entity extraction
        self._scheduler.add_job(
            self._job_extract_entities,
            "interval",
            hours=6,
            id="entity_extraction",
            max_instances=1,
            coalesce=True,
        )

        # Job 5: Decay update (daily at 2am)
        self._scheduler.add_job(
            self._job_update_decay,
            "cron",
            hour=2,
            minute=0,
            id="decay_update",
            max_instances=1,
            coalesce=True,
        )

        # Job 6: Consolidation scan (daily at 3am)
        self._scheduler.add_job(
            self._job_consolidate,
            "cron",
            hour=3,
            minute=0,
            id="consolidation",
            max_instances=1,
            coalesce=True,
        )

        # Job 7: Delete expired memories (daily at 4am)
        self._scheduler.add_job(
            self._job_delete_expired,
            "cron",
            hour=4,
            minute=0,
            id="delete_expired",
            max_instances=1,
            coalesce=True,
        )

        # Job 7: Confidence maintenance (daily at 4am)
        self._scheduler.add_job(
            self._job_confidence_maintenance,
            "cron",
            hour=4,
            minute=0,
            id="confidence_maintenance",
            max_instances=1,
            coalesce=True,
        )

        # Job 8: Timeline event extraction (daily at 5am)
        self._scheduler.add_job(
            self._job_event_extraction,
            "cron",
            hour=5,
            minute=0,
            id="event_extraction",
            max_instances=1,
            coalesce=True,
        )

        self._scheduler.start()
        console.print("[green]✓ Maintenance scheduler started (9 jobs)[/green]")

    def stop(self) -> None:
        """Stop the scheduler gracefully."""
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            console.print("[blue]Maintenance scheduler stopped[/blue]")

    def is_running(self) -> bool:
        """Return True if the scheduler is active."""
        return self._scheduler is not None and self._scheduler.running

    def get_stats(self) -> dict:
        """Return maintenance statistics."""
        return {
            **self._stats,
            "scheduler_running": self._scheduler is not None and self._scheduler.running,
        }

    # -------------------------------------------------------------------------
    # Health-aware AI availability
    # -------------------------------------------------------------------------

    async def _check_ai_available(self) -> bool:
        """Check if any AI provider is reachable. Caches result for 5 minutes."""
        now = time.monotonic()
        if self._ai_available is not None and (now - self._ai_last_checked) < 300:
            return self._ai_available

        available = False
        if self._ai_router:
            for provider in getattr(self._ai_router, "providers", []):
                try:
                    result = provider.is_available()
                    if asyncio.iscoroutine(result) or asyncio.isfuture(result):
                        result = await result
                    if result:
                        available = True
                        break
                except Exception as exc:
                    logger.debug(f"AI provider unavailable: {exc}")
                    continue
        elif self._ollama:
            try:
                result = self._ollama.is_available()
                if asyncio.iscoroutine(result) or asyncio.isfuture(result):
                    result = await result
                available = bool(result)
            except Exception as exc:
                logger.debug(f"Ollama availability check failed: {exc}")
                available = False

        if (
            not available
            and not (self._ai_router or self._ollama)
            or not self._ai_router
            and not self._ollama
        ):
            available = False

        self._ai_available = available
        self._ai_last_checked = now
        if not available:
            logger.debug("No AI providers available — AI-dependent jobs will be skipped")
        return available

    def _record_job_timing(self, job_name: str, duration: float, error: str | None = None) -> None:
        """Record per-job duration and error state for observability."""
        self._stats["job_durations"][job_name] = round(duration, 3)
        if error:
            self._stats["job_errors"][job_name] = error
        elif job_name in self._stats["job_errors"]:
            del self._stats["job_errors"][job_name]

    # -------------------------------------------------------------------------
    # AIRouter adapter helpers
    # -------------------------------------------------------------------------

    async def _router_score_importance(self, content: str) -> tuple[float, str]:
        """Use AIRouter to score importance. Returns (score, reason)."""
        from memory_system.ai_provider import TaskComplexity
        from memory_system.ollama_client import IMPORTANCE_PROMPT

        prompt = IMPORTANCE_PROMPT.format(content=content[:2000])
        raw = await self._ai_router.chat_completion(  # type: ignore[union-attr]
            messages=[{"role": "user", "content": prompt}],
            model=self._ms.settings.ollama_classifier_model,
            temperature=0.1,
            max_tokens=200,
            complexity=TaskComplexity.SIMPLE,
        )
        try:
            from memory_system.ollama_client import OllamaClient

            data = OllamaClient(host="")._extract_json(raw)  # reuse JSON extractor
            importance = float(data.get("importance", 0.5))
            reason = data.get("reason", "")
            return max(0.0, min(1.0, importance)), reason
        except Exception as exc:
            logger.debug(f"Router importance scoring failed: {exc}")
            return 0.5, "scoring unavailable"

    async def _router_summarize(self, content: str) -> str | None:
        """Use AIRouter to summarize content. Returns summary string or None."""
        if len(content) < 200:
            return None
        from memory_system.ai_provider import TaskComplexity
        from memory_system.ollama_client import SUMMARIZATION_PROMPT

        prompt = SUMMARIZATION_PROMPT.format(content=content[:4000])
        try:
            summary = await self._ai_router.chat_completion(  # type: ignore[union-attr]
                messages=[{"role": "user", "content": prompt}],
                model=self._ms.settings.ollama_maintenance_model,
                temperature=0.2,
                max_tokens=300,
                complexity=TaskComplexity.STANDARD,
            )
            return summary if summary else None
        except Exception as exc:
            logger.debug(f"Router summarization failed: {exc}")
            return None

    async def _router_detect_contradiction(self, content_a: str, content_b: str) -> dict:
        """Use AIRouter for contradiction detection. Returns same dict shape as OllamaClient."""
        from memory_system.ai_provider import TaskComplexity
        from memory_system.ollama_client import CONTRADICTION_PROMPT

        prompt = CONTRADICTION_PROMPT.format(memory_a=content_a[:1500], memory_b=content_b[:1500])
        try:
            raw = await self._ai_router.chat_completion(  # type: ignore[union-attr]
                messages=[{"role": "user", "content": prompt}],
                model=self._ms.settings.ollama_maintenance_model,
                temperature=0.1,
                max_tokens=200,
                complexity=TaskComplexity.STANDARD,
            )
            from memory_system.ollama_client import OllamaClient

            data = OllamaClient(host="")._extract_json(raw)
            return {
                "contradicts": bool(data.get("contradicts", False)),
                "confidence": float(data.get("confidence", 0.5)),
                "more_likely_correct": data.get("more_likely_correct", "neither"),
                "reason": data.get("reason", ""),
            }
        except Exception as exc:
            logger.debug(f"Router contradiction detection failed: {exc}")
            return {
                "contradicts": False,
                "confidence": 0.0,
                "more_likely_correct": "neither",
                "reason": "",
            }

    async def _router_extract_entities(self, content: str) -> list[dict]:
        """Use AIRouter for entity extraction. Returns same list shape as OllamaClient."""
        from memory_system.ai_provider import TaskComplexity
        from memory_system.ollama_client import ENTITY_EXTRACTION_PROMPT

        prompt = ENTITY_EXTRACTION_PROMPT.format(content=content[:2000])
        try:
            raw = await self._ai_router.chat_completion(  # type: ignore[union-attr]
                messages=[{"role": "user", "content": prompt}],
                model=self._ms.settings.ollama_classifier_model,
                temperature=0.1,
                max_tokens=300,
                complexity=TaskComplexity.SIMPLE,
            )
            from memory_system.ollama_client import OllamaClient

            data = OllamaClient(host="")._extract_json(raw)
            entities = data.get("entities", [])
            valid = []
            for e in entities:
                if isinstance(e, dict) and "name" in e and "type" in e:
                    valid.append(
                        {
                            "name": str(e["name"]),
                            "type": str(e.get("type", "CONCEPT")),
                            "confidence": float(e.get("confidence", 0.7)),
                        }
                    )
            return valid
        except Exception as exc:
            logger.debug(f"Router entity extraction failed: {exc}")
            return []

    async def _router_consolidate_memories(self, memory_contents: list[str]) -> str | None:
        """Use AIRouter to consolidate memories. Returns merged content or None."""
        from memory_system.ai_provider import TaskComplexity
        from memory_system.ollama_client import CONSOLIDATION_PROMPT

        memories_list = "\n\n".join(
            f"Memory {i + 1}: {content[:1000]}" for i, content in enumerate(memory_contents[:5])
        )
        prompt = CONSOLIDATION_PROMPT.format(memories_list=memories_list)
        try:
            result = await self._ai_router.chat_completion(  # type: ignore[union-attr]
                messages=[{"role": "user", "content": prompt}],
                model=self._ms.settings.ollama_maintenance_model,
                temperature=0.3,
                max_tokens=500,
                complexity=TaskComplexity.COMPLEX,
            )
            return result if result else None
        except Exception as exc:
            logger.debug(f"Router consolidation failed: {exc}")
            return None

    # -------------------------------------------------------------------------
    # Job implementations
    # -------------------------------------------------------------------------

    async def _job_score_importance(self) -> None:
        """Score importance for recently added memories that haven't been scored yet."""
        if not self._ms.settings.auto_importance_enabled:
            return
        if not await self._check_ai_available():
            self._stats["ai_jobs_skipped"] += 1
            return

        t0 = time.monotonic()
        async with self._semaphore:
            self._stats["last_run"]["score_importance"] = datetime.now(UTC).isoformat()
            try:
                # Fetch recent memories without AI-scored importance (importance == 0.5 = default)
                memories, _ = await self._ms.list_memories(limit=self._batch_size)
                unscored = [m for m in memories if abs(m.importance - 0.5) < 1e-9]

                # Process memories concurrently with semaphore to limit concurrent AI requests
                async def score_single_memory(mem):
                    try:
                        if self._ai_router:
                            importance, reason = await self._router_score_importance(mem.content)
                        else:
                            importance, reason = await self._ollama.score_importance(mem.content)  # type: ignore[union-attr]
                        await self._ms._weaviate.update_memory_fields(
                            memory_id=mem.id,
                            tier=mem.tier,
                            fields={"importance": importance},
                            tenant_id=mem.tenant_id,
                        )
                        await self._ms._weaviate.update_memory_metadata(
                            memory_id=mem.id,
                            tier=mem.tier,
                            metadata={"importance_reasoning": reason, "ai_scored": True},
                            tenant_id=mem.tenant_id,
                        )
                        return True
                    except Exception as e:
                        logger.warning(f"Failed to score memory {mem.id}: {e}")
                        return False

                # Run scoring concurrently (max 5 at a time via nested semaphore)
                score_semaphore = asyncio.Semaphore(5)

                async def limited_score(mem):
                    async with score_semaphore:
                        return await score_single_memory(mem)

                results = await asyncio.gather(*[limited_score(m) for m in unscored])
                scored_count = sum(1 for r in results if r)
                self._stats["memories_scored"] += scored_count

                if unscored:
                    logger.info(f"Scored importance for {scored_count}/{len(unscored)} memories")
                self._stats["jobs_run"] += 1
                self._record_job_timing("score_importance", time.monotonic() - t0)
            except Exception as e:
                logger.error(f"score_importance job failed: {e}")
                self._record_job_timing("score_importance", time.monotonic() - t0, str(e))

    async def _job_summarize(self) -> None:
        """Generate summaries for long memories that don't have one yet."""
        if not await self._check_ai_available():
            self._stats["ai_jobs_skipped"] += 1
            return

        t0 = time.monotonic()
        async with self._semaphore:
            self._stats["last_run"]["summarize"] = datetime.now(UTC).isoformat()
            try:
                memories, _ = await self._ms.list_memories(limit=self._batch_size)
                # Target: long content without a summary
                to_summarize = [m for m in memories if len(m.content) > 200 and not m.summary]

                for memory in to_summarize:
                    try:
                        if self._ai_router:
                            summary = await self._router_summarize(memory.content)
                        else:
                            summary = await self._ollama.summarize(memory.content)  # type: ignore[union-attr]
                        if summary:
                            await self._ms._weaviate.update_memory_fields(
                                memory_id=memory.id,
                                tier=memory.tier,
                                fields={"summary": summary},
                                tenant_id=memory.tenant_id,
                            )
                            self._stats["memories_summarized"] += 1
                    except Exception as e:
                        logger.warning(f"Failed to summarize memory {memory.id}: {e}")

                if to_summarize:
                    logger.info(f"Summarized {len(to_summarize)} memories")
                self._stats["jobs_run"] += 1
                self._record_job_timing("summarize", time.monotonic() - t0)
            except Exception as e:
                logger.error(f"summarize job failed: {e}")
                self._record_job_timing("summarize", time.monotonic() - t0, str(e))

    async def _job_detect_contradictions(self) -> None:
        """Detect contradictions between recent memories."""
        if not self._ms.settings.contradiction_detection_enabled:
            return
        if not await self._check_ai_available():
            self._stats["ai_jobs_skipped"] += 1
            return

        t0 = time.monotonic()
        async with self._semaphore:
            self._stats["last_run"]["contradiction_detection"] = datetime.now(UTC).isoformat()
            try:
                # Get recent memories to check
                memories, _ = await self._ms.list_memories(limit=20)
                if len(memories) < 2:
                    return

                # Check each memory against others (pairwise, limited)
                checked_pairs: set[frozenset] = set()
                for i, mem_a in enumerate(memories[:10]):  # cap at 10 to avoid O(n²) explosion
                    for mem_b in memories[i + 1 : i + 5]:
                        pair = frozenset([str(mem_a.id), str(mem_b.id)])
                        if pair in checked_pairs:
                            continue
                        checked_pairs.add(pair)

                        try:
                            if self._ai_router:
                                result = await self._router_detect_contradiction(
                                    mem_a.content, mem_b.content
                                )
                            else:
                                result = await self._ollama.detect_contradiction(  # type: ignore[union-attr]
                                    mem_a.content, mem_b.content
                                )
                            if result["contradicts"] and result["confidence"] > 0.7:
                                # Flag both memories
                                for mem, other_id in [(mem_a, mem_b.id), (mem_b, mem_a.id)]:
                                    await self._ms._weaviate.update_memory_metadata(
                                        memory_id=mem.id,
                                        tier=mem.tier,
                                        metadata={
                                            "contradicts_with": str(other_id),
                                            "contradiction_confidence": result["confidence"],
                                            "contradiction_reason": result["reason"],
                                        },
                                        tenant_id=mem.tenant_id,
                                    )
                                self._stats["contradictions_found"] += 1
                                logger.info(
                                    f"Contradiction detected: {mem_a.id} vs {mem_b.id} "
                                    f"(confidence={result['confidence']:.2f})"
                                )
                        except Exception as e:
                            logger.warning(f"Contradiction check failed for pair: {e}")

                self._stats["jobs_run"] += 1
                self._record_job_timing("contradiction_detection", time.monotonic() - t0)
            except Exception as e:
                logger.error(f"contradiction_detection job failed: {e}")
                self._record_job_timing("contradiction_detection", time.monotonic() - t0, str(e))

    async def _job_extract_entities(self) -> None:
        """Extract entities from memories and populate knowledge graph."""
        if not await self._check_ai_available():
            self._stats["ai_jobs_skipped"] += 1
            return

        t0 = time.monotonic()
        async with self._semaphore:
            self._stats["last_run"]["entity_extraction"] = datetime.now(UTC).isoformat()
            try:
                memories, _ = await self._ms.list_memories(limit=self._batch_size)

                for memory in memories:
                    try:
                        if self._ai_router:
                            entities = await self._router_extract_entities(memory.content)
                        else:
                            entities = await self._ollama.extract_entities(memory.content)  # type: ignore[union-attr]
                        for entity_data in entities:
                            if entity_data["confidence"] < 0.6:
                                continue
                            # Check if entity already exists
                            existing = await self._ms.find_entity_by_name(
                                name=entity_data["name"],
                                project_id=memory.project_id,
                                tenant_id=memory.tenant_id,
                            )
                            if not existing:
                                await self._ms.add_entity(
                                    name=entity_data["name"],
                                    entity_type=entity_data["type"],
                                    project_id=memory.project_id,
                                    tenant_id=memory.tenant_id,
                                    metadata={
                                        "source_memory_id": str(memory.id),
                                        "auto_extracted": True,
                                    },
                                )
                                self._stats["entities_extracted"] += 1
                    except Exception as e:
                        logger.warning(f"Entity extraction failed for memory {memory.id}: {e}")

                self._stats["jobs_run"] += 1
                self._record_job_timing("entity_extraction", time.monotonic() - t0)
            except Exception as e:
                logger.error(f"entity_extraction job failed: {e}")
                self._record_job_timing("entity_extraction", time.monotonic() - t0, str(e))

    async def _job_event_extraction(self) -> None:
        """Extract temporal events from recent unstructured memories."""
        if not (self._ai_router or self._ollama):
            self._stats["ai_jobs_skipped"] += 1
            return

        async with self._semaphore:
            self._stats["last_run"]["event_extraction"] = datetime.now(UTC).isoformat()
            try:
                # Find recent memories that are NOT already marked as events
                memories, _ = await self._ms.list_memories(limit=20)
                extractor = TemporalExtractor(self._ollama)

                total_extracted = 0

                for memory in memories:
                    # Skip if already processed for events
                    if memory.is_event or not memory.content:
                        continue

                    # Also we should probably only extract from facts or documents, not system errors
                    if str(memory.memory_type) in ["error_solution", "workflow", "preference"]:
                        continue

                    events = await extractor.extract_timeline_events(memory.content)
                    if events:
                        # Convert this memory to an event memory using the first primary event
                        # (in a real system we might split into multiple child memories)
                        memory = extractor.bind_temporal_bounds(memory, events[0])

                        await self._ms._weaviate.update_memory_fields(
                            memory_id=memory.id,
                            tier=memory.tier,
                            fields={
                                "is_event": True,
                                "temporal_bounds": __import__("json").dumps(
                                    {
                                        "start_time": memory.temporal_bounds.start_time.isoformat()
                                        if memory.temporal_bounds.start_time
                                        else None,
                                        "end_time": memory.temporal_bounds.end_time.isoformat()
                                        if memory.temporal_bounds.end_time
                                        else None,
                                        "resolution": memory.temporal_bounds.resolution,
                                        "is_ongoing": memory.temporal_bounds.is_ongoing,
                                        "relative_to": memory.temporal_bounds.relative_to,
                                    }
                                )
                                if memory.temporal_bounds
                                else None,
                            },
                            tenant_id=memory.tenant_id,
                        )
                        total_extracted += 1

                self._stats["jobs_run"] += 1
                logger.info(f"Extracted {total_extracted} timeline events")
            except Exception as e:
                logger.error(f"event_extraction job failed: {e}")

    async def _job_update_decay(self) -> None:
        """Update decay_factor for all memories based on access recency."""
        async with self._semaphore:
            self._stats["last_run"]["decay_update"] = datetime.now(UTC).isoformat()
            try:
                settings = self._ms.settings
                half_life = int(getattr(settings, "decay_half_life_days", 30))
                access_boost = getattr(settings, "decay_access_boost", 0.1)
                min_importance = getattr(settings, "decay_min_importance", 0.1)

                offset = 0
                total_updated = 0
                while True:
                    memories, total = await self._ms.list_memories(limit=100, offset=offset)
                    if not memories:
                        break

                    now = datetime.now(UTC)
                    for memory in memories:
                        try:
                            from memory_system.decay import MemoryDecay

                            decay_calc = MemoryDecay(half_life_days=int(half_life))
                            new_decay = decay_calc.calculate_decay(
                                created_at=memory.created_at,
                                last_accessed=memory.last_accessed_at,
                                access_count=memory.access_count,
                                access_boost=access_boost,
                                min_importance=min_importance,
                                now=now,
                            )

                            await self._ms._weaviate.update_memory_fields(
                                memory_id=memory.id,
                                tier=memory.tier,
                                fields={"decay_factor": new_decay},
                                tenant_id=memory.tenant_id,
                            )
                            total_updated += 1
                        except Exception as e:
                            import logging

                            logger = logging.getLogger(__name__)
                            logger.warning(f"Decay update failed for {memory.id}: {e}")

                    offset += len(memories)
                    if offset >= total:
                        break

                self._stats["memories_decayed"] = total_updated
                self._stats["jobs_run"] += 1
                import logging

                logger = logging.getLogger(__name__)
                logger.info(f"Updated decay for {total_updated} memories")
            except Exception as e:
                import logging

                logger = logging.getLogger(__name__)
                logger.error(f"decay_update job failed: {e}")

    async def _job_consolidate(self) -> None:
        """Find and merge near-duplicate memories using LFM 2.5."""
        if not (self._ai_router or self._ollama):
            return

        async with self._semaphore:
            self._stats["last_run"]["consolidation"] = datetime.now(UTC).isoformat()
            try:
                from memory_system.memory import Memory, MemorySource, MemoryType

                consolidated_count = 0
                # Get recent memories and find near-duplicates via vector similarity
                memories, _ = await self._ms.list_memories(limit=50)

                # Group by similarity — simple approach: batch embed and cluster
                # For now: find memories with same project_id and similar content length
                # (Full vector clustering would require fetching all vectors from Weaviate)
                project_groups: dict[str, list] = {}
                for mem in memories:
                    key = mem.project_id or "global"
                    project_groups.setdefault(key, []).append(mem)

                for _project_id, group in project_groups.items():
                    if len(group) < 3:
                        continue

                    # Find candidates: memories with no canonical_id (not already merged)
                    candidates = [m for m in group if not m.canonical_id]
                    if len(candidates) < 3:
                        continue

                    # Use vector similarity to find near-duplicates
                    if candidates[0].vector:
                        similar = await self._ms._weaviate.find_similar_memories_by_vector(
                            vector=candidates[0].vector,
                            tier=candidates[0].tier,
                            tenant_id=candidates[0].tenant_id,
                            limit=5,
                            threshold=0.92,
                        )
                        if len(similar) >= 2:
                            # Consolidate these similar memories
                            contents = [m.content for m in similar]
                            if self._ai_router:
                                merged_content = await self._router_consolidate_memories(contents)
                            else:
                                merged_content = await self._ollama.consolidate_memories(contents)  # type: ignore[union-attr]

                            if merged_content:
                                # Create canonical memory
                                embedding = await self._ms._get_embedding(merged_content)
                                canonical = Memory(
                                    content=merged_content,
                                    tier=similar[0].tier,
                                    memory_type=MemoryType.CONSOLIDATED,
                                    source=MemorySource.SYSTEM,
                                    project_id=similar[0].project_id,
                                    tenant_id=similar[0].tenant_id,
                                    importance=max(m.importance for m in similar),
                                    confidence=0.8,
                                    tags=list({tag for m in similar for tag in m.tags}),
                                    vector=embedding,
                                    is_canonical=True,
                                )
                                canonical_id = await self._ms._weaviate.add_memory(canonical)

                                # Mark originals as duplicates
                                for mem in similar:
                                    await self._ms._weaviate.update_memory_fields(
                                        memory_id=mem.id,
                                        tier=mem.tier,
                                        fields={
                                            "canonical_id": str(canonical_id),
                                            "is_canonical": False,
                                        },
                                        tenant_id=mem.tenant_id,
                                    )

                                consolidated_count += len(similar)
                                logger.info(
                                    f"Consolidated {len(similar)} memories → {canonical_id}"
                                )

                self._stats["memories_consolidated"] += consolidated_count
                self._stats["jobs_run"] += 1
                if consolidated_count:
                    logger.info(f"Consolidation complete: {consolidated_count} memories merged")
            except Exception as e:
                logger.error(f"consolidation job failed: {e}")

    async def _job_delete_expired(self) -> None:
        """Delete memories past their expires_at date."""
        async with self._semaphore:
            self._stats["last_run"]["delete_expired"] = datetime.now(UTC).isoformat()
            try:
                from memory_system.memory import MemoryTier

                total_deleted = 0
                if self._ms.settings.multi_tenancy_enabled:
                    tenants = await self._ms._weaviate.list_tenants()
                    if not tenants:
                        tenants = [self._ms.settings.default_tenant_id]
                else:
                    tenants = [self._ms.settings.default_tenant_id]

                invalidated_tenants: set[str] = set()
                for tenant_id in tenants:
                    for tier in MemoryTier:
                        deleted = await self._ms._weaviate.delete_expired_memories(
                            tier=tier,
                            tenant_id=tenant_id,
                        )
                        total_deleted += deleted
                        if deleted > 0:
                            invalidated_tenants.add(tenant_id)

                if invalidated_tenants:
                    for tenant_id in sorted(invalidated_tenants):
                        await self._ms._cache.invalidate_stats(tenant_id)
                    logger.info(f"Deleted {total_deleted} expired memories")

                self._stats["memories_deleted"] += total_deleted
                self._stats["jobs_run"] += 1
            except Exception as e:
                logger.error(f"delete_expired job failed: {e}")

    async def _job_confidence_maintenance(self) -> None:
        """Re-evaluate overall_confidence for memories based on age, access, source, and evidence."""
        t0 = time.monotonic()
        async with self._semaphore:
            self._stats["last_run"]["confidence_maintenance"] = datetime.now(UTC).isoformat()
            try:
                from memory_system.credibility import SourceCredibilityManager

                credibility = SourceCredibilityManager()
                total_updated = 0
                offset = 0

                while True:
                    memories, total = await self._ms.list_memories(limit=50, offset=offset)
                    if not memories:
                        break

                    now = datetime.now(UTC)
                    for memory in memories:
                        try:
                            source_type = str(getattr(memory, "source", "ai_assistant"))
                            source_id = memory.user_id or "unknown"
                            source_conf = credibility.calculate_source_confidence(
                                source_type=source_type,
                                source_id=source_id,
                                timestamp=memory.created_at,
                            )

                            age_days = (now - memory.created_at).total_seconds() / 86400
                            age_penalty = max(0.0, 1.0 - (age_days / 365.0) * 0.2)

                            access_boost = min(0.15, (memory.access_count or 0) * 0.02)

                            evidence_boost = min(0.1, len(memory.supporting_evidence_ids) * 0.03)
                            contradiction_penalty = (
                                -0.15
                                if memory.contradictions and not memory.contradictions_resolved
                                else 0.0
                            )

                            new_confidence = (
                                source_conf * 0.4
                                + age_penalty * 0.2
                                + access_boost
                                + evidence_boost
                                + contradiction_penalty
                                + (memory.decay_factor or 1.0) * 0.2
                            )
                            new_confidence = max(0.05, min(0.99, new_confidence))

                            if abs(new_confidence - (memory.overall_confidence or 0.5)) > 0.02:
                                await self._ms._weaviate.update_memory_fields(
                                    memory_id=memory.id,
                                    tier=memory.tier,
                                    fields={
                                        "overall_confidence": round(new_confidence, 4),
                                        "last_confidence_update": now.isoformat(),
                                    },
                                    tenant_id=memory.tenant_id,
                                )
                                total_updated += 1
                        except Exception as e:
                            logger.warning(f"Confidence update failed for {memory.id}: {e}")

                    offset += len(memories)
                    if offset >= total:
                        break

                self._stats["confidence_updates"] += total_updated
                self._stats["jobs_run"] += 1
                self._record_job_timing("confidence_maintenance", time.monotonic() - t0)
                if total_updated:
                    logger.info(f"Updated confidence for {total_updated} memories")
            except Exception as e:
                logger.error(f"confidence_maintenance job failed: {e}")
                self._record_job_timing("confidence_maintenance", time.monotonic() - t0, str(e))
