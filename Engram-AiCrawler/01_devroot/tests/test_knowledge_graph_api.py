"""Tests for app/api/knowledge_graph.py — Knowledge Graph API endpoints."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware import rate_limit as _rl_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all tests."""
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


def _make_mock_tracker():
    tracker = MagicMock()
    tracker.build_graph = AsyncMock()
    tracker.get_graph = AsyncMock()
    tracker.search_entities = AsyncMock()
    tracker.list_entity_types = AsyncMock()
    tracker.get_entity = AsyncMock()
    tracker.get_entity_relationships = AsyncMock()
    tracker.get_connected_entities = AsyncMock()
    tracker.merge_entities = AsyncMock()
    return tracker


def _make_mock_graph(scan_id: str = "scan123"):
    entity = MagicMock()
    entity.model_dump.return_value = {
        "id": "e1",
        "name": "John Doe",
        "entity_type": "person",
        "attributes": {},
    }
    rel = MagicMock()
    rel.model_dump.return_value = {
        "source_id": "e1",
        "target_id": "e2",
        "relation_type": "knows",
        "confidence": 0.9,
        "evidence": "",
    }
    graph = MagicMock()
    graph.entities = [entity]
    graph.relationships = [rel]
    graph.model_dump.return_value = {
        "scan_id": scan_id,
        "entities": [entity.model_dump()],
        "relationships": [rel.model_dump()],
    }
    return graph


# ---------------------------------------------------------------------------
# POST /api/knowledge-graph/build
# ---------------------------------------------------------------------------


class TestBuildKnowledgeGraph:
    def test_build_returns_200(self):
        mock_graph = _make_mock_graph()
        tracker = _make_mock_tracker()
        tracker.build_graph.return_value = mock_graph

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/build",
                json={
                    "scan_id": "scan123",
                    "crawl_results": [{"url": "https://example.com", "markdown": "content"}],
                    "context": "test context",
                },
            )

        assert resp.status_code == 200

    def test_build_missing_scan_id_returns_422(self):
        resp = client.post(
            "/api/knowledge-graph/build",
            json={"crawl_results": [{"url": "https://example.com"}]},
        )
        assert resp.status_code == 422

    def test_build_missing_crawl_results_returns_422(self):
        resp = client.post(
            "/api/knowledge-graph/build",
            json={"scan_id": "scan123", "crawl_results": []},
        )
        assert resp.status_code == 422

    def test_build_lm_studio_error_returns_502(self):
        from app.services.lm_studio_bridge import LMStudioError

        tracker = _make_mock_tracker()
        tracker.build_graph.side_effect = LMStudioError("LM Studio down")

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/build",
                json={
                    "scan_id": "scan123",
                    "crawl_results": [{"url": "https://example.com"}],
                },
            )
        assert resp.status_code == 502

    def test_build_generic_error_returns_500(self):
        tracker = _make_mock_tracker()
        tracker.build_graph.side_effect = Exception("Unexpected error")

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/build",
                json={
                    "scan_id": "scan123",
                    "crawl_results": [{"url": "https://example.com"}],
                },
            )
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /api/knowledge-graph/search
# ---------------------------------------------------------------------------


class TestSearchKnowledgeGraph:
    def test_search_returns_200(self):
        entity = MagicMock()
        entity.model_dump.return_value = {
            "id": "e1",
            "name": "John",
            "entity_type": "person",
            "attributes": {},
        }
        tracker = _make_mock_tracker()
        tracker.search_entities.return_value = [entity]

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/search",
                json={"scan_id": "scan123", "query": "John Doe", "n_results": 5},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["scan_id"] == "scan123"

    def test_search_missing_query_returns_422(self):
        resp = client.post(
            "/api/knowledge-graph/search",
            json={"scan_id": "scan123"},
        )
        assert resp.status_code == 422

    def test_search_storage_error_returns_500(self):
        from app.core.exceptions import StorageError

        tracker = _make_mock_tracker()
        tracker.search_entities.side_effect = StorageError("DB error")

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/search",
                json={"scan_id": "scan123", "query": "test"},
            )
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# GET /api/knowledge-graph/{scan_id}
# ---------------------------------------------------------------------------


class TestGetKnowledgeGraph:
    def test_get_existing_graph_returns_200(self):
        mock_graph = _make_mock_graph()
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = mock_graph

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123")

        assert resp.status_code == 200

    def test_get_nonexistent_graph_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = None

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/nonexistent")

        assert resp.status_code == 404

    def test_get_storage_error_returns_500(self):
        from app.core.exceptions import StorageError

        tracker = _make_mock_tracker()
        tracker.get_graph.side_effect = StorageError("DB error")

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123")

        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# GET /api/knowledge-graph/{scan_id}/types
# ---------------------------------------------------------------------------


class TestListEntityTypes:
    def test_returns_200_with_types(self):
        tracker = _make_mock_tracker()
        tracker.list_entity_types.return_value = {"person": 3, "org": 1}

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/types")

        assert resp.status_code == 200
        data = resp.json()
        assert data["types"] == {"person": 3, "org": 1}
        assert data["total_entities"] == 4

    def test_empty_types_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.list_entity_types.return_value = {}

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/types")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/knowledge-graph/{scan_id}/search
# ---------------------------------------------------------------------------


