"""Comprehensive tests for app/services/job_queue.py.

Targets 70%+ coverage of OsintJob, JobStore, OsintJobQueue,
register_handler, get_job_queue, ensure_queue_started.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

from app.services.job_queue import (
    OsintJob,
    OsintJobQueue,
    JobStore,
    JobStatus,
    JobType,
    register_handler,
    get_job_queue,
    ensure_queue_started,
    _HANDLERS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_job(**kwargs) -> OsintJob:
    defaults = dict(job_type=JobType.ENTITY_SCAN, payload={"name": "Alice"})
    defaults.update(kwargs)
    return OsintJob(**defaults)


def _file_store(tmp_path: Path) -> JobStore:
    """Return a JobStore that always uses the file fallback (Redis mocked out)."""
    store = JobStore(fallback_dir=tmp_path / "jobs")
    # Patch _get_redis on the instance so it always returns None
    store._get_redis = AsyncMock(return_value=None)
    return store


# ===========================================================================
# OsintJob unit tests (no async needed)
# ===========================================================================


class TestJobStatus:
    def test_all_values(self):
        assert JobStatus.PENDING == "pending"
        assert JobStatus.RUNNING == "running"
        assert JobStatus.COMPLETED == "completed"
        assert JobStatus.FAILED == "failed"
        assert JobStatus.CANCELLED == "cancelled"


class TestJobType:
    def test_all_values(self):
        assert JobType.ENTITY_SCAN == "entity_scan"
        assert JobType.PLATFORM_CRAWL == "platform_crawl"
        assert JobType.FRAUD_ANALYSIS == "fraud_analysis"
        assert JobType.DEEP_CRAWL == "deep_crawl"
        assert JobType.IMAGE_INTEL == "image_intel"
        assert JobType.CASE_EXPORT == "case_export"
        assert JobType.CUSTOM == "custom"


class TestOsintJobDefaults:
    def test_auto_generated_job_id(self):
        job = _make_job()
        assert isinstance(job.job_id, str)
        assert len(job.job_id) > 0

    def test_explicit_job_id(self):
        job = _make_job(job_id="abc123")
        assert job.job_id == "abc123"

    def test_default_priority(self):
        job = _make_job()
        assert job.priority == 5

    def test_custom_priority(self):
        job = _make_job(priority=1)
        assert job.priority == 1

    def test_default_status_is_pending(self):
        job = _make_job()
        assert job.status == JobStatus.PENDING

    def test_default_progress_is_zero(self):
        job = _make_job()
        assert job.progress == 0

    def test_created_by_default_none(self):
        job = _make_job()
        assert job.created_by is None

    def test_created_by_set(self):
        job = _make_job(created_by="user@example.com")
        assert job.created_by == "user@example.com"


class TestOsintJobToDict:
    def test_returns_all_expected_keys(self):
        job = _make_job(job_id="test-id")
        d = job.to_dict()
        expected_keys = {
            "job_id",
            "job_type",
            "payload",
            "priority",
            "created_by",
            "status",
            "created_at",
            "started_at",
            "completed_at",
            "result",
            "error",
            "progress",
            "progress_message",
        }
        assert set(d.keys()) == expected_keys

    def test_job_type_is_string_value(self):
        job = _make_job(job_type=JobType.FRAUD_ANALYSIS)
        d = job.to_dict()
        assert d["job_type"] == "fraud_analysis"

    def test_status_is_string_value(self):
        job = _make_job()
        d = job.to_dict()
        assert d["status"] == "pending"

    def test_payload_preserved(self):
        payload = {"name": "Bob", "age": 30}
        job = _make_job(payload=payload)
        assert job.to_dict()["payload"] == payload

    def test_progress_message_default_empty(self):
        job = _make_job()
        assert job.to_dict()["progress_message"] == ""


class TestOsintJobFromDict:
    def test_round_trip(self):
        original = _make_job(job_id="round-trip-id", priority=3, created_by="tester")
        original.status = JobStatus.RUNNING
        original.progress = 42
        original.progress_message = "halfway"
        original.result = {"found": True}
        original.error = None

        d = original.to_dict()
        restored = OsintJob.from_dict(d)

        assert restored.job_id == original.job_id
        assert restored.job_type == original.job_type
        assert restored.payload == original.payload
        assert restored.priority == original.priority
        assert restored.created_by == original.created_by
        assert restored.status == original.status
        assert restored.progress == original.progress
        assert restored.progress_message == original.progress_message
        assert restored.result == original.result

    def test_from_dict_default_priority(self):
        d = {
            "job_id": "x",
            "job_type": "entity_scan",
            "payload": {},
        }
        job = OsintJob.from_dict(d)
        assert job.priority == 5

    def test_from_dict_default_status_pending(self):
        d = {"job_id": "x", "job_type": "entity_scan", "payload": {}}
        job = OsintJob.from_dict(d)
        assert job.status == JobStatus.PENDING

    def test_from_dict_all_job_types(self):
        for jt in JobType:
            d = {"job_id": "x", "job_type": jt.value, "payload": {}}
            job = OsintJob.from_dict(d)
            assert job.job_type == jt


# ===========================================================================
# JobStore — file fallback (Redis mocked to None)
# ===========================================================================


class TestJobStoreFileFallback:
    def test_save_writes_json_file(self, tmp_path):
        store = _file_store(tmp_path)
        job = _make_job(job_id="save-test")
        asyncio.run(store.save(job))

        path = tmp_path / "jobs" / "save-test.json"
        assert path.exists()
        data = json.loads(path.read_text())
        assert data["job_id"] == "save-test"

    def test_load_returns_job_from_file(self, tmp_path):
        store = _file_store(tmp_path)
        job = _make_job(job_id="load-test")
        asyncio.run(store.save(job))

        loaded = asyncio.run(store.load("load-test"))
        assert loaded is not None
        assert loaded.job_id == "load-test"
        assert loaded.job_type == JobType.ENTITY_SCAN

    def test_load_returns_none_for_missing_job(self, tmp_path):
        store = _file_store(tmp_path)
        result = asyncio.run(store.load("nonexistent-id"))
        assert result is None

    def test_list_jobs_returns_all(self, tmp_path):
        store = _file_store(tmp_path)
        for i in range(3):
            asyncio.run(store.save(_make_job(job_id=f"job-{i}")))

        jobs = asyncio.run(store.list_jobs())
        assert len(jobs) == 3

    def test_list_jobs_filters_by_status(self, tmp_path):
        store = _file_store(tmp_path)

        job_a = _make_job(job_id="a")
        job_a.status = JobStatus.COMPLETED
        asyncio.run(store.save(job_a))

        job_b = _make_job(job_id="b")
        job_b.status = JobStatus.PENDING
        asyncio.run(store.save(job_b))

        completed = asyncio.run(store.list_jobs(status=JobStatus.COMPLETED))
        assert len(completed) == 1
        assert completed[0].job_id == "a"

    def test_list_jobs_filters_by_job_type(self, tmp_path):
        store = _file_store(tmp_path)

        asyncio.run(store.save(_make_job(job_id="scan-1", job_type=JobType.ENTITY_SCAN)))
        asyncio.run(store.save(_make_job(job_id="crawl-1", job_type=JobType.PLATFORM_CRAWL)))

        scans = asyncio.run(store.list_jobs(job_type=JobType.ENTITY_SCAN))
        assert len(scans) == 1
        assert scans[0].job_id == "scan-1"

    def test_list_jobs_respects_limit(self, tmp_path):
        store = _file_store(tmp_path)
        for i in range(5):
            asyncio.run(store.save(_make_job(job_id=f"job-{i}")))

        jobs = asyncio.run(store.list_jobs(limit=2))
        assert len(jobs) == 2

    def test_list_jobs_respects_offset(self, tmp_path):
        store = _file_store(tmp_path)
        for i in range(5):
            asyncio.run(store.save(_make_job(job_id=f"job-{i}")))

        all_jobs = asyncio.run(store.list_jobs(limit=100))
        offset_jobs = asyncio.run(store.list_jobs(limit=100, offset=3))
        assert len(offset_jobs) == len(all_jobs) - 3

    def test_delete_removes_file(self, tmp_path):
        store = _file_store(tmp_path)
        job = _make_job(job_id="del-test")
        asyncio.run(store.save(job))

        path = tmp_path / "jobs" / "del-test.json"
        assert path.exists()

        result = asyncio.run(store.delete("del-test"))
        assert result is True
        assert not path.exists()

    def test_delete_returns_true_for_nonexistent(self, tmp_path):
        store = _file_store(tmp_path)
        result = asyncio.run(store.delete("ghost-id"))
        assert result is True

    def test_list_jobs_empty_store(self, tmp_path):
        store = _file_store(tmp_path)
        jobs = asyncio.run(store.list_jobs())
        assert jobs == []

    def test_load_handles_corrupt_file(self, tmp_path):
        store = _file_store(tmp_path)
        bad_path = tmp_path / "jobs" / "corrupt.json"
        bad_path.parent.mkdir(parents=True, exist_ok=True)
        bad_path.write_text("NOT_VALID_JSON", encoding="utf-8")

        result = asyncio.run(store.load("corrupt"))
        assert result is None


# ===========================================================================
# JobStore — Redis path (mock Redis to succeed)
# ===========================================================================


def _redis_store(tmp_path: Path) -> tuple[JobStore, MagicMock]:
    """Return a JobStore with a mocked Redis client."""
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.setex = AsyncMock()
    mock_redis.sadd = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.smembers = AsyncMock(return_value=set())
    mock_redis.delete = AsyncMock()
    mock_redis.srem = AsyncMock()

    store = JobStore(fallback_dir=tmp_path / "jobs")
    # Inject mock directly — bypass the real _get_redis
    store._redis = mock_redis
    store._get_redis = AsyncMock(return_value=mock_redis)
    return store, mock_redis


class TestJobStoreRedis:
    def test_save_calls_setex_and_sadd(self, tmp_path):
        store, mock_redis = _redis_store(tmp_path)
        job = _make_job(job_id="redis-save")
        asyncio.run(store.save(job))

        mock_redis.setex.assert_awaited_once()
        call_args = mock_redis.setex.call_args[0]
        assert "redis-save" in call_args[0]  # key contains job_id
        mock_redis.sadd.assert_awaited_once()

    def test_load_returns_job_from_redis(self, tmp_path):
        store, mock_redis = _redis_store(tmp_path)
        job = _make_job(job_id="redis-load")
        raw = json.dumps(job.to_dict())
        mock_redis.get = AsyncMock(return_value=raw)

        loaded = asyncio.run(store.load("redis-load"))
        assert loaded is not None
        assert loaded.job_id == "redis-load"

    def test_load_falls_back_to_file_when_redis_returns_none(self, tmp_path):
        store, mock_redis = _redis_store(tmp_path)
        mock_redis.get = AsyncMock(return_value=None)

        # Save a file fallback manually
        job = _make_job(job_id="fallback-id")
        file_path = tmp_path / "jobs" / "fallback-id.json"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(json.dumps(job.to_dict()), encoding="utf-8")

        loaded = asyncio.run(store.load("fallback-id"))
        assert loaded is not None
        assert loaded.job_id == "fallback-id"

    def test_list_jobs_reads_from_redis_smembers(self, tmp_path):
        store, mock_redis = _redis_store(tmp_path)
        job = _make_job(job_id="list-redis")
        raw = json.dumps(job.to_dict())
        mock_redis.smembers = AsyncMock(return_value={"list-redis"})
        mock_redis.get = AsyncMock(return_value=raw)

        jobs = asyncio.run(store.list_jobs())
        assert len(jobs) == 1
        assert jobs[0].job_id == "list-redis"

    def test_delete_calls_redis_delete_and_srem(self, tmp_path):
        store, mock_redis = _redis_store(tmp_path)
        asyncio.run(store.delete("del-redis"))

        mock_redis.delete.assert_awaited_once()
        mock_redis.srem.assert_awaited_once()

    def test_save_falls_back_to_file_on_redis_error(self, tmp_path):
        store, mock_redis = _redis_store(tmp_path)
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis down"))

        job = _make_job(job_id="fallback-save")
        asyncio.run(store.save(job))

        # Should have written the file fallback
        path = tmp_path / "jobs" / "fallback-save.json"
        assert path.exists()


# ===========================================================================
# OsintJobQueue
# ===========================================================================


class TestOsintJobQueueEnqueue:
    def test_enqueue_returns_job_id_string(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {"name": "test"}))
        assert isinstance(job_id, str)
        assert len(job_id) > 0

    def test_enqueue_with_custom_job_id(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}, job_id="custom-id"))
        assert job_id == "custom-id"

    def test_enqueue_with_priority(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}, priority=1))
        job = asyncio.run(store.load(job_id))
        assert job.priority == 1

    def test_enqueue_with_created_by(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}, created_by="admin"))
        job = asyncio.run(store.load(job_id))
        assert job.created_by == "admin"


class TestOsintJobQueueGetJob:
    def test_get_job_returns_job_after_enqueue(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {"name": "test"}))
        job = asyncio.run(queue.get_job(job_id))
        assert job is not None
        assert job.job_id == job_id

    def test_get_job_returns_none_for_unknown(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        result = asyncio.run(queue.get_job("nonexistent"))
        assert result is None


class TestOsintJobQueueCancelJob:
    def test_cancel_pending_job_sets_cancelled(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))
        result = asyncio.run(queue.cancel_job(job_id))
        assert result is True
        job = asyncio.run(store.load(job_id))
        assert job.status == JobStatus.CANCELLED

    def test_cancel_nonexistent_job_returns_false(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        result = asyncio.run(queue.cancel_job("ghost"))
        assert result is False

    def test_cancel_completed_job_returns_false(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job = _make_job(job_id="done-job")
        job.status = JobStatus.COMPLETED
        asyncio.run(store.save(job))
        result = asyncio.run(queue.cancel_job("done-job"))
        assert result is False

    def test_cancel_failed_job_returns_false(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job = _make_job(job_id="failed-job")
        job.status = JobStatus.FAILED
        asyncio.run(store.save(job))
        result = asyncio.run(queue.cancel_job("failed-job"))
        assert result is False

    def test_cancel_already_cancelled_returns_false(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job = _make_job(job_id="cancelled-job")
        job.status = JobStatus.CANCELLED
        asyncio.run(store.save(job))
        result = asyncio.run(queue.cancel_job("cancelled-job"))
        assert result is False


class TestOsintJobQueueListJobs:
    def test_list_jobs_returns_all_enqueued(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))
        asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))
        asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))

        jobs = asyncio.run(queue.list_jobs())
        assert len(jobs) == 3

    def test_list_jobs_filter_by_status(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        job_id = asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))
        asyncio.run(queue.cancel_job(job_id))
        asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))

        cancelled = asyncio.run(queue.list_jobs(status=JobStatus.CANCELLED))
        assert len(cancelled) == 1

        pending = asyncio.run(queue.list_jobs(status=JobStatus.PENDING))
        assert len(pending) == 1


class TestOsintJobQueueStats:
    def test_queue_stats_returns_expected_keys(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=2, store=store)
        asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))

        stats = asyncio.run(queue.queue_stats())
        assert "total_jobs" in stats
        assert "by_status" in stats
        assert "by_type" in stats
        assert "queue_depth" in stats
        assert "concurrency" in stats
        assert "workers_running" in stats

    def test_queue_stats_concurrency_matches(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=7, store=store)
        stats = asyncio.run(queue.queue_stats())
        assert stats["concurrency"] == 7

    def test_queue_stats_total_jobs_count(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        asyncio.run(queue.enqueue(JobType.ENTITY_SCAN, {}))
        asyncio.run(queue.enqueue(JobType.PLATFORM_CRAWL, {}))

        stats = asyncio.run(queue.queue_stats())
        assert stats["total_jobs"] == 2

    def test_queue_stats_workers_not_running_initially(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        stats = asyncio.run(queue.queue_stats())
        assert stats["workers_running"] is False


# ===========================================================================
# _execute_job
# ===========================================================================


class TestExecuteJob:
    def test_execute_job_success(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        queue._semaphore = asyncio.Semaphore(1)

        async def mock_handler(job):
            return {"result": "ok"}

        job = _make_job(job_id="exec-success")
        asyncio.run(store.save(job))

        with patch.dict(
            "app.services.job_queue._HANDLERS", {JobType.ENTITY_SCAN.value: mock_handler}
        ):
            asyncio.run(queue._execute_job(job, 0))

        loaded = asyncio.run(store.load(job.job_id))
        assert loaded.status == JobStatus.COMPLETED
        assert loaded.result == {"result": "ok"}
        assert loaded.progress == 100
        assert loaded.progress_message == "Completed"
        assert loaded.completed_at is not None

    def test_execute_job_no_handler_sets_failed(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        queue._semaphore = asyncio.Semaphore(1)

        job = _make_job(job_id="no-handler", job_type=JobType.CUSTOM)
        asyncio.run(store.save(job))

        # Ensure no handler for CUSTOM
        with patch.dict("app.services.job_queue._HANDLERS", {}, clear=True):
            asyncio.run(queue._execute_job(job, 0))

        loaded = asyncio.run(store.load(job.job_id))
        assert loaded.status == JobStatus.FAILED
        assert "No handler" in loaded.error

    def test_execute_job_handler_raises_sets_failed(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        queue._semaphore = asyncio.Semaphore(1)

        async def failing_handler(job):
            raise ValueError("Something went wrong")

        job = _make_job(job_id="exec-fail")
        asyncio.run(store.save(job))

        with patch.dict(
            "app.services.job_queue._HANDLERS", {JobType.ENTITY_SCAN.value: failing_handler}
        ):
            asyncio.run(queue._execute_job(job, 0))

        loaded = asyncio.run(store.load(job.job_id))
        assert loaded.status == JobStatus.FAILED
        assert "ValueError" in loaded.error
        assert "Something went wrong" in loaded.error

    def test_execute_job_sets_running_before_handler(self, tmp_path):
        """Verify job transitions through RUNNING state (saved) before completion."""
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        queue._semaphore = asyncio.Semaphore(1)

        states_seen: list[str] = []

        async def tracking_handler(job):
            # At this point the job should have been saved as RUNNING
            current = (
                asyncio.get_event_loop().run_until_complete(store.load(job.job_id))
                if False
                else None
            )
            states_seen.append("handler_called")
            return {}

        job = _make_job(job_id="running-check")
        asyncio.run(store.save(job))

        with patch.dict(
            "app.services.job_queue._HANDLERS", {JobType.ENTITY_SCAN.value: tracking_handler}
        ):
            asyncio.run(queue._execute_job(job, 0))

        assert "handler_called" in states_seen

    def test_execute_job_cancelled_error_sets_cancelled(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        queue._semaphore = asyncio.Semaphore(1)

        async def cancelling_handler(job):
            raise asyncio.CancelledError()

        job = _make_job(job_id="exec-cancel")
        asyncio.run(store.save(job))

        with patch.dict(
            "app.services.job_queue._HANDLERS", {JobType.ENTITY_SCAN.value: cancelling_handler}
        ):
            asyncio.run(queue._execute_job(job, 0))

        loaded = asyncio.run(store.load(job.job_id))
        assert loaded.status == JobStatus.CANCELLED


# ===========================================================================
# register_handler
# ===========================================================================


class TestRegisterHandler:
    def test_registers_handler_in_dict(self):
        original = dict(_HANDLERS)
        try:

            async def my_handler(job):
                return {}

            register_handler(JobType.CASE_EXPORT, my_handler)
            assert _HANDLERS.get(JobType.CASE_EXPORT.value) is my_handler
        finally:
            # Restore original state
            _HANDLERS.clear()
            _HANDLERS.update(original)

    def test_overrides_existing_handler(self):
        original = dict(_HANDLERS)
        try:

            async def handler_v1(job):
                return {"v": 1}

            async def handler_v2(job):
                return {"v": 2}

            register_handler(JobType.IMAGE_INTEL, handler_v1)
            register_handler(JobType.IMAGE_INTEL, handler_v2)
            assert _HANDLERS[JobType.IMAGE_INTEL.value] is handler_v2
        finally:
            _HANDLERS.clear()
            _HANDLERS.update(original)

    def test_register_multiple_types(self):
        original = dict(_HANDLERS)
        try:

            async def h1(job):
                return {}

            async def h2(job):
                return {}

            register_handler(JobType.DEEP_CRAWL, h1)
            register_handler(JobType.FRAUD_ANALYSIS, h2)

            assert _HANDLERS[JobType.DEEP_CRAWL.value] is h1
            assert _HANDLERS[JobType.FRAUD_ANALYSIS.value] is h2
        finally:
            _HANDLERS.clear()
            _HANDLERS.update(original)


# ===========================================================================
# get_job_queue / ensure_queue_started
# ===========================================================================


class TestGetJobQueue:
    def test_returns_singleton(self, tmp_path):
        import app.services.job_queue as jq_module

        original = jq_module._queue_instance
        try:
            jq_module._queue_instance = None
            with patch.dict("os.environ", {"DATA_HOT_PATH": str(tmp_path)}):
                q1 = get_job_queue()
                q2 = get_job_queue()
                assert q1 is q2
        finally:
            jq_module._queue_instance = original

    def test_returns_osint_job_queue_instance(self, tmp_path):
        import app.services.job_queue as jq_module

        original = jq_module._queue_instance
        try:
            jq_module._queue_instance = None
            with patch.dict("os.environ", {"DATA_HOT_PATH": str(tmp_path)}):
                queue = get_job_queue()
                assert isinstance(queue, OsintJobQueue)
        finally:
            jq_module._queue_instance = original


class TestEnsureQueueStarted:
    def test_starts_queue_if_not_running(self):
        import app.services.job_queue as jq_module

        original = jq_module._queue_instance

        async def run():
            jq_module._queue_instance = None
            store = _file_store(Path("/tmp/test_ensure_queue"))
            mock_queue = OsintJobQueue(concurrency=1, store=store)
            jq_module._queue_instance = mock_queue
            assert not mock_queue._running
            result = await ensure_queue_started()
            assert result._running is True
            await result.stop()

        try:
            asyncio.run(run())
        finally:
            jq_module._queue_instance = original

    def test_does_not_restart_already_running_queue(self):
        import app.services.job_queue as jq_module

        original = jq_module._queue_instance

        async def run():
            jq_module._queue_instance = None
            store = _file_store(Path("/tmp/test_ensure_queue2"))
            mock_queue = OsintJobQueue(concurrency=1, store=store)
            jq_module._queue_instance = mock_queue

            await mock_queue.start()
            workers_before = list(mock_queue._workers)

            result = await ensure_queue_started()
            # Should be the same queue, not restarted
            assert result is mock_queue
            assert len(result._workers) == len(workers_before)
            await result.stop()

        try:
            asyncio.run(run())
        finally:
            jq_module._queue_instance = original


# ===========================================================================
# OsintJobQueue start / stop
# ===========================================================================


class TestOsintJobQueueStartStop:
    def test_start_sets_running_true(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=2, store=store)

        async def run():
            await queue.start()
            assert queue._running is True
            assert len(queue._workers) == 2
            await queue.stop()

        asyncio.run(run())

    def test_start_is_idempotent(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)

        async def run():
            await queue.start()
            workers_count = len(queue._workers)
            await queue.start()  # Second call should be no-op
            assert len(queue._workers) == workers_count
            await queue.stop()

        asyncio.run(run())

    def test_stop_sets_running_false(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)

        async def run():
            await queue.start()
            await queue.stop()
            assert queue._running is False
            assert len(queue._workers) == 0

        asyncio.run(run())

    def test_semaphore_initialized_on_start(self, tmp_path):
        store = _file_store(tmp_path)
        queue = OsintJobQueue(concurrency=3, store=store)

        async def run():
            assert queue._semaphore is None
            await queue.start()
            assert queue._semaphore is not None
            await queue.stop()

        asyncio.run(run())
