"""Tests for PlatformCrawlRouter.

Covers:
- _resolve_platform: platforms list, type inference, None fallback
- crawl_vectors: parallel execution, exception → error dict
- _crawl_with_adapter: adapter call, result structure, fallback on adapter failure
- _crawl_generic: ImportError, exception, success
"""
from __future__ import annotations

from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Minimal SearchVector stub so we don't need the real orchestrator import
# ---------------------------------------------------------------------------


class _Vector:
    """Minimal SearchVector stand-in."""

    def __init__(
        self,
        query: str,
        vector_type: str = "name",
        platforms: Optional[list] = None,
    ) -> None:
        self.query = query
        self.vector_type = vector_type
        self.platforms = platforms or []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_router(max_concurrent: int = 5):
    from app.osint.platform_crawler import PlatformCrawlRouter

    return PlatformCrawlRouter(max_concurrent=max_concurrent)


def _make_crawl_result(platform_id: str = "github", success: bool = True) -> Any:
    """Return a PlatformCrawlResult-like object."""
    from app.osint.platforms.base import PlatformCrawlResult

    return PlatformCrawlResult(
        platform_id=platform_id,
        query="test query",
        url="https://example.com",
        success=success,
        markdown="# result" if success else None,
        error=None if success else "failed",
        names=["Alice"],
        emails=["alice@example.com"],
        phones=[],
        addresses=[],
        usernames=["alice"],
        image_urls=[],
        profile_urls=["https://github.com/alice"],
        relationships=[],
    )


# ===========================================================================
# TestResolvePlatform
# ===========================================================================


class TestResolvePlatform:
    """_resolve_platform picks the right adapter ID."""

    def test_returns_first_matching_registered_platform_from_list(self):
        router = _make_router()
        vector = _Vector("alice", platforms=["github", "reddit"])
        result = router._resolve_platform(vector)
        assert result == "github"

    def test_returns_second_platform_when_first_not_in_registry(self):
        router = _make_router()
        vector = _Vector("alice", platforms=["nonexistent_platform", "reddit"])
        result = router._resolve_platform(vector)
        assert result == "reddit"

    def test_returns_none_when_no_platforms_match_registry(self):
        # When platforms list has no registry matches AND vector_type has no mapping,
        # _resolve_platform returns None.
        router = _make_router()
        vector = _Vector("alice", platforms=["completely_fake", "also_fake"], vector_type="keyword")
        result = router._resolve_platform(vector)
        assert result is None

    def test_empty_platforms_list_falls_through_to_type_inference(self):
        router = _make_router()
        vector = _Vector("alice", vector_type="email", platforms=[])
        result = router._resolve_platform(vector)
        assert result == "emailrep"

    def test_type_phone_maps_to_truepeoplesearch(self):
        router = _make_router()
        vector = _Vector("+1234567890", vector_type="phone")
        assert router._resolve_platform(vector) == "truepeoplesearch"

    def test_type_email_maps_to_emailrep(self):
        router = _make_router()
        vector = _Vector("a@b.com", vector_type="email")
        assert router._resolve_platform(vector) == "emailrep"

    def test_type_username_maps_to_github(self):
        router = _make_router()
        vector = _Vector("alice", vector_type="username")
        assert router._resolve_platform(vector) == "github"

    def test_type_name_maps_to_truepeoplesearch(self):
        router = _make_router()
        vector = _Vector("Alice Smith", vector_type="name")
        assert router._resolve_platform(vector) == "truepeoplesearch"

    def test_type_address_maps_to_truepeoplesearch(self):
        router = _make_router()
        vector = _Vector("123 Main St", vector_type="address")
        assert router._resolve_platform(vector) == "truepeoplesearch"

    def test_unknown_type_returns_none(self):
        router = _make_router()
        vector = _Vector("something", vector_type="keyword")
        assert router._resolve_platform(vector) is None

    def test_platform_lookup_is_case_insensitive(self):
        router = _make_router()
        vector = _Vector("alice", platforms=["GitHub"])
        result = router._resolve_platform(vector)
        assert result == "github"


# ===========================================================================
# TestCrawlVectors
# ===========================================================================


