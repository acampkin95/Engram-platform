"""
Tests for WatchdogService

Test suite for worker monitoring, orphan detection, and resource management.
"""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.watchdog import WatchdogService


class TestWatchdogService:
    @pytest.fixture
    def mock_env(self):
        env_vars = {
            "WATCHDOG_CHECK_INTERVAL_SECONDS": "30",
            "WATCHDOG_ORPHAN_AGE_MINUTES": "60",
            "WATCHDOG_MEMORY_THRESHOLD_PERCENT": "90",
            "WATCHDOG_DISK_THRESHOLD_PERCENT": "85",
            "WATCHDOG_MEMORY_CHECK_ENABLED": "true",
            "WATCHDOG_DISK_CHECK_ENABLED": "true",
            "LOG_LEVEL": "INFO",
        }
        with patch.dict(os.environ, env_vars, clear=True):
            yield env_vars

    def test_watchdog_initialization(self, mock_env):
        service = WatchdogService()

        assert service.check_interval == 30
        assert service.orphan_age_minutes == 60
        assert service.memory_threshold == 90
        assert service.disk_threshold == 85
        assert service.memory_check_enabled == True
        assert service.disk_check_enabled == True

    def test_watchdog_handles_sigterm(self, mock_env):
        service = WatchdogService()
        assert service.running == True

        service.handle_shutdown(15, None)
        assert service.running == False

    def test_watchdog_without_psutil(self, mock_env):
        with patch.dict(
            os.environ,
            {
                "WATCHDOG_MEMORY_CHECK_ENABLED": "false",
                "WATCHDOG_DISK_CHECK_ENABLED": "false",
            },
        ):
            service = WatchdogService()
            service.check_orphaned_workers()
            service.check_memory_usage()
            service.check_disk_usage()

    @pytest.mark.skipif(os.name != "posix", reason="requires POSIX")
    def test_orphaned_worker_detection(self, mock_env):
        """Test that check_orphaned_workers runs without error."""
        service = WatchdogService()

        with patch("psutil.process_iter", return_value=[]):
            # Should complete without error (no orphans found)
            service.check_orphaned_workers()  # should not raise

    @pytest.mark.skipif(os.name != "posix", reason="requires POSIX")
    def test_memory_monitoring_at_threshold(self, mock_env):
        """Test that memory check logs warning at threshold."""
        service = WatchdogService()

        mock_memory = MagicMock()
        mock_memory.percent = 95.0  # Above 90% threshold
        with patch("psutil.virtual_memory", return_value=mock_memory), patch(
            "psutil.process_iter", return_value=[]
        ):
            with patch("app.services.watchdog.logger") as mock_logger:
                service.check_memory_usage()
                assert mock_logger.warning.called

    @pytest.mark.skipif(os.name != "posix", reason="requires POSIX")
    def test_disk_monitoring_at_threshold(self, mock_env):
        """Test that disk check logs warning at threshold."""
        service = WatchdogService()

        mock_usage = MagicMock()
        mock_usage.used = 86
        mock_usage.total = 100
        with patch("shutil.disk_usage", return_value=mock_usage):
            with patch("app.services.watchdog.logger") as mock_logger:
                service.check_disk_usage()
                assert mock_logger.warning.called

    @pytest.mark.skipif(os.name != "posix", reason="requires POSIX")
    def test_memory_below_threshold(self, mock_env):
        """Test that memory check does NOT warn when below threshold."""
        service = WatchdogService()

        mock_memory = MagicMock()
        mock_memory.percent = 80.0  # Below 90% threshold
        with patch("psutil.virtual_memory", return_value=mock_memory), patch(
            "psutil.process_iter", return_value=[]
        ):
            with patch("app.services.watchdog.logger") as mock_logger:
                service.check_memory_usage()
                assert not mock_logger.warning.called

    @pytest.mark.skipif(os.name != "posix", reason="requires POSIX")
    def test_disk_below_threshold(self, mock_env):
        """Test that disk check does NOT warn when below threshold."""
        service = WatchdogService()

        mock_usage = MagicMock()
        mock_usage.used = 80
        mock_usage.total = 100
        with patch("shutil.disk_usage", return_value=mock_usage):
            with patch("app.services.watchdog.logger") as mock_logger:
                service.check_disk_usage()
                assert not mock_logger.warning.called
