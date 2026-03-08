"""Tests for app/api/scheduler.py — targets 70%+ coverage."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.api import scheduler as scheduler_module
from app.api.scheduler import router
from app.middleware import rate_limit as _rl_module
from datetime import UTC

# ---------------------------------------------------------------------------
# App / client setup
# ---------------------------------------------------------------------------
app = FastAPI()
app.include_router(router)
client = TestClient(app)

# ---------------------------------------------------------------------------
# Shared payload
# ---------------------------------------------------------------------------
BASIC_SCHEDULE = {
    "name": "Test Schedule",
    "crawl_config": {"url": "https://example.com"},
    "frequency": "daily",
    "enabled": True,
}


# ---------------------------------------------------------------------------
# Autouse fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all tests."""
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture(autouse=True)
def clear_schedules():
    """Clear the in-memory schedule store between tests."""
    scheduler_module._schedules.clear()
    yield
    scheduler_module._schedules.clear()


@pytest.fixture(autouse=True)
def mock_scheduler():
    """Mock APScheduler to avoid real job scheduling."""
    mock_sched = MagicMock()
    mock_job = MagicMock()
    mock_job.next_run_time = None
    mock_sched.get_job.return_value = mock_job
    mock_sched.add_job.return_value = None
    mock_sched.remove_job.return_value = None
    with patch("app.api.scheduler.get_scheduler", return_value=mock_sched):
        yield mock_sched


# ===========================================================================
# POST /api/scheduler/schedules — create_schedule
# ===========================================================================
class TestCreateSchedule:
    def test_create_basic_schedule_returns_201(self):
        resp = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Schedule"
        assert data["frequency"] == "daily"
        assert data["enabled"] is True
        assert "id" in data

    def test_create_schedule_disabled_no_job_added(self, mock_scheduler):
        payload = {**BASIC_SCHEDULE, "enabled": False}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201
        assert resp.json()["enabled"] is False
        mock_scheduler.add_job.assert_not_called()

    def test_create_schedule_enabled_adds_job(self, mock_scheduler):
        resp = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        assert resp.status_code == 201
        mock_scheduler.add_job.assert_called_once()

    def test_create_custom_frequency_with_cron(self):
        payload = {
            **BASIC_SCHEDULE,
            "frequency": "custom",
            "cron_expression": "0 * * * *",
        }
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201
        assert resp.json()["cron_expression"] == "0 * * * *"

    def test_create_custom_frequency_without_cron_returns_400(self):
        payload = {**BASIC_SCHEDULE, "frequency": "custom", "cron_expression": None}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 400
        assert "cron_expression" in resp.json()["detail"]

    def test_create_schedule_job_failure_returns_400(self, mock_scheduler):
        mock_scheduler.add_job.side_effect = RuntimeError("scheduler boom")
        resp = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        assert resp.status_code == 400
        assert "Invalid schedule configuration" in resp.json()["detail"]
        # Schedule should be removed from store on failure
        assert len(scheduler_module._schedules) == 0

    def test_create_hourly_schedule(self):
        payload = {**BASIC_SCHEDULE, "frequency": "hourly"}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201
        assert resp.json()["frequency"] == "hourly"

    def test_create_weekly_schedule(self):
        payload = {**BASIC_SCHEDULE, "frequency": "weekly"}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201

    def test_create_monthly_schedule(self):
        payload = {**BASIC_SCHEDULE, "frequency": "monthly"}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201

    def test_create_once_schedule(self):
        payload = {**BASIC_SCHEDULE, "frequency": "once"}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201

    def test_create_schedule_stores_in_memory(self):
        resp = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        assert resp.status_code == 201
        schedule_id = resp.json()["id"]
        assert schedule_id in scheduler_module._schedules

    def test_create_schedule_with_next_run(self, mock_scheduler):
        """When get_job returns a job with next_run_time, schedule is updated."""
        from datetime import datetime

        mock_job = MagicMock()
        mock_job.next_run_time = datetime(2030, 1, 1, tzinfo=UTC)
        mock_scheduler.get_job.return_value = mock_job

        resp = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        assert resp.status_code == 201
        # next_run should be set
        assert resp.json()["next_run"] is not None


