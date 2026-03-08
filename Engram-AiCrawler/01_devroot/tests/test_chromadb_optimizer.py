"""Tests for app/services/chromadb_optimizer.py — ChromaDB optimizer utilities."""

from unittest.mock import MagicMock, patch


from app.services.chromadb_optimizer import (
    BatchIngestor,
    CollectionOptimizer,
    OsintCollectionNames,
    _chunk_list,
    _content_hash,
    get_batch_ingestor,
    get_collection_optimizer,
)


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


class TestChunkList:
    def test_empty_list(self):
        assert _chunk_list([], 10) == []

    def test_exactly_one_batch(self):
        result = _chunk_list([1, 2, 3], 5)
        assert result == [[1, 2, 3]]

    def test_multiple_batches(self):
        result = _chunk_list(list(range(10)), 3)
        assert result == [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]

    def test_batch_size_one(self):
        result = _chunk_list([1, 2, 3], 1)
        assert result == [[1], [2], [3]]

    def test_exact_multiple(self):
        result = _chunk_list([1, 2, 3, 4], 2)
        assert result == [[1, 2], [3, 4]]


class TestContentHash:
    def test_returns_32_char_string(self):
        h = _content_hash("hello world")
        assert len(h) == 32

    def test_same_input_same_hash(self):
        assert _content_hash("test") == _content_hash("test")

    def test_different_inputs_different_hashes(self):
        assert _content_hash("abc") != _content_hash("xyz")

    def test_empty_string_hashes(self):
        h = _content_hash("")
        assert len(h) == 32


# ---------------------------------------------------------------------------
# OsintCollectionNames
# ---------------------------------------------------------------------------


class TestOsintCollectionNames:
    def test_entity_name(self):
        assert OsintCollectionNames.entity("abc123") == "entity_abc123"

    def test_scan_name(self):
        assert OsintCollectionNames.scan("scan456") == "scan_scan456"

    def test_case_name(self):
        assert OsintCollectionNames.case("case789") == "case_case789"

    def test_platform_name_lowercased(self):
        assert OsintCollectionNames.platform("Twitter") == "platform_twitter"
        assert OsintCollectionNames.platform("LINKEDIN") == "platform_linkedin"

    def test_global_constants(self):
        assert OsintCollectionNames.GLOBAL_ENTITIES == "osint_entities"
        assert OsintCollectionNames.GLOBAL_EVIDENCE == "osint_evidence"
        assert OsintCollectionNames.GLOBAL_FRAUD == "osint_fraud_signals"


# ---------------------------------------------------------------------------
# BatchIngestor
# ---------------------------------------------------------------------------


def _make_mock_client(existing_ids=None):
    """Create a mock ChromaDB client."""
    mock_client = MagicMock()
    mock_collection = MagicMock()
    mock_collection.get.return_value = {"ids": existing_ids or []}
    mock_collection.count.return_value = len(existing_ids or [])
    mock_client.get_or_create_collection.return_value = mock_collection
    mock_client.add_documents.return_value = ["id1", "id2"]
    return mock_client


