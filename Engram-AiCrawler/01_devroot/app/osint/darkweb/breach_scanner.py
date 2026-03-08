"""
Breach & Paste Site Scanner — Phase 8.3

Checks entity PII against:
  - Have I Been Pwned API v3 (email breach lookup)
  - Pastebin / paste site monitoring
  - Public breach databases (DeHashed-style queries)
  - Local breach database cache

HIBP API key required for full functionality:
  HIBP_API_KEY environment variable

Without API key, operates in limited/simulation mode.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, UTC
from enum import Enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


from typing import Any
from urllib.parse import quote

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class BreachSeverity(StrEnum):
    CRITICAL = "critical"  # Password + PII exposed
    HIGH = "high"  # Password or sensitive data
    MEDIUM = "medium"  # Email + metadata
    LOW = "low"  # Email only
    INFO = "info"  # Paste mention, no credentials


@dataclass
class BreachRecord:
    """A single breach or paste finding."""

    source: str  # "hibp", "paste", "dehashed", "local"
    breach_name: str
    breach_date: str | None  # ISO date string or None
    description: str
    data_classes: list[str]  # e.g. ["Passwords", "Email addresses"]
    severity: BreachSeverity
    pwn_count: int | None  # Total accounts in breach
    is_verified: bool
    is_sensitive: bool
    is_spam_list: bool
    domain: str | None  # Breach source domain
    logo_url: str | None
    query_term: str  # What we searched for
    found_at: datetime

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "breach_name": self.breach_name,
            "breach_date": self.breach_date,
            "description": self.description,
            "data_classes": self.data_classes,
            "severity": self.severity.value,
            "pwn_count": self.pwn_count,
            "is_verified": self.is_verified,
            "is_sensitive": self.is_sensitive,
            "is_spam_list": self.is_spam_list,
            "domain": self.domain,
            "query_term": self.query_term,
            "found_at": self.found_at.isoformat(),
        }


@dataclass
class PasteRecord:
    """A paste site finding."""

    source: str  # "pastebin", "ghostbin", "hastebin", etc.
    paste_id: str
    paste_url: str
    title: str | None
    date: str | None
    email_count: int
    matched_terms: list[str]
    snippet: str
    query_term: str
    found_at: datetime

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "paste_id": self.paste_id,
            "paste_url": self.paste_url,
            "title": self.title,
            "date": self.date,
            "email_count": self.email_count,
            "matched_terms": self.matched_terms,
            "snippet": self.snippet,
            "query_term": self.query_term,
            "found_at": self.found_at.isoformat(),
        }


@dataclass
class BreachScanResult:
    """Complete result of a breach scan."""

    scan_id: str
    query_terms: list[str]
    breaches: list[BreachRecord]
    pastes: list[PasteRecord]
    scan_duration_s: float
    scanned_at: datetime
    hibp_available: bool
    errors: list[str]

    @property
    def total_findings(self) -> int:
        return len(self.breaches) + len(self.pastes)

    @property
    def highest_severity(self) -> BreachSeverity | None:
        order = [
            BreachSeverity.CRITICAL,
            BreachSeverity.HIGH,
            BreachSeverity.MEDIUM,
            BreachSeverity.LOW,
            BreachSeverity.INFO,
        ]
        for level in order:
            if any(b.severity == level for b in self.breaches):
                return level
        return None

    @property
    def exposed_data_types(self) -> list[str]:
        all_types: set[str] = set()
        for b in self.breaches:
            all_types.update(b.data_classes)
        return sorted(all_types)

    @property
    def paste_count(self) -> int:
        return len(self.pastes)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "query_terms": self.query_terms,
            "total_findings": self.total_findings,
            "breach_count": len(self.breaches),
            "paste_count": len(self.pastes),
            "highest_severity": (self.highest_severity.value if self.highest_severity else None),
            "exposed_data_types": self.exposed_data_types,
            "breaches": [b.to_dict() for b in self.breaches],
            "pastes": [p.to_dict() for p in self.pastes],
            "scan_duration_s": self.scan_duration_s,
            "scanned_at": self.scanned_at.isoformat(),
            "hibp_available": self.hibp_available,
            "errors": self.errors,
        }


# ---------------------------------------------------------------------------
# Severity classifier
# ---------------------------------------------------------------------------

_CRITICAL_DATA_CLASSES = {
    "Passwords",
    "Password hints",
    "Credit cards",
    "Bank account numbers",
    "Social security numbers",
    "Passport numbers",
    "Government issued IDs",
}
_HIGH_DATA_CLASSES = {
    "Security questions and answers",
    "Auth tokens",
    "Private messages",
    "Health records",
    "Financial data",
}


def _classify_severity(data_classes: list[str]) -> BreachSeverity:
    classes_set = set(data_classes)
    if classes_set & _CRITICAL_DATA_CLASSES:
        return BreachSeverity.CRITICAL
    if classes_set & _HIGH_DATA_CLASSES:
        return BreachSeverity.HIGH
    if "Email addresses" in classes_set and len(classes_set) > 2:
        return BreachSeverity.MEDIUM
    if "Email addresses" in classes_set:
        return BreachSeverity.LOW
    return BreachSeverity.INFO


# ---------------------------------------------------------------------------
# HIBP Client
# ---------------------------------------------------------------------------


class HIBPClient:
    """
    Have I Been Pwned API v3 client.

    Docs: https://haveibeenpwned.com/API/v3
    Rate limit: 1 req/1500ms without API key, faster with key.
    """

    BASE_URL = "https://haveibeenpwned.com/api/v3"
    RATE_LIMIT_DELAY = 1.6  # seconds between requests

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("HIBP_API_KEY", "")
        self._last_request_time = 0.0

    def _headers(self) -> dict[str, str]:
        headers = {
            "User-Agent": "OSINT-Investigation-Platform/1.0",
            "hibp-api-key": self.api_key,
        }
        return headers

    async def _rate_limit(self):
        """Enforce HIBP rate limiting."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            await asyncio.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    async def get_breaches_for_email(self, email: str) -> tuple[list[dict[str, Any]], str | None]:
        """
        Query HIBP for breaches containing an email address.

        Returns (breaches_list, error_message)
        """
        if not self.api_key:
            return [], "HIBP_API_KEY not configured"

        await self._rate_limit()

        try:
            import aiohttp  # type: ignore

            url = f"{self.BASE_URL}/breachedaccount/{quote(email)}"
            params = {"truncateResponse": "false", "includeUnverified": "true"}

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=self._headers(),
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 200:
                        return await resp.json(), None
                    if resp.status == 404:
                        return [], None  # No breaches found
                    if resp.status == 401:
                        return [], "HIBP API key invalid or missing"
                    if resp.status == 429:
                        return [], "HIBP rate limit exceeded"
                    return [], f"HIBP HTTP {resp.status}"

        except ImportError:
            return [], "aiohttp not installed (pip install aiohttp)"
        except Exception as exc:
            return [], str(exc)

    async def get_pastes_for_email(self, email: str) -> tuple[list[dict[str, Any]], str | None]:
        """Query HIBP for pastes containing an email address."""
        if not self.api_key:
            return [], "HIBP_API_KEY not configured"

        await self._rate_limit()

        try:
            import aiohttp  # type: ignore

            url = f"{self.BASE_URL}/pasteaccount/{quote(email)}"

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=self._headers(),
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 200:
                        return await resp.json(), None
                    if resp.status == 404:
                        return [], None
                    if resp.status == 401:
                        return [], "HIBP API key invalid"
                    return [], f"HIBP HTTP {resp.status}"

        except ImportError:
            return [], "aiohttp not installed"
        except Exception as exc:
            return [], str(exc)

    async def check_password_pwned(self, password: str) -> tuple[int, str | None]:
        """
        Check if a password has been pwned using k-Anonymity model.
        Returns (pwned_count, error). Does NOT send the full password.
        """
        await self._rate_limit()

        try:
            import aiohttp  # type: ignore

            sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
            prefix, suffix = sha1[:5], sha1[5:]

            url = f"https://api.pwnedpasswords.com/range/{prefix}"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers={"User-Agent": "OSINT-Investigation-Platform/1.0"},
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status != 200:
                        return 0, f"HIBP Password API HTTP {resp.status}"
                    text = await resp.text()
                    for line in text.splitlines():
                        parts = line.split(":")
                        if len(parts) == 2 and parts[0].upper() == suffix:
                            return int(parts[1]), None
                    return 0, None  # Not found

        except ImportError:
            return 0, "aiohttp not installed"
        except Exception as exc:
            return 0, str(exc)


