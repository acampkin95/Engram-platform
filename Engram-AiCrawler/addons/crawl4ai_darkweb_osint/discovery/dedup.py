"""
Result deduplication for dark web search.

Handles:
- URL normalization
- Title similarity matching
- Content fingerprinting
- Seen URL tracking
"""

import hashlib
import logging
import re
from dataclasses import dataclass
from typing import List, Set, Optional, Dict
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from crawl4ai_darkweb_osint.discovery.search import SearchResult

logger = logging.getLogger(__name__)


@dataclass
class DedupStats:
    """Statistics from deduplication."""

    total_input: int
    duplicates_found: int
    unique_output: int
    duplicate_sources: Dict[str, int]


def normalize_url(url: str) -> str:
    """
    Normalize a URL for comparison.

    - Lowercase scheme and netloc
    - Remove trailing slashes
    - Sort query parameters
    - Remove fragments
    - Remove common tracking parameters

    Args:
        url: URL to normalize

    Returns:
        Normalized URL string
    """
    try:
        parsed = urlparse(url.lower())

        # Remove tracking parameters
        tracking_params = {
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "ref",
            "referer",
            "source",
            "fbclid",
            "gclid",
            "msclkid",
        }

        # Parse and filter query params
        query_params = parse_qs(parsed.query)
        filtered_params = {
            k: v for k, v in query_params.items() if k.lower() not in tracking_params
        }

        # Sort and rebuild query
        sorted_query = urlencode(filtered_params, doseq=True)

        # Remove trailing slash from path
        path = parsed.path.rstrip("/")
        if not path:
            path = "/"

        # Rebuild URL without fragment
        normalized = urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                path,
                parsed.params,
                sorted_query,
                "",  # No fragment
            )
        )

        return normalized

    except Exception as e:
        logger.warning(f"URL normalization failed for {url}: {e}")
        return url.lower()


def compute_content_hash(title: str, description: str = "") -> str:
    """
    Compute a hash for content similarity detection.

    Args:
        title: Result title
        description: Result description

    Returns:
        SHA256 hash string
    """
    # Normalize content
    normalized_title = re.sub(r"\s+", " ", title.lower().strip())
    normalized_desc = re.sub(r"\s+", " ", description.lower().strip())[:200]

    content = f"{normalized_title}|{normalized_desc}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def compute_similarity(str1: str, str2: str) -> float:
    """
    Compute similarity between two strings using simple overlap.

    For more accurate similarity, consider using:
    - difflib.SequenceMatcher
    - Levenshtein distance
    - TF-IDF cosine similarity

    Args:
        str1: First string
        str2: Second string

    Returns:
        Similarity score (0-1)
    """
    # Tokenize
    words1 = set(re.findall(r"\w+", str1.lower()))
    words2 = set(re.findall(r"\w+", str2.lower()))

    if not words1 or not words2:
        return 0.0

    # Jaccard similarity
    intersection = len(words1 & words2)
    union = len(words1 | words2)

    return intersection / union if union > 0 else 0.0


def deduplicate_results(
    results: List[SearchResult],
    threshold: float = 0.85,
    use_content_hash: bool = True,
) -> tuple[List[SearchResult], DedupStats]:
    """
    Deduplicate search results.

    Args:
        results: List of search results
        threshold: Similarity threshold for fuzzy matching
        use_content_hash: Whether to use content hashing

    Returns:
        Tuple of (deduplicated results, deduplication stats)
    """
    if not results:
        return [], DedupStats(
            total_input=0,
            duplicates_found=0,
            unique_output=0,
            duplicate_sources={},
        )

    seen_urls: Set[str] = set()
    seen_hashes: Set[str] = set()
    seen_titles: List[str] = []

    unique_results: List[SearchResult] = []
    duplicate_sources: Dict[str, int] = {}

    for result in results:
        is_duplicate = False
        duplicate_reason = None

        # Check normalized URL
        normalized_url = normalize_url(result.url)
        if normalized_url in seen_urls:
            is_duplicate = True
            duplicate_reason = "url"
        else:
            seen_urls.add(normalized_url)

        # Check content hash
        if not is_duplicate and use_content_hash:
            content_hash = compute_content_hash(result.title, result.description)
            if content_hash in seen_hashes:
                is_duplicate = True
                duplicate_reason = "content"
            else:
                seen_hashes.add(content_hash)

        # Check title similarity (fuzzy)
        if not is_duplicate and threshold < 1.0:
            for seen_title in seen_titles:
                similarity = compute_similarity(result.title, seen_title)
                if similarity >= threshold:
                    is_duplicate = True
                    duplicate_reason = "title_similarity"
                    break

        if is_duplicate:
            # Track duplicate source
            if duplicate_reason:
                duplicate_sources[duplicate_reason] = (
                    duplicate_sources.get(duplicate_reason, 0) + 1
                )
        else:
            unique_results.append(result)
            seen_titles.append(result.title)

    stats = DedupStats(
        total_input=len(results),
        duplicates_found=len(results) - len(unique_results),
        unique_output=len(unique_results),
        duplicate_sources=duplicate_sources,
    )

    return unique_results, stats


class SeenURLTracker:
    """
    Persistent tracker for seen URLs across sessions.

    Useful for incremental crawling.
    """

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path
        self._seen: Set[str] = set()
        self._loaded = False

    def _ensure_loaded(self):
        """Load seen URLs from storage."""
        if self._loaded or not self.storage_path:
            return

        try:
            import json
            from pathlib import Path

            path = Path(self.storage_path)
            if path.exists():
                with open(path) as f:
                    data = json.load(f)
                    self._seen = set(data.get("urls", []))
        except Exception as e:
            logger.warning(f"Failed to load seen URLs: {e}")

        self._loaded = True

    def is_seen(self, url: str) -> bool:
        """Check if URL has been seen."""
        self._ensure_loaded()
        return normalize_url(url) in self._seen

    def mark_seen(self, url: str):
        """Mark URL as seen."""
        self._ensure_loaded()
        self._seen.add(normalize_url(url))

    def save(self):
        """Save seen URLs to storage."""
        if not self.storage_path:
            return

        try:
            import json
            from pathlib import Path

            path = Path(self.storage_path)
            path.parent.mkdir(parents=True, exist_ok=True)

            with open(path, "w") as f:
                json.dump({"urls": list(self._seen)}, f)

        except Exception as e:
            logger.error(f"Failed to save seen URLs: {e}")

    def clear(self):
        """Clear all seen URLs."""
        self._seen.clear()


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="URL deduplication utilities")
    parser.add_argument("--normalize", help="Normalize a URL")
    parser.add_argument(
        "--hash", nargs=2, metavar=("TITLE", "DESC"), help="Compute content hash"
    )

    args = parser.parse_args()

    if args.normalize:
        print(f"Original:  {args.normalize}")
        print(f"Normalized: {normalize_url(args.normalize)}")

    elif args.hash:
        title, desc = args.hash
        print(f"Hash: {compute_content_hash(title, desc)}")

    else:
        parser.print_help()
