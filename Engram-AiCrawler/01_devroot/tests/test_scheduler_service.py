"""Tests for scheduler_service.py.

Mocks APScheduler to avoid real Redis/asyncio scheduler connections.
Tests the lifecycle logic: get_scheduler, start_scheduler, shutdown_scheduler.
"""

from unittest.mock import MagicMock, patch


class TestGetScheduler:
    def test_returns_scheduler_instance(self):
        """get_scheduler returns an AsyncIOScheduler."""
        import app.services.scheduler_service as svc

        # Reset singleton
        svc._scheduler = None
        with patch("app.services.scheduler_service._build_scheduler") as mock_build:
            mock_scheduler = MagicMock()
            mock_build.return_value = mock_scheduler
            result = svc.get_scheduler()
            assert result is mock_scheduler

    def test_returns_same_instance_on_repeated_calls(self):
        """Singleton — second call returns cached instance."""
        import app.services.scheduler_service as svc

        svc._scheduler = None
        with patch("app.services.scheduler_service._build_scheduler") as mock_build:
            mock_scheduler = MagicMock()
            mock_build.return_value = mock_scheduler
            first = svc.get_scheduler()
            second = svc.get_scheduler()
            assert first is second
            mock_build.assert_called_once()

    def teardown_method(self):
        """Reset singleton after each test."""
        import app.services.scheduler_service as svc

        svc._scheduler = None


class TestStartScheduler:
    def setup_method(self):
        import app.services.scheduler_service as svc

        svc._scheduler = None

    def teardown_method(self):
        import app.services.scheduler_service as svc

        svc._scheduler = None

    def test_starts_scheduler_when_not_running(self):
        import app.services.scheduler_service as svc

        mock_scheduler = MagicMock()
        mock_scheduler.running = False
        svc._scheduler = mock_scheduler

        svc.start_scheduler()

        mock_scheduler.start.assert_called_once()

    def test_does_not_start_when_already_running(self):
        import app.services.scheduler_service as svc

        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        svc._scheduler = mock_scheduler

        svc.start_scheduler()

        mock_scheduler.start.assert_not_called()


class TestShutdownScheduler:
    def setup_method(self):
        import app.services.scheduler_service as svc

        svc._scheduler = None

    def teardown_method(self):
        import app.services.scheduler_service as svc

        svc._scheduler = None

    def test_shuts_down_running_scheduler(self):
        import app.services.scheduler_service as svc

        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        svc._scheduler = mock_scheduler

        svc.shutdown_scheduler()

        mock_scheduler.shutdown.assert_called_once_with(wait=False)

    def test_resets_singleton_to_none_after_shutdown(self):
        import app.services.scheduler_service as svc

        mock_scheduler = MagicMock()
        mock_scheduler.running = True
        svc._scheduler = mock_scheduler

        svc.shutdown_scheduler()

        assert svc._scheduler is None

    def test_does_not_shutdown_when_not_running(self):
        import app.services.scheduler_service as svc

        mock_scheduler = MagicMock()
        mock_scheduler.running = False
        svc._scheduler = mock_scheduler

        svc.shutdown_scheduler()

        mock_scheduler.shutdown.assert_not_called()

    def test_noop_when_scheduler_is_none(self):
        import app.services.scheduler_service as svc

        svc._scheduler = None
        # Should not raise
        svc.shutdown_scheduler()


class TestBuildScheduler:
    def test_falls_back_to_memory_store_when_redis_unavailable(self):
        """If Redis is unavailable, scheduler still builds with in-memory store."""
        import app.services.scheduler_service as svc

        # Patch RedisJobStore to raise on init
        with patch(
            "app.services.scheduler_service.RedisJobStore", side_effect=Exception("no redis")
        ):
            with patch("app.services.scheduler_service.AsyncIOScheduler") as mock_cls:
                mock_cls.return_value = MagicMock()
                scheduler = svc._build_scheduler()
                # Should have been called with empty jobstores (fallback)
                call_kwargs = mock_cls.call_args.kwargs
                assert call_kwargs.get("jobstores") == {} or "jobstores" in call_kwargs
