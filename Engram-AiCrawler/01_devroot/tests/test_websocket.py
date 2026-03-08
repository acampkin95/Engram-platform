import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.websocket.manager import manager
from app.middleware import rate_limit as _rl_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all websocket tests (no Redis in test env)."""
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


class TestWebSocket:
    def test_websocket_connection(self):
        with client.websocket_connect("/ws?client_id=test-client") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connected"
            assert data["client_id"] == "test-client"

    def test_websocket_ping_pong(self):
        with client.websocket_connect("/ws?client_id=ping-client") as websocket:
            initial_data = websocket.receive_json()
            assert initial_data["type"] == "connected"

            websocket.send_json({"type": "ping"})

            response = websocket.receive_json()
            assert response["type"] == "pong"

    def test_websocket_subscribe(self):
        with client.websocket_connect("/ws?client_id=subscribe-client") as websocket:
            initial_data = websocket.receive_json()
            assert initial_data["type"] == "connected"

            websocket.send_json({"type": "subscribe", "topic": "crawl:*"})

            response = websocket.receive_json()
            assert response["type"] == "subscribed"
            assert response["topic"] == "crawl:*"

    def test_websocket_unsubscribe(self):
        with client.websocket_connect("/ws?client_id=unsubscribe-client") as websocket:
            initial_data = websocket.receive_json()
            assert initial_data["type"] == "connected"

            websocket.send_json({"type": "subscribe", "topic": "chat:*"})
            sub_response = websocket.receive_json()
            assert sub_response["type"] == "subscribed"

            websocket.send_json({"type": "unsubscribe", "topic": "chat:*"})

            response = websocket.receive_json()
            assert response["type"] == "unsubscribed"
            assert response["topic"] == "chat:*"

    def test_websocket_manager_connect_disconnect(self):
        initial_count = manager.get_connection_count()

        client_id = "test-connect-disconnect"
        with client.websocket_connect(f"/ws?client_id={client_id}") as websocket:
            assert manager.get_connection_count() == initial_count + 1
            data = websocket.receive_json()
            assert data["type"] == "connected"

        assert manager.get_connection_count() == initial_count

    def test_websocket_multiple_connections(self):
        initial_count = manager.get_connection_count()

        client_ids = ["client-1", "client-2", "client-3"]
        websockets = []

        for cid in client_ids:
            ws = client.websocket_connect(f"/ws?client_id={cid}")
            websockets.append(ws)
            ws.__enter__()
            ws.receive_json()

        assert manager.get_connection_count() >= initial_count + len(client_ids)

        for ws in websockets:
            ws.__exit__(None, None, None)

    def test_websocket_subscribe_to_crawl_updates(self):
        with client.websocket_connect("/ws?client_id=crawl-subscriber") as websocket:
            websocket.receive_json()

            websocket.send_json({"type": "subscribe", "topic": "crawl:test-123"})

            response = websocket.receive_json()
            assert response["type"] == "subscribed"

            assert manager.get_subscribers_count("crawl:test-123") == 1

    def test_websocket_default_client_id(self):
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_json()
            assert "client_id" in data
            assert data["type"] == "connected"

    def test_websocket_crawl_update_notification(self):
        import asyncio

        async def test_crawl_notification():
            client_id = "crawl-notification-client"

            async def receive_updates():
                with client.websocket_connect(f"/ws?client_id={client_id}") as websocket:
                    websocket.receive_json()
                    websocket.send_json({"type": "subscribe", "topic": "crawl:test-456"})
                    websocket.receive_json()

            await receive_updates()

            await manager.send_crawl_update("test-456", "running", {"url": "https://example.com"})

        asyncio.run(test_crawl_notification())

    def test_websocket_manager_stats(self):
        with client.websocket_connect("/ws?client_id=stats-client") as websocket:
            websocket.receive_json()

        response = client.get("/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_connections" in data
        assert "subscriptions" in data


class TestWebSocketErrorHandling:
    def test_websocket_disconnect_handling(self):
        client_id = "disconnect-test-client"

        try:
            with client.websocket_connect(f"/ws?client_id={client_id}") as websocket:
                websocket.receive_json()
                raise Exception("Simulated disconnection")
        except Exception:
            pass

        assert manager.get_subscribers_count("any_topic") == 0

    def test_websocket_invalid_json(self):
        with client.websocket_connect("/ws?client_id=invalid-json-client") as websocket:
            websocket.receive_json()

            websocket.send_text("not valid json")

    def test_websocket_missing_type(self):
        with client.websocket_connect("/ws?client_id=missing-type-client") as websocket:
            websocket.receive_json()

            websocket.send_json({"topic": "some-topic"})


class TestWebSocketTopics:
    def test_subscribe_to_multiple_topics(self):
        with client.websocket_connect("/ws?client_id=multi-topic-client") as websocket:
            websocket.receive_json()

            websocket.send_json({"type": "subscribe", "topic": "crawl:*"})
            websocket.receive_json()

            websocket.send_json({"type": "subscribe", "topic": "chat:*"})
            websocket.receive_json()

            websocket.send_json({"type": "subscribe", "topic": "data_changes"})
            websocket.receive_json()

    def test_unsubscribe_nonexistent_topic(self):
        with client.websocket_connect("/ws?client_id=unsub-nonexistent") as websocket:
            websocket.receive_json()

            websocket.send_json({"type": "unsubscribe", "topic": "nonexistent:*"})

            response = websocket.receive_json()
            assert response["type"] == "unsubscribed"


class TestWebSocketWildcardMatching:
    """Tests for wildcard topic subscription matching using fnmatch."""

    def test_wildcard_matches_specific_topic(self):
        """fnmatch pattern 'crawl:*' matches 'crawl:abc123'."""
        import fnmatch

        assert fnmatch.fnmatch("crawl:abc123", "crawl:*")
        assert fnmatch.fnmatch("crawl:uuid-1234-5678", "crawl:*")

    def test_wildcard_does_not_match_different_prefix(self):
        """Pattern 'crawl:*' does NOT match 'chat:abc'."""
        import fnmatch

        assert not fnmatch.fnmatch("chat:abc", "crawl:*")
        assert not fnmatch.fnmatch("osint_scan:xyz", "crawl:*")

    def test_exact_topic_matches_exact_subscription(self):
        """Exact subscription 'data_changes' matches only 'data_changes'."""
        import fnmatch

        assert fnmatch.fnmatch("data_changes", "data_changes")
        assert not fnmatch.fnmatch("data_changes_extra", "data_changes")

    def test_osint_scan_wildcard_matches_uuid(self):
        """Pattern 'osint_scan:*' matches 'osint_scan:{uuid}'."""
        import fnmatch

        scan_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert fnmatch.fnmatch(f"osint_scan:{scan_id}", "osint_scan:*")

    def test_get_subscribers_count_with_wildcard(self):
        """get_subscribers_count counts both wildcard and exact subscribers."""
        from app.websocket.manager import ConnectionManager as WebSocketManager

        m = WebSocketManager()
        m.subscriptions["client-a"] = ["crawl:*"]
        m.subscriptions["client-b"] = ["crawl:specific-id"]
        m.subscriptions["client-c"] = ["chat:*"]

        # Both client-a (wildcard) and client-b (exact) should match
        assert m.get_subscribers_count("crawl:specific-id") == 2
        # Only client-a (wildcard) matches a different crawl id
        assert m.get_subscribers_count("crawl:other-id") == 1
        # client-c matches chat topics
        assert m.get_subscribers_count("chat:session-1") == 1

    def test_websocket_subscribe_wildcard_protocol(self):
        """Client can subscribe with a wildcard pattern via the WebSocket protocol."""
        with client.websocket_connect("/ws?client_id=wc-proto-test") as websocket:
            websocket.receive_json()  # connected

            websocket.send_json({"type": "subscribe", "topic": "osint_scan:*"})
            resp = websocket.receive_json()
            assert resp["type"] == "subscribed"
            assert resp["topic"] == "osint_scan:*"
            assert "osint_scan:*" in manager.subscriptions.get("wc-proto-test", [])