class TestBatchIngestor:
    def test_no_client_returns_error(self):
        ingestor = BatchIngestor(chroma_client=None, batch_size=10)
        # Patch _get_client to return None (simulate unavailable ChromaDB)
        with patch.object(ingestor, "_get_client", return_value=None):
            result = ingestor.ingest_batch("test_col", ["doc1", "doc2"])
        assert result["error"] == "ChromaDB unavailable"
        assert result["added"] == 0

    def test_ingest_empty_documents_after_dedup(self):
        mock_client = _make_mock_client()
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)
        # Simulate all docs already present
        doc = "existing document"
        doc_hash = _content_hash(doc)
        mock_collection = MagicMock()
        mock_collection.get.return_value = {"ids": [doc_hash]}
        mock_client.get_or_create_collection.return_value = mock_collection

        result = ingestor.ingest_batch("test_col", [doc], deduplicate=True)
        assert result["added"] == 0
        assert result["skipped"] == 0  # skipped after dedup → empty list → early return

    def test_ingest_batch_without_dedup(self):
        mock_client = _make_mock_client()
        mock_client.add_documents.return_value = ["id1", "id2", "id3"]
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)

        result = ingestor.ingest_batch(
            "test_col",
            ["doc1", "doc2", "doc3"],
            deduplicate=False,
        )
        assert result["added"] == 3
        assert result["batches"] == 1
        assert result["collection"] == "test_col"

    def test_batching_splits_large_document_sets(self):
        mock_client = _make_mock_client()
        mock_client.add_documents.return_value = ["id1"]
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=2)

        docs = [f"doc{i}" for i in range(5)]
        result = ingestor.ingest_batch("test_col", docs, deduplicate=False)
        # 5 docs / batch_size=2 → 3 batches
        assert result["batches"] == 3

    def test_auto_generates_ids_from_content_hash(self):
        mock_client = _make_mock_client()
        captured_ids = []

        def capture_add(collection_name, documents, metadatas, ids):
            captured_ids.extend(ids)
            return ids

        mock_client.add_documents.side_effect = capture_add
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)

        docs = ["hello world", "foo bar"]
        ingestor.ingest_batch("test_col", docs, ids=None, deduplicate=False)

        assert _content_hash("hello world") in captured_ids
        assert _content_hash("foo bar") in captured_ids

    def test_custom_ids_used_when_provided(self):
        mock_client = _make_mock_client()
        captured_ids = []

        def capture_add(collection_name, documents, metadatas, ids):
            captured_ids.extend(ids)
            return ids

        mock_client.add_documents.side_effect = capture_add
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)

        docs = ["doc1", "doc2"]
        custom_ids = ["custom-id-1", "custom-id-2"]
        ingestor.ingest_batch("test_col", docs, ids=custom_ids, deduplicate=False)

        assert "custom-id-1" in captured_ids
        assert "custom-id-2" in captured_ids

    def test_failed_batch_logged_not_raised(self):
        mock_client = _make_mock_client()
        mock_client.add_documents.side_effect = RuntimeError("ChromaDB error")
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)

        # Should not raise
        result = ingestor.ingest_batch("test_col", ["doc1"], deduplicate=False)
        assert result["added"] == 0

    def test_dedup_filters_existing_ids(self):
        existing_hash = _content_hash("existing doc")
        mock_client = _make_mock_client(existing_ids=[existing_hash])
        mock_client.add_documents.return_value = ["new_id"]
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)

        result = ingestor.ingest_batch(
            "test_col",
            ["existing doc", "new doc"],
            deduplicate=True,
        )
        # Only "new doc" should be added
        assert result["added"] == 1

    def test_ingest_batch_returns_collection_name(self):
        mock_client = _make_mock_client()
        mock_client.add_documents.return_value = ["id1"]
        ingestor = BatchIngestor(chroma_client=mock_client, batch_size=10)

        result = ingestor.ingest_batch("my_collection", ["doc"], deduplicate=False)
        assert result["collection"] == "my_collection"

    def test_get_client_lazy_initializes(self):
        ingestor = BatchIngestor(chroma_client=None, batch_size=10)
        mock_client = MagicMock()
        # _get_client does a local import; test via ingest_batch which calls _get_client
        with patch.object(ingestor, "_get_client", return_value=mock_client):
            mock_client.add_documents.return_value = ["id1"]
            result = ingestor.ingest_batch("col", ["doc"], deduplicate=False)
        assert result["added"] == 1

    def test_get_client_returns_none_on_import_error(self):
        ingestor = BatchIngestor(chroma_client=None, batch_size=10)
        with patch.object(ingestor, "_get_client", return_value=None):
            result = ingestor.ingest_batch("col", ["doc"], deduplicate=False)
        assert result["error"] == "ChromaDB unavailable"


# ---------------------------------------------------------------------------
# CollectionOptimizer
# ---------------------------------------------------------------------------


