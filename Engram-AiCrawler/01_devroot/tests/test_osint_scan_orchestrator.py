"""Tests for the OSINT scan orchestrator pipeline."""

import json
import pytest
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch

from app.orchestrators.osint_scan_orchestrator import (
    CrawlResultItem,
    OSINTScanOrchestrator,
    ScanRequest,
    ScanResult,
    ScanStage,
)
from app.pipelines.model_review import BatchReviewResult
from app.osint.semantic_tracker import Entity, KnowledgeGraph, Relationship


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_bridge_mock():
    """Create a mock LMStudioBridge with all required methods."""
    bridge = MagicMock()
    bridge.generate_alias_discovery_queries = AsyncMock(
        return_value={
            "queries": [
                {"platform": "twitter", "query": "testuser site:twitter.com"},
                {"platform": "github", "query": "testuser site:github.com"},
            ]
        }
    )
    bridge._make_request_with_retry = AsyncMock(
        return_value={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "relevance_score": 0.85,
                                "decision": "keep",
                                "reasoning": "Highly relevant content",
                                "keywords_found": ["test", "user"],
                            }
                        )
                    }
                }
            ]
        }
    )
    return bridge


def _make_chromadb_mock():
    """Create a mock ChromaDBClient."""
    client = MagicMock()
    client.add_documents = MagicMock(return_value=["id-1", "id-2"])
    client.get_or_create_collection = MagicMock()
    return client


