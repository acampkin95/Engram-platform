"""Social Media Platform Adapters.

Adapters for social media and professional networks. Anti-bot levels vary widely:

- GitHub: Low protection, has structured HTML, yields emails + repos + bio
- Reddit: Low protection, JSON API available, yields username + post history
- LinkedIn: Very high protection, requires login — we use Google cache as proxy
- Twitter/X: Very high protection — we try Nitter mirrors + Google dork fallback

Strategy for high-protection platforms:
1. Try direct crawl with stealth settings
2. Fall back to Google-cached version: cache:https://platform.com/...
3. Fall back to Google dork: site:platform.com "query"
4. If all fail, return empty result (don't block the pipeline)
"""

from __future__ import annotations

import logging
import re
from urllib.parse import quote_plus

from app.osint.platforms.base import PlatformCrawlerBase, PlatformCrawlResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# GitHub adapter
# ---------------------------------------------------------------------------


class GitHubCrawler(PlatformCrawlerBase):
    """GitHub user search adapter.

    GitHub's search is accessible without login and returns structured HTML.
    Yields: display name, username, email (if public), bio, location, repos.

    Also fetches the profile page for the top result to get full details.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        url = f"https://github.com/search?q={quote_plus(query)}&type=users"
        raw = await self._crawl(url, wait_for_selector=".user-list-item")
        result = self._make_result(query, url, raw)

        if result.success and result.markdown:
            result.usernames = _extract_github_usernames(result.markdown)
            result.names = _extract_display_names(result.markdown)
            result.emails = _extract_emails_from_text(result.markdown)
            result.profile_urls = [f"https://github.com/{u}" for u in result.usernames[:5]]

        return result

    async def get_profile(self, username: str) -> PlatformCrawlResult:
        """Fetch a specific GitHub profile page for full details."""
        url = f"https://github.com/{username}"
        raw = await self._crawl(url)
        result = self._make_result(username, url, raw)

        if result.success and result.markdown:
            result.usernames = [username]
            result.names = _extract_display_names(result.markdown)
            result.emails = _extract_emails_from_text(result.markdown)
            # Extract location
            loc_match = re.search(
                r"(?:location|lives? in)[:\s]+([A-Z][^\n|.]{3,50})", result.markdown, re.IGNORECASE
            )
            if loc_match:
                result.addresses = [loc_match.group(1).strip()]

        return result


# ---------------------------------------------------------------------------
# Reddit adapter
# ---------------------------------------------------------------------------


class RedditCrawler(PlatformCrawlerBase):
    """Reddit user search adapter.

    Reddit's old.reddit.com is accessible without JS. We also try the
    JSON API endpoint for structured data.

    Yields: usernames, post/comment history snippets, communities.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        # Use old.reddit search — more accessible
        url = f"https://www.reddit.com/search/?q={quote_plus(query)}&type=user"
        raw = await self._crawl(url)
        result = self._make_result(query, url, raw)

        if result.success and result.markdown:
            result.usernames = _extract_reddit_usernames(result.markdown)
            result.profile_urls = [
                f"https://www.reddit.com/user/{u}" for u in result.usernames[:10]
            ]

        return result

    async def get_profile(self, username: str) -> PlatformCrawlResult:
        """Fetch a Reddit profile via the JSON API (no auth required for public profiles)."""
        # JSON endpoint is very accessible
        url = f"https://www.reddit.com/user/{username}/about.json"
        raw = await self._crawl(url)
        result = self._make_result(username, url, raw)

        if result.success and result.markdown:
            result.usernames = [username]
            # Extract karma / account age from JSON markdown
            # Enrichment pipeline will process the full text

        return result


# ---------------------------------------------------------------------------
# LinkedIn adapter (fallback strategy)
# ---------------------------------------------------------------------------


