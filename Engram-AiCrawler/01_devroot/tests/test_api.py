import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.crawl import CrawlRequest, CrawlStatus, ExtractionType
from app.middleware import rate_limit as _rl_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture(autouse=True)
def disable_auth():
    """Disable auth for all API tests to prevent test_auth.py env pollution."""
    from app.config.auth import ClerkConfig

    mock_config = MagicMock(spec=ClerkConfig)
    mock_config.auth_enabled = False
    mock_config.protected_routes_enabled = False
    with patch("app.config.auth.get_clerk_config", return_value=mock_config), patch(
        "app.config.get_clerk_config", return_value=mock_config
    ), patch("app.api.crawl.get_clerk_config", return_value=mock_config), patch(
        "app.api.data.get_clerk_config", return_value=mock_config
    ), patch("app.api.chat.get_clerk_config", return_value=mock_config):
        yield


@pytest.fixture(autouse=True)
def mock_lm_studio():
    """Mock LM Studio connection check to prevent slow network retries in tests."""
    with patch(
        "app.services.lm_studio_bridge.check_lm_studio_connection", return_value="connected"
    ):
        yield


class TestHealthEndpoints:
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "crawl4ai-osint"
        assert "version" in data

    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        assert response.text == "Crawl4AI OSINT Container Running"

    def test_stats(self):
        response = client.get("/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_connections" in data
        assert "subscriptions" in data


class TestCrawlAPI:
    def test_start_crawl(self):
        request = CrawlRequest(
            url="https://example.com",
            extraction_type=ExtractionType.CSS,
            word_count_threshold=10,
        )
        response = client.post(
            "/api/crawl/start",
            json={
                "url": str(request.url),
                "extraction_type": request.extraction_type,
                "word_count_threshold": request.word_count_threshold,
            },
        )
        assert response.status_code == 202

        data = response.json()
        assert "crawl_id" in data
        assert data["status"] == CrawlStatus.PENDING
        assert data["url"] in ["https://example.com", "https://example.com/"]
        assert "created_at" in data

    def test_start_crawl_invalid_url(self):
        response = client.post("/api/crawl/start", json={"url": "not-a-valid-url"})
        # Note: This will fail FastAPI's URL validation, not Pydantic HttpUrl
        assert response.status_code in [422, 400]

    def test_get_crawl_status_not_found(self):
        response = client.get("/api/crawl/status/nonexistent-id")
        assert response.status_code == 404

    def test_list_crawls(self):
        response = client.get("/api/crawl/list")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_crawls_with_filter(self):
        response = client.get("/api/crawl/list?status=pending")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_batch_crawl(self):
        response = client.post(
            "/api/crawl/batch",
            json={
                "urls": ["https://example.com", "https://example.org"],
                "max_concurrent": 2,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_deep_crawl(self):
        response = client.post(
            "/api/crawl/deep",
            json={"start_url": "https://example.com", "max_depth": 2, "max_pages": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert "crawl_id" in data

    def test_cancel_crawl_not_found(self):
        response = client.post("/api/crawl/cancel/nonexistent-id")
        assert response.status_code == 404


class TestChatAPI:
    def test_chat_completion_requires_messages(self):
        response = client.post("/api/chat/completions", json={})
        assert response.status_code == 422

    def test_chat_completion_with_message(self):
        response = client.post(
            "/api/chat/completions",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "model": "default",
            },
        )
        assert response.status_code in [200, 500]

    def test_list_sessions(self):
        response = client.get("/api/chat/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_clear_sessions(self):
        response = client.post("/api/chat/clear")
        assert response.status_code == 200

    def test_get_message_not_found(self):
        response = client.get("/api/chat/history/nonexistent-id")
        assert response.status_code == 404


class TestDataAPI:
    def test_create_data_set(self):
        response = client.post(
            "/api/data/sets",
            params={
                "name": "test-set",
                "description": "Test description",
                "tags": ["test", "sample"],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "test-set"
        assert data["tier"] == "hot"
        assert "data_set_id" in data

    def test_list_data_sets(self):
        response = client.get("/api/data/sets")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_data_sets_with_tier_filter(self):
        response = client.get("/api/data/sets?tier=hot")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_data_set_not_found(self):
        response = client.get("/api/data/sets/nonexistent-id")
        assert response.status_code == 404

    def test_update_data_set(self):
        create_response = client.post("/api/data/sets", params={"name": "update-test"})
        data_set_id = create_response.json()["data_set_id"]

        response = client.put(
            f"/api/data/sets/{data_set_id}",
            params={"name": "updated-name", "description": "Updated description"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "updated-name"

    def test_migrate_data_set(self):
        create_response = client.post("/api/data/sets", params={"name": "migrate-test"})
        data_set_id = create_response.json()["data_set_id"]

        response = client.post(
            f"/api/data/sets/{data_set_id}/migrate", json={"target_tier": "warm"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tier"] == "warm"

    def test_delete_data_set(self):
        create_response = client.post("/api/data/sets", params={"name": "delete-test"})
        data_set_id = create_response.json()["data_set_id"]

        response = client.delete(f"/api/data/sets/{data_set_id}")
        assert response.status_code == 200

    def test_export_data_sets(self):
        response = client.post("/api/data/export")
        assert response.status_code == 200
        data = response.json()
        assert "export_id" in data
        assert data["format"] == "tar.gz"

    def test_offload_archive(self):
        response = client.post("/api/data/offload", params={"threshold_gb": 50})
        assert response.status_code == 200

    def test_get_data_stats(self):
        response = client.get("/api/data/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_sets" in data
        assert "total_size_bytes" in data
        assert "tier_stats" in data


class TestValidation:
    def test_invalid_json(self):
        response = client.post("/api/crawl/start", data="invalid json")
        assert response.status_code == 422

    def test_missing_required_field(self):
        response = client.post("/api/crawl/start", json={"word_count_threshold": 10})
        assert response.status_code == 422

    def test_invalid_enum_value(self):
        response = client.post(
            "/api/crawl/start",
            json={"url": "https://example.com", "extraction_type": "invalid_type"},
        )
        assert response.status_code == 422

    def test_invalid_tier_value(self):
        response = client.post(
            "/api/data/sets/nonexistent/migrate", json={"target_tier": "invalid_tier"}
        )
        assert response.status_code == 422


class TestCORS:
    def test_cors_preflight(self):
        response = client.options(
            "/api/crawl/start",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers


class TestAsyncBehavior:
    def test_async_endpoint_response_time(self):
        import time

        start = time.time()
        response = client.get("/health")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 1.0

    def test_background_task_scheduling(self):
        response = client.post("/api/crawl/start", json={"url": "https://example.com"})
        assert response.status_code == 202
        assert "crawl_id" in response.json()