# ===========================================================================
# GET /api/scheduler/schedules — list_schedules
# ===========================================================================
class TestListSchedules:
    def test_list_empty(self):
        resp = client.get("/api/scheduler/schedules")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_schedules(self):
        client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        client.post("/api/scheduler/schedules", json={**BASIC_SCHEDULE, "name": "Second"})
        resp = client.get("/api/scheduler/schedules")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_returns_all_fields(self):
        client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        resp = client.get("/api/scheduler/schedules")
        item = resp.json()[0]
        assert "id" in item
        assert "name" in item
        assert "frequency" in item
        assert "enabled" in item


# ===========================================================================
# GET /api/scheduler/schedules/{id} — get_schedule
# ===========================================================================
class TestGetSchedule:
    def test_get_existing_schedule(self):
        create = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        schedule_id = create.json()["id"]

        resp = client.get(f"/api/scheduler/schedules/{schedule_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == schedule_id

    def test_get_nonexistent_schedule_returns_404(self):
        resp = client.get("/api/scheduler/schedules/nonexistent-id")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Schedule not found"


# ===========================================================================
# PUT /api/scheduler/schedules/{id} — update_schedule
# ===========================================================================
class TestUpdateSchedule:
    def _create(self, payload=None) -> str:
        resp = client.post("/api/scheduler/schedules", json=payload or BASIC_SCHEDULE)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_update_nonexistent_returns_404(self):
        resp = client.put("/api/scheduler/schedules/no-such-id", json={"name": "X"})
        assert resp.status_code == 404

    def test_update_name_only(self):
        sid = self._create()
        resp = client.put(f"/api/scheduler/schedules/{sid}", json={"name": "Updated Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_update_empty_body_returns_existing(self):
        sid = self._create()
        resp = client.put(f"/api/scheduler/schedules/{sid}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == BASIC_SCHEDULE["name"]

    def test_update_frequency_triggers_reschedule(self, mock_scheduler):
        sid = self._create()
        resp = client.put(f"/api/scheduler/schedules/{sid}", json={"frequency": "weekly"})
        assert resp.status_code == 200
        assert resp.json()["frequency"] == "weekly"
        # remove_job should have been called (reschedule)
        mock_scheduler.remove_job.assert_called()

    def test_update_to_custom_without_cron_returns_400(self):
        sid = self._create()
        resp = client.put(f"/api/scheduler/schedules/{sid}", json={"frequency": "custom"})
        assert resp.status_code == 400
        assert "cron_expression" in resp.json()["detail"]

    def test_update_to_custom_with_cron(self):
        sid = self._create()
        resp = client.put(
            f"/api/scheduler/schedules/{sid}",
            json={"frequency": "custom", "cron_expression": "*/5 * * * *"},
        )
        assert resp.status_code == 200
        assert resp.json()["cron_expression"] == "*/5 * * * *"

    def test_update_reschedule_failure_reverts_and_returns_400(self, mock_scheduler):
        sid = self._create()
        mock_scheduler.add_job.side_effect = RuntimeError("add_job failed")

        resp = client.put(f"/api/scheduler/schedules/{sid}", json={"frequency": "weekly"})
        assert resp.status_code == 400
        assert "Invalid schedule configuration" in resp.json()["detail"]
        # Schedule should be reverted to original
        assert scheduler_module._schedules[sid].frequency == "daily"

    def test_update_disable_schedule(self, mock_scheduler):
        """Disabling a schedule (enabled=False) should remove the job."""
        sid = self._create()
        resp = client.put(f"/api/scheduler/schedules/{sid}", json={"enabled": False})
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False
        assert resp.json()["next_run"] is None
        mock_scheduler.remove_job.assert_called()

    def test_update_enable_schedule(self, mock_scheduler):
        """Enabling a previously disabled schedule should add a job."""
        sid = self._create(payload={**BASIC_SCHEDULE, "enabled": False})
        resp = client.put(f"/api/scheduler/schedules/{sid}", json={"enabled": True})
        assert resp.status_code == 200
        assert resp.json()["enabled"] is True
        mock_scheduler.add_job.assert_called()


# ===========================================================================
# DELETE /api/scheduler/schedules/{id} — delete_schedule
# ===========================================================================
class TestDeleteSchedule:
    def test_delete_existing_returns_204(self):
        create = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        sid = create.json()["id"]

        resp = client.delete(f"/api/scheduler/schedules/{sid}")
        assert resp.status_code == 204
        assert sid not in scheduler_module._schedules

    def test_delete_nonexistent_returns_404(self):
        resp = client.delete("/api/scheduler/schedules/no-such-id")
        assert resp.status_code == 404

    def test_delete_removes_scheduler_job(self, mock_scheduler):
        # Seed a job into the mock
        create = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        sid = create.json()["id"]
        mock_scheduler.get_job.return_value = MagicMock()  # pretend job exists

        client.delete(f"/api/scheduler/schedules/{sid}")
        mock_scheduler.remove_job.assert_called_with(sid)


# ===========================================================================
# POST /api/scheduler/schedules/{id}/toggle — toggle_schedule
# ===========================================================================
class TestToggleSchedule:
    def _create(self, enabled: bool = True) -> str:
        payload = {**BASIC_SCHEDULE, "enabled": enabled}
        resp = client.post("/api/scheduler/schedules", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_toggle_nonexistent_returns_404(self):
        resp = client.post("/api/scheduler/schedules/no-such-id/toggle")
        assert resp.status_code == 404

    def test_toggle_enabled_to_disabled(self, mock_scheduler):
        sid = self._create(enabled=True)
        resp = client.post(f"/api/scheduler/schedules/{sid}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False
        assert resp.json()["next_run"] is None

    def test_toggle_disabled_to_enabled(self, mock_scheduler):
        sid = self._create(enabled=False)
        resp = client.post(f"/api/scheduler/schedules/{sid}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is True
        mock_scheduler.add_job.assert_called()

    def test_toggle_enable_failure_returns_400(self, mock_scheduler):
        sid = self._create(enabled=False)
        mock_scheduler.add_job.side_effect = RuntimeError("add_job boom")

        resp = client.post(f"/api/scheduler/schedules/{sid}/toggle")
        assert resp.status_code == 400
        assert "Failed to enable schedule" in resp.json()["detail"]
        # Schedule should be reverted to disabled
        assert scheduler_module._schedules[sid].enabled is False

    def test_toggle_enable_updates_next_run(self, mock_scheduler):
        from datetime import datetime

        mock_job = MagicMock()
        mock_job.next_run_time = datetime(2030, 6, 1, tzinfo=UTC)
        mock_scheduler.get_job.return_value = mock_job

        sid = self._create(enabled=False)
        resp = client.post(f"/api/scheduler/schedules/{sid}/toggle")
        assert resp.status_code == 200
        assert resp.json()["next_run"] is not None


# ===========================================================================
# POST /api/scheduler/schedules/{id}/run — run_schedule_now
# ===========================================================================
class TestRunScheduleNow:
    def test_run_nonexistent_returns_404(self):
        resp = client.post("/api/scheduler/schedules/no-such-id/run")
        assert resp.status_code == 404

    def test_run_existing_schedule_returns_200(self):
        create = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        sid = create.json()["id"]

        resp = client.post(f"/api/scheduler/schedules/{sid}/run")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == sid

    def test_run_updates_last_run(self):
        create = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        sid = create.json()["id"]

        resp = client.post(f"/api/scheduler/schedules/{sid}/run")
        assert resp.status_code == 200
        assert resp.json()["last_run"] is not None

    def test_run_sets_last_result_success(self):
        create = client.post("/api/scheduler/schedules", json=BASIC_SCHEDULE)
        sid = create.json()["id"]

        resp = client.post(f"/api/scheduler/schedules/{sid}/run")
        assert resp.status_code == 200
        assert resp.json()["last_result"] == "success"


# ===========================================================================
# _execute_scheduled_crawl — direct async coverage
# ===========================================================================
class TestExecuteScheduledCrawl:
    def test_execute_missing_schedule_is_noop(self):
        """Calling _execute_scheduled_crawl for unknown id should not raise."""
        import asyncio

        asyncio.run(scheduler_module._execute_scheduled_crawl("nonexistent-id"))
        # No exception, nothing in _schedules changed
        assert "nonexistent-id" not in scheduler_module._schedules

    def test_execute_sets_success(self):
        """Direct call to _execute_scheduled_crawl updates last_result to success."""
        import asyncio

        # Seed a schedule directly
        from datetime import datetime
        from app.models.scheduler import Schedule, ScheduleFrequency

        now = datetime.now(tz=UTC)
        sched = Schedule(
            id="test-exec-id",
            name="Direct Exec",
            crawl_config={"url": "https://test.com"},
            frequency=ScheduleFrequency.DAILY,
            enabled=True,
            created_at=now,
            updated_at=now,
        )
        scheduler_module._schedules["test-exec-id"] = sched

        asyncio.run(scheduler_module._execute_scheduled_crawl("test-exec-id"))
        updated = scheduler_module._schedules["test-exec-id"]
        assert updated.last_result == "success"
        assert updated.last_run is not None

    def test_execute_exception_sets_failed(self):
        import asyncio
        from datetime import datetime
        from app.models.scheduler import Schedule, ScheduleFrequency
        from unittest.mock import patch as _patch

        now = datetime.now(tz=UTC)
        sched = Schedule(
            id="test-fail-id",
            name="Fail Test",
            crawl_config={"url": "https://fail.com"},
            frequency=ScheduleFrequency.DAILY,
            enabled=True,
            created_at=now,
            updated_at=now,
        )
        scheduler_module._schedules["test-fail-id"] = sched

        call_count = {"n": 0}
        original_copy = sched.__class__.model_copy

        def patched_copy(self_inner, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise RuntimeError("simulated failure")
            return original_copy(self_inner, **kwargs)

        with _patch.object(sched.__class__, "model_copy", patched_copy):
            asyncio.run(scheduler_module._execute_scheduled_crawl("test-fail-id"))

        updated = scheduler_module._schedules["test-fail-id"]
        assert updated.last_result == "failed"


# ===========================================================================
# _build_trigger — direct coverage
# ===========================================================================
class TestBuildTrigger:
    def test_custom_with_cron(self):
        from apscheduler.triggers.cron import CronTrigger

        trigger = scheduler_module._build_trigger("custom", "0 12 * * *")
        assert isinstance(trigger, CronTrigger)

    def test_custom_without_cron_raises(self):
        with pytest.raises(ValueError, match="cron_expression"):
            scheduler_module._build_trigger("custom", None)

    def test_hourly_returns_interval_trigger(self):
        from apscheduler.triggers.interval import IntervalTrigger

        trigger = scheduler_module._build_trigger("hourly")
        assert isinstance(trigger, IntervalTrigger)

    def test_daily_returns_interval_trigger(self):
        from apscheduler.triggers.interval import IntervalTrigger

        trigger = scheduler_module._build_trigger("daily")
        assert isinstance(trigger, IntervalTrigger)

    def test_weekly_returns_interval_trigger(self):
        from apscheduler.triggers.interval import IntervalTrigger

        trigger = scheduler_module._build_trigger("weekly")
        assert isinstance(trigger, IntervalTrigger)

    def test_monthly_returns_cron_trigger(self):
        from apscheduler.triggers.cron import CronTrigger

        trigger = scheduler_module._build_trigger("monthly")
        assert isinstance(trigger, CronTrigger)

    def test_once_returns_date_trigger(self):
        from apscheduler.triggers.date import DateTrigger

        trigger = scheduler_module._build_trigger("once")
        assert isinstance(trigger, DateTrigger)

    def test_unsupported_frequency_raises(self):
        with pytest.raises(ValueError, match="Unsupported frequency"):
            scheduler_module._build_trigger("unsupported")


# ===========================================================================
# _get_next_run — direct coverage
# ===========================================================================
class TestGetNextRun:
    def test_get_next_run_when_job_exists(self, mock_scheduler):
        from datetime import datetime

        mock_job = MagicMock()
        expected_time = datetime(2030, 1, 1, tzinfo=UTC)
        mock_job.next_run_time = expected_time
        mock_scheduler.get_job.return_value = mock_job

        result = scheduler_module._get_next_run("some-id")
        assert result == expected_time

    def test_get_next_run_when_no_job(self, mock_scheduler):
        mock_scheduler.get_job.return_value = None
        result = scheduler_module._get_next_run("some-id")
        assert result is None


# ===========================================================================
# _remove_scheduler_job — direct coverage
# ===========================================================================
class TestRemoveSchedulerJob:
    def test_remove_existing_job(self, mock_scheduler):
        mock_scheduler.get_job.return_value = MagicMock()
        scheduler_module._remove_scheduler_job("some-id")
        mock_scheduler.remove_job.assert_called_once_with("some-id")

    def test_remove_nonexistent_job_does_not_call_remove(self, mock_scheduler):
        mock_scheduler.get_job.return_value = None
        scheduler_module._remove_scheduler_job("some-id")
        mock_scheduler.remove_job.assert_not_called()
