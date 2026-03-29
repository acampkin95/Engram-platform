"""OSINT Async Job Queue — Phase 6.3.

Decouples heavy OSINT operations from API request/response cycles.

Design:
  - Jobs are submitted via enqueue() → returns job_id immediately
  - A background asyncio worker pool processes jobs concurrently
  - Job state is persisted to Redis (with JSON file fallback)
  - Callers poll get_job() or await wait_for_job()
  - Integrates with APScheduler for scheduled recurring scans
  - Worker concurrency is capped by OSINT_JOB_CONCURRENCY (default: 3)

Job lifecycle:
  PENDING → RUNNING → COMPLETED | FAILED | CANCELLED

Supported job types (extensible):
  - entity_scan    : Full OSINT scan for an entity
  - platform_crawl : Single-platform crawl
  - fraud_analysis : Fraud detection pipeline
  - deep_crawl     : Deep web crawl for an entity
  - image_intel    : Image intelligence pipeline
  - case_export    : Export a case to file
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import traceback
import uuid
from datetime import datetime
from app._compat import UTC

from app._compat import StrEnum

from pathlib import Path
from typing import Any
from collections.abc import Callable, Coroutine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Job model
# ---------------------------------------------------------------------------

class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class JobType(StrEnum):
    ENTITY_SCAN = "entity_scan"
    PLATFORM_CRAWL = "platform_crawl"
    FRAUD_ANALYSIS = "fraud_analysis"
    DEEP_CRAWL = "deep_crawl"
    IMAGE_INTEL = "image_intel"
    CASE_EXPORT = "case_export"
    CUSTOM = "custom"

class OsintJob:
    """Represents a single queued OSINT job."""

    def __init__(
        self,
        job_type: JobType,
        payload: dict[str, Any],
        job_id: str | None = None,
        priority: int = 5,
        created_by: str | None = None,
    ) -> None:
        self.job_id: str = job_id or uuid.uuid4().hex
        self.job_type: JobType = job_type
        self.payload: dict[str, Any] = payload
        self.priority: int = priority  # 1 (highest) – 10 (lowest)
        self.created_by: str | None = created_by
        self.status: JobStatus = JobStatus.PENDING
        self.created_at: str = datetime.now(UTC).isoformat()
        self.started_at: str | None = None
        self.completed_at: str | None = None
        self.result: Any | None = None
        self.error: str | None = None
        self.progress: int = 0  # 0–100
        self.progress_message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "job_type": self.job_type.value,
            "payload": self.payload,
            "priority": self.priority,
            "created_by": self.created_by,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "result": self.result,
            "error": self.error,
            "progress": self.progress,
            "progress_message": self.progress_message,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> OsintJob:
        job = cls(
            job_type=JobType(data["job_type"]),
            payload=data.get("payload", {}),
            job_id=data["job_id"],
            priority=data.get("priority", 5),
            created_by=data.get("created_by"),
        )
        job.status = JobStatus(data.get("status", JobStatus.PENDING))
        job.created_at = data.get("created_at", job.created_at)
        job.started_at = data.get("started_at")
        job.completed_at = data.get("completed_at")
        job.result = data.get("result")
        job.error = data.get("error")
        job.progress = data.get("progress", 0)
        job.progress_message = data.get("progress_message", "")
        return job

# ---------------------------------------------------------------------------
# Job store (Redis with file fallback)
# ---------------------------------------------------------------------------

class JobStore:
    """Persist job state to Redis, falling back to a JSON file store."""

    REDIS_PREFIX = "osint:job:"
    REDIS_LIST_KEY = "osint:jobs:all"
    JOB_TTL = 86400 * 7  # 7 days

    def __init__(self, fallback_dir: Path | None = None) -> None:
        self._fallback_dir = (
            fallback_dir or Path(os.getenv("DATA_HOT_PATH", "/app/data/tiers/hot")) / "jobs"
        )
        self._fallback_dir.mkdir(parents=True, exist_ok=True)
        self._redis: Any | None = None

    async def _get_redis(self) -> Any | None:
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis

            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self._redis = aioredis.from_url(redis_url, decode_responses=True)
            await self._redis.ping()
            return self._redis
        except Exception as exc:
            logger.warning("JobStore: Redis unavailable (%s), using file fallback", exc)
            self._redis = None
            return None

    # -- Save / load --------------------------------------------------------

    async def save(self, job: OsintJob) -> None:
        data = json.dumps(job.to_dict(), default=str)
        redis = await self._get_redis()
        if redis:
            try:
                await redis.setex(f"{self.REDIS_PREFIX}{job.job_id}", self.JOB_TTL, data)
                await redis.sadd(self.REDIS_LIST_KEY, job.job_id)
                return
            except Exception as exc:
                logger.debug("JobStore Redis save failed: %s", exc)
        # File fallback
        (self._fallback_dir / f"{job.job_id}.json").write_text(data, encoding="utf-8")

    async def load(self, job_id: str) -> OsintJob | None:
        redis = await self._get_redis()
        if redis:
            try:
                raw = await redis.get(f"{self.REDIS_PREFIX}{job_id}")
                if raw:
                    return OsintJob.from_dict(json.loads(raw))
            except Exception as exc:
                logger.debug("JobStore Redis load failed: %s", exc)
        # File fallback
        path = self._fallback_dir / f"{job_id}.json"
        if path.exists():
            try:
                return OsintJob.from_dict(json.loads(path.read_text(encoding="utf-8")))
            except Exception:
                return None
        return None

    async def list_jobs(
        self,
        status: JobStatus | None = None,
        job_type: JobType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[OsintJob]:
        jobs: list[OsintJob] = []

        redis = await self._get_redis()
        if redis:
            try:
                job_ids = await redis.smembers(self.REDIS_LIST_KEY)
                for jid in job_ids:
                    raw = await redis.get(f"{self.REDIS_PREFIX}{jid}")
                    if raw:
                        jobs.append(OsintJob.from_dict(json.loads(raw)))
            except Exception as exc:
                logger.debug("JobStore Redis list failed: %s", exc)
                jobs = []

        if not jobs:
            # File fallback
            for path in self._fallback_dir.glob("*.json"):
                try:
                    jobs.append(OsintJob.from_dict(json.loads(path.read_text(encoding="utf-8"))))
                except Exception:
                    pass

        # Filter
        if status:
            jobs = [j for j in jobs if j.status == status]
        if job_type:
            jobs = [j for j in jobs if j.job_type == job_type]

        jobs.sort(key=lambda j: (j.priority, j.created_at))
        return jobs[offset : offset + limit]

    async def delete(self, job_id: str) -> bool:
        redis = await self._get_redis()
        if redis:
            try:
                await redis.delete(f"{self.REDIS_PREFIX}{job_id}")
                await redis.srem(self.REDIS_LIST_KEY, job_id)
            except Exception:
                pass
        path = self._fallback_dir / f"{job_id}.json"
        if path.exists():
            path.unlink()
            return True
        return True

# ---------------------------------------------------------------------------
# Worker pool
# ---------------------------------------------------------------------------

# Registry of handler functions: job_type → async callable(job) → Any
_HANDLERS: dict[str, Callable[[OsintJob], Coroutine[Any, Any, Any]]] = {}

def register_handler(job_type: JobType, handler: Callable) -> None:
    """Register an async handler for a job type."""
    _HANDLERS[job_type.value] = handler
    logger.info("JobQueue: registered handler for %s", job_type.value)

class OsintJobQueue:
    """Async worker pool for OSINT jobs.

    Usage:
        queue = OsintJobQueue()
        await queue.start()

        job_id = await queue.enqueue(JobType.ENTITY_SCAN, {"name": "John Doe", ...})
        job = await queue.get_job(job_id)
    """

    def __init__(
        self,
        concurrency: int = 0,
        store: JobStore | None = None,
    ) -> None:
        self._concurrency = concurrency or int(os.getenv("OSINT_JOB_CONCURRENCY", "3"))
        self._store = store or JobStore()
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._workers: list[asyncio.Task] = []
        self._running = False
        self._semaphore: asyncio.Semaphore | None = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._semaphore = asyncio.Semaphore(self._concurrency)
        for i in range(self._concurrency):
            task = asyncio.create_task(self._worker(i), name=f"osint-worker-{i}")
            self._workers.append(task)
        logger.info("OsintJobQueue started with %d workers", self._concurrency)

    async def stop(self) -> None:
        self._running = False
        for w in self._workers:
            w.cancel()
        self._workers.clear()
        logger.info("OsintJobQueue stopped")

    async def enqueue(
        self,
        job_type: JobType,
        payload: dict[str, Any],
        priority: int = 5,
        created_by: str | None = None,
        job_id: str | None = None,
    ) -> str:
        """Add a job to the queue. Returns job_id immediately."""
        job = OsintJob(
            job_type=job_type,
            payload=payload,
            job_id=job_id,
            priority=priority,
            created_by=created_by,
        )
        await self._store.save(job)
        # Priority queue: lower number = higher priority
        await self._queue.put((job.priority, job.created_at, job.job_id))
        logger.info("Enqueued job %s (type=%s priority=%d)", job.job_id, job_type.value, priority)
        return job.job_id

    async def get_job(self, job_id: str) -> OsintJob | None:
        return await self._store.load(job_id)

    async def cancel_job(self, job_id: str) -> bool:
        job = await self._store.load(job_id)
        if job is None:
            return False
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
            return False  # Terminal state
        job.status = JobStatus.CANCELLED
        job.completed_at = datetime.now(UTC).isoformat()
        await self._store.save(job)
        return True

    async def list_jobs(
        self,
        status: JobStatus | None = None,
        job_type: JobType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[OsintJob]:
        return await self._store.list_jobs(
            status=status, job_type=job_type, limit=limit, offset=offset
        )

    async def wait_for_job(
        self,
        job_id: str,
        timeout: float = 300.0,
        poll_interval: float = 1.0,
    ) -> OsintJob | None:
        """Poll until job reaches a terminal state or timeout."""
        elapsed = 0.0
        while elapsed < timeout:
            job = await self._store.load(job_id)
            if job and job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                return job
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        return await self._store.load(job_id)

    async def queue_stats(self) -> dict[str, Any]:
        """Return queue statistics."""
        all_jobs = await self._store.list_jobs(limit=10000)
        by_status: dict[str, int] = {}
        by_type: dict[str, int] = {}
        for j in all_jobs:
            by_status[j.status.value] = by_status.get(j.status.value, 0) + 1
            by_type[j.job_type.value] = by_type.get(j.job_type.value, 0) + 1
        return {
            "total_jobs": len(all_jobs),
            "by_status": by_status,
            "by_type": by_type,
            "queue_depth": self._queue.qsize(),
            "concurrency": self._concurrency,
            "workers_running": self._running,
        }

    # ------------------------------------------------------------------
    # Internal worker
    # ------------------------------------------------------------------

    async def _worker(self, worker_id: int) -> None:
        logger.debug("Worker %d started", worker_id)
        while self._running:
            try:
                priority, created_at, job_id = await asyncio.wait_for(
                    self._queue.get(), timeout=5.0
                )
            except TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            job = await self._store.load(job_id)
            if job is None:
                logger.warning("Worker %d: job %s not found in store", worker_id, job_id)
                self._queue.task_done()
                continue

            if job.status == JobStatus.CANCELLED:
                self._queue.task_done()
                continue

            assert self._semaphore is not None, "Semaphore not initialized"
            async with self._semaphore:
                await self._execute_job(job, worker_id)

            self._queue.task_done()

    async def _execute_job(self, job: OsintJob, worker_id: int) -> None:
        logger.info(
            "Worker %d executing job %s (type=%s)", worker_id, job.job_id, job.job_type.value
        )
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(UTC).isoformat()
        job.progress = 0
        job.progress_message = "Starting..."
        await self._store.save(job)

        handler = _HANDLERS.get(job.job_type.value)
        if handler is None:
            job.status = JobStatus.FAILED
            job.error = f"No handler registered for job type: {job.job_type.value}"
            job.completed_at = datetime.now(UTC).isoformat()
            await self._store.save(job)
            logger.error("No handler for job type %s", job.job_type.value)
            return

        try:
            result = await handler(job)
            job.status = JobStatus.COMPLETED
            job.result = result
            job.progress = 100
            job.progress_message = "Completed"
            job.completed_at = datetime.now(UTC).isoformat()
            logger.info("Job %s completed successfully", job.job_id)
        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.now(UTC).isoformat()
            logger.info("Job %s cancelled", job.job_id)
        except Exception as exc:
            job.status = JobStatus.FAILED
            job.error = f"{type(exc).__name__}: {exc}"
            job.completed_at = datetime.now(UTC).isoformat()
            logger.error("Job %s failed: %s\n%s", job.job_id, exc, traceback.format_exc())
        finally:
            await self._store.save(job)

# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_queue_instance: OsintJobQueue | None = None

def get_job_queue() -> OsintJobQueue:
    global _queue_instance
    if _queue_instance is None:
        _queue_instance = OsintJobQueue()
    return _queue_instance

async def ensure_queue_started() -> OsintJobQueue:
    """Get queue and start workers if not already running."""
    queue = get_job_queue()
    if not queue._running:
        await queue.start()
    return queue
