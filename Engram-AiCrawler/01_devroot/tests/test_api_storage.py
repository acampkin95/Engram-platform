"""Tests for app/api/storage.py — targets 70%+ coverage.

Patches app.api.storage.get_chromadb_client so no real ChromaDB is needed.
All endpoints tested with happy paths and error paths.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api.storage import router
from app.middleware import rate_limit as _rl_module
from app.core.exceptions import StorageError


# ---------------------------------------------------------------------------
# App / client setup
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture(autouse=True)
def mock_get_redis():
    with patch("app.services.job_store._get_redis", new=AsyncMock(return_value=None)):
        yield


@pytest.fixture
def mock_client():
    """Return a fresh MagicMock that represents the ChromaDB client."""
    return MagicMock()


# ---------------------------------------------------------------------------
# POST /api/storage/collections
# ---------------------------------------------------------------------------


class TestCreateCollection:
    def test_create_collection_success(self, mock_client):
        mock_client.get_or_create_collection.return_value = MagicMock()
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/collections", json={"name": "test_col"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "test_col"
        assert data["status"] == "created"
        mock_client.get_or_create_collection.assert_called_once_with("test_col")

    def test_create_collection_storage_error(self, mock_client):
        mock_client.get_or_create_collection.side_effect = StorageError("DB down")
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/collections", json={"name": "bad_col"})
        assert resp.status_code == 500
        assert "DB down" in resp.json()["detail"]

    def test_create_collection_name_too_short(self):
        resp = client.post("/api/storage/collections", json={"name": ""})
        assert resp.status_code == 422

    def test_create_collection_name_too_long(self):
        resp = client.post("/api/storage/collections", json={"name": "a" * 129})
        assert resp.status_code == 422

    def test_create_collection_missing_name(self):
        resp = client.post("/api/storage/collections", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/storage/collections
# ---------------------------------------------------------------------------


class TestListCollections:
    def test_list_collections_success(self, mock_client):
        mock_client.list_collections.return_value = ["col_a", "col_b"]
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.get("/api/storage/collections")
        assert resp.status_code == 200
        data = resp.json()
        assert data["collections"] == ["col_a", "col_b"]
        assert data["count"] == 2

    def test_list_collections_empty(self, mock_client):
        mock_client.list_collections.return_value = []
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.get("/api/storage/collections")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_list_collections_storage_error(self, mock_client):
        mock_client.list_collections.side_effect = StorageError("list failed")
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.get("/api/storage/collections")
        assert resp.status_code == 500
        assert "list failed" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# DELETE /api/storage/collections/{name}
# ---------------------------------------------------------------------------


class TestDeleteCollection:
    def test_delete_collection_success(self, mock_client):
        mock_client.delete_collection.return_value = None
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.delete("/api/storage/collections/my_col")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "my_col"
        assert data["status"] == "deleted"
        mock_client.delete_collection.assert_called_once_with("my_col")

    def test_delete_collection_storage_error(self, mock_client):
        mock_client.delete_collection.side_effect = StorageError("delete failed")
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.delete("/api/storage/collections/bad_col")
        assert resp.status_code == 500
        assert "delete failed" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# POST /api/storage/documents
# ---------------------------------------------------------------------------


class TestAddDocuments:
    def test_add_documents_success(self, mock_client):
        mock_client.add_documents.return_value = ["id1", "id2"]
        payload = {
            "collection_name": "my_col",
            "documents": ["doc one", "doc two"],
        }
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/documents", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["collection"] == "my_col"
        assert data["added"] == 2
        assert data["ids"] == ["id1", "id2"]

    def test_add_documents_with_metadatas(self, mock_client):
        mock_client.add_documents.return_value = ["id1"]
        payload = {
            "collection_name": "my_col",
            "documents": ["doc one"],
            "metadatas": [{"source": "web"}],
        }
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/documents", json=payload)
        assert resp.status_code == 200
        mock_client.add_documents.assert_called_once_with(
            collection_name="my_col",
            documents=["doc one"],
            metadatas=[{"source": "web"}],
        )

    def test_add_documents_storage_error(self, mock_client):
        mock_client.add_documents.side_effect = StorageError("add failed")
        payload = {"collection_name": "bad", "documents": ["doc"]}
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/documents", json=payload)
        assert resp.status_code == 500

    def test_add_documents_empty_list_rejected(self):
        payload = {"collection_name": "my_col", "documents": []}
        resp = client.post("/api/storage/documents", json=payload)
        assert resp.status_code == 422

    def test_add_documents_missing_fields(self):
        resp = client.post("/api/storage/documents", json={"collection_name": "c"})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/storage/search
# ---------------------------------------------------------------------------


class TestSearchDocuments:
    def test_search_success(self, mock_client):
        mock_client.search.return_value = [{"id": "1", "distance": 0.1}]
        payload = {
            "collection_name": "my_col",
            "query_texts": ["find me"],
        }
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/search", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["collection"] == "my_col"
        assert len(data["results"]) == 1

    def test_search_with_n_results(self, mock_client):
        mock_client.search.return_value = []
        payload = {
            "collection_name": "my_col",
            "query_texts": ["q"],
            "n_results": 5,
        }
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/search", json=payload)
        assert resp.status_code == 200
        mock_client.search.assert_called_once_with(
            collection_name="my_col",
            query_texts=["q"],
            n_results=5,
        )

    def test_search_storage_error(self, mock_client):
        mock_client.search.side_effect = StorageError("search failed")
        payload = {"collection_name": "bad", "query_texts": ["q"]}
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.post("/api/storage/search", json=payload)
        assert resp.status_code == 500

    def test_search_n_results_out_of_range(self):
        payload = {"collection_name": "c", "query_texts": ["q"], "n_results": 0}
        resp = client.post("/api/storage/search", json=payload)
        assert resp.status_code == 422

    def test_search_n_results_too_large(self):
        payload = {"collection_name": "c", "query_texts": ["q"], "n_results": 101}
        resp = client.post("/api/storage/search", json=payload)
        assert resp.status_code == 422

    def test_search_empty_query_list(self):
        payload = {"collection_name": "c", "query_texts": []}
        resp = client.post("/api/storage/search", json=payload)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/storage/collections/{name}/count
# ---------------------------------------------------------------------------


class TestGetCollectionCount:
    def test_get_count_success(self, mock_client):
        mock_client.count.return_value = 42
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.get("/api/storage/collections/my_col/count")
        assert resp.status_code == 200
        data = resp.json()
        assert data["collection"] == "my_col"
        assert data["count"] == 42
        mock_client.count.assert_called_once_with("my_col")

    def test_get_count_zero(self, mock_client):
        mock_client.count.return_value = 0
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.get("/api/storage/collections/empty_col/count")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_get_count_storage_error(self, mock_client):
        mock_client.count.side_effect = StorageError("count failed")
        with patch("app.api.storage.get_chromadb_client", return_value=mock_client):
            resp = client.get("/api/storage/collections/bad_col/count")
        assert resp.status_code == 500
        assert "count failed" in resp.json()["detail"]
