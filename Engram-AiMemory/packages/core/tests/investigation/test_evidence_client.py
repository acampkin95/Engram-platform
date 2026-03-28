"""Tests for evidence_client.py - EvidenceClient."""

import hashlib
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from memory_system.compat import UTC
from memory_system.investigation.evidence_client import EvidenceClient
from memory_system.investigation.models import EvidenceIngest, SearchRequest, SourceType


class MockCollection:
    class MockTenant:
        def __init__(self, parent):
            self._parent = parent

        def data(self):
            return MagicMock()

        def query(self):
            return MockQuery(self._parent)

    def __init__(self, parent):
        self._parent = parent
        self._tenant = None

    def with_tenant(self, tenant_id):
        self._tenant = MockTenant(self._parent)
        return self._tenant


class MockQuery:
    def __init__(self, parent):
        pass

    def near_text(self, query=None, limit=None, filters=None):
        return MagicMock(objects=[])

    def fetch_objects(self, filters=None, limit=None):
        return MagicMock(objects=[])


class MockMatterClient:
    def ensure_tenant_active(self, matter_id, doc_type):
        pass


def _make_mock_weaviate_client():
    mock = MagicMock()
    mock.collections.get.return_value = MockCollection(mock)
    return mock


def _make_ingest(content="Test content", source_url="https://example.com"):
    return EvidenceIngest(
        matter_id="test-matter",
        content=content,
        source_url=source_url,
        source_type=SourceType.MANUAL,
    )


class TestEvidenceClientInit:
    def test_init_stores_clients(self):
        mock_weaviate = MagicMock()
        mock_matter = MagicMock()
        client = EvidenceClient(mock_weaviate, mock_matter)
        assert client._client is mock_weaviate
        assert client._matter_client is mock_matter


class TestSplitContent:
    def test_split_short_content_returns_single_chunk(self):
        client = EvidenceClient(MagicMock(), MagicMock())
        content = "Short content"
        chunks = client._split_content(content)
        assert chunks == [content]

    def test_split_content_handles_empty_string(self):
        client = EvidenceClient(MagicMock(), MagicMock())
        chunks = client._split_content("")
        assert chunks == [""]

    def test_split_content_respects_chunk_size(self):
        client = EvidenceClient(MagicMock(), MagicMock())
        client.CHUNK_SIZE = 50
        client.CHUNK_OVERLAP = 10
        content = "word " * 500
        chunks = client._split_content(content)
        for chunk in chunks:
            assert len(chunk) <= 200


class TestIngestDocument:
    @pytest.mark.asyncio
    async def test_ingest_skips_duplicate_document(self):
        mock_weaviate = _make_mock_weaviate_client()
        mock_matter = MockMatterClient()
        client = EvidenceClient(mock_weaviate, mock_matter)

        content = "Test content"
        document_hash = hashlib.sha256(content.encode()).hexdigest()

        async def mock_document_exists(matter_id, dh):
            return dh == document_hash

        client._document_exists = mock_document_exists

        ingest = _make_ingest(content=content)
        result = await client.ingest_document(ingest)

        assert result == []

    @pytest.mark.asyncio
    async def test_ingest_calls_ensure_tenant_active(self):
        mock_weaviate = _make_mock_weaviate_client()
        mock_matter = MagicMock()
        client = EvidenceClient(mock_weaviate, mock_matter)

        async def mock_document_exists(matter_id, dh):
            return False

        client._document_exists = mock_document_exists

        ingest = _make_ingest(content="Short content")
        await client.ingest_document(ingest)

        mock_matter.ensure_tenant_active.assert_called_once()


class TestSearchEvidence:
    @pytest.mark.asyncio
    async def test_search_returns_empty_when_no_results(self):
        mock_weaviate = _make_mock_weaviate_client()
        mock_matter = MockMatterClient()
        client = EvidenceClient(mock_weaviate, mock_matter)

        search = SearchRequest(
            matter_id="test-matter",
            query="test query",
            limit=10,
            offset=0,
        )
        result = await client.search_evidence(search)

        assert result.total == 0
        assert result.results == []

    @pytest.mark.asyncio
    async def test_search_returns_search_response_object(self):
        mock_weaviate = _make_mock_weaviate_client()
        mock_matter = MockMatterClient()
        client = EvidenceClient(mock_weaviate, mock_matter)

        search = SearchRequest(
            matter_id="test-matter",
            query="test query",
            limit=10,
            offset=0,
        )
        result = await client.search_evidence(search)

        assert hasattr(result, "results")
        assert hasattr(result, "total")
        assert hasattr(result, "query")
        assert hasattr(result, "matter_id")
        assert hasattr(result, "limit")
        assert hasattr(result, "offset")

    @pytest.mark.asyncio
    async def test_search_uses_default_limit_and_offset(self):
        mock_weaviate = _make_mock_weaviate_client()
        mock_matter = MockMatterClient()
        client = EvidenceClient(mock_weaviate, mock_matter)

        search = SearchRequest(
            matter_id="test-matter",
            query="test",
        )
        result = await client.search_evidence(search)

        assert result.limit == 10
        assert result.offset == 0


class TestDocumentExists:
    @pytest.mark.asyncio
    async def test_returns_false_on_exception(self):
        mock_weaviate = MagicMock()
        mock_weaviate.collections.get.side_effect = Exception("Error")
        mock_matter = MockMatterClient()
        client = EvidenceClient(mock_weaviate, mock_matter)

        result = await client._document_exists("test-matter", "abc123")

        assert result is False