def _make_crawl_results(count=3, success=True):
    """Create test CrawlResultItem list."""
    return [
        CrawlResultItem(
            crawl_id=f"crawl-{i}",
            url=f"https://example.com/profile-{i}",
            success=success,
            markdown=f"# Profile {i}\nSome content about the user" if success else None,
            word_count=10 if success else 0,
        )
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------


class TestScanStage:
    def test_all_stages_exist(self):
        expected = {
            "pending",
            "alias_discovery",
            "crawling",
            "face_matching",
            "whois_lookup",
            "threat_intel",
            "email_osint",
            "reviewing",
            "storing",
            "building_graph",
            "completed",
            "failed",
        }
        assert {s.value for s in ScanStage} == expected

    def test_stage_is_string_enum(self):
        assert ScanStage.PENDING == "pending"
        assert ScanStage.COMPLETED == "completed"


class TestScanRequest:
    def test_defaults(self):
        req = ScanRequest(username="testuser")
        assert req.username == "testuser"
        assert req.platforms is None
        assert req.max_concurrent_crawls == 5
        assert req.query_context == ""

    def test_custom_values(self):
        req = ScanRequest(
            username="john",
            platforms=["twitter", "github"],
            max_concurrent_crawls=10,
            query_context="find john doe",
        )
        assert req.platforms == ["twitter", "github"]
        assert req.max_concurrent_crawls == 10


class TestCrawlResultItem:
    def test_successful_item(self):
        item = CrawlResultItem(
            crawl_id="c1",
            url="https://x.com/test",
            success=True,
            markdown="# Test",
            word_count=5,
        )
        assert item.success is True
        assert item.error is None

    def test_failed_item(self):
        item = CrawlResultItem(
            crawl_id="c2",
            url="https://x.com/fail",
            success=False,
            error="timeout",
        )
        assert item.success is False
        assert item.markdown is None


class TestScanResult:
    def test_defaults(self):
        r = ScanResult(scan_id="s1", username="test", stage=ScanStage.PENDING)
        assert r.profile_urls == []
        assert r.crawl_results == []
        assert r.review is None
        assert r.knowledge_graph is None
        assert r.stored_document_ids == []
        assert r.error is None


# ---------------------------------------------------------------------------
# Orchestrator unit tests
# ---------------------------------------------------------------------------


class TestOSINTScanOrchestrator:
    @pytest.mark.asyncio
    async def test_run_scan_full_pipeline(self):
        """Full pipeline: alias → crawl → review → store → graph."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()
        progress_calls = []

        async def on_progress(scan_id, stage, data):
            progress_calls.append((scan_id, stage, data))

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
            on_progress=on_progress,
        )

        # Mock the crawling stage to avoid needing a real browser
        mock_crawl_results = _make_crawl_results(2, success=True)
        with patch.object(orchestrator, "_crawl_urls", return_value=mock_crawl_results):
            # Mock knowledge graph build
            mock_graph = KnowledgeGraph(
                scan_id="test",
                entities=[Entity(id="e1", name="testuser", entity_type="username")],
                relationships=[],
                created_at=datetime.now(UTC).isoformat(),
                updated_at=datetime.now(UTC).isoformat(),
            )
            with patch.object(
                orchestrator._semantic_tracker, "build_graph", return_value=mock_graph
            ):
                request = ScanRequest(username="testuser")
                result = await orchestrator.run_scan(request)

        assert result.stage == ScanStage.COMPLETED
        assert result.username == "testuser"
        assert len(result.profile_urls) > 0
        assert len(result.crawl_results) == 2
        assert result.review is not None
        assert result.knowledge_graph is not None
        assert len(result.stored_document_ids) > 0
        assert result.error is None
        assert result.summary["scan_id"] == result.scan_id

        # Verify progress was emitted for each stage
        stages_emitted = [s for _, s, _ in progress_calls]
        assert ScanStage.ALIAS_DISCOVERY in stages_emitted
        assert ScanStage.CRAWLING in stages_emitted
        assert ScanStage.REVIEWING in stages_emitted
        assert ScanStage.STORING in stages_emitted
        assert ScanStage.BUILDING_GRAPH in stages_emitted
        assert ScanStage.COMPLETED in stages_emitted

    @pytest.mark.asyncio
    async def test_run_scan_no_successful_crawls(self):
        """Pipeline short-circuits when all crawls fail."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
        )

        failed_results = _make_crawl_results(3, success=False)
        with patch.object(orchestrator, "_crawl_urls", return_value=failed_results):
            request = ScanRequest(username="ghost")
            result = await orchestrator.run_scan(request)

        assert result.stage == ScanStage.COMPLETED
        assert result.review is None
        assert result.knowledge_graph is None
        assert len(result.stored_document_ids) == 0

    @pytest.mark.asyncio
    async def test_run_scan_handles_exception(self):
        """Pipeline catches exceptions and sets FAILED stage."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
        )

        with patch.object(
            orchestrator._alias_service,
            "build_profile_urls",
            side_effect=RuntimeError("LM Studio down"),
        ):
            request = ScanRequest(username="error_user")
            result = await orchestrator.run_scan(request)

        assert result.stage == ScanStage.FAILED
        assert "LM Studio down" in result.error

    @pytest.mark.asyncio
    async def test_run_scan_with_platform_filter(self):
        """Pipeline respects platform filter."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
        )

        mock_crawl_results = _make_crawl_results(1, success=True)
        with patch.object(orchestrator, "_crawl_urls", return_value=mock_crawl_results):
            mock_graph = KnowledgeGraph(
                scan_id="test",
                entities=[],
                relationships=[],
                created_at="now",
                updated_at="now",
            )
            with patch.object(
                orchestrator._semantic_tracker, "build_graph", return_value=mock_graph
            ):
                request = ScanRequest(
                    username="testuser",
                    platforms=["twitter", "github"],
                )
                result = await orchestrator.run_scan(request)

        assert result.stage == ScanStage.COMPLETED
        # Only twitter and github profile URLs should be generated
        platform_names = [p["platform"] for p in result.profile_urls]
        for name in platform_names:
            assert name.lower() in ["twitter", "github"]

    @pytest.mark.asyncio
    async def test_store_results_empty_list(self):
        """Storing empty list returns empty."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
        )

        result = await orchestrator._store_results("scan-1", [])
        assert result == []

    @pytest.mark.asyncio
    async def test_store_results_calls_chromadb(self):
        """Storing results calls ChromaDB add_documents."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
        )

        items = _make_crawl_results(2, success=True)
        result = await orchestrator._store_results("scan-1", items)
        assert len(result) == 2
        chromadb.add_documents.assert_called_once()

    @pytest.mark.asyncio
    async def test_emit_calls_callback(self):
        """Progress callback is invoked correctly."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()
        called = []

        async def cb(scan_id, stage, data):
            called.append((scan_id, stage, data))

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
            on_progress=cb,
        )

        await orchestrator._emit("s1", ScanStage.CRAWLING, {"urls": 5})
        assert len(called) == 1
        assert called[0] == ("s1", ScanStage.CRAWLING, {"urls": 5})

    @pytest.mark.asyncio
    async def test_emit_handles_callback_error(self):
        """Progress callback errors don't crash the pipeline."""
        bridge = _make_bridge_mock()
        chromadb = _make_chromadb_mock()

        async def bad_cb(scan_id, stage, data):
            raise RuntimeError("callback exploded")

        orchestrator = OSINTScanOrchestrator(
            lm_bridge=bridge,
            chromadb_client=chromadb,
            on_progress=bad_cb,
        )

        # Should not raise
        await orchestrator._emit("s1", ScanStage.CRAWLING, {})

    def test_build_summary(self):
        """Summary builder produces correct stats."""
        review = BatchReviewResult(
            results=[],
            total_reviewed=5,
            kept=3,
            deranked=1,
            archived=1,
            average_relevance=0.72,
            timestamp="now",
        )
        graph = KnowledgeGraph(
            scan_id="s1",
            entities=[Entity(id="e1", name="test", entity_type="username")],
            relationships=[
                Relationship(
                    source_id="e1",
                    target_id="e2",
                    relation_type="alias_of",
                    confidence=0.9,
                )
            ],
            created_at="now",
            updated_at="now",
        )
        result = ScanResult(
            scan_id="s1",
            username="testuser",
            stage=ScanStage.COMPLETED,
            profile_urls=[{"platform": "twitter", "url": "https://x.com/test"}],
            crawl_results=_make_crawl_results(3, success=True),
            review=review,
            knowledge_graph=graph,
            stored_document_ids=["id1", "id2", "id3"],
        )

        summary = OSINTScanOrchestrator._build_summary(result)
        assert summary["scan_id"] == "s1"
        assert summary["username"] == "testuser"
        assert summary["platforms_scanned"] == 1
        assert summary["total_crawls"] == 3
        assert summary["successful_crawls"] == 3
        assert summary["kept"] == 3
        assert summary["documents_stored"] == 3
        assert summary["entities_found"] == 1
        assert summary["relationships_found"] == 1