class TestSearchEntitiesInScan:
    def test_search_with_query_returns_200(self):
        entity = MagicMock()
        entity.model_dump.return_value = {
            "id": "e1",
            "name": "Bob",
            "entity_type": "person",
            "attributes": {},
        }
        tracker = _make_mock_tracker()
        tracker.search_entities.return_value = [entity]

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/search?query=Bob")

        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["query"] == "Bob"

    def test_search_with_entity_type_filter(self):
        tracker = _make_mock_tracker()
        tracker.search_entities.return_value = []

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/search?query=test&entity_type=person")

        assert resp.status_code == 200

    def test_search_missing_query_returns_422(self):
        resp = client.get("/api/knowledge-graph/scan123/search")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/knowledge-graph/{scan_id}/entities/{entity_id}
# ---------------------------------------------------------------------------


class TestGetEntityDetail:
    def test_existing_entity_returns_200(self):
        entity = MagicMock()
        entity.model_dump.return_value = {
            "id": "e1",
            "name": "Alice",
            "entity_type": "person",
            "attributes": {},
        }
        rel = MagicMock()
        rel.model_dump.return_value = {
            "source_id": "e1",
            "target_id": "e2",
            "relation_type": "knows",
            "confidence": 0.9,
            "evidence": "",
        }
        tracker = _make_mock_tracker()
        tracker.get_entity.return_value = entity
        tracker.get_entity_relationships.return_value = [rel]

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/entities/e1")

        assert resp.status_code == 200
        data = resp.json()
        assert "entity" in data
        assert "relationships" in data

    def test_nonexistent_entity_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.get_entity.return_value = None

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/entities/nonexistent")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/knowledge-graph/{scan_id}/expand/{entity_id}
# ---------------------------------------------------------------------------


class TestExpandNode:
    def test_expand_existing_entity(self):
        entity = MagicMock()
        entity.model_dump.return_value = {
            "id": "e1",
            "name": "Alice",
            "entity_type": "person",
            "attributes": {},
        }
        tracker = _make_mock_tracker()
        tracker.get_entity.return_value = entity
        tracker.get_connected_entities.return_value = ([entity], [])

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/expand/e1?depth=1")

        assert resp.status_code == 200
        data = resp.json()
        assert "entities" in data
        assert "relationships" in data

    def test_expand_nonexistent_entity_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.get_entity.return_value = None

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/expand/nonexistent")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/knowledge-graph/{scan_id}/merge
# ---------------------------------------------------------------------------


class TestMergeEntities:
    def test_merge_success(self):
        tracker = _make_mock_tracker()
        tracker.merge_entities.return_value = True

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/scan123/merge",
                json={"source_id": "e1", "target_id": "e2"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["merged"] is True

    def test_merge_same_ids_returns_400(self):
        resp = client.post(
            "/api/knowledge-graph/scan123/merge",
            json={"source_id": "e1", "target_id": "e1"},
        )
        assert resp.status_code == 400

    def test_merge_entity_not_found_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.merge_entities.return_value = False

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/scan123/merge",
                json={"source_id": "e1", "target_id": "e2"},
            )

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/knowledge-graph/{scan_id}/export
# ---------------------------------------------------------------------------


class TestExportKnowledgeGraph:
    def test_export_json_returns_200(self):
        mock_graph = _make_mock_graph("scan123")
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = mock_graph

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/export?format=json")

        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]

    def test_export_csv_returns_200(self):
        mock_graph = _make_mock_graph("scan123")
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = mock_graph

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/export?format=csv")

        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]

    def test_export_graphml_returns_200(self):
        mock_graph = _make_mock_graph("scan123")
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = mock_graph

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/export?format=graphml")

        assert resp.status_code == 200
        assert "xml" in resp.headers["content-type"]

    def test_export_invalid_format_returns_422(self):
        resp = client.get("/api/knowledge-graph/scan123/export?format=xlsx")
        assert resp.status_code == 422

    def test_export_nonexistent_graph_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = None

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/scan123/export?format=json")

        assert resp.status_code == 404

    def test_export_json_has_download_header(self):
        mock_graph = _make_mock_graph("mygraph")
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = mock_graph

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.get("/api/knowledge-graph/mygraph/export?format=json")

        assert resp.status_code == 200
        assert "attachment" in resp.headers.get("content-disposition", "")


# ---------------------------------------------------------------------------
# POST /api/knowledge-graph/merge-scans
# ---------------------------------------------------------------------------


class TestMergeScanGraphs:
    def test_merge_two_scans(self):
        entity1 = MagicMock()
        entity1.id = "e1"
        entity1.name = "Alice"
        entity1.entity_type = "person"
        entity1.attributes = {}
        entity1.model_dump.return_value = entity1.__dict__

        entity2 = MagicMock()
        entity2.id = "e2"
        entity2.name = "Bob"
        entity2.entity_type = "person"
        entity2.attributes = {}
        entity2.model_dump.return_value = entity2.__dict__

        graph1 = MagicMock()
        graph1.entities = [entity1]
        graph1.relationships = []

        graph2 = MagicMock()
        graph2.entities = [entity2]
        graph2.relationships = []

        tracker = _make_mock_tracker()
        tracker.get_graph.side_effect = [graph1, graph2]

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/merge-scans",
                json={"scan_ids": ["scan1", "scan2"]},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "entities" in data
        assert "relationships" in data

    def test_merge_scan_not_found_returns_404(self):
        tracker = _make_mock_tracker()
        tracker.get_graph.return_value = None

        with patch("app.api.knowledge_graph._get_tracker", return_value=tracker):
            resp = client.post(
                "/api/knowledge-graph/merge-scans",
                json={"scan_ids": ["scan1", "scan2"]},
            )

        assert resp.status_code == 404

    def test_merge_fewer_than_two_scans_returns_422(self):
        resp = client.post(
            "/api/knowledge-graph/merge-scans",
            json={"scan_ids": ["scan1"]},
        )
        assert resp.status_code == 422
