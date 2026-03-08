"""URL deduplication engine using Bloom filters.

Provides O(1) probabilistic URL membership testing to prevent
re-crawling of already-seen URLs.

Architecture Decision: ADR-001 Section 11 — Phase 1 (Bloom filter only)
Phase 2 will add MinHash/LSH content deduplication via datasketch.
"""


from __future__ import annotations
import logging
from urllib.parse import parse_qs, urlencode, urlparse

from pybloom_live import BloomFilter

logger = logging.getLogger(__name__)


class DeduplicationEngine:
    """URL deduplication via Bloom filter.

    Uses a probabilistic Bloom filter for O(1) URL membership testing.
    False positive rate is configurable (default 0.1%); false negatives
    are impossible.

    Phase 1 scope: URL-level dedup only.
    Phase 2 will add content-level near-duplicate detection (MinHash/LSH).

    Usage::

        engine = DeduplicationEngine()
        if not engine.is_url_seen("https://example.com"):
            # URL is new — proceed with crawling
            ...
    """

    def __init__(
        self,
        expected_urls: int = 1_000_000,
        false_positive_rate: float = 0.001,
    ):
        """Initialize the deduplication engine.

        Args:
            expected_urls: Expected number of unique URLs (affects memory).
                At 1M URLs with 0.1% FP rate, the filter uses ~1.2 MB.
            false_positive_rate: Acceptable false positive rate (default 0.1%).
        """
        self._expected_urls = expected_urls
        self._false_positive_rate = false_positive_rate
        self.url_bloom = BloomFilter(
            capacity=expected_urls,
            error_rate=false_positive_rate,
        )
        self._url_count = 0
        logger.info(
            f"DeduplicationEngine initialized "
            f"(capacity={expected_urls:,}, fp_rate={false_positive_rate})"
        )

    @property
    def url_count(self) -> int:
        """Number of unique URLs added to the Bloom filter."""
        return self._url_count

    def is_url_seen(self, url: str) -> bool:
        """Check if a URL has been seen before; add it if not.

        This is the primary API: check-and-add in one atomic operation.

        Args:
            url: URL to check (will be normalized before checking).

        Returns:
            True if the URL was already seen (or is a false positive),
            False if the URL is new (and has been added to the filter).
        """
        normalized = self._normalize_url(url)
        if normalized in self.url_bloom:
            logger.debug(f"URL already seen: {url}")
            return True
        self.url_bloom.add(normalized)
        self._url_count += 1
        return False

    def check_url(self, url: str) -> bool:
        """Check URL membership WITHOUT adding it to the filter.

        Args:
            url: URL to check.

        Returns:
            True if the URL is probably in the filter.
        """
        normalized = self._normalize_url(url)
        return normalized in self.url_bloom

    def add_url(self, url: str) -> None:
        """Add a URL to the filter without checking first.

        Args:
            url: URL to add (will be normalized).
        """
        normalized = self._normalize_url(url)
        if normalized not in self.url_bloom:
            self.url_bloom.add(normalized)
            self._url_count += 1

    def reset(self) -> None:
        """Reset the Bloom filter (clears all stored URLs).

        Creates a new filter with the same capacity and error rate
        parameters as the original.
        """
        self.url_bloom = BloomFilter(
            capacity=self._expected_urls,
            error_rate=self._false_positive_rate,
        )
        self._url_count = 0
        logger.info("DeduplicationEngine reset")

    @staticmethod
    def _normalize_url(url: str) -> str:
        """Normalize a URL for consistent comparison.

        Normalization steps:
            - Lowercase scheme and netloc
            - Sort query parameters alphabetically
            - Strip URL fragments (#...)
            - Strip trailing slashes from path
            - Collapse empty path to "/"

        Args:
            url: Raw URL string.

        Returns:
            Normalized URL string.
        """
        parsed = urlparse(url.lower())

        # Sort query parameters for consistent ordering
        if parsed.query:
            params = parse_qs(parsed.query)
            sorted_params = sorted((k, sorted(v)) for k, v in params.items())
            query_str = urlencode(sorted_params, doseq=True)
        else:
            query_str = ""

        # Rebuild URL without fragment, with sorted params
        path = parsed.path.rstrip("/") or "/"
        normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
        if query_str:
            normalized += f"?{query_str}"

        return normalized


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_dedup_engine: DeduplicationEngine | None = None


def get_dedup_engine(
    expected_urls: int = 1_000_000,
    false_positive_rate: float = 0.001,
) -> DeduplicationEngine:
    """Get the global DeduplicationEngine singleton.

    Args:
        expected_urls: Passed to constructor on first call only.
        false_positive_rate: Passed to constructor on first call only.
    """
    global _dedup_engine
    if _dedup_engine is None:
        _dedup_engine = DeduplicationEngine(
            expected_urls=expected_urls,
            false_positive_rate=false_positive_rate,
        )
    return _dedup_engine


def close_dedup_engine() -> None:
    """Reset the global DeduplicationEngine singleton."""
    global _dedup_engine
    _dedup_engine = None