# ---------------------------------------------------------------------------
# WebSocket manager new methods
# ---------------------------------------------------------------------------


class TestWebSocketOSINTEvents:
    @pytest.mark.asyncio
    async def test_send_osint_scan_update(self):
        from app.websocket.manager import ConnectionManager

        mgr = ConnectionManager()
        sent = []

        async def mock_broadcast(message, topic=None):
            sent.append((message, topic))

        mgr.broadcast = mock_broadcast

        await mgr.send_osint_scan_update("scan-1", "crawling", {"urls": 5})
        assert len(sent) == 1
        msg, topic = sent[0]
        assert msg["type"] == "osint_scan_update"
        assert msg["scan_id"] == "scan-1"
        assert msg["stage"] == "crawling"
        assert topic == "osint_scan:scan-1"

    @pytest.mark.asyncio
    async def test_send_knowledge_graph_update(self):
        from app.websocket.manager import ConnectionManager

        mgr = ConnectionManager()
        sent = []

        async def mock_broadcast(message, topic=None):
            sent.append((message, topic))

        mgr.broadcast = mock_broadcast

        await mgr.send_knowledge_graph_update("scan-1", "built", {"entities": 10})
        assert len(sent) == 1
        msg, topic = sent[0]
        assert msg["type"] == "knowledge_graph_update"
        assert topic == "knowledge_graph:scan-1"

    @pytest.mark.asyncio
    async def test_send_review_update(self):
        from app.websocket.manager import ConnectionManager

        mgr = ConnectionManager()
        sent = []

        async def mock_broadcast(message, topic=None):
            sent.append((message, topic))

        mgr.broadcast = mock_broadcast

        await mgr.send_review_update("scan-1", "completed", {"kept": 3})
        assert len(sent) == 1
        msg, topic = sent[0]
        assert msg["type"] == "review_update"
        assert topic == "review:scan-1"