class TestCollectionOptimizer:
    def _make_optimizer(self, collections=None, doc_counts=None):
        """Helper to create CollectionOptimizer with a mocked client."""
        mock_client = MagicMock()
        collections = collections or []
        doc_counts = doc_counts or {}

        mock_client.list_collections.return_value = collections

        def get_or_create(name):
            col = MagicMock()
            col.count.return_value = doc_counts.get(name, 0)
            col.get.return_value = {
                "ids": [f"id_{i}" for i in range(doc_counts.get(name, 0))],
                "metadatas": [
                    {"added_at": "2024-01-01T00:00:00"} for _ in range(doc_counts.get(name, 0))
                ],
            }
            return col

        mock_client.get_or_create_collection.side_effect = get_or_create
        return CollectionOptimizer(chroma_client=mock_client), mock_client

    def test_collection_stats_no_client(self):
        optimizer = CollectionOptimizer(chroma_client=None)
        with patch.object(optimizer, "_get_client", return_value=None):
            result = optimizer.collection_stats()
        assert "error" in result

    def test_collection_stats_all_collections(self):
        optimizer, _ = self._make_optimizer(
            collections=["col_a", "col_b"],
            doc_counts={"col_a": 10, "col_b": 5},
        )
        result = optimizer.collection_stats()
        assert result["total_collections"] == 2
        assert result["total_documents"] == 15
        assert "col_a" in result["collections"]
        assert result["collections"]["col_a"]["document_count"] == 10

    def test_collection_stats_single_collection(self):
        optimizer, _ = self._make_optimizer(
            collections=["col_a"],
            doc_counts={"col_a": 42},
        )
        result = optimizer.collection_stats(collection_name="col_a")
        assert result["total_collections"] == 1
        assert result["total_documents"] == 42

    def test_collection_stats_empty(self):
        optimizer, _ = self._make_optimizer(collections=[], doc_counts={})
        result = optimizer.collection_stats()
        assert result["total_collections"] == 0
        assert result["total_documents"] == 0

    def test_prune_collection_no_client(self):
        optimizer = CollectionOptimizer(chroma_client=None)
        with patch.object(optimizer, "_get_client", return_value=None):
            result = optimizer.prune_collection("test_col", max_documents=100)
        assert "error" in result
        assert result["pruned"] == 0

    def test_prune_collection_below_max_no_op(self):
        optimizer, mock_client = self._make_optimizer(
            collections=["test_col"],
            doc_counts={"test_col": 50},
        )
        result = optimizer.prune_collection("test_col", max_documents=100)
        assert result["pruned"] == 0
        assert result["remaining"] == 50

    def test_prune_collection_removes_excess(self):
        mock_client = MagicMock()
        mock_collection = MagicMock()
        mock_collection.count.return_value = 150
        mock_collection.get.return_value = {
            "ids": [f"id_{i}" for i in range(150)],
            "metadatas": [{"added_at": f"2024-01-{i % 28 + 1:02d}T00:00:00"} for i in range(150)],
        }
        mock_client.get_or_create_collection.return_value = mock_collection
        optimizer = CollectionOptimizer(chroma_client=mock_client)

        result = optimizer.prune_collection("test_col", max_documents=100)
        assert result["pruned"] == 50
        assert result["remaining"] == 100
        mock_collection.delete.assert_called_once()

    def test_prune_collection_error_returns_error_dict(self):
        mock_client = MagicMock()
        mock_client.get_or_create_collection.side_effect = RuntimeError("DB error")
        optimizer = CollectionOptimizer(chroma_client=mock_client)

        result = optimizer.prune_collection("test_col", max_documents=100)
        assert "error" in result
        assert result["pruned"] == 0

    def test_delete_orphaned_collections(self):
        mock_client = MagicMock()
        mock_client.list_collections.return_value = [
            "scan_active123",
            "scan_orphan456",
            "entity_active789",
            "entity_orphan000",
            "unrelated_col",
        ]
        optimizer = CollectionOptimizer(chroma_client=mock_client)

        active_ids = {"active123", "active789"}
        deleted = optimizer.delete_orphaned_collections(active_ids)

        assert "scan_orphan456" in deleted
        assert "entity_orphan000" in deleted
        assert "scan_active123" not in deleted
        assert "unrelated_col" not in deleted

    def test_delete_orphaned_no_client(self):
        optimizer = CollectionOptimizer(chroma_client=None)
        with patch.object(optimizer, "_get_client", return_value=None):
            result = optimizer.delete_orphaned_collections({"id1"})
        assert result == []

    def test_health_check_healthy(self):
        optimizer, _ = self._make_optimizer(
            collections=["col1", "col2"],
            doc_counts={"col1": 10, "col2": 20},
        )
        result = optimizer.health_check()
        assert result["status"] == "healthy"
        assert result["collection_count"] == 2
        assert result["total_documents"] == 30
        assert "batch_size" in result
        assert "similarity_threshold" in result

    def test_health_check_no_client(self):
        optimizer = CollectionOptimizer(chroma_client=None)
        with patch.object(optimizer, "_get_client", return_value=None):
            result = optimizer.health_check()
        assert result["status"] == "unavailable"

    def test_health_check_error(self):
        mock_client = MagicMock()
        mock_client.list_collections.side_effect = RuntimeError("connection failed")
        optimizer = CollectionOptimizer(chroma_client=mock_client)
        result = optimizer.health_check()
        assert result["status"] == "error"
        assert "error" in result

    def test_get_client_lazy_initializes(self):
        optimizer = CollectionOptimizer(chroma_client=None)
        mock_client = MagicMock()
        mock_client.list_collections.return_value = []
        with patch.object(optimizer, "_get_client", return_value=mock_client):
            result = optimizer.health_check()
        assert result["status"] == "healthy"

    def test_get_client_returns_none_on_error(self):
        optimizer = CollectionOptimizer(chroma_client=None)
        with patch.object(optimizer, "_get_client", return_value=None):
            result = optimizer.health_check()
        assert result["status"] == "unavailable"


# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------


class TestSingletons:
    def test_get_batch_ingestor_returns_batch_ingestor(self):
        import app.services.chromadb_optimizer as mod

        mod._ingestor = None  # Reset singleton
        ingestor = get_batch_ingestor()
        assert isinstance(ingestor, BatchIngestor)

    def test_get_batch_ingestor_returns_same_instance(self):
        import app.services.chromadb_optimizer as mod

        mod._ingestor = None
        i1 = get_batch_ingestor()
        i2 = get_batch_ingestor()
        assert i1 is i2

    def test_get_collection_optimizer_returns_optimizer(self):
        import app.services.chromadb_optimizer as mod

        mod._optimizer = None
        optimizer = get_collection_optimizer()
        assert isinstance(optimizer, CollectionOptimizer)

    def test_get_collection_optimizer_returns_same_instance(self):
        import app.services.chromadb_optimizer as mod

        mod._optimizer = None
        o1 = get_collection_optimizer()
        o2 = get_collection_optimizer()
        assert o1 is o2
