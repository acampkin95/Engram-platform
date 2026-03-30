from __future__ import annotations

import logging
import uuid
from datetime import datetime
from app._compat import UTC
from typing import Union
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import APIRouter, HTTPException

from app.models.scheduler import (
    CreateSchedule,
    Schedule,
    ScheduleFrequency,
    ScheduleStatus,
    UpdateSchedule,
)
from app.services.scheduler_service import get_scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])

# In-memory store (replace with database in production)
_schedules: dict[str, Schedule] = {}


def _build_trigger(
    frequency: ScheduleFrequency,
    cron_expression: str | None = None,
) -> Union[CronTrigger, IntervalTrigger, DateTrigger]:
    if frequency == ScheduleFrequency.CUSTOM:
        if not cron_expression:
            raise ValueError("cron_expression is required for custom frequency")
        return CronTrigger.from_crontab(cron_expression)

    trigger_map: dict[ScheduleFrequency, Union[CronTrigger, IntervalTrigger, DateTrigger]] = {
        ScheduleFrequency.HOURLY: IntervalTrigger(hours=1),
        ScheduleFrequency.DAILY: IntervalTrigger(days=1),
        ScheduleFrequency.WEEKLY: IntervalTrigger(weeks=1),
        ScheduleFrequency.MONTHLY: CronTrigger(day=1, hour=0, minute=0),
        ScheduleFrequency.ONCE: DateTrigger(
            run_date=datetime.now(tz=UTC),
        ),
    }

    trigger = trigger_map.get(frequency)
    if trigger is None:
        raise ValueError(f"Unsupported frequency: {frequency}")
    return trigger


async def _execute_scheduled_crawl(schedule_id: str) -> None:
    schedule = _schedules.get(schedule_id)
    if schedule is None:
        logger.warning("Schedule %s not found during execution", schedule_id)
        return

    now = datetime.now(tz=UTC)
    logger.info("Executing scheduled crawl: %s (%s)", schedule.name, schedule_id)

    try:
        # Import execute_crawl from crawl API
        from app.api.crawl import execute_crawl
        from app.models.crawl import CrawlRequest

        # Build CrawlRequest from schedule config
        crawl_config = schedule.crawl_config
        crawl_id = str(uuid.uuid4())

        request = CrawlRequest(
            url=crawl_config.get("url", ""),
            extraction_type=crawl_config.get("extraction_type", "css"),
            word_count_threshold=crawl_config.get("word_count_threshold", 50),
            bypass_cache=crawl_config.get("bypass_cache", False),
            wait_for=crawl_config.get("wait_for"),
            screenshot=crawl_config.get("screenshot", False),
            pdf=crawl_config.get("pdf", False),
            exclude_external_links=crawl_config.get("exclude_external_links", True),
            exclude_social_media_links=crawl_config.get("exclude_social_media_links", True),
        )

        await execute_crawl(crawl_id, request)

        _schedules[schedule_id] = schedule.model_copy(
            update={
                "last_run": now,
                "last_result": ScheduleStatus.SUCCESS,
                "updated_at": now,
            },
        )
        logger.info("Scheduled crawl %s completed successfully", schedule_id)
    except Exception:
        logger.exception("Scheduled crawl failed: %s", schedule_id)
        _schedules[schedule_id] = schedule.model_copy(
            update={
                "last_run": now,
                "last_result": ScheduleStatus.FAILED,
                "updated_at": now,
            },
        )


def _get_next_run(schedule_id: str) -> datetime | None:
    scheduler = get_scheduler()
    job = scheduler.get_job(schedule_id)
    if job is None:
        return None
    return job.next_run_time


def _add_scheduler_job(schedule: Schedule) -> None:
    trigger = _build_trigger(schedule.frequency, schedule.cron_expression)
    scheduler = get_scheduler()
    scheduler.add_job(
        _execute_scheduled_crawl,
        trigger=trigger,
        id=schedule.id,
        args=[schedule.id],
        replace_existing=True,
    )


def _remove_scheduler_job(schedule_id: str) -> None:
    scheduler = get_scheduler()
    job = scheduler.get_job(schedule_id)
    if job is not None:
        scheduler.remove_job(schedule_id)


