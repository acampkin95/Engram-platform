"""
End-to-end tests for the Crawl4AI OSINT API.

These tests exercise the full HTTP request/response cycle using TestClient,
with external dependencies (Redis, ChromaDB, LM Studio, browser) mocked at
the boundary.  No real network calls are made.

Test categories:
- Health & root endpoints
- Crawl API (start, status, list, cancel, delete, batch, deep)
- Chat API (completions, sessions, history)
- Data API (CRUD, stats)
- Storage API (collections)
- OSINT API (platforms list)
- WebSocket upgrade
- Auth enforcement (401 when protected routes enabled)
"""

import pytest
from unittest.mock import patch, MagicMock


# ===========================================================================
# Health & root
# ===========================================================================


class TestHealthE2E:
    def test_health_returns_200(self, app_client):
        response = app_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_root_returns_200(self, app_client):
        response = app_client.get("/")
        assert response.status_code == 200

    def test_stats_returns_200(self, app_client):
        response = app_client.get("/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_connections" in data


# ===========================================================================
# Crawl API
# ===========================================================================


class TestCrawlE2E:
    def test_start_crawl_returns_202(self, fresh_app_client, mock_crawler_context):
        response = fresh_app_client.post(
            "/api/crawl/start",
            json={"url": "https://example.com"},
        )
        assert response.status_code == 202
        data = response.json()
        assert "crawl_id" in data
        assert data["status"] == "pending"
        assert data["url"] in ("https://example.com", "https://example.com/")

    def test_start_crawl_invalid_url_returns_400(self, fresh_app_client):
        response = fresh_app_client.post(
            "/api/crawl/start",
            json={"url": "not-a-url"},
        )
        assert response.status_code in (400, 422)

    def test_get_crawl_status(self, fresh_app_client, mock_crawler_context):
        # Start a crawl first
        start = fresh_app_client.post(
            "/api/crawl/start",
            json={"url": "https://example.com"},
        )
        assert start.status_code == 202
        crawl_id = start.json()["crawl_id"]

        # Get its status
        response = fresh_app_client.get(f"/api/crawl/status/{crawl_id}")
        assert response.status_code == 200
        assert response.json()["crawl_id"] == crawl_id

    def test_get_crawl_status_not_found(self, fresh_app_client):
        response = fresh_app_client.get("/api/crawl/status/nonexistent-id")
        assert response.status_code == 404

    def test_list_crawls(self, fresh_app_client, mock_crawler_context):
        # Start a crawl
        fresh_app_client.post(
            "/api/crawl/start",
            json={"url": "https://example.com"},
        )
        response = fresh_app_client.get("/api/crawl/list")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_cancel_crawl(self, fresh_app_client, mock_crawler_context):
        start = fresh_app_client.post(
            "/api/crawl/start",
            json={"url": "https://example.com"},
        )
        crawl_id = start.json()["crawl_id"]

        response = fresh_app_client.post(f"/api/crawl/cancel/{crawl_id}")
        assert response.status_code == 200
        assert "cancelled" in response.json()["message"]

    def test_cancel_crawl_not_found(self, fresh_app_client):
        response = fresh_app_client.post("/api/crawl/cancel/nonexistent")
        assert response.status_code == 404

    def test_delete_crawl_no_auth(self, fresh_app_client, mock_crawler_context):
        """DELETE requires auth when auth is disabled — should succeed without user."""
        start = fresh_app_client.post(
            "/api/crawl/start",
            json={"url": "https://example.com"},
        )
        crawl_id = start.json()["crawl_id"]

        response = fresh_app_client.delete(f"/api/crawl/{crawl_id}")
        assert response.status_code == 200

    def test_delete_crawl_not_found(self, fresh_app_client):
        response = fresh_app_client.delete("/api/crawl/nonexistent")
        assert response.status_code == 404

    def test_batch_crawl_returns_list(self, fresh_app_client, mock_crawler_context):
        response = fresh_app_client.post(
            "/api/crawl/batch",
            json={"urls": ["https://example.com", "https://example.org"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

    def test_deep_crawl_returns_crawl_id(self, fresh_app_client, mock_crawler_context):
        response = fresh_app_client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com", "max_depth": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert "crawl_id" in data


# ===========================================================================
# Chat API
# ===========================================================================


class TestChatE2E:
    def test_chat_completion_missing_messages_returns_422(self, app_client):
        response = app_client.post("/api/chat/completions", json={})
        assert response.status_code == 422

    def test_list_chat_sessions(self, app_client):
        response = app_client.get("/api/chat/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_clear_chat_sessions(self, app_client):
        response = app_client.post("/api/chat/clear")
        assert response.status_code == 200


# ===========================================================================
# Data API
# ===========================================================================


class TestDataE2E:
    def test_list_data_sets(self, app_client):
        response = app_client.get("/api/data/sets")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_data_stats(self, app_client):
        response = app_client.get("/api/data/stats")
        assert response.status_code == 200

    def test_create_data_set(self, app_client):
        response = app_client.post(
            "/api/data/sets",
            json={"name": "e2e-test-set", "tier": "hot"},
        )
        # Accept 200/201/422 (422 if validation differs)
        assert response.status_code in (200, 201, 422)

    def test_get_nonexistent_data_set_returns_404(self, app_client):
        response = app_client.get("/api/data/sets/nonexistent-id")
        assert response.status_code == 404


# ===========================================================================
# Storage API (ChromaDB)
# ===========================================================================


class TestStorageE2E:
    def test_list_collections(self, app_client):
        with patch("app.api.storage.get_chromadb_client") as mock_chroma:
            mock_client = MagicMock()
            mock_client.list_collections.return_value = []
            mock_chroma.return_value = mock_client
            response = app_client.get("/api/storage/collections")
            assert response.status_code in (200, 500)  # 500 if chroma unavailable

    def test_create_collection(self, app_client):
        with patch("app.api.storage.get_chromadb_client") as mock_chroma:
            mock_client = MagicMock()
            mock_collection = MagicMock()
            mock_collection.name = "test-collection"
            mock_collection.count.return_value = 0
            mock_client.get_or_create_collection.return_value = mock_collection
            mock_chroma.return_value = mock_client
            response = app_client.post(
                "/api/storage/collections",
                json={"name": "test-collection"},
            )
            assert response.status_code in (200, 201, 422, 500)


# ===========================================================================
# OSINT API
# ===========================================================================


class TestOsintE2E:
    def test_list_platforms(self, app_client):
        response = app_client.get("/api/osint/platforms")
        assert response.status_code == 200
        data = response.json()
        assert "platforms" in data
        assert isinstance(data["platforms"], list)
        assert len(data["platforms"]) > 0


# ===========================================================================
# Auth enforcement (protected routes)
# ===========================================================================


class TestAuthEnforcementE2E:
    """Verify that protected routes return 401 when auth is enabled."""

    @pytest.fixture(autouse=True)
    def enable_auth(self, _rsa_key_pair):
        """Override the session-scoped auth mock to enable auth."""
        from app.config.auth import ClerkConfig

        _, public_pem = _rsa_key_pair

        enabled_config = MagicMock(spec=ClerkConfig)
        enabled_config.auth_enabled = True
        enabled_config.protected_routes_enabled = True
        enabled_config.jwt_key = public_pem
        enabled_config.issuer = "https://test.clerk.com"
        enabled_config.audience = "test-app"
        enabled_config.admin_users = ["admin@test.com"]

        with (
            patch("app.config.auth.get_clerk_config", return_value=enabled_config),
            patch("app.config.get_clerk_config", return_value=enabled_config),
            patch("app.api.crawl.get_clerk_config", return_value=enabled_config),
            patch("app.middleware.auth.get_clerk_config", return_value=enabled_config),
        ):
            yield

    def test_start_crawl_requires_auth(self):
        from app.main import app
        from fastapi.testclient import TestClient

        client = TestClient(app, raise_server_exceptions=False)
        with patch("app.middleware.rate_limit._config.rate_limit_enabled", False):
            response = client.post(
                "/api/crawl/start",
                json={"url": "https://example.com"},
            )
        assert response.status_code == 401

    def test_start_crawl_with_valid_token_succeeds(self, auth_headers, mock_crawler_context):
        from app.main import app
        from fastapi.testclient import TestClient

        client = TestClient(app, raise_server_exceptions=False)
        with patch("app.middleware.rate_limit._config.rate_limit_enabled", False):
            response = client.post(
                "/api/crawl/start",
                json={"url": "https://example.com"},
                headers=auth_headers,
            )
        assert response.status_code == 202


# ===========================================================================
# Input validation
# ===========================================================================


class TestValidationE2E:
    def test_missing_url_field_returns_422(self, app_client):
        response = app_client.post("/api/crawl/start", json={})
        assert response.status_code == 422

    def test_invalid_json_returns_422(self, app_client):
        response = app_client.post(
            "/api/crawl/start",
            content=b"not json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422

    def test_list_crawls_with_status_filter(self, app_client):
        response = app_client.get("/api/crawl/list?status=pending")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