class TestCrawlVectors:
    """crawl_vectors orchestrates parallel crawls."""

    @pytest.mark.asyncio
    async def test_returns_list_of_dicts(self):
        router = _make_router()
        vectors = [_Vector("alice", vector_type="username")]

        crawl_result = _make_crawl_result()
        with patch.object(
            router, "_crawl_one", new=AsyncMock(return_value={"success": True, "query": "alice"})
        ):
            results = await router.crawl_vectors(vectors)

        assert isinstance(results, list)
        assert len(results) == 1
        assert results[0]["success"] is True

    @pytest.mark.asyncio
    async def test_exception_in_crawl_produces_error_dict(self):
        router = _make_router()
        vectors = [_Vector("alice", vector_type="username")]

        with patch.object(router, "_crawl_one", new=AsyncMock(side_effect=RuntimeError("boom"))):
            results = await router.crawl_vectors(vectors)

        assert len(results) == 1
        assert results[0]["success"] is False
        assert results[0]["query"] == "alice"
        assert "boom" in results[0]["error"]
        assert results[0]["markdown"] is None

    @pytest.mark.asyncio
    async def test_processes_multiple_vectors(self):
        router = _make_router()
        vectors = [
            _Vector("alice", vector_type="username"),
            _Vector("bob@example.com", vector_type="email"),
        ]

        async def fake_crawl(v):
            return {"success": True, "query": v.query}

        with patch.object(router, "_crawl_one", side_effect=fake_crawl):
            results = await router.crawl_vectors(vectors)

        assert len(results) == 2
        queries = {r["query"] for r in results}
        assert "alice" in queries
        assert "bob@example.com" in queries

    @pytest.mark.asyncio
    async def test_mixed_success_and_failure(self):
        router = _make_router()
        vectors = [
            _Vector("alice"),
            _Vector("bad"),
        ]

        call_count = 0

        async def fake_crawl(v):
            nonlocal call_count
            call_count += 1
            if v.query == "bad":
                raise ValueError("bad vector")
            return {"success": True, "query": v.query}

        with patch.object(router, "_crawl_one", side_effect=fake_crawl):
            results = await router.crawl_vectors(vectors)

        assert len(results) == 2
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        assert len(successes) == 1
        assert len(failures) == 1

    @pytest.mark.asyncio
    async def test_empty_vectors_returns_empty_list(self):
        router = _make_router()
        results = await router.crawl_vectors([])
        assert results == []


# ===========================================================================
# TestCrawlWithAdapter
# ===========================================================================


