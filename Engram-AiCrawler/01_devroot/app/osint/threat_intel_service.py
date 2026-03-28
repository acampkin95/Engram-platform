"""Threat intelligence service — Shodan and VirusTotal integration.

Uses official APIs when keys are configured, falling back to free endpoints
(Shodan InternetDB, URLhaus, AbuseIPDB) for keyless operation.
"""


from __future__ import annotations
import asyncio
import logging
import re
from typing import Any, Union

import aiohttp

from app.config.osint_providers import get_osint_settings, osint_cache
from app.core.exceptions import OsintServiceError, ProviderRateLimitError, ProviderUnavailableError
from app.models.osint import (
    IpReputationResponse,
    ShodanHost,
    ShodanSearchResponse,
    VirusTotalResult,
)

logger = logging.getLogger(__name__)

_IP_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
_HASH_RE = re.compile(r"^[a-fA-F0-9]{32,64}$")
_URL_RE = re.compile(r"^https?://")


def _detect_indicator_type(indicator: str) -> str:
    """Auto-detect the type of an indicator (ip, file_hash, url, domain)."""
    indicator = indicator.strip()
    if _IP_RE.match(indicator):
        return "ip"
    if _HASH_RE.match(indicator):
        return "file_hash"
    if _URL_RE.match(indicator):
        return "url"
    return "domain"


