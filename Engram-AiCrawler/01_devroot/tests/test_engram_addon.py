"""
Tests for the Crawl4AI Engram addon.

Covers:
- EngramConfig env var loading and is_configured property
- EngramClient disabled path (all methods return None/[])
- Setup wizard helpers: _ask_yes_no (EOF), _read_env, _write_env_key, _test_engram_connection
- get_addon_info with missing/corrupt manifest.json
"""
from __future__ import annotations

import socket
from pathlib import Path
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent


# ---------------------------------------------------------------------------
# EngramConfig
# ---------------------------------------------------------------------------


class TestEngramConfig:
    """EngramConfig loads correctly from environment variables."""

    def test_disabled_by_default(self, monkeypatch):
        monkeypatch.delenv("ENGRAM_ENABLED", raising=False)
        monkeypatch.delenv("ENGRAM_API_URL", raising=False)
        monkeypatch.delenv("ENGRAM_API_KEY", raising=False)

        from addons.crawl4ai_engram.config import EngramConfig

        cfg = EngramConfig()
        assert cfg.enabled is False
        assert cfg.is_configured is False

    def test_enabled_via_env(self, monkeypatch):
        monkeypatch.setenv("ENGRAM_ENABLED", "true")
        monkeypatch.setenv("ENGRAM_API_URL", "http://engram.local:8000")

        from addons.crawl4ai_engram.config import EngramConfig

        cfg = EngramConfig()
        assert cfg.enabled is True
        assert cfg.api_url == "http://engram.local:8000"
        assert cfg.is_configured is True

    def test_empty_api_url_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("ENGRAM_ENABLED", "true")
        monkeypatch.setenv("ENGRAM_API_URL", "")  # empty → should fall back

        from addons.crawl4ai_engram.config import EngramConfig

        cfg = EngramConfig()
        assert cfg.api_url == "http://localhost:8000"

    def test_api_key_none_when_unset(self, monkeypatch):
        monkeypatch.delenv("ENGRAM_API_KEY", raising=False)

        from addons.crawl4ai_engram.config import EngramConfig

        cfg = EngramConfig()
        assert cfg.api_key is None

    def test_headers_include_auth_when_key_set(self, monkeypatch):
        monkeypatch.setenv("ENGRAM_API_KEY", "secret-token")

        from addons.crawl4ai_engram.config import EngramConfig

        cfg = EngramConfig()
        headers = cfg.headers()
        assert headers["Authorization"] == "Bearer secret-token"

    def test_headers_no_auth_when_key_absent(self, monkeypatch):
        monkeypatch.delenv("ENGRAM_API_KEY", raising=False)

        from addons.crawl4ai_engram.config import EngramConfig

        cfg = EngramConfig()
        headers = cfg.headers()
        assert "Authorization" not in headers

    def test_reload_config_picks_up_new_env(self, monkeypatch):
        monkeypatch.setenv("ENGRAM_ENABLED", "false")

        from addons.crawl4ai_engram import config as cfg_module

        cfg_module.reload_config()
        assert cfg_module.get_config().enabled is False

        monkeypatch.setenv("ENGRAM_ENABLED", "true")
        monkeypatch.setenv("ENGRAM_API_URL", "http://new-host:9000")
        cfg_module.reload_config()
        assert cfg_module.get_config().enabled is True
        assert cfg_module.get_config().api_url == "http://new-host:9000"


# ---------------------------------------------------------------------------
# EngramClient — disabled path (no httpx, no network)
# ---------------------------------------------------------------------------