class TestCrawlWithAdapter:
    """_crawl_with_adapter uses the registered adapter and formats results."""

    @pytest.mark.asyncio
    async def test_calls_get_crawler_with_platform_id(self):
        router = _make_router()
        vector = _Vector("alice")
        crawl_result = _make_crawl_result("github")

        mock_crawler = MagicMock()
        mock_crawler.search = AsyncMock(return_value=crawl_result)

        with patch("app.osint.platform_crawler.get_crawler", return_value=mock_crawler) as mock_get:
            result = await router._crawl_with_adapter(vector, "github")

        mock_get.assert_called_once_with("github")
        mock_crawler.search.assert_awaited_once_with("alice")

    @pytest.mark.asyncio
    async def test_result_includes_platform_id(self):
        router = _make_router()
        vector = _Vector("alice")
        crawl_result = _make_crawl_result("github")

        mock_crawler = MagicMock()
        mock_crawler.search = AsyncMock(return_value=crawl_result)

        with patch("app.osint.platform_crawler.get_crawler", return_value=mock_crawler):
            result = await router._crawl_with_adapter(vector, "github")

        assert result["platform_id"] == "github"

    @pytest.mark.asyncio
    async def test_result_includes_pre_extracted_fields(self):
        router = _make_router()
        vector = _Vector("alice")
        crawl_result = _make_crawl_result("github")

        mock_crawler = MagicMock()
        mock_crawler.search = AsyncMock(return_value=crawl_result)

        with patch("app.osint.platform_crawler.get_crawler", return_value=mock_crawler):
            result = await router._crawl_with_adapter(vector, "github")

        pre = result["pre_extracted"]
        assert "names" in pre
        assert "emails" in pre
        assert "phones" in pre
        assert "addresses" in pre
        assert "usernames" in pre
        assert "image_urls" in pre
        assert "profile_urls" in pre
        assert "relationships" in pre

    @pytest.mark.asyncio
    async def test_pre_extracted_names_match_crawl_result(self):
        router = _make_router()
        vector = _Vector("alice")
        crawl_result = _make_crawl_result("github")  # names=["Alice"]

        mock_crawler = MagicMock()
        mock_crawler.search = AsyncMock(return_value=crawl_result)

        with patch("app.osint.platform_crawler.get_crawler", return_value=mock_crawler):
            result = await router._crawl_with_adapter(vector, "github")

        assert result["pre_extracted"]["names"] == ["Alice"]
        assert result["pre_extracted"]["emails"] == ["alice@example.com"]

    @pytest.mark.asyncio
    async def test_adapter_failure_falls_back_to_generic(self):
        router = _make_router()
        vector = _Vector("alice")

        mock_crawler = MagicMock()
        mock_crawler.search = AsyncMock(side_effect=RuntimeError("adapter exploded"))

        generic_result = {
            "success": False,
            "query": "alice",
            "markdown": None,
            "error": "crawl4ai not available",
        }

        with patch("app.osint.platform_crawler.get_crawler", return_value=mock_crawler):
            with patch.object(
                router, "_crawl_generic", new=AsyncMock(return_value=generic_result)
            ) as mock_generic:
                result = await router._crawl_with_adapter(vector, "github")

        mock_generic.assert_awaited_once_with(vector)
        assert result["success"] is False


# ===========================================================================
# TestCrawlGeneric
# ===========================================================================


