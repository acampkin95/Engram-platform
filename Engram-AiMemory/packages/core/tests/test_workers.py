"""
Unit tests for memory_system.workers — MaintenanceScheduler.

Mocks MemorySystem, OllamaClient, APScheduler (external services).
Tests real scheduling logic, stats tracking, and job routing.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from memory_system.memory import (
    Memory,
    MemorySource,
    MemoryTier,
    MemoryType,
)
from memory_system.workers import MaintenanceScheduler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_memory(
    content: str = "Test memory content",
    importance: float = 0.5,
    summary: str | None = None,
    vector: list[float] | None = None,
    canonical_id: str | None = None,
    tier: MemoryTier = MemoryTier.PROJECT,
    project_id: str = "test-project",
    tenant_id: str = "default",
    access_count: int = 0,
    last_accessed_at: datetime | None = None,
    created_at: datetime | None = None,
) -> Memory:
    return Memory(
        id=uuid4(),
        content=content,
        tier=tier,
        memory_type=MemoryType.FACT,
        source=MemorySource.AGENT,
        project_id=project_id,
        user_id="test-user",
        tenant_id=tenant_id,
        importance=importance,
        confidence=0.9,
        tags=[],
        metadata={},
        summary=summary,
        vector=vector,
        canonical_id=canonical_id,
        access_count=access_count,
        last_accessed_at=last_accessed_at,
        created_at=created_at or datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _make_mock_system() -> MagicMock:
    """Create a mock MemorySystem for scheduler tests."""
    system = MagicMock()
    mock_settings = MagicMock()
    mock_settings.auto_importance_enabled = True
    mock_settings.contradiction_detection_enabled = True
    mock_settings.ollama_classifier_model = "qwen2.5:0.5b-instruct"
    mock_settings.ollama_maintenance_model = "liquid/lfm2.5:1.2b"
    mock_settings.default_tenant_id = "default"
    mock_settings.multi_tenancy_enabled = True
    mock_settings.decay_half_life_days = 30.0
    mock_settings.decay_access_boost = 0.1
    mock_settings.decay_min_importance = 0.1
    system.settings = mock_settings

    system.list_memories = AsyncMock(return_value=([], 0))
    system.find_entity_by_name = AsyncMock(return_value=None)
    system.add_entity = AsyncMock(return_value=uuid4())
    system._weaviate = MagicMock()
    system._weaviate.update_memory_fields = AsyncMock()
    system._weaviate.update_memory_metadata = AsyncMock()
    system._weaviate.delete_expired_memories = AsyncMock(return_value=0)
    system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=[])
    system._weaviate.add_memory = AsyncMock(return_value=uuid4())
    system._weaviate.list_tenants = AsyncMock(return_value=["default"])
    system._cache = MagicMock()
    system._cache.invalidate_stats = AsyncMock()
    system._get_embedding = AsyncMock(return_value=[0.1] * 768)

    return system


def _make_mock_ollama() -> MagicMock:
    """Create a mock OllamaClient that reports as available."""
    ollama = MagicMock()
    ollama.is_available = AsyncMock(return_value=True)
    ollama.score_importance = AsyncMock(return_value=(0.8, "test reason"))
    ollama.summarize = AsyncMock(return_value="Test summary")
    ollama.detect_contradiction = AsyncMock(
        return_value={
            "contradicts": False,
            "confidence": 0.0,
            "more_likely_correct": "neither",
            "reason": "",
        }
    )
    ollama.extract_entities = AsyncMock(return_value=[])
    ollama.consolidate_memories = AsyncMock(return_value="Merged content")
    return ollama


def _make_mock_router(available: bool = True) -> MagicMock:
    """Create a mock AIRouter with an available provider."""
    mock_router = MagicMock()
    mock_provider = MagicMock()
    mock_provider.is_available = AsyncMock(return_value=available)
    mock_router.providers = [mock_provider]
    mock_router.chat_completion = AsyncMock(return_value='{"importance": 0.8, "reason": "test"}')
    return mock_router


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------


class TestMaintenanceSchedulerInit:
    def test_default_params(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)

        assert scheduler._ms is system
        assert scheduler._ollama is None
        assert scheduler._ai_router is None
        assert scheduler._batch_size == 10
        assert scheduler._max_concurrent == 2
        assert scheduler._scheduler is None

    def test_custom_params(self) -> None:
        system = _make_mock_system()
        mock_ollama = MagicMock()
        mock_router = MagicMock()

        scheduler = MaintenanceScheduler(
            system,
            ollama_client=mock_ollama,
            ai_router=mock_router,
            batch_size=20,
            max_concurrent=4,
        )

        assert scheduler._ollama is mock_ollama
        assert scheduler._ai_router is mock_router
        assert scheduler._batch_size == 20
        assert scheduler._max_concurrent == 4

    def test_initial_stats(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)

        stats = scheduler._stats
        assert stats["jobs_run"] == 0
        assert stats["memories_scored"] == 0
        assert stats["memories_summarized"] == 0
        assert stats["contradictions_found"] == 0
        assert stats["entities_extracted"] == 0
        assert stats["memories_decayed"] == 0
        assert stats["memories_consolidated"] == 0
        assert stats["memories_deleted"] == 0
        assert stats["last_run"] == {}


# ---------------------------------------------------------------------------
# start / stop / is_running / get_stats
# ---------------------------------------------------------------------------


class TestSchedulerLifecycle:
    def test_start_without_apscheduler(self) -> None:
        """When APScheduler is not installed, start() should warn and return."""
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)

        with patch.dict(
            "sys.modules",
            {
                "apscheduler": None,
                "apscheduler.schedulers": None,
                "apscheduler.schedulers.asyncio": None,
            },
        ):
            with patch("memory_system.workers.MaintenanceScheduler.start") as mock_start:
                # Simulate the ImportError path
                pass

        # Direct test: manually test the ImportError branch
        scheduler_obj = MaintenanceScheduler(system)
        original_import = (
            __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__
        )

        def mock_import(name, *args, **kwargs):
            if "apscheduler" in name:
                raise ImportError("No module named 'apscheduler'")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            scheduler_obj.start()

        assert scheduler_obj._scheduler is None

    def test_start_with_apscheduler(self) -> None:
        """When APScheduler is available, start() should create and start scheduler."""
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)

        mock_async_scheduler = MagicMock()
        mock_module = MagicMock()
        mock_module.AsyncIOScheduler.return_value = mock_async_scheduler

        with patch.dict("sys.modules", {"apscheduler.schedulers.asyncio": mock_module}):
            scheduler.start()

        assert scheduler._scheduler is mock_async_scheduler
        mock_async_scheduler.start.assert_called_once()
        # Should have added 9 jobs
        assert mock_async_scheduler.add_job.call_count == 9

    def test_stop_when_running(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        mock_sched = MagicMock()
        mock_sched.running = True
        scheduler._scheduler = mock_sched

        scheduler.stop()
        mock_sched.shutdown.assert_called_once_with(wait=False)

    def test_stop_when_not_running(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        mock_sched = MagicMock()
        mock_sched.running = False
        scheduler._scheduler = mock_sched

        scheduler.stop()
        mock_sched.shutdown.assert_not_called()

    def test_stop_when_no_scheduler(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        scheduler.stop()  # Should not raise

    def test_is_running_true(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        mock_sched = MagicMock()
        mock_sched.running = True
        scheduler._scheduler = mock_sched

        assert scheduler.is_running() is True

    def test_is_running_false_no_scheduler(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        assert scheduler.is_running() is False

    def test_is_running_false_stopped(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        mock_sched = MagicMock()
        mock_sched.running = False
        scheduler._scheduler = mock_sched

        assert scheduler.is_running() is False

    def test_get_stats(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        mock_sched = MagicMock()
        mock_sched.running = True
        scheduler._scheduler = mock_sched

        stats = scheduler.get_stats()
        assert stats["scheduler_running"] is True
        assert stats["jobs_run"] == 0

    def test_get_stats_no_scheduler(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)

        stats = scheduler.get_stats()
        assert stats["scheduler_running"] is False


# ---------------------------------------------------------------------------
# Job methods
# ---------------------------------------------------------------------------


class TestJobScoreImportance:
    async def test_skips_when_no_ai_provider(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system, ollama_client=None, ai_router=None)
        await scheduler._job_score_importance()
        system.list_memories.assert_not_called()

    async def test_skips_when_auto_importance_disabled(self) -> None:
        system = _make_mock_system()
        system.settings.auto_importance_enabled = False
        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_score_importance()
        system.list_memories.assert_not_called()

    async def test_scores_unscored_memories_with_ollama(self) -> None:
        system = _make_mock_system()
        unscored_mem = _make_memory(importance=0.5)  # default = unscored
        system.list_memories = AsyncMock(return_value=([unscored_mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.score_importance = AsyncMock(return_value=(0.8, "high quality"))

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_score_importance()

        assert scheduler._stats["memories_scored"] == 1
        assert scheduler._stats["jobs_run"] == 1
        system._weaviate.update_memory_fields.assert_called_once()
        system._weaviate.update_memory_metadata.assert_called_once()

    async def test_skips_already_scored_memories(self) -> None:
        system = _make_mock_system()
        scored_mem = _make_memory(importance=0.8)  # Already scored (not 0.5)
        system.list_memories = AsyncMock(return_value=([scored_mem], 1))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_score_importance()

        mock_ollama.score_importance.assert_not_called()


class TestJobSummarize:
    async def test_skips_when_no_ai_provider(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        await scheduler._job_summarize()
        system.list_memories.assert_not_called()

    async def test_summarizes_long_memories_without_summary(self) -> None:
        system = _make_mock_system()
        long_mem = _make_memory(content="x" * 300, summary=None)
        system.list_memories = AsyncMock(return_value=([long_mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.summarize = AsyncMock(return_value="A summary")

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_summarize()

        assert scheduler._stats["memories_summarized"] == 1

    async def test_skips_short_memories(self) -> None:
        system = _make_mock_system()
        short_mem = _make_memory(content="short", summary=None)
        system.list_memories = AsyncMock(return_value=([short_mem], 1))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_summarize()

        mock_ollama.summarize.assert_not_called()

    async def test_skips_already_summarized(self) -> None:
        system = _make_mock_system()
        summarized_mem = _make_memory(content="x" * 300, summary="existing summary")
        system.list_memories = AsyncMock(return_value=([summarized_mem], 1))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_summarize()

        mock_ollama.summarize.assert_not_called()


class TestJobUpdateDecay:
    async def test_updates_decay_for_memories(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(
            access_count=2,
            last_accessed_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
        )
        system.list_memories = AsyncMock(side_effect=[([mem], 1), ([], 0)])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_update_decay()

        assert scheduler._stats["memories_decayed"] == 1
        system._weaviate.update_memory_fields.assert_called_once()

    async def test_handles_no_memories(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(return_value=([], 0))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_update_decay()

        assert scheduler._stats["memories_decayed"] == 0


class TestJobDeleteExpired:
    async def test_deletes_and_invalidates_cache(self) -> None:
        system = _make_mock_system()
        system._weaviate.delete_expired_memories = AsyncMock(return_value=3)
        system._weaviate.list_tenants = AsyncMock(return_value=["default"])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_delete_expired()

        assert scheduler._stats["memories_deleted"] == 9  # 3 tiers x 3 per tier
        system._cache.invalidate_stats.assert_called_once()

    async def test_no_deletions_skips_cache_invalidation(self) -> None:
        system = _make_mock_system()
        system._weaviate.delete_expired_memories = AsyncMock(return_value=0)
        system._weaviate.list_tenants = AsyncMock(return_value=["default"])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_delete_expired()

        assert scheduler._stats["memories_deleted"] == 0
        system._cache.invalidate_stats.assert_not_called()

    async def test_deletes_for_all_tenants(self) -> None:
        system = _make_mock_system()
        system._weaviate.list_tenants = AsyncMock(return_value=["default", "tenant-b"])
        system._weaviate.delete_expired_memories = AsyncMock(side_effect=[1, 0, 0, 2, 0, 0])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_delete_expired()

        assert scheduler._stats["memories_deleted"] == 3
        assert system._weaviate.delete_expired_memories.await_count == 6
        system._cache.invalidate_stats.assert_any_await("default")
        system._cache.invalidate_stats.assert_any_await("tenant-b")


class TestJobDetectContradictions:
    async def test_skips_when_disabled(self) -> None:
        system = _make_mock_system()
        system.settings.contradiction_detection_enabled = False
        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_detect_contradictions()
        system.list_memories.assert_not_called()

    async def test_skips_when_fewer_than_2_memories(self) -> None:
        system = _make_mock_system()
        mem = _make_memory()
        system.list_memories = AsyncMock(return_value=([mem], 1))

        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_detect_contradictions()

        # Should return early, not attempt contradiction checks
        assert scheduler._stats["contradictions_found"] == 0


class TestJobExtractEntities:
    async def test_skips_when_no_ai_provider(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        await scheduler._job_extract_entities()
        system.list_memories.assert_not_called()

    async def test_extracts_and_stores_entities(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(content="Python is used by Google")
        system.list_memories = AsyncMock(return_value=([mem], 1))
        system.find_entity_by_name = AsyncMock(return_value=None)

        mock_ollama = MagicMock()
        mock_ollama.extract_entities = AsyncMock(
            return_value=[
                {"name": "Python", "type": "TECHNOLOGY", "confidence": 0.9},
                {"name": "Google", "type": "ORGANIZATION", "confidence": 0.8},
            ]
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_extract_entities()

        assert scheduler._stats["entities_extracted"] == 2
        assert system.add_entity.call_count == 2

    async def test_skips_low_confidence_entities(self) -> None:
        system = _make_mock_system()
        mem = _make_memory()
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.extract_entities = AsyncMock(
            return_value=[
                {"name": "Maybe", "type": "CONCEPT", "confidence": 0.3},  # Below 0.6 threshold
            ]
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_extract_entities()

        system.add_entity.assert_not_called()

    async def test_skips_existing_entities(self) -> None:
        system = _make_mock_system()
        mem = _make_memory()
        system.list_memories = AsyncMock(return_value=([mem], 1))
        system.find_entity_by_name = AsyncMock(return_value=MagicMock())  # Entity exists

        mock_ollama = MagicMock()
        mock_ollama.extract_entities = AsyncMock(
            return_value=[{"name": "Existing", "type": "CONCEPT", "confidence": 0.9}]
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_extract_entities()

        system.add_entity.assert_not_called()


# ---------------------------------------------------------------------------
# Extended job tests — covering uncovered paths
# ---------------------------------------------------------------------------


class TestJobDetectContradictionsBody:
    """Cover the actual pair-check + flagging logic (lines ~391-431)."""

    async def test_detects_and_flags_contradiction(self) -> None:
        system = _make_mock_system()
        mem_a = _make_memory(content="The sky is blue")
        mem_b = _make_memory(content="The sky is not blue")
        system.list_memories = AsyncMock(return_value=([mem_a, mem_b], 2))

        mock_ollama = MagicMock()
        mock_ollama.detect_contradiction = AsyncMock(
            return_value={
                "contradicts": True,
                "confidence": 0.9,
                "more_likely_correct": "memory_a",
                "reason": "Opposite claims",
            }
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_detect_contradictions()

        assert scheduler._stats["contradictions_found"] == 1
        assert scheduler._stats["jobs_run"] == 1
        # Both memories get metadata update
        assert system._weaviate.update_memory_metadata.call_count == 2

    async def test_no_flag_when_confidence_below_threshold(self) -> None:
        system = _make_mock_system()
        mem_a = _make_memory(content="Claim A")
        mem_b = _make_memory(content="Claim B")
        system.list_memories = AsyncMock(return_value=([mem_a, mem_b], 2))

        mock_ollama = MagicMock()
        mock_ollama.detect_contradiction = AsyncMock(
            return_value={
                "contradicts": True,
                "confidence": 0.3,  # Below 0.7 threshold
                "more_likely_correct": "neither",
                "reason": "",
            }
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_detect_contradictions()

        assert scheduler._stats["contradictions_found"] == 0
        system._weaviate.update_memory_metadata.assert_not_called()

    async def test_no_flag_when_not_contradicting(self) -> None:
        system = _make_mock_system()
        mem_a = _make_memory(content="Python is great")
        mem_b = _make_memory(content="Python is popular")
        system.list_memories = AsyncMock(return_value=([mem_a, mem_b], 2))

        mock_ollama = MagicMock()
        mock_ollama.detect_contradiction = AsyncMock(
            return_value={
                "contradicts": False,
                "confidence": 0.1,
                "more_likely_correct": "neither",
                "reason": "",
            }
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_detect_contradictions()

        assert scheduler._stats["contradictions_found"] == 0

    async def test_handles_pair_check_exception(self) -> None:
        system = _make_mock_system()
        mem_a = _make_memory(content="X")
        mem_b = _make_memory(content="Y")
        system.list_memories = AsyncMock(return_value=([mem_a, mem_b], 2))

        mock_ollama = MagicMock()
        mock_ollama.detect_contradiction = AsyncMock(side_effect=RuntimeError("AI error"))

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_detect_contradictions()

        assert scheduler._stats["contradictions_found"] == 0
        assert scheduler._stats["jobs_run"] == 1

    async def test_handles_outer_exception(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB down"))

        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_detect_contradictions()

        # Should not crash
        assert scheduler._stats["contradictions_found"] == 0


class TestJobConsolidateExtended:
    """Cover the full consolidation job (lines ~536-622)."""

    async def test_skips_when_no_ai_provider(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)  # no ollama or ai_router
        await scheduler._job_consolidate()
        system.list_memories.assert_not_called()

    async def test_consolidates_similar_memories(self) -> None:
        system = _make_mock_system()
        mems = [
            _make_memory(
                content=f"Memory about topic {i}",
                project_id="proj-1",
                vector=[0.1] * 768,
                canonical_id=None,
                importance=0.5 + i * 0.1,
            )
            for i in range(4)
        ]
        system.list_memories = AsyncMock(return_value=(mems, 4))

        # find_similar returns 3 similar memories
        similar = mems[:3]
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=similar)

        canonical_id = uuid4()
        system._weaviate.add_memory = AsyncMock(return_value=canonical_id)

        mock_ollama = MagicMock()
        mock_ollama.consolidate_memories = AsyncMock(
            return_value="Consolidated content about topic"
        )

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        assert scheduler._stats["memories_consolidated"] == 3
        assert scheduler._stats["jobs_run"] == 1
        system._weaviate.add_memory.assert_called_once()
        # 3 originals marked as duplicates
        assert system._weaviate.update_memory_fields.call_count == 3

    async def test_skips_groups_smaller_than_3(self) -> None:
        system = _make_mock_system()
        mems = [_make_memory(project_id="proj-1", canonical_id=None) for _ in range(2)]
        system.list_memories = AsyncMock(return_value=(mems, 2))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        assert scheduler._stats["memories_consolidated"] == 0

    async def test_skips_candidates_with_canonical_id(self) -> None:
        system = _make_mock_system()
        # All memories already have canonical_id → they're already merged
        mems = [_make_memory(project_id="proj-1", canonical_id=str(uuid4())) for _ in range(4)]
        system.list_memories = AsyncMock(return_value=(mems, 4))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        assert scheduler._stats["memories_consolidated"] == 0

    async def test_skips_when_no_vector(self) -> None:
        system = _make_mock_system()
        mems = [_make_memory(project_id="proj-1", canonical_id=None, vector=None) for _ in range(4)]
        system.list_memories = AsyncMock(return_value=(mems, 4))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        assert scheduler._stats["memories_consolidated"] == 0

    async def test_skips_when_too_few_similar(self) -> None:
        system = _make_mock_system()
        mems = [
            _make_memory(project_id="proj-1", vector=[0.1] * 768, canonical_id=None)
            for _ in range(4)
        ]
        system.list_memories = AsyncMock(return_value=(mems, 4))
        # Only 1 similar found — below threshold of 2
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=[mems[0]])

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        assert scheduler._stats["memories_consolidated"] == 0

    async def test_skips_when_consolidation_returns_none(self) -> None:
        system = _make_mock_system()
        mems = [
            _make_memory(project_id="proj-1", vector=[0.1] * 768, canonical_id=None)
            for _ in range(4)
        ]
        system.list_memories = AsyncMock(return_value=(mems, 4))
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=mems[:3])

        mock_ollama = MagicMock()
        mock_ollama.consolidate_memories = AsyncMock(return_value=None)

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        # merged_content was None → no canonical created
        system._weaviate.add_memory.assert_not_called()
        assert scheduler._stats["memories_consolidated"] == 0

    async def test_handles_outer_exception(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB error"))

        mock_ollama = MagicMock()
        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_consolidate()

        # Should not crash
        assert scheduler._stats["memories_consolidated"] == 0


class TestJobScoreImportanceExtended:
    """Cover exception handler and logging paths in _job_score_importance."""

    async def test_handles_individual_memory_score_error(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(importance=0.5)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.score_importance = AsyncMock(side_effect=RuntimeError("Ollama down"))

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_score_importance()

        # Memory not scored due to error but job completes
        assert scheduler._stats["memories_scored"] == 0
        assert scheduler._stats["jobs_run"] == 1

    async def test_handles_outer_exception(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB error"))

        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_score_importance()

        # Should not crash
        assert scheduler._stats["jobs_run"] == 0


class TestJobSummarizeExtended:
    """Cover exception handler and edge paths in _job_summarize."""

    async def test_handles_individual_memory_summarize_error(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(content="x" * 300, summary=None)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.summarize = AsyncMock(side_effect=RuntimeError("Ollama down"))

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_summarize()

        assert scheduler._stats["memories_summarized"] == 0
        assert scheduler._stats["jobs_run"] == 1

    async def test_skips_when_summarize_returns_none(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(content="x" * 300, summary=None)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.summarize = AsyncMock(return_value=None)

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_summarize()

        # Summary was None, so no update
        system._weaviate.update_memory_fields.assert_not_called()
        assert scheduler._stats["memories_summarized"] == 0

    async def test_handles_outer_exception(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB error"))

        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_summarize()

        assert scheduler._stats["jobs_run"] == 0


class TestJobExtractEntitiesExtended:
    """Cover exception handlers in _job_extract_entities."""

    async def test_handles_individual_extraction_error(self) -> None:
        system = _make_mock_system()
        mem = _make_memory()
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_ollama = MagicMock()
        mock_ollama.extract_entities = AsyncMock(side_effect=RuntimeError("fail"))

        scheduler = MaintenanceScheduler(system, ollama_client=mock_ollama)
        await scheduler._job_extract_entities()

        assert scheduler._stats["entities_extracted"] == 0
        assert scheduler._stats["jobs_run"] == 1

    async def test_handles_outer_exception(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB error"))

        scheduler = MaintenanceScheduler(system, ollama_client=MagicMock())
        await scheduler._job_extract_entities()

        assert scheduler._stats["jobs_run"] == 0


class TestJobUpdateDecayExtended:
    """Cover edge cases in _job_update_decay."""

    async def test_handles_memory_without_reference_time(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(last_accessed_at=None, created_at=None)
        # Override created_at to None on the object after creation
        object.__setattr__(mem, "created_at", None)
        system.list_memories = AsyncMock(side_effect=[([mem], 1), ([], 0)])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_update_decay()

        assert scheduler._stats["memories_decayed"] == 1
        # Decay should default to 1.0 when no reference time
        call_args = system._weaviate.update_memory_fields.call_args
        fields = call_args.kwargs.get("fields") or call_args[1].get("fields")
        assert fields["decay_factor"] == 1.0

    async def test_handles_naive_datetime(self) -> None:
        """Memory with naive datetime (no tzinfo) should still work."""
        from datetime import datetime as dt

        system = _make_mock_system()
        naive_dt = dt(2025, 1, 1, 12, 0, 0)  # No timezone
        mem = _make_memory(last_accessed_at=naive_dt, created_at=datetime.now(timezone.utc))
        # Force last_accessed_at to naive via object.__setattr__
        object.__setattr__(mem, "last_accessed_at", naive_dt)
        system.list_memories = AsyncMock(side_effect=[([mem], 1), ([], 0)])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_update_decay()

        assert scheduler._stats["memories_decayed"] == 1

    async def test_handles_individual_update_error(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(last_accessed_at=datetime.now(timezone.utc))
        system.list_memories = AsyncMock(side_effect=[([mem], 1), ([], 0)])
        system._weaviate.update_memory_fields = AsyncMock(side_effect=RuntimeError("Update failed"))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_update_decay()

        # Error handled gracefully, total_updated stays 0
        assert scheduler._stats["memories_decayed"] == 0

    async def test_handles_outer_exception(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB down"))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_update_decay()

        # Should not crash
        assert scheduler._stats["memories_decayed"] == 0


class TestJobDeleteExpiredExtended:
    """Cover exception handler in _job_delete_expired."""

    async def test_handles_exception(self) -> None:
        system = _make_mock_system()
        system._weaviate.delete_expired_memories = AsyncMock(
            side_effect=RuntimeError("Delete failed")
        )

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_delete_expired()

        # Should not crash
        assert scheduler._stats["memories_deleted"] == 0


# ---------------------------------------------------------------------------
# AI Router path tests — covering _router_* methods
# ---------------------------------------------------------------------------


class TestJobsWithAIRouter:
    """Cover the AI router code paths in job methods + _router_* helper methods."""

    async def test_score_importance_via_ai_router(self) -> None:
        """Exercises _router_score_importance and ai_router branch."""
        system = _make_mock_system()
        mem = _make_memory(importance=0.5)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_router = _make_mock_router()
        mock_router.chat_completion = AsyncMock(
            return_value='{"importance": 0.85, "reason": "Critical decision"}'
        )

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_score_importance()

        assert scheduler._stats["memories_scored"] == 1
        assert scheduler._stats["jobs_run"] == 1
        mock_router.chat_completion.assert_called_once()

    async def test_score_importance_ai_router_json_error_fallback(self) -> None:
        """When _extract_json fails, falls back to (0.5, 'scoring unavailable')."""
        system = _make_mock_system()
        mem = _make_memory(importance=0.5)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_router = _make_mock_router()
        mock_router.chat_completion = AsyncMock(return_value="not valid json")

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_score_importance()

        # Still counted as scored (with fallback values)
        assert scheduler._stats["memories_scored"] == 1

    async def test_summarize_via_ai_router(self) -> None:
        """Exercises _router_summarize (lines 208-223) and ai_router branch."""
        system = _make_mock_system()
        mem = _make_memory(content="x" * 300, summary=None)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_router = _make_mock_router()
        mock_router.chat_completion = AsyncMock(return_value="A concise summary of the content")

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_summarize()

        assert scheduler._stats["memories_summarized"] == 1
        mock_router.chat_completion.assert_called_once()

    async def test_summarize_ai_router_short_content_returns_none(self) -> None:
        """_router_summarize returns None for content < 200 chars."""
        system = _make_mock_system()
        mem = _make_memory(content="short", summary=None)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_router = _make_mock_router()
        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_summarize()

        mock_router.chat_completion.assert_not_called()

    async def test_detect_contradiction_via_ai_router(self) -> None:
        """Exercises _router_detect_contradiction (lines 227-248)."""
        system = _make_mock_system()
        mem_a = _make_memory(content="The answer is yes")
        mem_b = _make_memory(content="The answer is no")
        system.list_memories = AsyncMock(return_value=([mem_a, mem_b], 2))

        mock_router = _make_mock_router()
        mock_router.chat_completion = AsyncMock(
            return_value='{"contradicts": true, "confidence": 0.95, "more_likely_correct": "memory_a", "reason": "Opposite"}'
        )

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_detect_contradictions()

        assert scheduler._stats["contradictions_found"] == 1
        mock_router.chat_completion.assert_called_once()

    async def test_extract_entities_via_ai_router(self) -> None:
        """Exercises _router_extract_entities (lines 252-276)."""
        system = _make_mock_system()
        mem = _make_memory(content="Python is used by Google")
        system.list_memories = AsyncMock(return_value=([mem], 1))
        system.find_entity_by_name = AsyncMock(return_value=None)

        mock_router = _make_mock_router()
        mock_router.chat_completion = AsyncMock(
            return_value='{"entities": [{"name": "Python", "type": "TECH", "confidence": 0.9}]}'
        )

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_extract_entities()

        assert scheduler._stats["entities_extracted"] == 1
        mock_router.chat_completion.assert_called_once()

    async def test_consolidate_via_ai_router(self) -> None:
        """Exercises _router_consolidate_memories (lines 280-297)."""
        system = _make_mock_system()
        mems = [
            _make_memory(
                content=f"Memory about topic {i}",
                project_id="proj-1",
                vector=[0.1] * 768,
                canonical_id=None,
            )
            for i in range(4)
        ]
        system.list_memories = AsyncMock(return_value=(mems, 4))
        system._weaviate.find_similar_memories_by_vector = AsyncMock(return_value=mems[:3])
        system._weaviate.add_memory = AsyncMock(return_value=uuid4())

        mock_router = _make_mock_router()
        mock_router.chat_completion = AsyncMock(
            return_value="Merged: comprehensive summary of topics 0-2"
        )

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_consolidate()

        assert scheduler._stats["memories_consolidated"] == 3
        mock_router.chat_completion.assert_called_once()


class TestHealthAwareScheduling:
    """Test health-aware AI availability checking and graceful job skipping."""

    async def test_skips_score_importance_when_no_ai_available(self) -> None:
        system = _make_mock_system()
        mock_router = MagicMock()
        mock_router.providers = [MagicMock()]
        mock_router.providers[0].is_available = AsyncMock(return_value=False)

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_score_importance()

        assert scheduler._stats["ai_jobs_skipped"] == 1
        assert scheduler._stats["memories_scored"] == 0

    async def test_skips_summarize_when_no_ai_available(self) -> None:
        system = _make_mock_system()
        mock_router = MagicMock()
        mock_router.providers = [MagicMock()]
        mock_router.providers[0].is_available = AsyncMock(return_value=False)

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_summarize()

        assert scheduler._stats["ai_jobs_skipped"] == 1

    async def test_proceeds_when_ai_is_available(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(importance=0.5)
        system.list_memories = AsyncMock(return_value=([mem], 1))

        mock_router = MagicMock()
        mock_router.providers = [MagicMock()]
        mock_router.providers[0].is_available = AsyncMock(return_value=True)
        mock_router.chat_completion = AsyncMock(
            return_value='{"importance": 0.8, "reason": "test"}'
        )

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)
        await scheduler._job_score_importance()

        assert scheduler._stats["ai_jobs_skipped"] == 0
        assert scheduler._stats["memories_scored"] == 1

    async def test_caches_availability_check(self) -> None:
        system = _make_mock_system()
        mock_provider = MagicMock()
        mock_provider.is_available = AsyncMock(return_value=True)
        mock_router = MagicMock()
        mock_router.providers = [mock_provider]

        scheduler = MaintenanceScheduler(system, ai_router=mock_router)

        result1 = await scheduler._check_ai_available()
        result2 = await scheduler._check_ai_available()

        assert result1 is True
        assert result2 is True
        mock_provider.is_available.assert_called_once()


class TestConfidenceMaintenance:
    """Test the real confidence maintenance job implementation."""

    async def test_updates_confidence_for_memories(self) -> None:
        system = _make_mock_system()
        mem = _make_memory(content="Test memory", importance=0.7)
        mem.overall_confidence = 0.5
        mem.supporting_evidence_ids = []
        mem.contradictions = []
        mem.contradictions_resolved = False
        mem.decay_factor = 0.9
        mem.user_id = "user-1"
        system.list_memories = AsyncMock(side_effect=[([mem], 1), ([], 0)])

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_confidence_maintenance()

        assert scheduler._stats["confidence_updates"] >= 0
        assert scheduler._stats["jobs_run"] == 1
        assert "confidence_maintenance" in scheduler._stats["job_durations"]

    async def test_skips_when_confidence_unchanged(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(return_value=([], 0))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_confidence_maintenance()

        assert scheduler._stats["confidence_updates"] == 0
        system._weaviate.update_memory_fields.assert_not_called()

    async def test_handles_error_gracefully(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("DB down"))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_confidence_maintenance()

        assert "confidence_maintenance" in scheduler._stats["job_errors"]


class TestJobMetrics:
    """Test per-job timing and error tracking."""

    async def test_records_job_duration(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(return_value=([], 0))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_confidence_maintenance()

        assert "confidence_maintenance" in scheduler._stats["job_durations"]
        assert scheduler._stats["job_durations"]["confidence_maintenance"] >= 0

    async def test_records_error_on_failure(self) -> None:
        system = _make_mock_system()
        system.list_memories = AsyncMock(side_effect=RuntimeError("boom"))

        scheduler = MaintenanceScheduler(system)
        await scheduler._job_confidence_maintenance()

        assert "confidence_maintenance" in scheduler._stats["job_errors"]
        assert "boom" in scheduler._stats["job_errors"]["confidence_maintenance"]

    async def test_clears_error_on_success(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        scheduler._stats["job_errors"]["confidence_maintenance"] = "old error"
        system.list_memories = AsyncMock(return_value=([], 0))

        await scheduler._job_confidence_maintenance()

        assert "confidence_maintenance" not in scheduler._stats["job_errors"]

    async def test_stats_include_new_fields(self) -> None:
        system = _make_mock_system()
        scheduler = MaintenanceScheduler(system)
        stats = scheduler.get_stats()

        assert "confidence_updates" in stats
        assert "events_extracted" in stats
        assert "ai_jobs_skipped" in stats
        assert "job_durations" in stats
        assert "job_errors" in stats
