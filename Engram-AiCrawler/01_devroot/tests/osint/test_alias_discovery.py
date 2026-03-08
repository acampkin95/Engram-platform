"""Tests for AliasDiscoveryService.

Tests real behavior: URL construction, filtering, result structure.
LMStudioBridge is mocked only because it makes external network calls.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.osint.alias_discovery import AliasDiscoveryService
from app.osint.platforms import get_all_platforms


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_service(queries=None):
    """Return an AliasDiscoveryService with a stubbed LM bridge."""
    bridge = MagicMock()
    bridge.generate_alias_discovery_queries = AsyncMock(return_value={"queries": queries or []})
    return AliasDiscoveryService(lm_bridge=bridge)


# ---------------------------------------------------------------------------
# build_profile_urls
# ---------------------------------------------------------------------------


class TestBuildProfileUrls:
    """build_profile_urls generates correct URLs without any external calls."""

    @pytest.mark.asyncio
    async def test_returns_url_for_every_platform_when_no_filter(self):
        """Without a platform filter, one URL per platform with a profile template is returned."""
        service = make_service()
        results = await service.build_profile_urls("alice")

        platforms_with_template = [
            p for p in get_all_platforms() if p.profile_url_template is not None
        ]
        assert len(results) == len(platforms_with_template)

    @pytest.mark.asyncio
    async def test_url_contains_username(self):
        """Every returned URL embeds the requested username."""
        service = make_service()
        results = await service.build_profile_urls("bob_osint")

        for item in results:
            assert (
                "bob_osint" in item["url"]
            ), f"Username missing from {item['platform']} URL: {item['url']}"

    @pytest.mark.asyncio
    async def test_result_has_platform_and_url_keys(self):
        """Each result dict has exactly 'platform' and 'url' keys."""
        service = make_service()
        results = await service.build_profile_urls("alice")

        for item in results:
            assert set(item.keys()) == {"platform", "url"}

    @pytest.mark.asyncio
    async def test_filters_to_requested_platforms(self):
        """When platforms list is given, only those platforms are returned."""
        service = make_service()
        results = await service.build_profile_urls("alice", platforms=["github", "reddit"])

        returned_names = {r["platform"] for r in results}
        assert returned_names == {"github", "reddit"}

    @pytest.mark.asyncio
    async def test_platform_filter_is_case_insensitive(self):
        """Platform names in the filter are matched case-insensitively."""
        service = make_service()
        results = await service.build_profile_urls("alice", platforms=["GitHub", "REDDIT"])

        returned_names = {r["platform"] for r in results}
        assert returned_names == {"github", "reddit"}

    @pytest.mark.asyncio
    async def test_unknown_platform_in_filter_is_ignored(self):
        """Unknown platform names in filter are silently ignored."""
        service = make_service()
        results = await service.build_profile_urls("alice", platforms=["github", "nonexistent"])

        returned_names = {r["platform"] for r in results}
        assert "github" in returned_names
        assert "nonexistent" not in returned_names

    @pytest.mark.asyncio
    async def test_github_url_format(self):
        """GitHub profile URL follows expected pattern."""
        service = make_service()
        results = await service.build_profile_urls("testuser", platforms=["github"])

        assert len(results) == 1
        assert results[0]["url"] == "https://github.com/testuser"
        assert results[0]["platform"] == "github"

    @pytest.mark.asyncio
    async def test_twitter_url_format(self):
        """Twitter profile URL follows expected pattern."""
        service = make_service()
        results = await service.build_profile_urls("testuser", platforms=["twitter"])

        assert len(results) == 1
        assert results[0]["url"] == "https://x.com/testuser"

    @pytest.mark.asyncio
    async def test_empty_platforms_list_returns_all_platforms(self):
        """Passing an empty platforms list is treated as no filter (returns all).

        The implementation uses `if platforms:` which is falsy for [],
        so it falls back to returning all configured platforms.
        """
        service = make_service()
        results = await service.build_profile_urls("alice", platforms=[])

        platforms_with_template = [
            p for p in get_all_platforms() if p.profile_url_template is not None
        ]
        assert len(results) == len(platforms_with_template)


# ---------------------------------------------------------------------------
# discover_aliases
# ---------------------------------------------------------------------------


class TestDiscoverAliases:
    """discover_aliases calls LM bridge and returns structured result."""

    @pytest.mark.asyncio
    async def test_returns_username_in_result(self):
        """Result dict always includes the queried username."""
        service = make_service()
        result = await service.discover_aliases("charlie")

        assert result["username"] == "charlie"

    @pytest.mark.asyncio
    async def test_returns_timestamp(self):
        """Result includes an ISO-format UTC timestamp."""
        service = make_service()
        result = await service.discover_aliases("charlie")

        ts = result["timestamp"]
        assert isinstance(ts, str)
        assert "T" in ts  # ISO format contains T separator

    @pytest.mark.asyncio
    async def test_returns_queries_from_bridge(self):
        """Queries returned by the LM bridge are forwarded in the result."""
        queries = [
            {"platform": "github", "query": "charlie site:github.com"},
            {"platform": "reddit", "query": "charlie site:reddit.com"},
        ]
        service = make_service(queries=queries)
        result = await service.discover_aliases("charlie")

        assert result["queries"] == queries

    @pytest.mark.asyncio
    async def test_platforms_searched_derived_from_queries(self):
        """platforms_searched is the sorted unique set of platforms in queries."""
        queries = [
            {"platform": "github", "query": "q1"},
            {"platform": "reddit", "query": "q2"},
            {"platform": "github", "query": "q3"},  # duplicate
        ]
        service = make_service(queries=queries)
        result = await service.discover_aliases("charlie")

        assert result["platforms_searched"] == ["github", "reddit"]

    @pytest.mark.asyncio
    async def test_platform_filter_removes_non_matching_queries(self):
        """When platforms filter given, queries for other platforms are removed."""
        queries = [
            {"platform": "github", "query": "q1"},
            {"platform": "reddit", "query": "q2"},
            {"platform": "twitter", "query": "q3"},
        ]
        service = make_service(queries=queries)
        result = await service.discover_aliases("charlie", platforms=["github"])

        assert len(result["queries"]) == 1
        assert result["queries"][0]["platform"] == "github"
        assert result["platforms_searched"] == ["github"]

    @pytest.mark.asyncio
    async def test_platform_filter_is_case_insensitive(self):
        """Platform filter matching is case-insensitive."""
        queries = [{"platform": "github", "query": "q1"}]
        service = make_service(queries=queries)
        result = await service.discover_aliases("charlie", platforms=["GitHub"])

        assert len(result["queries"]) == 1

    @pytest.mark.asyncio
    async def test_empty_bridge_result_returns_empty_queries(self):
        """If bridge returns no queries, result has empty lists."""
        service = make_service(queries=[])
        result = await service.discover_aliases("charlie")

        assert result["queries"] == []
        assert result["platforms_searched"] == []

    @pytest.mark.asyncio
    async def test_bridge_called_with_username(self):
        """LM bridge is called with the requested username."""
        service = make_service()
        await service.discover_aliases("dave")

        service.lm_bridge.generate_alias_discovery_queries.assert_called_once_with("dave")


# ---------------------------------------------------------------------------
# search_username
# ---------------------------------------------------------------------------


class TestSearchUsername:
    """search_username combines build_profile_urls + discover_aliases."""

    @pytest.mark.asyncio
    async def test_result_contains_username(self):
        """Result includes the queried username."""
        service = make_service()
        result = await service.search_username("eve")

        assert result["username"] == "eve"

    @pytest.mark.asyncio
    async def test_result_contains_profile_urls(self):
        """Result includes profile_urls list."""
        service = make_service()
        result = await service.search_username("eve")

        assert "profile_urls" in result
        assert isinstance(result["profile_urls"], list)
        assert len(result["profile_urls"]) > 0

    @pytest.mark.asyncio
    async def test_result_contains_search_queries(self):
        """Result includes search_queries from LM bridge."""
        queries = [{"platform": "github", "query": "eve site:github.com"}]
        service = make_service(queries=queries)
        result = await service.search_username("eve")

        assert result["search_queries"] == queries

    @pytest.mark.asyncio
    async def test_result_contains_platforms_searched(self):
        """Result includes platforms_searched derived from LM queries."""
        queries = [{"platform": "github", "query": "q"}]
        service = make_service(queries=queries)
        result = await service.search_username("eve")

        assert result["platforms_searched"] == ["github"]

    @pytest.mark.asyncio
    async def test_result_contains_timestamp(self):
        """Result includes an ISO timestamp."""
        service = make_service()
        result = await service.search_username("eve")

        assert "timestamp" in result
        assert "T" in result["timestamp"]

    @pytest.mark.asyncio
    async def test_profile_urls_contain_username(self):
        """All profile URLs embed the requested username."""
        service = make_service()
        result = await service.search_username("frank_osint")

        for item in result["profile_urls"]:
            assert "frank_osint" in item["url"]
