import configparser
from pathlib import Path


class TestSupervisordConfig:
    @staticmethod
    def get_config_path() -> Path:
        return Path(__file__).resolve().parents[2] / "supervisord.conf"

    def test_supervisord_config_exists(self):
        config_path = self.get_config_path()
        assert config_path.exists(), "supervisord.conf should exist"

    def test_supervisord_config_valid(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        assert config.has_section("supervisord"), "Should have supervisord section"
        assert config.get("supervisord", "nodaemon") == "true", "Should run in foreground"
        assert config.get("supervisord", "loglevel") == "info", "Should have info log level"

    def test_all_services_defined(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        expected_services = ["crawl4ai", "lm_bridge", "watchdog", "cleanup"]
        for service in expected_services:
            assert config.has_section(f"program:{service}"), (
                f"Should have {service} service defined"
            )

    def test_service_auto_restart_enabled(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        expected_policies = {
            "crawl4ai": {"autorestart": "true", "autostart": "true"},
            "lm_bridge": {"autorestart": "false", "autostart": "false"},
            "watchdog": {"autorestart": "true", "autostart": "true"},
            "cleanup": {"autorestart": "true", "autostart": "true"},
        }
        for service, policy in expected_policies.items():
            assert config.get(f"program:{service}", "autorestart") == policy["autorestart"], (
                f"{service} should use the documented autorestart policy"
            )
            assert config.get(f"program:{service}", "autostart") == policy["autostart"], (
                f"{service} should use the documented autostart policy"
            )

    def test_log_rotation_configured(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        services = ["crawl4ai", "lm_bridge", "watchdog", "cleanup"]
        for service in services:
            assert config.has_option(f"program:{service}", "stdout_logfile"), (
                f"{service} should have stdout log"
            )
            assert config.has_option(f"program:{service}", "stderr_logfile"), (
                f"{service} should have stderr log"
            )
            assert config.get(f"program:{service}", "stdout_logfile_maxbytes") == "50MB", (
                f"{service} should rotate at 50MB"
            )
            assert config.get(f"program:{service}", "stdout_logfile_backups") == "10", (
                f"{service} should keep 10 backups"
            )

    def test_graceful_shutdown_configured(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        services = ["crawl4ai", "lm_bridge", "watchdog", "cleanup"]
        for service in services:
            assert config.get(f"program:{service}", "stopsignal") == "TERM", (
                f"{service} should use SIGTERM"
            )
            assert config.get(f"program:{service}", "stopwaitsecs") == "30", (
                f"{service} should wait 30s"
            )

    def test_max_restart_attempts_configured(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        services = ["crawl4ai", "lm_bridge", "watchdog", "cleanup"]
        for service in services:
            assert config.get(f"program:{service}", "startretries") == "3", (
                f"{service} should retry 3 times"
            )

    def test_environment_variable_passthrough(self):
        config_path = self.get_config_path()
        config = configparser.ConfigParser()
        config.read(str(config_path))

        env_vars_by_service = {
            "crawl4ai": [
                "PYTHONUNBUFFERED",
                "ENV_APP_NAME",
                "ENV_LOG_LEVEL",
                "ENV_LM_STUDIO_URL",
                "ENV_REDIS_URL",
            ],
            "lm_bridge": [
                "PYTHONUNBUFFERED",
                "ENV_APP_NAME",
                "ENV_LOG_LEVEL",
                "ENV_LM_STUDIO_URL",
                "ENV_CHROMADB_PATH",
            ],
            "watchdog": [
                "PYTHONUNBUFFERED",
                "ENV_APP_NAME",
                "ENV_LOG_LEVEL",
                "ENV_WATCHDOG_CHECK_INTERVAL_SECONDS",
                "ENV_CHROMADB_PATH",
            ],
            "cleanup": [
                "PYTHONUNBUFFERED",
                "ENV_APP_NAME",
                "ENV_LOG_LEVEL",
                "ENV_DATA_HOT_PATH",
                "ENV_WATCHDOG_DISK_THRESHOLD_PERCENT",
            ],
        }

        for service, expected_vars in env_vars_by_service.items():
            env = config.get(f"program:{service}", "environment", raw=True)
            for var in expected_vars:
                assert var in env, f"{service} should have {var} passthrough"
