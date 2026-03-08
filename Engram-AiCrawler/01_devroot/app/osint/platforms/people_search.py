"""People Search Platform Adapters.

Custom adapters for people-search sites that are accessible without login.
These sites are the primary source for:
- Full name + aliases
- Phone numbers (cell + landline)
- Current and historical addresses
- Associated household members / relatives

Anti-bot posture: TruePeopleSearch and FastPeopleSearch are relatively open
(no JS required). WhitePages uses JS and has stronger bot detection.

Each adapter:
1. Builds the search URL from the query
2. Crawls with appropriate settings
3. Does a targeted CSS/regex extraction pass on top of the raw markdown
4. Returns a PlatformCrawlResult with pre-filled structured fields
   (the enrichment pipeline will do a second LLM pass if enabled)
"""

from __future__ import annotations

import logging
import re

from app.osint.platforms.base import PlatformCrawlerBase, PlatformCrawlResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared extraction helpers
# ---------------------------------------------------------------------------

_PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}")

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")

_US_ZIP_RE = re.compile(r"\b\d{5}(?:-\d{4})?\b")

# Matches lines that look like "Name, Age XX" or "Name · Age XX"
_NAME_AGE_RE = re.compile(
    r"([A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+)[\s,·]+(?:Age\s*)?(\d{2,3})",
    re.MULTILINE,
)

# "lives in" / "from" address patterns in markdown
_LIVES_IN_RE = re.compile(
    r"(?:lives? in|from|located in|residing in|address(?:ed)? at)[:\s]+([A-Z][^.|\n]{5,80})",
    re.IGNORECASE,
)


def _extract_phones(text: str) -> list[str]:
    return list(set(_PHONE_RE.findall(text)))


def _extract_emails(text: str) -> list[str]:
    return list(set(_EMAIL_RE.findall(text)))


def _extract_names_from_markdown(text: str) -> list[str]:
    """Extract properly-cased full names from markdown."""
    matches = _NAME_AGE_RE.findall(text)
    return list({m[0] for m in matches if len(m[0].split()) >= 2})


def _extract_addresses(text: str) -> list[str]:
    """Extract city/state or full addresses from text."""
    # Simple pattern: "City, ST ZIP" or "City, State"
    addr_pattern = re.compile(
        r"([A-Z][a-zA-Z\s]{2,30}),\s*([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?",
        re.MULTILINE,
    )
    raw = addr_pattern.findall(text)
    results = []
    for city, state in raw:
        city = city.strip()
        if len(city) > 2 and city.lower() not in {"street", "avenue", "drive", "road"}:
            results.append(f"{city}, {state}")
    return list(set(results))


# ---------------------------------------------------------------------------
# TruePeopleSearch adapter
# ---------------------------------------------------------------------------


class TruePeopleSearchCrawler(PlatformCrawlerBase):
    """Adapter for TruePeopleSearch.com — the most accessible people-search site.

    Static HTML, no login required, yields: names, phones, addresses, relatives.
    URL pattern: https://www.truepeoplesearch.com/results?name=John+Doe
    For phone: https://www.truepeoplesearch.com/results?phoneno=5551234567
    """

    async def search(self, query: str, search_type: str = "name") -> PlatformCrawlResult:
        """Search TruePeopleSearch.

        Args:
            query: The search query (name, phone number, or address)
            search_type: "name", "phone", or "address"
        """
        if search_type == "phone":
            digits = "".join(c for c in query if c.isdigit())
            url = f"https://www.truepeoplesearch.com/results?phoneno={digits}"
        elif search_type == "address":
            from urllib.parse import quote_plus

            url = f"https://www.truepeoplesearch.com/results?streetaddress={quote_plus(query)}"
        else:
            url = self.platform.build_search_url(query)

        raw = await self._crawl(url, wait_for_selector=".card-summary")
        result = self._make_result(query, url, raw)

        if result.success and result.markdown:
            result.names = _extract_names_from_markdown(result.markdown)
            result.phones = _extract_phones(result.markdown)
            result.addresses = _extract_addresses(result.markdown)
            result.emails = _extract_emails(result.markdown)
            # Extract relative names from "Also known as" / "Relatives" sections
            result.relationships = _extract_relatives(result.markdown)

        return result

    async def search_by_phone(self, phone: str) -> PlatformCrawlResult:
        return await self.search(phone, search_type="phone")

    async def search_by_address(self, address: str) -> PlatformCrawlResult:
        return await self.search(address, search_type="address")


