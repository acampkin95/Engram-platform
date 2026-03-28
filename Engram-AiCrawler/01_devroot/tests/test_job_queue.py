"""Tests for OSINT async job queue."""

import pytest
from pathlib import Path
import tempfile

from app.services.job_queue import (
    JobStatus,
    JobType,
    OsintJob,
    JobStore,
    OsintJobQueue,
    register_handler,
    _HANDLERS,
)


class TestJobStatus:
    """Tests for JobStatus enum."""

    def test_job_status_values(self):
        """JobStatus has expected values."""
        assert JobStatus.PENDING == "pending"
        assert JobStatus.RUNNING == "running"
        assert JobStatus.COMPLETED == "completed"
        assert JobStatus.FAILED == "failed"
        assert JobStatus.CANCELLED == "cancelled"


class TestJobType:
    """Tests for JobType enum."""

    def test_job_type_values(self):
        """JobType has expected values."""
        assert JobType.ENTITY_SCAN == "entity_scan"
        assert JobType.PLATFORM_CRAWL == "platform_crawl"
        assert JobType.FRAUD_ANALYSIS == "fraud_analysis"
        assert JobType.DEEP_CRAWL == "deep_crawl"
        assert JobType.IMAGE_INTEL == "image_intel"
        assert JobType.CASE_EXPORT == "case_export"


class TestOsintJob:
    """Tests for OsintJob model."""

    def test_creates_job_with_defaults(self):
        """Job is created with default values."""
        job = OsintJob(
            job_type=JobType.ENTITY_SCAN,
            payload={"name": "test"},
        )

        assert job.job_id is not None
        assert len(job.job_id) == 32
        assert job.job_type == JobType.ENTITY_SCAN
        assert job.status == JobStatus.PENDING
        assert job.priority == 5

    def test_creates_job_with_custom_values(self):
        """Job is created with custom values."""
        job = OsintJob(
            job_type=JobType.PLATFORM_CRAWL,
            payload={"url": "test"},
            job_id="custom-id",
            priority=1,
        )

        assert job.job_id == "custom-id"
        assert job.priority == 1

    def test_to_dict(self):
        """Job serializes to dictionary."""
        job = OsintJob(
            job_type=JobType.ENTITY_SCAN,
            payload={"name": "test"},
            job_id="test-123",
        )
        job.status = JobStatus.RUNNING

        data = job.to_dict()

        assert data["job_id"] == "test-123"
        assert data["status"] == "running"

    def test_from_dict(self):
        """Job deserializes from dictionary."""
        data = {
            "job_id": "test-456",
            "job_type": "platform_crawl",
            "payload": {"url": "test"},
            "status": "completed",
            "priority": 2,
        }

        job = OsintJob.from_dict(data)

        assert job.job_id == "test-456"
        assert job.job_type == JobType.PLATFORM_CRAWL
        assert job.status == JobStatus.COMPLETED