@router.post("/schedules", response_model=Schedule, status_code=201)
async def create_schedule(body: CreateSchedule) -> Schedule:
    """Create a new scheduled crawl."""
    if body.frequency == ScheduleFrequency.CUSTOM and not body.cron_expression:
        raise HTTPException(
            status_code=400,
            detail="cron_expression is required when frequency is 'custom'",
        )

    now = datetime.now(tz=UTC)
    schedule_id = str(uuid.uuid4())

    schedule = Schedule(
        id=schedule_id,
        name=body.name,
        crawl_config=body.crawl_config,
        frequency=body.frequency,
        cron_expression=body.cron_expression,
        enabled=body.enabled,
        created_at=now,
        updated_at=now,
    )

    _schedules[schedule_id] = schedule

    if schedule.enabled:
        try:
            _add_scheduler_job(schedule)
            next_run = _get_next_run(schedule_id)
            if next_run is not None:
                _schedules[schedule_id] = schedule.model_copy(
                    update={"next_run": next_run},
                )
        except Exception as exc:
            _schedules.pop(schedule_id, None)
            logger.exception("Failed to register scheduler job")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid schedule configuration: {exc}",
            ) from exc

    logger.info("Created schedule %s (%s)", schedule.name, schedule_id)
    return _schedules[schedule_id]


@router.get("/schedules", response_model=list[Schedule], status_code=200)
async def list_schedules() -> list[Schedule]:
    """List all schedules."""
    return list(_schedules.values())


@router.get("/schedules/{schedule_id}", response_model=Schedule, status_code=200)
async def get_schedule(schedule_id: str) -> Schedule:
    """Get schedule by ID."""
    schedule = _schedules.get(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.put("/schedules/{schedule_id}", response_model=Schedule, status_code=200)
async def update_schedule(schedule_id: str, body: UpdateSchedule) -> Schedule:
    """Update an existing schedule."""
    existing = _schedules.get(schedule_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return existing

    now = datetime.now(tz=UTC)
    updates["updated_at"] = now

    updated = existing.model_copy(update=updates)

    if updated.frequency == ScheduleFrequency.CUSTOM and not updated.cron_expression:
        raise HTTPException(
            status_code=400,
            detail="cron_expression is required when frequency is 'custom'",
        )

    _schedules[schedule_id] = updated

    needs_reschedule = any(key in updates for key in ("frequency", "cron_expression", "enabled"))
    if needs_reschedule:
        _remove_scheduler_job(schedule_id)
        if updated.enabled:
            try:
                _add_scheduler_job(updated)
                next_run = _get_next_run(schedule_id)
                _schedules[schedule_id] = updated.model_copy(
                    update={"next_run": next_run, "updated_at": now},
                )
            except Exception as exc:
                _schedules[schedule_id] = existing
                logger.exception("Failed to reschedule job")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid schedule configuration: {exc}",
                ) from exc
        else:
            _schedules[schedule_id] = updated.model_copy(
                update={"next_run": None},
            )

    logger.info("Updated schedule %s", schedule_id)
    return _schedules[schedule_id]


@router.delete("/schedules/{schedule_id}", status_code=204, response_model=None)
async def delete_schedule(schedule_id: str) -> None:
    """Delete a schedule and its associated job."""
    if schedule_id not in _schedules:
        raise HTTPException(status_code=404, detail="Schedule not found")

    _remove_scheduler_job(schedule_id)
    del _schedules[schedule_id]
    logger.info("Deleted schedule %s", schedule_id)


@router.post("/schedules/{schedule_id}/toggle", response_model=Schedule, status_code=201)
async def toggle_schedule(schedule_id: str) -> Schedule:
    """Enable or disable a schedule."""
    schedule = _schedules.get(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    now = datetime.now(tz=UTC)
    new_enabled = not schedule.enabled

    if new_enabled:
        try:
            updated = schedule.model_copy(
                update={"enabled": True, "updated_at": now},
            )
            _schedules[schedule_id] = updated
            _add_scheduler_job(updated)
            next_run = _get_next_run(schedule_id)
            _schedules[schedule_id] = updated.model_copy(
                update={"next_run": next_run},
            )
        except Exception as exc:
            _schedules[schedule_id] = schedule
            logger.exception("Failed to enable schedule")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to enable schedule: {exc}",
            ) from exc
    else:
        _remove_scheduler_job(schedule_id)
        _schedules[schedule_id] = schedule.model_copy(
            update={"enabled": False, "next_run": None, "updated_at": now},
        )

    logger.info(
        "Toggled schedule %s → %s",
        schedule_id,
        "enabled" if new_enabled else "disabled",
    )
    return _schedules[schedule_id]


@router.post("/schedules/{schedule_id}/run", response_model=Schedule, status_code=201)
async def run_schedule_now(schedule_id: str) -> Schedule:
    """Trigger a scheduled crawl immediately."""
    schedule = _schedules.get(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await _execute_scheduled_crawl(schedule_id)

    logger.info("Triggered immediate run for schedule %s", schedule_id)
    return _schedules[schedule_id]
