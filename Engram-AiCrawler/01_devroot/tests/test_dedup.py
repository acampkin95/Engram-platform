"""Tests for DeduplicationEngine (URL Bloom filter deduplication).

Tests cover:
- URL seen/not seen tracking
- Check without adding
- Add without checking
- URL normalization (case, query params, fragments, trailing slashes)
- Reset clears filter
- url_count property
- Singleton pattern
"""

import pytest

from app.services.dedup import (
    DeduplicationEngine,
    close_dedup_engine,
    get_dedup_engine,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def engine():
    """Fresh DeduplicationEngine for each test."""
    return DeduplicationEngine(expected_urls=1000, false_positive_rate=0.001)


# ---------------------------------------------------------------------------
# is_url_seen — check-and-add
# ---------------------------------------------------------------------------


class TestIsUrlSeen:
    def test_new_url_returns_false(self, engine):
        result = engine.is_url_seen("https://example.com/page")
        assert result is False

    def test_seen_url_returns_true(self, engine):
        engine.is_url_seen("https://example.com/page")
        result = engine.is_url_seen("https://example.com/page")
        assert result is True

    def test_different_urls_are_independent(self, engine):
        engine.is_url_seen("https://example.com/a")
        result = engine.is_url_seen("https://example.com/b")
        assert result is False

    def test_url_count_increments_on_new_url(self, engine):
        assert engine.url_count == 0
        engine.is_url_seen("https://example.com/1")
        assert engine.url_count == 1
        engine.is_url_seen("https://example.com/2")
        assert engine.url_count == 2

    def test_url_count_does_not_increment_on_duplicate(self, engine):
        engine.is_url_seen("https://example.com/page")
        engine.is_url_seen("https://example.com/page")
        assert engine.url_count == 1

    def test_normalized_duplicates_detected(self, engine):
        # Same URL, different case in scheme/host
        engine.is_url_seen("https://Example.COM/page")
        result = engine.is_url_seen("https://example.com/page")
        assert result is True

    def test_fragment_stripped_so_same_page_detected(self, engine):
        engine.is_url_seen("https://example.com/page#section1")
        result = engine.is_url_seen("https://example.com/page#section2")
        assert result is True

    def test_sorted_query_params_detected_as_same(self, engine):
        engine.is_url_seen("https://example.com/search?b=2&a=1")
        result = engine.is_url_seen("https://example.com/search?a=1&b=2")
        assert result is True

    def test_trailing_slash_stripped(self, engine):
        engine.is_url_seen("https://example.com/path/")
        result = engine.is_url_seen("https://example.com/path")
        assert result is True


# ---------------------------------------------------------------------------
# check_url — read-only membership test
# ---------------------------------------------------------------------------


class TestCheckUrl:
    def test_unknown_url_returns_false(self, engine):
        result = engine.check_url("https://example.com/new")
        assert result is False

    def test_does_not_add_to_filter(self, engine):
        engine.check_url("https://example.com/page")
        assert engine.url_count == 0

    def test_returns_true_after_is_url_seen_adds_it(self, engine):
        engine.is_url_seen("https://example.com/page")
        result = engine.check_url("https://example.com/page")
        assert result is True


# ---------------------------------------------------------------------------
# add_url — add without checking
# ---------------------------------------------------------------------------


class TestAddUrl:
    def test_increments_count(self, engine):
        engine.add_url("https://example.com/page")
        assert engine.url_count == 1

    def test_duplicate_add_does_not_increment_count(self, engine):
        engine.add_url("https://example.com/page")
        engine.add_url("https://example.com/page")
        assert engine.url_count == 1

    def test_is_url_seen_detects_added_url(self, engine):
        engine.add_url("https://example.com/page")
        result = engine.is_url_seen("https://example.com/page")
        assert result is True


# ---------------------------------------------------------------------------
# reset
# ---------------------------------------------------------------------------


class TestReset:
    def test_reset_clears_filter(self, engine):
        engine.is_url_seen("https://example.com/page")
        engine.reset()
        result = engine.is_url_seen("https://example.com/page")
        assert result is False

    def test_reset_clears_count(self, engine):
        engine.is_url_seen("https://example.com/page")
        engine.reset()
        assert engine.url_count == 0

    def test_can_add_after_reset(self, engine):
        engine.is_url_seen("https://example.com/a")
        engine.reset()
        engine.is_url_seen("https://example.com/b")
        assert engine.url_count == 1


# ---------------------------------------------------------------------------
# URL normalization edge cases
# ---------------------------------------------------------------------------


class TestNormalizeUrl:
    def test_empty_path_becomes_slash(self, engine):
        # Both should normalize to same
        engine.is_url_seen("https://example.com")
        result = engine.check_url("https://example.com/")
        # Trailing slash stripped → / → same
        assert result is True

    def test_multiple_query_values_sorted(self, engine):
        engine.is_url_seen("https://example.com/?c=3&a=1&b=2")
        result = engine.is_url_seen("https://example.com/?a=1&b=2&c=3")
        assert result is True

    def test_query_string_preserved_when_different(self, engine):
        engine.is_url_seen("https://example.com/search?q=foo")
        result = engine.is_url_seen("https://example.com/search?q=bar")
        assert result is False

    def test_normalize_url_static_method(self):
        norm = DeduplicationEngine._normalize_url("https://EXAMPLE.COM/Path/?b=2&a=1#frag")
        assert "example.com" in norm
        assert "#frag" not in norm
        # Query params sorted
        assert norm.index("a=1") < norm.index("b=2")


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------


class TestSingleton:
    def setup_method(self):
        close_dedup_engine()

    def teardown_method(self):
        close_dedup_engine()

    def test_get_dedup_engine_returns_instance(self):
        eng = get_dedup_engine()
        assert isinstance(eng, DeduplicationEngine)

    def test_get_dedup_engine_returns_same_instance(self):
        eng1 = get_dedup_engine()
        eng2 = get_dedup_engine()
        assert eng1 is eng2

    def test_close_dedup_engine_resets_singleton(self):
        eng1 = get_dedup_engine()
        close_dedup_engine()
        eng2 = get_dedup_engine()
        assert eng1 is not eng2
