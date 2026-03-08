"""Tests for app/api/settings.py — covering GET, PUT, test-connection endpoints.

Target: 70%+ coverage on app/api/settings.py
"""
from __future__ import annotations

import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api.settings import router as settings_router
from app.middleware import rate_limit as _rl_module

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(settings_router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture()
def settings_file(tmp_path):
    """Provide a temp settings.json path and patch _SETTINGS_PATH."""
    settings_path = tmp_path / "settings.json"
    with patch("app.api.settings._SETTINGS_PATH", settings_path):
        yield settings_path


# ---------------------------------------------------------------------------
# GET /api/settings
# ---------------------------------------------------------------------------


class TestGetSettings:
    def test_returns_200_with_defaults_when_no_file(self, settings_file):
        # File does not exist — should return AppSettings defaults
        resp = client.get("/api/settings")
        assert resp.status_code == 200

    def test_returns_default_theme(self, settings_file):
        resp = client.get("/api/settings")
        data = resp.json()
        assert "theme" in data
        assert data["theme"] == "system"

    def test_returns_default_language(self, settings_file):
        resp = client.get("/api/settings")
        data = resp.json()
        assert data["language"] == "en"

    def test_loads_existing_settings_from_file(self, settings_file):
        # Write a settings file with custom values
        settings_file.write_text(json.dumps({"theme": "dark", "language": "fr"}), encoding="utf-8")
        resp = client.get("/api/settings")
        data = resp.json()
        assert data["theme"] == "dark"
        assert data["language"] == "fr"

    def test_returns_defaults_when_file_is_corrupt(self, settings_file):
        settings_file.write_text("not valid json!!!", encoding="utf-8")
        resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        # Should fall back to defaults
        assert data["theme"] == "system"

    def test_returns_all_expected_sections(self, settings_file):
        resp = client.get("/api/settings")
        data = resp.json()
        assert "crawl_defaults" in data
        assert "connections" in data
        assert "notifications" in data
        assert "network_privacy" in data

    def test_connections_has_lm_studio_url(self, settings_file):
        resp = client.get("/api/settings")
        data = resp.json()
        assert "lm_studio_url" in data["connections"]

    def test_crawl_defaults_structure(self, settings_file):
        resp = client.get("/api/settings")
        data = resp.json()
        cd = data["crawl_defaults"]
        assert "extraction_type" in cd
        assert "word_count_threshold" in cd
        assert "screenshot" in cd
        assert "pdf" in cd


# ---------------------------------------------------------------------------
# PUT /api/settings
# ---------------------------------------------------------------------------


class TestUpdateSettings:
    def test_update_theme_returns_200(self, settings_file):
        resp = client.put("/api/settings", json={"theme": "dark"})
        assert resp.status_code == 200

    def test_update_theme_persisted_in_response(self, settings_file):
        resp = client.put("/api/settings", json={"theme": "light"})
        data = resp.json()
        assert data["theme"] == "light"

    def test_update_language(self, settings_file):
        resp = client.put("/api/settings", json={"language": "de"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == "de"

    def test_update_persists_to_file(self, settings_file):
        client.put("/api/settings", json={"theme": "dark"})
        assert settings_file.exists()
        saved = json.loads(settings_file.read_text())
        assert saved["theme"] == "dark"

    def test_deep_merge_nested_field(self, settings_file):
        """PUT with partial nested dict should deep-merge, not replace."""
        # First set a base
        client.put("/api/settings", json={"crawl_defaults": {"extraction_type": "llm"}})
        # Now update only screenshot without touching extraction_type
        resp = client.put("/api/settings", json={"crawl_defaults": {"screenshot": True}})
        data = resp.json()
        assert data["crawl_defaults"]["screenshot"] is True
        assert data["crawl_defaults"]["extraction_type"] == "llm"

    def test_update_connections_url(self, settings_file):
        resp = client.put(
            "/api/settings",
            json={"connections": {"lm_studio_url": "http://myserver:1234/v1"}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["connections"]["lm_studio_url"] == "http://myserver:1234/v1"

    def test_invalid_settings_returns_422(self, settings_file):
        """Passing a value that fails Pydantic validation should return 422."""
        # theme accepts any string so we need to break something else.
        # crawl_defaults.word_count_threshold must be int — pass a bad nested type
        resp = client.put(
            "/api/settings",
            json={"crawl_defaults": {"word_count_threshold": "not-an-int"}},
        )
        assert resp.status_code == 422

    def test_empty_dict_update_returns_defaults(self, settings_file):
        resp = client.put("/api/settings", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["theme"] == "system"

    def test_save_failure_returns_500(self, settings_file):
        """When _save_settings raises HTTPException(500), PUT should return 500."""
        from fastapi import HTTPException

        with patch(
            "app.api.settings._save_settings",
            side_effect=HTTPException(status_code=500, detail="Failed to persist settings"),
        ):
            resp = client.put("/api/settings", json={"theme": "dark"})
        assert resp.status_code == 500

    def test_update_notifications(self, settings_file):
        resp = client.put(
            "/api/settings",
            json={"notifications": {"crawl_complete": False}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["notifications"]["crawl_complete"] is False


# ---------------------------------------------------------------------------
# POST /api/settings/test-connection
# ---------------------------------------------------------------------------


class TestConnectionTest:
    def test_connected_on_200_response(self):
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_response))
        )
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            resp = client.post(
                "/api/settings/test-connection",
                json={"url": "http://localhost:1234/v1"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "connected"
        assert data["url"] == "http://localhost:1234/v1"
        assert data["latency_ms"] is not None
        assert data["error"] is None

    def test_disconnected_on_500_response(self):
        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_response))
        )
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            resp = client.post(
                "/api/settings/test-connection",
                json={"url": "http://localhost:1234/v1"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "disconnected"
        assert "500" in data["error"]

    def test_disconnected_on_connection_error(self):
        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(side_effect=Exception("Connection refused"))
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            resp = client.post(
                "/api/settings/test-connection",
                json={"url": "http://unreachable:9999/v1"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "disconnected"
        assert data["error"] is not None
        assert data["latency_ms"] is not None

    def test_disconnected_on_timeout(self):
        import httpx as _httpx

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(side_effect=_httpx.TimeoutException("timed out"))
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            resp = client.post(
                "/api/settings/test-connection",
                json={"url": "http://slow-server:1234/v1"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "disconnected"

    def test_url_appends_models_path(self):
        """The endpoint should call {url}/models, not {url} directly."""
        captured_urls = []

        async def fake_get(url, **kwargs):
            captured_urls.append(url)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            return mock_resp

        mock_inner = MagicMock()
        mock_inner.get = fake_get

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_inner)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            client.post(
                "/api/settings/test-connection",
                json={"url": "http://myserver:1234/v1"},
            )

        assert len(captured_urls) == 1
        assert captured_urls[0].endswith("/models")

    def test_url_with_trailing_slash_normalized(self):
        """Trailing slash in URL should be stripped before appending /models."""
        captured_urls = []

        async def fake_get(url, **kwargs):
            captured_urls.append(url)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            return mock_resp

        mock_inner = MagicMock()
        mock_inner.get = fake_get

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_inner)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            client.post(
                "/api/settings/test-connection",
                json={"url": "http://myserver:1234/v1/"},
            )

        assert "/models" in captured_urls[0]
        assert "//" not in captured_urls[0].replace("://", "")

    def test_missing_url_returns_422(self):
        resp = client.post("/api/settings/test-connection", json={})
        assert resp.status_code == 422

    def test_response_includes_latency(self):
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_async_client = MagicMock()
        mock_async_client.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_response))
        )
        mock_async_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.settings.httpx.AsyncClient", return_value=mock_async_client):
            resp = client.post(
                "/api/settings/test-connection",
                json={"url": "http://localhost:1234/v1"},
            )

        data = resp.json()
        assert isinstance(data["latency_ms"], float | int)
        assert data["latency_ms"] >= 0


# ---------------------------------------------------------------------------
# Internal helpers: _load_settings, _save_settings, _deep_merge
# ---------------------------------------------------------------------------


class TestLoadSettings:
    def test_returns_defaults_when_file_missing(self, tmp_path):
        path = tmp_path / "nonexistent.json"
        with patch("app.api.settings._SETTINGS_PATH", path):
            from app.api.settings import _load_settings

            result = _load_settings()
        assert result.theme == "system"

    def test_returns_parsed_settings_when_file_exists(self, tmp_path):
        path = tmp_path / "settings.json"
        path.write_text(json.dumps({"theme": "dark", "language": "ja"}), encoding="utf-8")
        with patch("app.api.settings._SETTINGS_PATH", path):
            from app.api.settings import _load_settings

            result = _load_settings()
        assert result.theme == "dark"
        assert result.language == "ja"

    def test_returns_defaults_on_json_error(self, tmp_path):
        path = tmp_path / "settings.json"
        path.write_text("{broken json", encoding="utf-8")
        with patch("app.api.settings._SETTINGS_PATH", path):
            from app.api.settings import _load_settings

            result = _load_settings()
        assert result.theme == "system"


class TestSaveSettings:
    def test_creates_file_on_save(self, tmp_path):
        path = tmp_path / "subdir" / "settings.json"
        from app.models.settings import AppSettings

        settings = AppSettings(theme="dark")
        with patch("app.api.settings._SETTINGS_PATH", path):
            from app.api.settings import _save_settings

            _save_settings(settings)
        assert path.exists()
        saved = json.loads(path.read_text())
        assert saved["theme"] == "dark"

    def test_raises_500_on_write_failure(self, tmp_path):
        from fastapi import HTTPException
        from app.models.settings import AppSettings

        settings = AppSettings()
        # Make the path unwritable by making it a directory
        bad_path = tmp_path / "settings.json"
        bad_path.mkdir()  # directory, not file — write_text will fail
        with patch("app.api.settings._SETTINGS_PATH", bad_path):
            from app.api.settings import _save_settings

            with pytest.raises(HTTPException) as exc_info:
                _save_settings(settings)
        assert exc_info.value.status_code == 500


class TestDeepMerge:
    def test_simple_override(self):
        from app.api.settings import _deep_merge

        result = _deep_merge({"a": 1, "b": 2}, {"b": 99})
        assert result == {"a": 1, "b": 99}

    def test_nested_merge(self):
        from app.api.settings import _deep_merge

        base = {"a": {"x": 1, "y": 2}, "b": 3}
        override = {"a": {"y": 99}}
        result = _deep_merge(base, override)
        assert result["a"]["x"] == 1
        assert result["a"]["y"] == 99
        assert result["b"] == 3

    def test_non_dict_override_replaces(self):
        from app.api.settings import _deep_merge

        base = {"a": {"x": 1}}
        override = {"a": "string"}
        result = _deep_merge(base, override)
        assert result["a"] == "string"

    def test_new_key_added(self):
        from app.api.settings import _deep_merge

        result = _deep_merge({"a": 1}, {"b": 2})
        assert result["a"] == 1
        assert result["b"] == 2

    def test_does_not_mutate_base(self):
        from app.api.settings import _deep_merge

        base = {"a": 1}
        _deep_merge(base, {"a": 99})
        assert base["a"] == 1