class TestEngramClientDisabled:
    """All client methods silently return None / [] when Engram is disabled."""

    def _disabled_client(self):
        from addons.crawl4ai_engram.config import EngramConfig
        from addons.crawl4ai_engram.client import EngramClient

        cfg = EngramConfig.__new__(EngramConfig)
        cfg.enabled = False
        cfg.api_url = ""
        cfg.api_key = None
        cfg.auto_store = False
        return EngramClient(config=cfg)

    def test_health_returns_disabled_status(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(client.health())
        assert result == {"status": "disabled"}

    def test_store_crawl_result_returns_none(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(client.store_crawl_result(url="https://example.com", content="text"))
        assert result is None

    def test_search_returns_empty_list(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(client.search("some query"))
        assert result == []

    def test_search_matter_returns_empty_list(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(client.search_matter("matter-001", "query"))
        assert result == []

    def test_list_matters_returns_empty_list(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(client.list_matters())
        assert result == []

    def test_create_matter_returns_none(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(client.create_matter("m-001", "Test Matter"))
        assert result is None

    def test_ingest_into_matter_returns_none(self):
        import asyncio

        client = self._disabled_client()
        result = asyncio.run(
            client.ingest_into_matter("m-001", content="evidence", source_url="https://example.com")
        )
        assert result is None


# ---------------------------------------------------------------------------
# Setup wizard helpers
# ---------------------------------------------------------------------------


class TestAskYesNo:
    """_ask_yes_no returns default on EOF / KeyboardInterrupt."""

    def _call(self, default: bool, side_effect) -> bool:
        from cli.setup import _ask_yes_no

        with patch("builtins.input", side_effect=side_effect):
            with patch("cli.setup.HAS_RICH", False):
                return _ask_yes_no("Question?", default=default)

    def test_eof_returns_true_default(self):
        result = self._call(default=True, side_effect=EOFError)
        assert result is True

    def test_eof_returns_false_default(self):
        result = self._call(default=False, side_effect=EOFError)
        assert result is False

    def test_keyboard_interrupt_returns_default(self):
        result = self._call(default=True, side_effect=KeyboardInterrupt)
        assert result is True

    def test_yes_answer(self):
        result = self._call(default=False, side_effect=["y"])
        assert result is True

    def test_no_answer(self):
        result = self._call(default=True, side_effect=["n"])
        assert result is False

    def test_empty_answer_returns_default(self):
        result = self._call(default=True, side_effect=[""])
        assert result is True


class TestReadEnv:
    """_read_env parses .env files correctly and handles errors gracefully."""

    def test_parses_key_value_pairs(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("FOO=bar\nBAZ=qux\n", encoding="utf-8")

        from cli.setup import _read_env

        result = _read_env(tmp_path)
        assert result["FOO"] == "bar"
        assert result["BAZ"] == "qux"

    def test_ignores_comments_and_blank_lines(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("# comment\n\nKEY=value\n", encoding="utf-8")

        from cli.setup import _read_env

        result = _read_env(tmp_path)
        assert "# comment" not in result
        assert result["KEY"] == "value"

    def test_missing_file_returns_empty_dict(self, tmp_path):
        from cli.setup import _read_env

        result = _read_env(tmp_path)
        assert result == {}

    def test_unreadable_file_returns_empty_dict(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("KEY=value\n", encoding="utf-8")

        from cli.setup import _read_env

        with patch.object(Path, "read_text", side_effect=PermissionError("denied")):
            result = _read_env(tmp_path)
        assert result == {}


class TestWriteEnvKey:
    """_write_env_key correctly appends or replaces keys in .env."""

    def test_appends_new_key(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("EXISTING=value\n", encoding="utf-8")

        from cli.setup import _write_env_key

        _write_env_key(tmp_path, "NEW_KEY", "new_value")

        content = env_file.read_text()
        assert "NEW_KEY=new_value" in content
        assert "EXISTING=value" in content

    def test_replaces_existing_key(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("MY_KEY=old_value\n", encoding="utf-8")

        from cli.setup import _write_env_key

        _write_env_key(tmp_path, "MY_KEY", "new_value")

        content = env_file.read_text()
        assert "MY_KEY=new_value" in content
        assert "MY_KEY=old_value" not in content

    def test_uncomments_commented_key(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("# MY_KEY=disabled\n", encoding="utf-8")

        from cli.setup import _write_env_key

        _write_env_key(tmp_path, "MY_KEY", "enabled")

        content = env_file.read_text()
        assert "MY_KEY=enabled" in content

    def test_creates_file_if_missing(self, tmp_path):
        from cli.setup import _write_env_key

        _write_env_key(tmp_path, "FRESH_KEY", "fresh_value")

        env_file = tmp_path / ".env"
        assert env_file.exists()
        assert "FRESH_KEY=fresh_value" in env_file.read_text()


class TestTestEngramConnection:
    """_test_engram_connection validates URLs and handles network errors."""

    def test_rejects_empty_url(self):
        from cli.setup import _test_engram_connection

        assert _test_engram_connection("") is False

    def test_rejects_non_http_url(self):
        from cli.setup import _test_engram_connection

        assert _test_engram_connection("ftp://bad.example.com") is False

    def test_rejects_relative_url(self):
        from cli.setup import _test_engram_connection

        assert _test_engram_connection("/api/health") is False

    def test_returns_true_on_200(self):
        from cli.setup import _test_engram_connection

        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.status = 200

        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = _test_engram_connection("http://localhost:8000")
        assert result is True

    def test_returns_true_on_http_error_below_500(self):
        from cli.setup import _test_engram_connection
        import urllib.error

        err = urllib.error.HTTPError(url="", code=401, msg="Unauthorized", hdrs=None, fp=None)
        with patch("urllib.request.urlopen", side_effect=err):
            result = _test_engram_connection("http://localhost:8000")
        assert result is True

    def test_returns_false_on_http_error_500(self):
        from cli.setup import _test_engram_connection
        import urllib.error

        err = urllib.error.HTTPError(
            url="", code=503, msg="Service Unavailable", hdrs=None, fp=None
        )
        with patch("urllib.request.urlopen", side_effect=err):
            result = _test_engram_connection("http://localhost:8000")
        assert result is False

    def test_returns_false_on_url_error(self):
        from cli.setup import _test_engram_connection
        import urllib.error

        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("no route")):
            result = _test_engram_connection("http://unreachable.local:8000")
        assert result is False

    def test_returns_false_on_timeout(self):
        from cli.setup import _test_engram_connection

        with patch("urllib.request.urlopen", side_effect=socket.timeout()):
            result = _test_engram_connection("http://slow.local:8000")
        assert result is False


# ---------------------------------------------------------------------------
# get_addon_info
# ---------------------------------------------------------------------------


class TestGetAddonInfo:
    """get_addon_info handles missing and corrupt manifest.json gracefully."""

    def test_returns_dict_with_required_keys(self, monkeypatch):
        monkeypatch.setenv("ENGRAM_ENABLED", "false")
        from addons.crawl4ai_engram.config import reload_config

        reload_config()

        from addons.crawl4ai_engram import get_addon_info

        info = get_addon_info()

        for key in (
            "name",
            "version",
            "description",
            "api_prefix",
            "features",
            "enabled",
            "setup_required",
        ):
            assert key in info, f"Missing key: {key}"

    def test_missing_manifest_returns_safe_defaults(self, monkeypatch, tmp_path):
        monkeypatch.setenv("ENGRAM_ENABLED", "false")
        from addons.crawl4ai_engram.config import reload_config

        reload_config()

        # Patch Path to point to a directory without manifest.json
        fake_path = tmp_path / "no_manifest.json"  # does not exist

        with patch("addons.crawl4ai_engram.__init__.Path") as MockPath:
            mock_instance = MagicMock()
            mock_instance.__truediv__ = lambda s, x: fake_path
            MockPath.return_value = mock_instance

            from addons.crawl4ai_engram import get_addon_info

            info = get_addon_info()
            # Should not raise; name must be a string
            assert isinstance(info["name"], str)

    def test_corrupt_manifest_returns_safe_defaults(self, tmp_path, monkeypatch):
        monkeypatch.setenv("ENGRAM_ENABLED", "false")
        from addons.crawl4ai_engram.config import reload_config

        reload_config()

        corrupt = tmp_path / "manifest.json"
        corrupt.write_text("{not valid json", encoding="utf-8")

        with patch("addons.crawl4ai_engram.__init__.Path") as MockPath:
            mock_instance = MagicMock()
            mock_instance.__truediv__ = lambda s, x: corrupt
            MockPath.return_value = mock_instance

            from addons.crawl4ai_engram import get_addon_info

            # Should not raise
            info = get_addon_info()
            assert isinstance(info, dict)