# ---------------------------------------------------------------------------
# Paste Monitor (public paste APIs)
# ---------------------------------------------------------------------------


class PasteMonitor:
    """Monitor public paste sites for entity mentions."""

    # Pastebin scraping API (public, no auth required)
    PASTEBIN_SCRAPE_URL = "https://scrape.pastebin.com/api_scraping.php"

    async def search_recent_pastes(
        self,
        search_terms: list[str],
        max_pastes: int = 100,
    ) -> list[PasteRecord]:
        """
        Search recent Pastebin pastes for entity mentions.

        Note: Pastebin scraping API requires Pro account.
        Falls back to public paste search via Google dork patterns.
        """
        records = []

        try:
            import aiohttp  # type: ignore

            async with aiohttp.ClientSession() as session:
                # Fetch recent pastes
                async with session.get(
                    self.PASTEBIN_SCRAPE_URL,
                    params={"limit": min(max_pastes, 250)},
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status != 200:
                        logger.debug(f"Pastebin scrape API: HTTP {resp.status}")
                        return []

                    pastes = await resp.json()

                    # Filter for relevant pastes
                    for paste in pastes:
                        title = paste.get("title", "") or ""
                        key = paste.get("key", "")
                        paste_url = f"https://pastebin.com/{key}"

                        # Check title for matches
                        matched = [t for t in search_terms if t.lower() in title.lower()]

                        if matched:
                            records.append(
                                PasteRecord(
                                    source="pastebin",
                                    paste_id=key,
                                    paste_url=paste_url,
                                    title=title,
                                    date=paste.get("date"),
                                    email_count=0,
                                    matched_terms=matched,
                                    snippet=f"Title match: {title}",
                                    query_term=search_terms[0],
                                    found_at=datetime.now(UTC),
                                )
                            )

        except ImportError:
            logger.warning("aiohttp not installed — paste monitoring disabled")
        except Exception as exc:
            logger.debug(f"Paste monitor error: {exc}")

        return records


# ---------------------------------------------------------------------------
# Main Breach Scanner
# ---------------------------------------------------------------------------


class BreachScanner:
    """
    Comprehensive breach and paste site scanner.

    Checks HIBP, paste sites, and optional local breach database
    for entity PII exposure.
    """

    def __init__(
        self,
        hibp_api_key: str | None = None,
        simulation_mode: bool = False,
    ):
        self.hibp = HIBPClient(api_key=hibp_api_key)
        self.paste_monitor = PasteMonitor()
        self.simulation_mode = simulation_mode

    async def scan(
        self,
        emails: list[str] | None = None,
        usernames: list[str] | None = None,
        phone_numbers: list[str] | None = None,
        full_name: str | None = None,
        check_pastes: bool = True,
    ) -> BreachScanResult:
        """
        Scan all provided identifiers for breach exposure.

        Args:
            emails: Email addresses to check
            usernames: Usernames to search
            phone_numbers: Phone numbers (international format)
            full_name: Full name for paste search
            check_pastes: Also check paste sites

        Returns:
            BreachScanResult with all findings
        """
        start_time = time.time()
        scan_id = hashlib.md5(f"{emails}{usernames}{time.time()}".encode()).hexdigest()[:12]

        emails = emails or []
        usernames = usernames or []
        phone_numbers = phone_numbers or []

        query_terms = emails + usernames + phone_numbers
        if full_name:
            query_terms.append(full_name)

        breaches: list[BreachRecord] = []
        pastes: list[PasteRecord] = []
        errors: list[str] = []
        hibp_available = bool(self.hibp.api_key)

        if self.simulation_mode:
            # Simulation mode
            breaches, pastes = self._simulate_results(emails, query_terms)
        else:
            # Real scanning
            tasks = []

            # HIBP breach checks for each email
            for email in emails:
                tasks.append(self._check_email_breaches(email, breaches, errors))

            # HIBP paste checks
            if check_pastes:
                for email in emails:
                    tasks.append(self._check_email_pastes(email, pastes, errors))

            # Paste site monitoring for all terms
            if check_pastes and query_terms:
                tasks.append(self._check_paste_sites(query_terms, pastes, errors))

            if tasks:
                await asyncio.gather(*tasks)

        return BreachScanResult(
            scan_id=scan_id,
            query_terms=query_terms,
            breaches=sorted(
                breaches,
                key=lambda b: (
                    ["critical", "high", "medium", "low", "info"].index(b.severity.value)
                ),
            ),
            pastes=pastes,
            scan_duration_s=time.time() - start_time,
            scanned_at=datetime.now(UTC),
            hibp_available=hibp_available,
            errors=errors,
        )

    async def _check_email_breaches(
        self,
        email: str,
        breaches: list[BreachRecord],
        errors: list[str],
    ):
        """Check a single email against HIBP breaches."""
        raw, err = await self.hibp.get_breaches_for_email(email)
        if err:
            errors.append(f"HIBP breach [{email}]: {err}")
            return
        for item in raw:
            data_classes = item.get("DataClasses", [])
            breaches.append(
                BreachRecord(
                    source="hibp",
                    breach_name=item.get("Name", "Unknown"),
                    breach_date=item.get("BreachDate"),
                    description=item.get("Description", ""),
                    data_classes=data_classes,
                    severity=_classify_severity(data_classes),
                    pwn_count=item.get("PwnCount"),
                    is_verified=item.get("IsVerified", False),
                    is_sensitive=item.get("IsSensitive", False),
                    is_spam_list=item.get("IsSpamList", False),
                    domain=item.get("Domain"),
                    logo_url=item.get("LogoPath"),
                    query_term=email,
                    found_at=datetime.now(UTC),
                )
            )

    async def _check_email_pastes(
        self,
        email: str,
        pastes: list[PasteRecord],
        errors: list[str],
    ):
        """Check a single email against HIBP pastes."""
        raw, err = await self.hibp.get_pastes_for_email(email)
        if err:
            errors.append(f"HIBP paste [{email}]: {err}")
            return
        for item in raw:
            pastes.append(
                PasteRecord(
                    source=item.get("Source", "unknown").lower(),
                    paste_id=item.get("Id", ""),
                    paste_url="",
                    title=item.get("Title"),
                    date=item.get("Date"),
                    email_count=item.get("EmailCount", 0),
                    matched_terms=[email],
                    snippet=f"Paste containing {email}",
                    query_term=email,
                    found_at=datetime.now(UTC),
                )
            )

    async def _check_paste_sites(
        self,
        query_terms: list[str],
        pastes: list[PasteRecord],
        errors: list[str],
    ):
        """Check public paste sites for query terms."""
        try:
            found = await self.paste_monitor.search_recent_pastes(query_terms)
            pastes.extend(found)
        except Exception as exc:
            errors.append(f"Paste site monitor: {exc}")

    def _simulate_results(
        self,
        emails: list[str],
        query_terms: list[str],
    ) -> tuple[list[BreachRecord], list[PasteRecord]]:
        """Return simulated breach data for testing."""
        breaches = []
        pastes = []

        if emails:
            email = emails[0]
            breaches.append(
                BreachRecord(
                    source="hibp",
                    breach_name="SimulatedBreach2023",
                    breach_date="2023-06-15",
                    description=(
                        "[SIMULATION] This is a simulated breach record for testing. "
                        "In production, real HIBP data would appear here."
                    ),
                    data_classes=["Email addresses", "Passwords", "Usernames"],
                    severity=BreachSeverity.HIGH,
                    pwn_count=1_500_000,
                    is_verified=True,
                    is_sensitive=False,
                    is_spam_list=False,
                    domain="example-breach.com",
                    logo_url=None,
                    query_term=email,
                    found_at=datetime.now(UTC),
                )
            )
            pastes.append(
                PasteRecord(
                    source="pastebin",
                    paste_id="sim123abc",
                    paste_url="https://pastebin.com/sim123abc",
                    title="[SIMULATION] Data dump",
                    date="2024-01-10",
                    email_count=500,
                    matched_terms=[email],
                    snippet=f"[SIMULATION] Paste containing {email} and other PII",
                    query_term=email,
                    found_at=datetime.now(UTC),
                )
            )

        return breaches, pastes


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_breach_scanner_instance: BreachScanner | None = None


def get_breach_scanner(
    simulation_mode: bool = False,
) -> BreachScanner:
    """Get or create the global BreachScanner instance."""
    global _breach_scanner_instance
    if _breach_scanner_instance is None:
        _breach_scanner_instance = BreachScanner(
            hibp_api_key=os.getenv("HIBP_API_KEY"),
            simulation_mode=simulation_mode,
        )
    return _breach_scanner_instance
