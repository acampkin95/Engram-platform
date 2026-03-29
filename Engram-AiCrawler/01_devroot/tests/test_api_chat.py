"""Tests for app/api/chat.py — targets 70%+ coverage.

Strategy: Use httpx.AsyncClient + ASGITransport wrapped in asyncio.run() for
completions (async endpoint body) so coverage tracks the async code in the same
thread. Use synchronous TestClient for the simpler endpoints.
"""
from __future__ import annotations

import asyncio
from app._compat import UTC
from datetime import datetime, timedelta

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api import chat as chat_module
from app.api.chat import router
from app.middleware import rate_limit as _rl_module
from app.config.auth import ClerkConfig

# ---------------------------------------------------------------------------
# App / client setup
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Async helper — runs httpx.AsyncClient in same thread so coverage works
# ---------------------------------------------------------------------------


async def _async_post(path: str, json: dict) -> httpx.Response:
    """POST via AsyncClient in the same thread as the test."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        return await ac.post(path, json=json)


async def _async_get(path: str, params: dict | None = None) -> httpx.Response:
    """GET via AsyncClient in the same thread as the test."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        return await ac.get(path, params=params or {})


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all tests."""
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture(autouse=True)
def clear_store():
    """Clear in-memory fallback store before and after each test."""
    chat_module._chat_store._fallback.clear()
    yield
    chat_module._chat_store._fallback.clear()


@pytest.fixture(autouse=True)
def mock_get_redis():
    """Patch _get_redis to return None immediately (no Redis exception path).

    When _get_redis() raises internally (Redis unreachable), coverage.py's
    CTracer loses the trace for the calling async frame after the first await.
    Returning None directly avoids that exception path and keeps CTracer happy.
    """
    with patch("app.services.job_store._get_redis", new=AsyncMock(return_value=None)):
        yield


@pytest.fixture(autouse=True)
def mock_manager():
    """Patch WebSocket manager to avoid real WS calls."""
    with patch("app.api.chat.manager") as mock:
        mock.send_chat_update = AsyncMock()
        yield mock


@pytest.fixture(autouse=True)
def disable_auth():
    """Patch get_clerk_config to always return auth-disabled config, preventing
    lru_cache pollution from test_auth.py running auth-enabled tests."""
    _auth_disabled = ClerkConfig(
        secret_key="disabled",
        jwt_key="disabled",
        issuer="https://clerk.com",
        audience="",
        admin_users=[],
        auth_enabled=False,
        protected_routes_enabled=False,
        token_expiry_hours=24,
        refresh_buffer_minutes=30,
    )
    with patch("app.api.chat.get_clerk_config", return_value=_auth_disabled):
        yield


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def make_mock_bridge(
    content="Hello!", finish_reason="stop", prompt_tokens=10, completion_tokens=5, total_tokens=15
):
    """Return a mock LMStudioBridge instance."""
    bridge = MagicMock()
    bridge._make_request_with_retry = AsyncMock(
        return_value={
            "choices": [
                {
                    "message": {"content": content},
                    "finish_reason": finish_reason,
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
            },
        }
    )
    return bridge


# ---------------------------------------------------------------------------
# POST /api/chat/completions
# ---------------------------------------------------------------------------


class TestChatCompletions:
    def test_success_returns_chat_response(self):
        """Happy path: LM Studio returns a valid response."""
        mock_bridge = make_mock_bridge()
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Hello"}],
                        "model": "local-model",
                    },
                )
            )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Hello!"
        assert data["finish_reason"] == "stop"
        assert data["role"] == "assistant"
        assert "message_id" in data
        assert "created_at" in data

    def test_success_stores_session(self):
        """Completed request is persisted in the chat store."""
        mock_bridge = make_mock_bridge(content="Stored response")
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Store me"}],
                        "model": "test-model",
                    },
                )
            )
        assert response.status_code == 200
        message_id = response.json()["message_id"]
        # The session should now be in the fallback store
        assert message_id in chat_module._chat_store._fallback

    def test_success_with_temperature_and_max_tokens(self):
        """Optional fields are forwarded to the bridge."""
        mock_bridge = make_mock_bridge()
        with patch(
            "app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge
        ) as MockBridge:
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Hi"}],
                        "model": "local-model",
                        "temperature": 0.5,
                        "max_tokens": 256,
                    },
                )
            )
        assert response.status_code == 200
        # Bridge was instantiated
        MockBridge.assert_called_once()

    def test_stream_true_returns_error(self):
        """stream=True raises HTTPException(501) inside try block; outer except
        catches it and re-raises as 500 LM Studio error."""
        mock_bridge = make_mock_bridge()
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Stream me"}],
                        "model": "local-model",
                        "stream": True,
                    },
                )
            )
        # The 501 HTTPException is caught by the outer except block and re-raised as 500
        assert response.status_code == 500
        assert "LM Studio error" in response.json()["detail"]

    def test_lm_studio_exception_returns_500(self):
        """If LMStudioBridge raises, endpoint returns 500."""
        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(
            side_effect=RuntimeError("LM Studio unreachable")
        )
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Crash"}],
                        "model": "local-model",
                    },
                )
            )
        assert response.status_code == 500
        assert "LM Studio error" in response.json()["detail"]

    def test_lm_studio_exception_updates_store_with_error(self):
        """On exception, the session finish_reason is set to 'error'."""
        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(side_effect=ValueError("bad response"))
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Fail"}],
                        "model": "local-model",
                    },
                )
            )
        assert response.status_code == 500
        # The fallback store should have the session with finish_reason=error
        stored = list(chat_module._chat_store._fallback.values())
        assert len(stored) == 1
        assert stored[0]["finish_reason"] == "error"

    def test_empty_choices_returns_empty_content(self):
        """If LM Studio returns no choices, content is empty string."""
        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(
            return_value={
                "choices": [],
                "usage": {},
            }
        )
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Empty"}],
                        "model": "local-model",
                    },
                )
            )
        assert response.status_code == 200
        assert response.json()["content"] == ""

    def test_multiple_messages_accepted(self):
        """Multi-turn conversation messages are accepted."""
        mock_bridge = make_mock_bridge(content="Multi-turn response")
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            response = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [
                            {"role": "system", "content": "You are helpful."},
                            {"role": "user", "content": "Hello"},
                            {"role": "assistant", "content": "Hi there!"},
                            {"role": "user", "content": "How are you?"},
                        ],
                        "model": "local-model",
                    },
                )
            )
        assert response.status_code == 200
        assert response.json()["content"] == "Multi-turn response"

    def test_manager_called_on_success(self):
        """manager.send_chat_update is called twice on success (processing + completed)."""
        mock_bridge = make_mock_bridge()
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            with patch("app.api.chat.manager") as mock_mgr:
                mock_mgr.send_chat_update = AsyncMock()
                response = asyncio.run(
                    _async_post(
                        "/api/chat/completions",
                        json={
                            "messages": [{"role": "user", "content": "Hello"}],
                            "model": "local-model",
                        },
                    )
                )
        assert response.status_code == 200
        assert mock_mgr.send_chat_update.call_count == 2

    def test_manager_called_on_error(self):
        """manager.send_chat_update is called twice on error (processing + failed)."""
        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(side_effect=RuntimeError("fail"))
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            with patch("app.api.chat.manager") as mock_mgr:
                mock_mgr.send_chat_update = AsyncMock()
                response = asyncio.run(
                    _async_post(
                        "/api/chat/completions",
                        json={
                            "messages": [{"role": "user", "content": "Fail"}],
                            "model": "local-model",
                        },
                    )
                )
        assert response.status_code == 500
        assert mock_mgr.send_chat_update.call_count == 2


# ---------------------------------------------------------------------------
# GET /api/chat/history/{message_id}
# ---------------------------------------------------------------------------


class TestChatHistory:
    def test_get_existing_message(self):
        """Returns stored session when message_id exists."""
        msg_id = "test-message-id-123"
        session = {
            "message_id": msg_id,
            "role": "assistant",
            "content": "Stored content",
            "model": "test-model",
            "finish_reason": "stop",
            "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
            "created_at": datetime.now(UTC).isoformat(),
        }
        chat_module._chat_store._fallback[msg_id] = session

        response = client.get(f"/api/chat/history/{msg_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["message_id"] == msg_id
        assert data["content"] == "Stored content"

    def test_get_nonexistent_message_returns_404(self):
        """Returns 404 when message_id does not exist."""
        response = client.get("/api/chat/history/does-not-exist")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_history_returns_correct_fields(self):
        """Response includes all ChatResponse fields."""
        msg_id = "fields-check-id"
        session = {
            "message_id": msg_id,
            "role": "assistant",
            "content": "Field check",
            "model": "gpt-test",
            "finish_reason": "stop",
            "usage": None,
            "created_at": datetime.now(UTC).isoformat(),
        }
        chat_module._chat_store._fallback[msg_id] = session

        response = client.get(f"/api/chat/history/{msg_id}")
        assert response.status_code == 200
        data = response.json()
        for field in ["message_id", "role", "content", "model", "finish_reason", "created_at"]:
            assert field in data, f"Missing field: {field}"

    def test_history_via_async_client(self):
        """GET history via AsyncClient in same thread."""
        msg_id = "async-history-id"
        session = {
            "message_id": msg_id,
            "role": "assistant",
            "content": "Async history",
            "model": "test-model",
            "finish_reason": "stop",
            "usage": None,
            "created_at": datetime.now(UTC).isoformat(),
        }
        chat_module._chat_store._fallback[msg_id] = session

        response = asyncio.run(_async_get(f"/api/chat/history/{msg_id}"))
        assert response.status_code == 200
        assert response.json()["content"] == "Async history"

    def test_history_not_found_via_async_client(self):
        """GET history 404 via AsyncClient."""
        response = asyncio.run(_async_get("/api/chat/history/no-such-id"))
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/chat/sessions
# ---------------------------------------------------------------------------


class TestListSessions:
    def test_empty_sessions_returns_empty_list(self):
        """Returns empty list when no sessions exist."""
        response = client.get("/api/chat/sessions")
        assert response.status_code == 200
        assert response.json() == []

    def test_sessions_returned_sorted_by_created_at(self):
        """Sessions are returned sorted by created_at descending."""
        base = datetime.now(UTC)
        for i in range(3):
            msg_id = f"session-{i}"
            chat_module._chat_store._fallback[msg_id] = {
                "message_id": msg_id,
                "role": "assistant",
                "content": f"Content {i}",
                "model": "test-model",
                "finish_reason": "stop",
                "usage": None,
                "created_at": (base + timedelta(seconds=i)).isoformat(),
            }

        response = client.get("/api/chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Most recent first
        assert data[0]["message_id"] == "session-2"
        assert data[2]["message_id"] == "session-0"

    def test_sessions_limit_parameter(self):
        """limit query param restricts number of returned sessions."""
        base = datetime.now(UTC)
        for i in range(5):
            msg_id = f"limit-session-{i}"
            chat_module._chat_store._fallback[msg_id] = {
                "message_id": msg_id,
                "role": "assistant",
                "content": f"Content {i}",
                "model": "test-model",
                "finish_reason": "stop",
                "usage": None,
                "created_at": (base + timedelta(seconds=i)).isoformat(),
            }

        response = client.get("/api/chat/sessions?limit=2")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_sessions_default_limit_100(self):
        """Default limit is 100 — returns all when under limit."""
        for i in range(10):
            msg_id = f"default-limit-{i}"
            chat_module._chat_store._fallback[msg_id] = {
                "message_id": msg_id,
                "role": "assistant",
                "content": f"Content {i}",
                "model": "test-model",
                "finish_reason": "stop",
                "usage": None,
                "created_at": datetime.now(UTC).isoformat(),
            }

        response = client.get("/api/chat/sessions")
        assert response.status_code == 200
        assert len(response.json()) == 10

    def test_sessions_contain_expected_fields(self):
        """Each session entry contains ChatResponse fields."""
        msg_id = "field-check-session"
        chat_module._chat_store._fallback[msg_id] = {
            "message_id": msg_id,
            "role": "assistant",
            "content": "Hello",
            "model": "test-model",
            "finish_reason": "stop",
            "usage": None,
            "created_at": datetime.now(UTC).isoformat(),
        }

        response = client.get("/api/chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        for field in ["message_id", "role", "content", "model", "finish_reason"]:
            assert field in data[0]

    def test_sessions_limit_via_async_client(self):
        """Sessions limit via AsyncClient."""
        base = datetime.now(UTC)
        for i in range(4):
            msg_id = f"async-limit-{i}"
            chat_module._chat_store._fallback[msg_id] = {
                "message_id": msg_id,
                "role": "assistant",
                "content": f"Content {i}",
                "model": "test-model",
                "finish_reason": "stop",
                "usage": None,
                "created_at": (base + timedelta(seconds=i)).isoformat(),
            }

        response = asyncio.run(_async_get("/api/chat/sessions", params={"limit": 2}))
        assert response.status_code == 200
        assert len(response.json()) == 2


# ---------------------------------------------------------------------------
# POST /api/chat/clear
# ---------------------------------------------------------------------------


class TestClearSessions:
    def test_clear_empty_store_returns_zero(self):
        """Clearing an empty store returns count=0."""
        response = client.post("/api/chat/clear")
        assert response.status_code == 200
        assert "0" in response.json()["message"]

    def test_clear_with_sessions_returns_count(self):
        """Clearing populated store returns the correct count."""
        for i in range(3):
            msg_id = f"clear-session-{i}"
            chat_module._chat_store._fallback[msg_id] = {
                "message_id": msg_id,
                "role": "assistant",
                "content": f"Content {i}",
                "model": "test-model",
                "finish_reason": "stop",
                "usage": None,
                "created_at": datetime.now(UTC).isoformat(),
            }

        response = client.post("/api/chat/clear")
        assert response.status_code == 200
        assert "3" in response.json()["message"]

    def test_clear_empties_the_store(self):
        """After clear, the store is empty."""
        chat_module._chat_store._fallback["some-id"] = {
            "message_id": "some-id",
            "role": "assistant",
            "content": "To be cleared",
            "model": "test-model",
            "finish_reason": "stop",
            "usage": None,
            "created_at": datetime.now(UTC).isoformat(),
        }

        client.post("/api/chat/clear")
        assert len(chat_module._chat_store._fallback) == 0

    def test_clear_response_message_format(self):
        """Response message includes 'Cleared' and count."""
        response = client.post("/api/chat/clear")
        assert response.status_code == 200
        msg = response.json()["message"]
        assert "Cleared" in msg
        assert "chat sessions" in msg

    def test_clear_via_async_client(self):
        """POST /clear via AsyncClient in same thread."""
        for i in range(2):
            chat_module._chat_store._fallback[f"async-clear-{i}"] = {
                "message_id": f"async-clear-{i}",
                "role": "assistant",
                "content": "x",
                "model": "m",
                "finish_reason": "stop",
                "usage": None,
                "created_at": datetime.now(UTC).isoformat(),
            }

        response = asyncio.run(_async_post("/api/chat/clear", json={}))
        assert response.status_code == 200
        assert "2" in response.json()["message"]


# ---------------------------------------------------------------------------
# Integration: completions → history → sessions → clear
# ---------------------------------------------------------------------------


class TestIntegrationFlow:
    def test_full_flow(self):
        """POST completion → GET history → GET sessions → POST clear."""
        mock_bridge = make_mock_bridge(content="Integration response")

        # 1. Create a completion (async, same thread)
        with patch("app.services.lm_studio_bridge.LMStudioBridge", return_value=mock_bridge):
            create_resp = asyncio.run(
                _async_post(
                    "/api/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": "Integration test"}],
                        "model": "local-model",
                    },
                )
            )
        assert create_resp.status_code == 200
        message_id = create_resp.json()["message_id"]

        # 2. Retrieve it by history
        history_resp = client.get(f"/api/chat/history/{message_id}")
        assert history_resp.status_code == 200
        assert history_resp.json()["content"] == "Integration response"

        # 3. List sessions — should have 1
        sessions_resp = client.get("/api/chat/sessions")
        assert sessions_resp.status_code == 200
        assert len(sessions_resp.json()) == 1

        # 4. Clear sessions
        clear_resp = client.post("/api/chat/clear")
        assert clear_resp.status_code == 200
        assert "1" in clear_resp.json()["message"]

        # 5. Sessions now empty
        sessions_after = client.get("/api/chat/sessions")
        assert sessions_after.json() == []

        # 6. History now 404
        history_after = client.get(f"/api/chat/history/{message_id}")
        assert history_after.status_code == 404
