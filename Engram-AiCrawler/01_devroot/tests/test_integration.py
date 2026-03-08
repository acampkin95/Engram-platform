"""Integration tests for end-to-end workflows.

All external services (crawl4ai, LM Studio, Redis, ChromaDB) are mocked.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Crawl → Cache → Retrieve workflow
# ---------------------------------------------------------------------------


class TestCrawlCacheWorkflow:
    """Test that crawl results are cached and retrieved on subsequent requests."""

    @pytest.mark.asyncio
    async def test_crawl_result_cached_after_success(self):
        """After a successful crawl, the result should be stored in cache."""
        from app.services.cache import set_crawl_result

        mock_set = AsyncMock(return_value=True)
        mock_get = AsyncMock(return_value=None)

        with patch("app.services.cache.cache_set", mock_set), patch(
            "app.services.cache.cache_get", mock_get
        ):
            # Simulate storing a crawl result
            result_data = {
                "markdown": "# Test Page",
                "html": "<h1>Test Page</h1>",
                "extracted_content": None,
                "links": [],
                "media": {},
                "metadata": {"word_count": 2},
            }
            ok = await set_crawl_result("https://example.com", result_data)
            assert ok is True
            mock_set.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_hit_returns_stored_result(self):
        """A cached crawl result should be returned on cache hit."""
        from app.services.cache import get_crawl_result

        cached_data = {"markdown": "# Cached", "html": "<h1>Cached</h1>"}

        with patch("app.services.cache.cache_get", AsyncMock(return_value=cached_data)):
            result = await get_crawl_result("https://example.com")
            assert result is not None
            assert result["markdown"] == "# Cached"

    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self):
        """Cache miss should return None, allowing a fresh crawl."""
        from app.services.cache import get_crawl_result

        with patch("app.services.cache.cache_get", AsyncMock(return_value=None)):
            result = await get_crawl_result("https://example.com")
            assert result is None


# ---------------------------------------------------------------------------
# LM Studio caching workflow
# ---------------------------------------------------------------------------


class TestLMCacheWorkflow:
    """Test LM Studio response caching in lm_studio_bridge."""

    @pytest.mark.asyncio
    async def test_lm_response_cached_after_request(self):
        """LM responses should be cached for identical message payloads."""
        from app.services.cache import set_lm_response, get_lm_response

        response_data = {"choices": [{"message": {"content": '{"result": "test"}'}}]}

        with patch("app.services.cache.cache_set", AsyncMock(return_value=True)):
            ok = await set_lm_response("hash123", response_data)
            assert ok is True

        with patch("app.services.cache.cache_get", AsyncMock(return_value=response_data)):
            cached = await get_lm_response("hash123")
            assert cached is not None
            assert cached["choices"][0]["message"]["content"] == '{"result": "test"}'


# ---------------------------------------------------------------------------
# OSINT Alias Discovery pipeline
# ---------------------------------------------------------------------------


class TestAliasDiscoveryPipeline:
    """Test alias discovery end-to-end with mocked LM Studio."""

    @pytest.mark.asyncio
    async def test_discover_aliases_returns_queries(self):
        from app.osint.alias_discovery import AliasDiscoveryService

        mock_bridge = MagicMock()
        mock_bridge.generate_alias_discovery_queries = AsyncMock(
            return_value={
                "queries": [
                    {"platform": "twitter", "query": "testuser site:x.com"},
                    {"platform": "linkedin", "query": "testuser site:linkedin.com"},
                    {"platform": "github", "query": "testuser site:github.com"},
                ]
            }
        )

        service = AliasDiscoveryService(lm_bridge=mock_bridge)
        result = await service.discover_aliases("testuser")

        assert result["username"] == "testuser"
        assert len(result["queries"]) == 3
        assert "timestamp" in result
        mock_bridge.generate_alias_discovery_queries.assert_called_once_with("testuser")

    @pytest.mark.asyncio
    async def test_discover_aliases_filters_by_platform(self):
        from app.osint.alias_discovery import AliasDiscoveryService

        mock_bridge = MagicMock()
        mock_bridge.generate_alias_discovery_queries = AsyncMock(
            return_value={
                "queries": [
                    {"platform": "twitter", "query": "q1"},
                    {"platform": "linkedin", "query": "q2"},
                    {"platform": "github", "query": "q3"},
                ]
            }
        )

        service = AliasDiscoveryService(lm_bridge=mock_bridge)
        result = await service.discover_aliases("testuser", platforms=["twitter"])

        assert len(result["queries"]) == 1
        assert result["queries"][0]["platform"] == "twitter"

    @pytest.mark.asyncio
    async def test_build_profile_urls(self):
        from app.osint.alias_discovery import AliasDiscoveryService

        mock_bridge = MagicMock()
        service = AliasDiscoveryService(lm_bridge=mock_bridge)
        urls = await service.build_profile_urls("johndoe", platforms=["twitter", "github"])

        assert len(urls) == 2
        twitter_url = next(u for u in urls if u["platform"] == "twitter")
        assert "johndoe" in twitter_url["url"]

    @pytest.mark.asyncio
    async def test_search_username_combines_results(self):
        from app.osint.alias_discovery import AliasDiscoveryService

        mock_bridge = MagicMock()
        mock_bridge.generate_alias_discovery_queries = AsyncMock(
            return_value={"queries": [{"platform": "twitter", "query": "q1"}]}
        )

        service = AliasDiscoveryService(lm_bridge=mock_bridge)
        result = await service.search_username("testuser")

        assert "profile_urls" in result
        assert "search_queries" in result
        assert len(result["profile_urls"]) > 0  # All platforms


# ---------------------------------------------------------------------------
# ChromaDB store → search workflow
# ---------------------------------------------------------------------------


class TestChromaDBWorkflow:
    """Test ChromaDB client operations with mocked chromadb."""

    def test_add_and_count_documents(self):
        """Documents added should be countable."""
        from app.storage.chromadb_client import ChromaDBClient

        mock_collection = MagicMock()
        mock_collection.count.return_value = 3
        mock_collection.add = MagicMock()

        mock_chroma = MagicMock()
        mock_chroma.get_or_create_collection.return_value = mock_collection

        with patch("chromadb.PersistentClient", return_value=mock_chroma):
            client = ChromaDBClient(path="/tmp/test_chroma")
            ids = client.add_documents(
                collection_name="test",
                documents=["doc1", "doc2", "doc3"],
            )
            assert len(ids) == 3
            mock_collection.add.assert_called_once()

            count = client.count("test")
            assert count == 3

    def test_search_returns_results(self):
        """Search should return query results from ChromaDB."""
        from app.storage.chromadb_client import ChromaDBClient

        mock_results = {
            "ids": [["id1", "id2"]],
            "documents": [["doc1", "doc2"]],
            "distances": [[0.1, 0.3]],
        }

        mock_collection = MagicMock()
        mock_collection.query.return_value = mock_results

        mock_chroma = MagicMock()
        mock_chroma.get_or_create_collection.return_value = mock_collection

        with patch("chromadb.PersistentClient", return_value=mock_chroma):
            client = ChromaDBClient(path="/tmp/test_chroma")
            results = client.search("test", query_texts=["search query"])
            assert results["ids"] == [["id1", "id2"]]

    def test_list_collections(self):
        """Should return list of collection names."""
        from app.storage.chromadb_client import ChromaDBClient

        mock_col1 = MagicMock()
        mock_col1.name = "scan_col1"
        mock_col2 = MagicMock()
        mock_col2.name = "scan_col2"

        mock_chroma = MagicMock()
        mock_chroma.list_collections.return_value = [mock_col1, mock_col2]

        with patch("chromadb.PersistentClient", return_value=mock_chroma):
            client = ChromaDBClient(path="/tmp/test_chroma")
            names = client.list_collections()
            assert names == ["scan_col1", "scan_col2"]

    def test_delete_collection(self):
        """Delete should call chromadb delete_collection."""
        from app.storage.chromadb_client import ChromaDBClient

        mock_chroma = MagicMock()

        with patch("chromadb.PersistentClient", return_value=mock_chroma):
            client = ChromaDBClient(path="/tmp/test_chroma")
            ok = client.delete_collection("test")
            assert ok is True
            mock_chroma.delete_collection.assert_called_once_with(name="scan_test")


# ---------------------------------------------------------------------------
# Model Review Pipeline
# ---------------------------------------------------------------------------


class TestModelReviewPipeline:
    """Test the model review pipeline with mocked LM Studio."""

    @pytest.mark.asyncio
    async def test_review_single_keep(self):
        from app.pipelines.model_review import ModelReviewPipeline, ReviewDecision

        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(
            return_value={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "relevance_score": 0.85,
                                    "decision": "keep",
                                    "reasoning": "Highly relevant content",
                                    "keywords_found": ["osint", "intelligence"],
                                }
                            )
                        }
                    }
                ]
            }
        )

        pipeline = ModelReviewPipeline(lm_bridge=mock_bridge)
        result = await pipeline.review_single(
            crawl_id="c1",
            url="https://example.com",
            markdown_content="# OSINT Intelligence Report",
            query_context="osint tools",
        )

        assert result.relevance_score == 0.85
        assert result.decision == ReviewDecision.KEEP
        assert "osint" in result.keywords_found

    @pytest.mark.asyncio
    async def test_review_single_archive_on_low_score(self):
        from app.pipelines.model_review import ModelReviewPipeline, ReviewDecision

        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(
            return_value={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "relevance_score": 0.1,
                                    "decision": "archive",
                                    "reasoning": "Not relevant",
                                    "keywords_found": [],
                                }
                            )
                        }
                    }
                ]
            }
        )

        pipeline = ModelReviewPipeline(lm_bridge=mock_bridge)
        result = await pipeline.review_single(
            crawl_id="c2",
            url="https://example.com/unrelated",
            markdown_content="# Cookie recipes",
        )

        assert result.relevance_score == 0.1
        assert result.decision == ReviewDecision.ARCHIVE

    @pytest.mark.asyncio
    async def test_review_batch_aggregates(self):
        from app.pipelines.model_review import ModelReviewPipeline

        call_count = 0

        async def mock_request(*args, **kwargs):
            nonlocal call_count
            scores = [0.9, 0.4, 0.1]
            score = scores[call_count % len(scores)]
            call_count += 1
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "relevance_score": score,
                                    "decision": "keep" if score > 0.5 else "archive",
                                    "reasoning": "test",
                                    "keywords_found": [],
                                }
                            )
                        }
                    }
                ]
            }

        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = mock_request

        pipeline = ModelReviewPipeline(lm_bridge=mock_bridge)
        batch_result = await pipeline.review_batch(
            items=[
                {"crawl_id": "c1", "url": "u1", "markdown": "content1"},
                {"crawl_id": "c2", "url": "u2", "markdown": "content2"},
                {"crawl_id": "c3", "url": "u3", "markdown": "content3"},
            ],
            query_context="test query",
        )

        assert batch_result.total_reviewed == 3
        assert batch_result.kept == 1
        assert batch_result.deranked == 1
        assert batch_result.archived == 1

    @pytest.mark.asyncio
    async def test_review_handles_json_parse_failure(self):
        """Pipeline should gracefully handle unparseable LLM responses."""
        from app.pipelines.model_review import ModelReviewPipeline, ReviewDecision

        mock_bridge = MagicMock()
        mock_bridge._make_request_with_retry = AsyncMock(
            return_value={"choices": [{"message": {"content": "This is not JSON at all"}}]}
        )

        pipeline = ModelReviewPipeline(lm_bridge=mock_bridge)
        result = await pipeline.review_single(
            crawl_id="c_bad",
            url="https://example.com",
            markdown_content="some content",
        )

        assert result.relevance_score == 0.0
        assert result.decision == ReviewDecision.ARCHIVE
        assert "failed" in result.reasoning.lower() or "error" in result.reasoning.lower()


# ---------------------------------------------------------------------------
# Platform config
# ---------------------------------------------------------------------------


class TestPlatformConfig:
    """Test platform configuration module."""

    def test_get_platform_returns_config(self):
        from app.osint.platforms import get_platform

        twitter = get_platform("twitter")
        assert twitter is not None
        assert twitter.id == "twitter"
        assert "{username}" in twitter.profile_url_template

    def test_get_platform_case_insensitive(self):
        from app.osint.platforms import get_platform

        assert get_platform("Twitter") is not None
        assert get_platform("GITHUB") is not None

    def test_get_platform_unknown_returns_none(self):
        from app.osint.platforms import get_platform

        assert get_platform("nonexistent_platform") is None

    def test_get_all_platforms_returns_list(self):
        from app.osint.platforms import get_all_platforms

        platforms = get_all_platforms()
        assert len(platforms) >= 6
        ids = {p.id for p in platforms}
        assert "twitter" in ids
        assert "github" in ids