class TestJobStore:
    """Tests for JobStore persistence."""

    @pytest.fixture
    def temp_store_dir(self):
        """Create temporary directory for job store."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    @pytest.fixture
    def job_store(self, temp_store_dir):
        """Create JobStore with file fallback."""
        store = JobStore(fallback_dir=temp_store_dir)
        store._redis = None
        return store

    @pytest.mark.asyncio
    async def test_save_and_load_job(self, job_store):
        """Job is saved and loaded correctly."""
        job = OsintJob(
            job_type=JobType.ENTITY_SCAN,
            payload={"name": "test"},
            job_id="save-load-test",
        )

        await job_store.save(job)
        loaded = await job_store.load("save-load-test")

        assert loaded is not None
        assert loaded.job_id == "save-load-test"

    @pytest.mark.asyncio
    async def test_load_nonexistent_job(self, job_store):
        """Load returns None for nonexistent job."""
        result = await job_store.load("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_job(self, job_store):
        """Job is deleted correctly."""
        job = OsintJob(
            job_type=JobType.ENTITY_SCAN,
            payload={},
            job_id="delete-test",
        )
        await job_store.save(job)

        deleted = await job_store.delete("delete-test")

        assert deleted is True
        loaded = await job_store.load("delete-test")
        assert loaded is None

    @pytest.mark.asyncio
    async def test_list_jobs(self, job_store):
        """Jobs are listed correctly."""
        for i in range(3):
            job = OsintJob(
                job_type=JobType.ENTITY_SCAN,
                payload={},
                job_id=f"list-test-{i}",
            )
            await job_store.save(job)

        jobs = await job_store.list_jobs()

        assert len(jobs) == 3


class TestOsintJobQueue:
    """Tests for OsintJobQueue."""

    @pytest.fixture
    def job_queue(self, tmp_path):
        """Create job queue with file store."""
        store = JobStore(fallback_dir=tmp_path)
        queue = OsintJobQueue(concurrency=2, store=store)
        return queue

    @pytest.mark.asyncio
    async def test_enqueue_creates_job(self, job_queue):
        """Enqueue creates a job."""
        await job_queue.start()

        job_id = await job_queue.enqueue(
            JobType.ENTITY_SCAN,
            {"name": "test"},
        )

        assert job_id is not None

        job = await job_queue.get_job(job_id)
        assert job is not None
        assert job.job_type == JobType.ENTITY_SCAN

        await job_queue.stop()

    @pytest.mark.asyncio
    async def test_get_job_returns_none_for_nonexistent(self, job_queue):
        """get_job returns None for nonexistent job."""
        result = await job_queue.get_job("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_cancel_pending_job(self, job_queue):
        """Pending job can be cancelled."""
        # Don't start the queue processor to keep job in PENDING state
        # so we can test cancellation of a pending (not yet running) job
        job_id = await job_queue.enqueue(JobType.ENTITY_SCAN, {})

        # Verify job is PENDING before cancelling
        job = await job_queue.get_job(job_id)
        assert job.status == JobStatus.PENDING

        cancelled = await job_queue.cancel_job(job_id)

        assert cancelled is True
        job = await job_queue.get_job(job_id)
        assert job.status == JobStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_cancel_completed_job_fails(self, job_queue):
        """Completed job cannot be cancelled."""
        # Don't start the queue - we manually set status to COMPLETED
        job_id = await job_queue.enqueue(JobType.ENTITY_SCAN, {})

        job = await job_queue.get_job(job_id)
        job.status = JobStatus.COMPLETED
        await job_queue._store.save(job)

        cancelled = await job_queue.cancel_job(job_id)
        assert cancelled is False

    @pytest.mark.asyncio
    async def test_list_jobs(self, job_queue):
        """Jobs are listed correctly."""
        await job_queue.start()

        for i in range(3):
            await job_queue.enqueue(JobType.ENTITY_SCAN, {"i": i})

        jobs = await job_queue.list_jobs()

        assert len(jobs) == 3

        await job_queue.stop()

    @pytest.mark.asyncio
    async def test_queue_stats(self, job_queue):
        """Queue stats are returned correctly."""
        await job_queue.start()

        await job_queue.enqueue(JobType.ENTITY_SCAN, {})

        stats = await job_queue.queue_stats()

        assert stats["total_jobs"] == 1
        assert stats["workers_running"] is True

        await job_queue.stop()


class TestJobHandlers:
    """Tests for job handler registration."""

    @pytest.fixture
    def job_queue(self, tmp_path):
        """Create job queue with file store."""
        store = JobStore(fallback_dir=tmp_path)
        queue = OsintJobQueue(concurrency=1, store=store)
        return queue

    @pytest.mark.asyncio
    async def test_register_handler(self):
        """Handler is registered correctly."""
        _HANDLERS.clear()

        async def mock_handler(job):
            return {"result": "ok"}

        register_handler(JobType.ENTITY_SCAN, mock_handler)

        assert "entity_scan" in _HANDLERS

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires Redis + event loop isolation; fails without Redis")
    async def test_job_fails_without_handler(self, job_queue):
        """Job fails when no handler is registered."""
        _HANDLERS.clear()

        await job_queue.start()
        job_id = await job_queue.enqueue(JobType.CUSTOM, {})

        job = await job_queue.wait_for_job(job_id, timeout=5.0)

        assert job.status == JobStatus.FAILED
        assert "No handler registered" in job.error

        await job_queue.stop()