class ThreatIntelService:
    """Provides Shodan search and VirusTotal lookups with keyless fallbacks."""

    def __init__(self, session: aiohttp.ClientSession | None = None) -> None:
        self._settings = get_osint_settings()
        self._session = session

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    # -----------------------------------------------------------------------
    # Shodan
    # -----------------------------------------------------------------------

    @osint_cache(ttl_seconds=604800, prefix="threat:shodan")
    async def search_shodan(self, query: str, limit: int = 20) -> ShodanSearchResponse:
        """Search Shodan for hosts matching *query*.

        Falls back to Shodan InternetDB (free, single-IP lookup) when the
        query looks like an IP address and no API key is configured.
        """
        cfg = self._settings.shodan

        if cfg.has_api_key:
            return await self._shodan_api_search(query, limit)

        # Keyless fallback: InternetDB only works for single IPs
        if _IP_RE.match(query.strip()):
            host = await self._shodan_internetdb(query.strip())
            return ShodanSearchResponse(
                query=query,
                total=1 if host else 0,
                results=[host] if host else [],
                fallback_used=True,
            )

        return ShodanSearchResponse(query=query, total=0, results=[], fallback_used=True)

    async def _shodan_api_search(self, query: str, limit: int) -> ShodanSearchResponse:
        cfg = self._settings.shodan
        session = await self._get_session()

        try:
            url = f"{cfg.base_url}/shodan/host/search"
            params = {"key": cfg.api_key, "query": query, "page": 1}
            async with session.get(url, params=params) as resp:
                if resp.status == 429:
                    raise ProviderRateLimitError("Shodan rate limit exceeded", provider="shodan")
                if resp.status == 401:
                    raise ProviderUnavailableError("Invalid Shodan API key")
                resp.raise_for_status()
                data = await resp.json()

            results: list[ShodanHost] = []
            for match in (data.get("matches") or [])[:limit]:
                results.append(
                    ShodanHost(
                        ip=str(match.get("ip_str", "")),
                        ports=[match.get("port", 0)],
                        hostnames=match.get("hostnames", []),
                        org=match.get("org"),
                        os=match.get("os"),
                        vulns=list(match.get("vulns", {}).keys())
                        if isinstance(match.get("vulns"), dict)
                        else [],
                        services=[
                            {
                                "port": match.get("port"),
                                "transport": match.get("transport"),
                                "product": match.get("product"),
                                "version": match.get("version"),
                                "banner": (match.get("data") or "")[:500],
                            }
                        ],
                    )
                )

            return ShodanSearchResponse(
                query=query,
                total=data.get("total", len(results)),
                results=results,
                fallback_used=False,
            )
        except (ProviderRateLimitError, ProviderUnavailableError):
            raise
        except Exception as exc:
            logger.error(f"Shodan API search failed: {exc}")
            raise OsintServiceError(f"Shodan search failed: {exc}")

    async def _shodan_internetdb(self, ip: str) -> ShodanHost | None:
        """Free Shodan InternetDB lookup (no API key required)."""
        session = await self._get_session()
        try:
            url = f"https://internetdb.shodan.io/{ip}"
            async with session.get(url) as resp:
                if resp.status == 404:
                    return None
                resp.raise_for_status()
                data = await resp.json()

            return ShodanHost(
                ip=ip,
                ports=data.get("ports", []),
                hostnames=data.get("hostnames", []),
                vulns=data.get("vulns", []),
                services=[],
            )
        except Exception as exc:
            logger.debug(f"Shodan InternetDB failed for {ip}: {exc}")
            return None

    # -----------------------------------------------------------------------
    # VirusTotal
    # -----------------------------------------------------------------------

    @osint_cache(ttl_seconds=2592000, prefix="threat:vt")
    async def check_virustotal(
        self, indicator: str, indicator_type: str = "auto"
    ) -> VirusTotalResult:
        """Check an indicator against VirusTotal.

        Falls back to URLhaus for URL/domain checks when no VT key.
        """
        indicator = indicator.strip()
        if indicator_type == "auto":
            indicator_type = _detect_indicator_type(indicator)

        cfg = self._settings.virustotal

        if cfg.has_api_key:
            return await self._vt_api_check(indicator, indicator_type)

        # Keyless fallbacks
        if indicator_type in ("url", "domain"):
            return await self._urlhaus_check(indicator, indicator_type)

        if indicator_type == "ip":
            return await self._abuseipdb_check_as_vt(indicator)

        return VirusTotalResult(
            indicator=indicator,
            indicator_type=indicator_type,
            fallback_used=True,
        )

    def _build_vt_url(self, indicator: str, indicator_type: str) -> str:
        cfg = self._settings.virustotal
        if indicator_type == "file_hash":
            return f"{cfg.base_url}/files/{indicator}"
        elif indicator_type == "url":
            import base64
            url_id = base64.urlsafe_b64encode(indicator.encode()).decode().rstrip("=")
            return f"{cfg.base_url}/urls/{url_id}"
        elif indicator_type == "domain":
            return f"{cfg.base_url}/domains/{indicator}"
        elif indicator_type == "ip":
            return f"{cfg.base_url}/ip_addresses/{indicator}"
        else:
            raise OsintServiceError(f"Unsupported VT indicator type: {indicator_type}")

    def _extract_vendor_results(self, results_raw: dict) -> list[dict]:
        return [
            {
                "vendor": vendor,
                "category": info.get("category"),
                "result": info.get("result"),
            }
            for vendor, info in list(results_raw.items())[:50]
        ]

    def _extract_threat_names(self, results_raw: dict) -> list[str]:
        threat_names = []
        for info in results_raw.values():
            r = info.get("result")
            if r and r not in ("clean", "unrated"):
                threat_names.append(r)
        return list(set(threat_names))[:20]

    async def _vt_api_check(self, indicator: str, indicator_type: str) -> VirusTotalResult:
        cfg = self._settings.virustotal
        session = await self._get_session()
        headers = {"x-apikey": cfg.api_key}

        try:
            url = self._build_vt_url(indicator, indicator_type)

            async with session.get(url, headers=headers) as resp:
                if resp.status == 429:
                    raise ProviderRateLimitError(
                        "VirusTotal rate limit exceeded", provider="virustotal"
                    )
                if resp.status == 404:
                    return VirusTotalResult(
                        indicator=indicator,
                        indicator_type=indicator_type,
                        fallback_used=False,
                    )
                resp.raise_for_status()
                data = await resp.json()

            attrs = data.get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            results_raw = attrs.get("last_analysis_results", {})

            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            harmless = stats.get("harmless", 0)
            undetected = stats.get("undetected", 0)
            total_vendors = malicious + suspicious + harmless + undetected

            return VirusTotalResult(
                indicator=indicator,
                indicator_type=indicator_type,
                detection_ratio=f"{malicious}/{total_vendors}" if total_vendors else None,
                malicious=malicious,
                suspicious=suspicious,
                harmless=harmless,
                undetected=undetected,
                total_vendors=total_vendors,
                threat_names=self._extract_threat_names(results_raw),
                last_analysis_date=attrs.get("last_analysis_date"),
                reputation_score=attrs.get("reputation"),
                vendor_results=self._extract_vendor_results(results_raw),
                fallback_used=False,
            )
        except (ProviderRateLimitError, ProviderUnavailableError):
            raise
        except Exception as exc:
            logger.error(f"VirusTotal API check failed: {exc}")
            raise OsintServiceError(f"VirusTotal check failed: {exc}")

    async def _urlhaus_check(self, indicator: str, indicator_type: str) -> VirusTotalResult:
        """Free URLhaus fallback for URL/domain threat checks."""
        session = await self._get_session()
        try:
            fallback_url = self._settings.virustotal.fallback_url
            if indicator_type == "url":
                payload = {"url": indicator}
                endpoint = f"{fallback_url}/url/"
            else:
                payload = {"host": indicator}
                endpoint = f"{fallback_url}/host/"

            async with session.post(endpoint, data=payload) as resp:
                data = await resp.json()

            data.get("query_status", "no_results")
            urls = data.get("urls", [])
            malicious = len([u for u in urls if u.get("threat") and u["threat"] != "none"])

            return VirusTotalResult(
                indicator=indicator,
                indicator_type=indicator_type,
                malicious=malicious,
                total_vendors=1,
                detection_ratio=f"{malicious}/1" if malicious else "0/1",
                threat_names=[u.get("threat", "") for u in urls[:10] if u.get("threat")],
                fallback_used=True,
            )
        except Exception as exc:
            logger.debug(f"URLhaus fallback failed: {exc}")
            return VirusTotalResult(
                indicator=indicator, indicator_type=indicator_type, fallback_used=True
            )

    async def _abuseipdb_check_as_vt(self, ip: str) -> VirusTotalResult:
        """Minimal IP check via AbuseIPDB free endpoint, formatted as VT result."""
        session = await self._get_session()
        try:
            url = "https://api.abuseipdb.com/api/v2/check"
            params = {"ipAddress": ip, "maxAgeInDays": "90"}
            headers = {"Accept": "application/json"}
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status != 200:
                    return VirusTotalResult(indicator=ip, indicator_type="ip", fallback_used=True)
                data = await resp.json()

            abuse_data = data.get("data", {})
            confidence = abuse_data.get("abuseConfidenceScore", 0)
            malicious = 1 if confidence > 50 else 0

            return VirusTotalResult(
                indicator=ip,
                indicator_type="ip",
                malicious=malicious,
                total_vendors=1,
                detection_ratio=f"{malicious}/1",
                reputation_score=-confidence if confidence else 0,
                fallback_used=True,
            )
        except Exception as exc:
            logger.debug(f"AbuseIPDB fallback failed for {ip}: {exc}")
            return VirusTotalResult(indicator=ip, indicator_type="ip", fallback_used=True)

    # -----------------------------------------------------------------------
    # IP Reputation (aggregate)
    # -----------------------------------------------------------------------

    @osint_cache(ttl_seconds=86400, prefix="threat:iprep")
    async def check_ip_reputation(self, ip: str) -> IpReputationResponse:
        """Aggregate IP reputation from Shodan + VirusTotal."""
        ip = ip.strip()

        shodan_task = self.search_shodan(ip)
        vt_task = self.check_virustotal(ip, "ip")

        _gather_results: list[Any] = list(
            await asyncio.gather(shodan_task, vt_task, return_exceptions=True)
        )
        shodan_resp: Union[ShodanSearchResponse, BaseException] = _gather_results[0]
        vt_resp: Union[VirusTotalResult, BaseException] = _gather_results[1]

        shodan_host: ShodanHost | None = None
        if isinstance(shodan_resp, ShodanSearchResponse) and shodan_resp.results:
            shodan_host = shodan_resp.results[0]

        vt_result: VirusTotalResult | None = None
        if isinstance(vt_resp, VirusTotalResult):
            vt_result = vt_resp

        # Compute composite threat score (0-100)
        score = 0
        if shodan_host:
            score += min(len(shodan_host.vulns) * 10, 40)
            score += min(len(shodan_host.ports) * 2, 20)
        if vt_result:
            score += min(vt_result.malicious * 15, 40)

        score = min(score, 100)

        if score >= 80:
            risk_level = "critical"
        elif score >= 60:
            risk_level = "high"
        elif score >= 30:
            risk_level = "medium"
        elif score > 0:
            risk_level = "low"
        else:
            risk_level = "clean"

        return IpReputationResponse(
            ip=ip,
            threat_score=score,
            risk_level=risk_level,
            shodan_data=shodan_host,
            vt_data=vt_result,
            fallback_used=(
                (isinstance(shodan_resp, ShodanSearchResponse) and shodan_resp.fallback_used)
                or (isinstance(vt_resp, VirusTotalResult) and vt_resp.fallback_used)
            ),
        )