class TestCrawlGeneric:
    """_crawl_generic is the crawl4ai fallback."""

    @pytest.mark.asyncio
    async def test_import_error_returns_error_dict(self):
        router = _make_router()
        vector = _Vector("https://example.com", vector_type="keyword")

        # Simulate crawl4ai not being importable
        with patch.dict("sys.modules", {"crawl4ai": None}):
            result = await router._crawl_generic(vector)

        assert result["success"] is False
        assert result["query"] == "https://example.com"
        assert result["markdown"] is None
        assert "crawl4ai not available" in result["error"]

    @pytest.mark.asyncio
    async def test_exception_returns_error_dict(self):
        router = _make_router()
        vector = _Vector("https://example.com", vector_type="keyword")

        mock_crawler_instance = MagicMock()
        mock_crawler_instance.__aenter__ = AsyncMock(return_value=mock_crawler_instance)
        mock_crawler_instance.__aexit__ = AsyncMock(return_value=False)
        mock_crawler_instance.arun = AsyncMock(side_effect=RuntimeError("network error"))

        mock_crawl4ai = MagicMock()
        mock_crawl4ai.AsyncWebCrawler = MagicMock(return_value=mock_crawler_instance)
        mock_crawl4ai.BrowserConfig = MagicMock()
        mock_crawl4ai.CrawlerRunConfig = MagicMock()
        mock_crawl4ai.CacheMode = MagicMock()
        mock_crawl4ai.CacheMode.ENABLED = "enabled"

        mock_base = MagicMock()
        mock_base._random_user_agent = MagicMock(return_value="Mozilla/5.0")

        with patch.dict(
            "sys.modules", {"crawl4ai": mock_crawl4ai, "app.osint.platforms.base": mock_base}
        ):
            result = await router._crawl_generic(vector)

        assert result["success"] is False
        assert result["query"] == "https://example.com"
        assert "network error" in result["error"]

    @pytest.mark.asyncio
    async def test_successful_crawl_returns_markdown(self):
        router = _make_router()
        vector = _Vector("https://example.com", vector_type="keyword")

        mock_res = MagicMock()
        mock_res.success = True
        mock_res.markdown = "# Page Title\nSome content"
        mock_res.error_message = None

        mock_crawler_instance = MagicMock()
        mock_crawler_instance.__aenter__ = AsyncMock(return_value=mock_crawler_instance)
        mock_crawler_instance.__aexit__ = AsyncMock(return_value=False)
        mock_crawler_instance.arun = AsyncMock(return_value=mock_res)

        mock_crawl4ai = MagicMock()
        mock_crawl4ai.AsyncWebCrawler = MagicMock(return_value=mock_crawler_instance)
        mock_crawl4ai.BrowserConfig = MagicMock(return_value=MagicMock())
        mock_crawl4ai.CrawlerRunConfig = MagicMock(return_value=MagicMock())
        mock_crawl4ai.CacheMode = MagicMock()
        mock_crawl4ai.CacheMode.ENABLED = "enabled"

        mock_base = MagicMock()
        mock_base._random_user_agent = MagicMock(return_value="Mozilla/5.0")

        with patch.dict(
            "sys.modules", {"crawl4ai": mock_crawl4ai, "app.osint.platforms.base": mock_base}
        ):
            result = await router._crawl_generic(vector)

        assert result["success"] is True
        assert result["markdown"] == "# Page Title\nSome content"
        assert result["query"] == "https://example.com"
        assert result["error"] is None

    @pytest.mark.asyncio
    async def test_failed_crawl_returns_error_message(self):
        router = _make_router()
        vector = _Vector("https://example.com", vector_type="keyword")

        mock_res = MagicMock()
        mock_res.success = False
        mock_res.markdown = None
        mock_res.error_message = "timeout"

        mock_crawler_instance = MagicMock()
        mock_crawler_instance.__aenter__ = AsyncMock(return_value=mock_crawler_instance)
        mock_crawler_instance.__aexit__ = AsyncMock(return_value=False)
        mock_crawler_instance.arun = AsyncMock(return_value=mock_res)

        mock_crawl4ai = MagicMock()
        mock_crawl4ai.AsyncWebCrawler = MagicMock(return_value=mock_crawler_instance)
        mock_crawl4ai.BrowserConfig = MagicMock(return_value=MagicMock())
        mock_crawl4ai.CrawlerRunConfig = MagicMock(return_value=MagicMock())
        mock_crawl4ai.CacheMode = MagicMock()
        mock_crawl4ai.CacheMode.ENABLED = "enabled"

        mock_base = MagicMock()
        mock_base._random_user_agent = MagicMock(return_value="Mozilla/5.0")

        with patch.dict(
            "sys.modules", {"crawl4ai": mock_crawl4ai, "app.osint.platforms.base": mock_base}
        ):
            result = await router._crawl_generic(vector)

        assert result["success"] is False
        assert result["markdown"] is None
        assert result["error"] == "timeout"


# ===========================================================================
# TestCrawlOne (integration of _resolve_platform + routing)
# ===========================================================================


class TestCrawlOne:
    """_crawl_one routes to adapter or generic based on resolved platform."""

    @pytest.mark.asyncio
    async def test_routes_to_adapter_when_platform_resolved(self):
        router = _make_router()
        vector = _Vector("alice", vector_type="username")  # resolves to "github"

        adapter_result = {"success": True, "query": "alice", "platform_id": "github"}

        with patch.object(
            router, "_crawl_with_adapter", new=AsyncMock(return_value=adapter_result)
        ) as mock_adapter:
            with patch.object(router, "_crawl_generic", new=AsyncMock()) as mock_generic:
                result = await router._crawl_one(vector)

        mock_adapter.assert_awaited_once_with(vector, "github")
        mock_generic.assert_not_awaited()
        assert result["platform_id"] == "github"

    @pytest.mark.asyncio
    async def test_routes_to_generic_when_no_platform_resolved(self):
        router = _make_router()
        vector = _Vector("https://example.com", vector_type="keyword")  # no mapping

        generic_result = {"success": True, "query": "https://example.com", "markdown": "content"}

        with patch.object(router, "_crawl_with_adapter", new=AsyncMock()) as mock_adapter:
            with patch.object(
                router, "_crawl_generic", new=AsyncMock(return_value=generic_result)
            ) as mock_generic:
                result = await router._crawl_one(vector)

        mock_generic.assert_awaited_once_with(vector)
        mock_adapter.assert_not_awaited()
        assert result["markdown"] == "content"