class LinkedInCrawler(PlatformCrawlerBase):
    """LinkedIn adapter with multi-level fallback strategy.

    LinkedIn aggressively blocks scrapers. Our approach:
    1. Try Google's index: site:linkedin.com/in "query"
    2. Try Google cache of a known profile URL
    3. Return partial results from whatever we get

    NOTE: Direct LinkedIn crawls will almost always hit login walls.
    The Google-dork approach yields name, title, company, and location
    from the search snippet without needing to log in.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        # Strategy 1: Google dork for LinkedIn profiles
        dork_url = (
            f"https://www.google.com/search?q=site:linkedin.com/in+" f"{quote_plus(query)}&num=10"
        )
        raw = await self._crawl(dork_url, wait_for_selector="#search")
        result = self._make_result(query, dork_url, raw)

        if result.success and result.markdown:
            result.names = _extract_display_names(result.markdown)
            result.profile_urls = _extract_linkedin_profile_urls(result.markdown)
            # Extract titles/companies from Google snippets
            result.relationships = _extract_linkedin_snippets(result.markdown)

        return result


# ---------------------------------------------------------------------------
# Twitter/X adapter (fallback strategy)
# ---------------------------------------------------------------------------


class TwitterCrawler(PlatformCrawlerBase):
    """Twitter/X adapter with Nitter mirror + Google dork fallback.

    Twitter requires login for most searches since 2023. Strategy:
    1. Try Nitter public mirrors (no login required)
    2. Fall back to Google dork: site:twitter.com OR site:x.com "query"
    """

    # Nitter mirrors (rotated for availability)
    _NITTER_MIRRORS = [
        "https://nitter.privacydev.net",
        "https://nitter.poast.org",
        "https://nitter.1d4.us",
    ]

    async def search(self, query: str) -> PlatformCrawlResult:
        import random

        # Try Nitter first
        mirror = random.choice(self._NITTER_MIRRORS)
        nitter_url = f"{mirror}/search?q={quote_plus(query)}&f=users"

        raw = await self._crawl(nitter_url)
        if raw.get("success") and raw.get("markdown"):
            result = self._make_result(query, nitter_url, raw)
            result.usernames = _extract_twitter_usernames(result.markdown or "")
            result.names = _extract_display_names(result.markdown or "")
            result.profile_urls = [f"https://x.com/{u}" for u in result.usernames[:10]]
            return result

        # Fallback: Google dork
        dork_url = (
            f"https://www.google.com/search?q="
            f"(site:twitter.com+OR+site:x.com)+{quote_plus(query)}&num=10"
        )
        raw = await self._crawl(dork_url, wait_for_selector="#search")
        result = self._make_result(query, dork_url, raw)

        if result.success and result.markdown:
            result.usernames = _extract_twitter_usernames(result.markdown)
            result.names = _extract_display_names(result.markdown)

        return result

    async def get_profile(self, username: str) -> PlatformCrawlResult:
        """Fetch a profile via Nitter."""
        import random

        mirror = random.choice(self._NITTER_MIRRORS)
        url = f"{mirror}/{username}"
        raw = await self._crawl(url)
        result = self._make_result(username, url, raw)

        if result.success and result.markdown:
            result.usernames = [username]
            result.names = _extract_display_names(result.markdown)
            result.image_urls = _extract_image_urls(result.markdown)

        return result


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------


def _extract_emails_from_text(text: str) -> list[str]:
    return list(
        set(
            re.findall(
                r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
                text,
            )
        )
    )


def _extract_display_names(text: str) -> list[str]:
    """Extract properly-cased full names (First Last) from markdown."""
    # Match Title Case sequences of 2-4 words
    pattern = re.compile(r"\b([A-Z][a-z]{1,20}(?:\s[A-Z][a-z]{1,20}){1,3})\b")
    candidates = pattern.findall(text)
    # Filter out common non-name patterns
    stopwords = {
        "The University",
        "New York",
        "San Francisco",
        "Los Angeles",
        "United States",
        "United Kingdom",
        "View Profile",
        "More Results",
        "Search Results",
        "Next Page",
    }
    return list({n for n in candidates if n not in stopwords and len(n.split()) >= 2})[:20]


def _extract_github_usernames(text: str) -> list[str]:
    pattern = re.compile(r"github\.com/([A-Za-z0-9\-]{1,39})(?:/|$|\s)", re.IGNORECASE)
    return list(set(pattern.findall(text)))


def _extract_reddit_usernames(text: str) -> list[str]:
    pattern = re.compile(r"(?:reddit\.com/user/|u/)([A-Za-z0-9_\-]{3,20})", re.IGNORECASE)
    return list(set(pattern.findall(text)))


def _extract_twitter_usernames(text: str) -> list[str]:
    # @handle or twitter.com/handle or x.com/handle
    pattern = re.compile(
        r"(?:twitter\.com/|x\.com/|@)([A-Za-z0-9_]{1,50})",
        re.IGNORECASE,
    )
    found = pattern.findall(text)
    # Filter out common non-user paths
    ignore = {"home", "search", "explore", "login", "signup", "i", "settings", "notifications"}
    return list({u for u in found if u.lower() not in ignore})


def _extract_linkedin_profile_urls(text: str) -> list[str]:
    pattern = re.compile(r"linkedin\.com/in/([A-Za-z0-9\-]{3,100})", re.IGNORECASE)
    slugs = pattern.findall(text)
    return [f"https://linkedin.com/in/{s}" for s in set(slugs)]


def _extract_linkedin_snippets(text: str) -> list[dict[str, str]]:
    """Extract title + company from Google snippet text about LinkedIn profiles."""
    relationships = []
    # Pattern: "Name · Title at Company"
    pattern = re.compile(
        r"([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s*[·\-|]\s*([^\n·\-|]{5,80})",
    )
    for match in pattern.finditer(text):
        name, detail = match.group(1).strip(), match.group(2).strip()
        if name and detail:
            relationships.append(
                {
                    "name": name,
                    "relation": "linkedin_profile",
                    "detail": detail,
                    "confidence": "0.5",
                }
            )
    return relationships[:10]


def _extract_image_urls(text: str) -> list[str]:
    pattern = re.compile(
        r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:jpg|jpeg|png|gif|webp)',
        re.IGNORECASE,
    )
    return list(set(pattern.findall(text)))