# ---------------------------------------------------------------------------
# FastPeopleSearch adapter
# ---------------------------------------------------------------------------


class FastPeopleSearchCrawler(PlatformCrawlerBase):
    """Adapter for FastPeopleSearch.com — another low-friction people search.

    Static HTML, no login, yields: names, phones, addresses.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        url = self.platform.build_search_url(query)
        raw = await self._crawl(url)
        result = self._make_result(query, url, raw)

        if result.success and result.markdown:
            result.names = _extract_names_from_markdown(result.markdown)
            result.phones = _extract_phones(result.markdown)
            result.addresses = _extract_addresses(result.markdown)

        return result


# ---------------------------------------------------------------------------
# WhitePages adapter
# ---------------------------------------------------------------------------


class WhitePagesCrawler(PlatformCrawlerBase):
    """Adapter for WhitePages.com — higher quality but requires JS + is anti-bot heavy.

    Yields: names, phones, addresses.
    Strategy: Use JS rendering with a realistic user agent; accept partial results.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        # WhitePages uses path-based search, not query param
        from urllib.parse import quote

        # "John Doe" → "John-Doe"
        path_query = "-".join(query.split())
        url = f"https://www.whitepages.com/name/{quote(path_query)}"

        raw = await self._crawl(
            url,
            wait_for_selector=".card",
            js_code=_WHITEPAGES_SCROLL_JS,
        )
        result = self._make_result(query, url, raw)

        if result.success and result.markdown:
            result.names = _extract_names_from_markdown(result.markdown)
            result.phones = _extract_phones(result.markdown)
            result.addresses = _extract_addresses(result.markdown)

        return result


# Scroll down to trigger lazy loading on WhitePages
_WHITEPAGES_SCROLL_JS = """
window.scrollTo(0, document.body.scrollHeight / 2);
await new Promise(r => setTimeout(r, 1500));
window.scrollTo(0, document.body.scrollHeight);
"""


# ---------------------------------------------------------------------------
# EmailRep adapter
# ---------------------------------------------------------------------------


class EmailRepCrawler(PlatformCrawlerBase):
    """Adapter for EmailRep.io — returns reputation and linked profiles for an email.

    JSON API response (no JS needed). Yields: names, linked social profiles.
    """

    async def search(self, query: str) -> PlatformCrawlResult:
        # EmailRep uses the email as the path
        url = f"https://emailrep.io/{query}"
        raw = await self._crawl(url)
        result = self._make_result(query, url, raw)

        if result.success and result.markdown:
            result.emails = [query] if "@" in query else []
            # Parse profile links from the JSON-like markdown
            profile_pattern = re.compile(
                r'(?:twitter|linkedin|facebook|instagram|github)\.com/[^\s"\']+',
                re.IGNORECASE,
            )
            result.profile_urls = list(set(profile_pattern.findall(result.markdown)))

        return result


# ---------------------------------------------------------------------------
# Shared extraction helpers (relationships / relatives)
# ---------------------------------------------------------------------------


def _extract_relatives(text: str) -> list[dict[str, str]]:
    """Extract relative names from people-search result pages."""
    relationships = []

    # Patterns like: "Relatives: Jane Doe, Bob Smith"
    rel_section = re.search(
        r"(?:Relatives?|Also known as|Associated with)[:\s]+([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if rel_section:
        names_raw = rel_section.group(1)
        # Split on commas or pipe
        for raw_name in re.split(r"[,|]", names_raw):
            name = raw_name.strip()
            if len(name.split()) >= 2 and name[0].isupper():
                relationships.append(
                    {
                        "name": name,
                        "relation": "relative",
                        "confidence": "0.6",
                    }
                )

    return relationships
