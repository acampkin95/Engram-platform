from __future__ import annotations

import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def _build_scheduler() -> AsyncIOScheduler:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    try:
        jobstores = {
            "default": RedisJobStore(
                jobs_key="apscheduler.jobs", run_times_key="apscheduler.run_times", url=redis_url
            ),
        }
        logger.info("APScheduler using Redis job store at %s", redis_url)
    except Exception as exc:
        logger.warning("Redis job store unavailable (%s), falling back to memory store", exc)
        jobstores = {}

    executors = {
        "default": AsyncIOExecutor(),
    }

    job_defaults = {
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 30,
    }

    return AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
    )


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = _build_scheduler()
    return _scheduler


def start_scheduler() -> None:
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler started")
    else:
        logger.debug("APScheduler already running")


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
    _scheduler = None
