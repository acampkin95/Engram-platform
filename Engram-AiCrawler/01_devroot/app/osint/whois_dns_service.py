"""WHOIS, DNS, and IP geolocation lookup service.

Uses ``python-whois`` and ``dnspython`` when available, falling back to free
public JSON APIs (dns.google, ip-api.com, bgpview.io) for keyless operation.
"""


from __future__ import annotations
import asyncio
import logging
import re
import socket
from datetime import datetime
from typing import Any

import aiohttp

from app.config.osint_providers import get_osint_settings, osint_cache
from app.core.exceptions import OsintServiceError, ProviderRateLimitError
from app.models.osint import (
    DnsLookupResponse,
    DnsRecord,
    IpLookupResponse,
    WhoisLookupResponse,
)

logger = logging.getLogger(__name__)

_DOMAIN_RE = re.compile(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$")
_IP_V4_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")


def _validate_domain(domain: str) -> str:
    domain = domain.strip().lower().rstrip(".")
    if not _DOMAIN_RE.match(domain):
        raise OsintServiceError(f"Invalid domain: {domain}", status_code=400)
    return domain


def _validate_ip(ip: str) -> str:
    ip = ip.strip()
    try:
        socket.inet_pton(socket.AF_INET, ip)
        return ip
    except OSError:
        pass
    try:
        socket.inet_pton(socket.AF_INET6, ip)
        return ip
    except OSError:
        raise OsintServiceError(f"Invalid IP address: {ip}", status_code=400)


def _safe_str(val: Any) -> str | None:
    """Convert a value to string, handling datetime lists from python-whois."""
    if val is None:
        return None
    if isinstance(val, list):
        return str(val[0]) if val else None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


class WhoisDnsService:
    """Provides WHOIS, DNS and IP geolocation lookups."""

    def __init__(self, session: aiohttp.ClientSession | None = None) -> None:
        self._settings = get_osint_settings()
        self._session = session

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    # -- WHOIS --------------------------------------------------------------

    @osint_cache(ttl_seconds=2592000, prefix="whois:domain")
    async def lookup_domain(self, domain: str) -> WhoisLookupResponse:
        """Look up WHOIS data for a domain."""
        domain = _validate_domain(domain)

        # Try python-whois library first
        try:
            return await self._whois_via_library(domain)
        except Exception as exc:
            logger.debug(f"python-whois failed for {domain}: {exc}, trying API fallback")

        # Fallback to WHOIS API if key available
        if self._settings.whois.has_api_key:
            try:
                return await self._whois_via_api(domain)
            except Exception as exc:
                logger.warning(f"WHOIS API failed for {domain}: {exc}")

        raise OsintServiceError(f"WHOIS lookup failed for {domain}")

    async def _whois_via_library(self, domain: str) -> WhoisLookupResponse:
        loop = asyncio.get_event_loop()
        try:
            import whois as python_whois
        except ImportError:
            raise OsintServiceError("python-whois not installed")

        w = await loop.run_in_executor(None, python_whois.whois, domain)

        name_servers = w.name_servers or []
        if isinstance(name_servers, str):
            name_servers = [name_servers]
        name_servers = [ns.lower() for ns in name_servers if ns]

        status = w.status or []
        if isinstance(status, str):
            status = [status]

        registrant: dict[str, Any] | None = None
        if hasattr(w, "name") and w.name:
            registrant = {
                "name": _safe_str(w.name),
                "org": _safe_str(getattr(w, "org", None)),
                "country": _safe_str(getattr(w, "country", None)),
                "state": _safe_str(getattr(w, "state", None)),
                "city": _safe_str(getattr(w, "city", None)),
            }

        return WhoisLookupResponse(
            domain=domain,
            registrar=_safe_str(w.registrar),
            creation_date=_safe_str(w.creation_date),
            expiration_date=_safe_str(w.expiration_date),
            updated_date=_safe_str(w.updated_date),
            name_servers=name_servers,
            status=status,
            registrant=registrant,
            raw={"text": (w.text or "")[:5000]},
            fallback_used=False,
        )

    async def _whois_via_api(self, domain: str) -> WhoisLookupResponse:
        cfg = self._settings.whois
        session = await self._get_session()
        params = {
            "apiKey": cfg.api_key,
            "domainName": domain,
            "outputFormat": "JSON",
        }
        async with session.get(cfg.base_url, params=params) as resp:
            if resp.status == 429:
                raise ProviderRateLimitError("WHOIS API rate limited", provider="whois")
            resp.raise_for_status()
            data = await resp.json()

        record = data.get("WhoisRecord", {})
        return WhoisLookupResponse(
            domain=domain,
            registrar=record.get("registrarName"),
            creation_date=record.get("createdDate"),
            expiration_date=record.get("expiresDate"),
            updated_date=record.get("updatedDate"),
            name_servers=[
                ns.get("host", "") for ns in record.get("nameServers", {}).get("hostNames", [])
            ],
            status=[record.get("status", "")],
            raw=record,
            fallback_used=False,
        )

    # -- DNS ----------------------------------------------------------------

    @osint_cache(ttl_seconds=604800, prefix="whois:dns")
    async def lookup_dns(
        self, domain: str, record_types: list[str] | None = None
    ) -> DnsLookupResponse:
        """Look up DNS records for a domain."""
        domain = _validate_domain(domain)
        record_types = record_types or ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"]

        # Try dnspython first
        try:
            return await self._dns_via_library(domain, record_types)
        except Exception as exc:
            logger.debug(f"dnspython failed for {domain}: {exc}, trying dns.google")

        # Fallback to dns.google public API
        return await self._dns_via_google(domain, record_types)

    async def _dns_via_library(self, domain: str, record_types: list[str]) -> DnsLookupResponse:
        loop = asyncio.get_event_loop()
        try:
            import dns.resolver
        except ImportError:
            raise OsintServiceError("dnspython not installed")

        records: list[DnsRecord] = []

        for rtype in record_types:
            try:

                def _resolve(rt: str = rtype) -> Any:
                    return dns.resolver.resolve(domain, rt)

                answers = await loop.run_in_executor(None, _resolve)
                for rdata in answers:
                    priority = None
                    value = str(rdata)
                    if rtype == "MX":
                        priority = getattr(rdata, "preference", None)
                        value = str(getattr(rdata, "exchange", rdata))
                    records.append(
                        DnsRecord(
                            type=rtype,
                            name=domain,
                            value=value,
                            ttl=answers.rrset.ttl if answers.rrset else None,
                            priority=priority,
                        )
                    )
            except Exception:
                continue

        return DnsLookupResponse(domain=domain, records=records, fallback_used=False)

    async def _dns_via_google(self, domain: str, record_types: list[str]) -> DnsLookupResponse:
        session = await self._get_session()
        records: list[DnsRecord] = []

        for rtype in record_types:
            try:
                url = f"https://dns.google/resolve?name={domain}&type={rtype}"
                async with session.get(url) as resp:
                    if resp.status != 200:
                        continue
                    data = await resp.json()

                for answer in data.get("Answer", []):
                    records.append(
                        DnsRecord(
                            type=rtype,
                            name=answer.get("name", domain),
                            value=answer.get("data", ""),
                            ttl=answer.get("TTL"),
                        )
                    )
            except Exception as exc:
                logger.debug(f"dns.google failed for {domain}/{rtype}: {exc}")
                continue

        return DnsLookupResponse(domain=domain, records=records, fallback_used=True)

    # -- IP Geolocation -----------------------------------------------------

    @osint_cache(ttl_seconds=86400, prefix="whois:ip")
    async def lookup_ip(self, ip: str) -> IpLookupResponse:
        """Look up geolocation and ASN data for an IP address."""
        ip = _validate_ip(ip)
        session = await self._get_session()

        try:
            url = f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,org,as,asname,reverse,query"
            async with session.get(url) as resp:
                data = await resp.json()

            if data.get("status") == "fail":
                raise OsintServiceError(f"IP lookup failed: {data.get('message', 'unknown error')}")

            asn_raw = data.get("as", "")
            asn = asn_raw.split()[0] if asn_raw else None

            return IpLookupResponse(
                ip=ip,
                country=data.get("country"),
                country_code=data.get("countryCode"),
                region=data.get("regionName"),
                city=data.get("city"),
                latitude=data.get("lat"),
                longitude=data.get("lon"),
                isp=data.get("isp"),
                org=data.get("org"),
                asn=asn,
                as_name=data.get("asname"),
                reverse_dns=data.get("reverse"),
                fallback_used=False,
            )
        except OsintServiceError:
            raise
        except Exception as exc:
            logger.error(f"IP lookup failed for {ip}: {exc}")
            raise OsintServiceError(f"IP lookup failed for {ip}: {exc}")

    # -- ASN ----------------------------------------------------------------

    async def lookup_asn(self, asn: str) -> dict[str, Any]:
        """Look up ASN details via bgpview.io (free, no key)."""
        asn = asn.strip().upper()
        if not asn.startswith("AS"):
            asn = f"AS{asn}"
        asn_num = asn.replace("AS", "")

        session = await self._get_session()
        try:
            url = f"https://api.bgpview.io/asn/{asn_num}"
            async with session.get(url) as resp:
                if resp.status != 200:
                    raise OsintServiceError(f"ASN lookup failed: HTTP {resp.status}")
                data = await resp.json()

            asn_data = data.get("data", {})
            return {
                "asn": int(asn_num),
                "name": asn_data.get("name"),
                "description": asn_data.get("description_short"),
                "country_code": asn_data.get("country_code"),
                "website": asn_data.get("website"),
                "email_contacts": asn_data.get("email_contacts", []),
                "looking_glass": asn_data.get("looking_glass"),
                "traffic_estimation": asn_data.get("traffic_estimation"),
                "rir_allocation": asn_data.get("rir_allocation", {}),
            }
        except OsintServiceError:
            raise
        except Exception as exc:
            logger.error(f"ASN lookup failed for {asn}: {exc}")
            raise OsintServiceError(f"ASN lookup failed: {exc}")
