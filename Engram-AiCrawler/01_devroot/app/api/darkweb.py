"""
Dark Web OSINT API — Phase 8.6

Endpoints:
  POST /api/darkweb/scan/full              — Full dark web investigation scan
  POST /api/darkweb/scan/marketplace       — Marketplace/forum mention scan
  POST /api/darkweb/scan/breach            — Breach & paste site scan
  POST /api/darkweb/scan/crypto            — Cryptocurrency address trace
  POST /api/darkweb/correlate              — Cross-source entity correlation
  GET  /api/darkweb/status                 — Dark web service status
  POST /api/darkweb/crypto/extract         — Extract & trace crypto from text
  GET  /api/darkweb/sites                  — List known monitored sites
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Python 3.9+ compatibility for UTC timezone
try:
    from datetime import UTC
except ImportError:
    from datetime import timezone
    UTC = timezone.utc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/darkweb", tags=["darkweb"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class FullScanRequest(BaseModel):
    entity_name: str = Field(..., description="Primary investigation target name")
    emails: list[str] = Field(default_factory=list, description="Known email addresses")
    usernames: list[str] = Field(default_factory=list, description="Known usernames")
    phone_numbers: list[str] = Field(default_factory=list, description="Known phone numbers")
    aliases: list[str] = Field(default_factory=list, description="Known aliases")
    crypto_addresses: list[str] = Field(default_factory=list, description="Known crypto addresses")
    surface_data: dict[str, Any] | None = Field(
        None, description="Surface web OSINT data (locations, employers, social profiles, etc.)"
    )
    simulation_mode: bool = Field(
        False, description="Use simulation mode (no real Tor/API calls — for testing)"
    )
    include_darkweb: bool = Field(True, description="Include dark web marketplace scan")
    include_breach: bool = Field(True, description="Include breach/paste scan")
    include_crypto: bool = Field(True, description="Include crypto address trace")


class MarketplaceScanRequest(BaseModel):
    entity_name: str
    additional_terms: list[str] = Field(default_factory=list)
    categories: list[str] | None = Field(None, description="Filter site categories")
    include_clearnet: bool = True
    max_sites: int = Field(10, ge=1, le=30)
    simulation_mode: bool = False


class BreachScanRequest(BaseModel):
    emails: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    phone_numbers: list[str] = Field(default_factory=list)
    full_name: str | None = None
    check_pastes: bool = True
    simulation_mode: bool = False


class CryptoTraceRequest(BaseModel):
    addresses: list[str] = Field(..., min_length=1, description="Crypto addresses to trace")
    max_txs_per_address: int = Field(20, ge=1, le=100)
    simulation_mode: bool = False


class CryptoExtractRequest(BaseModel):
    text: str = Field(..., description="Text to extract crypto addresses from")
    max_txs: int = Field(20, ge=1, le=100)
    simulation_mode: bool = False


class CorrelateRequest(BaseModel):
    entity_name: str
    breach_scan_id: str | None = Field(None, description="Not used yet — pass result inline")
    breach_result: dict[str, Any] | None = None
    monitor_result: dict[str, Any] | None = None
    crypto_result: dict[str, Any] | None = None
    surface_data: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Helpers — lazy-import services to avoid startup errors if deps missing
# ---------------------------------------------------------------------------


def _get_marketplace_monitor(simulation_mode: bool = False):
    from app.osint.darkweb.marketplace_monitor import get_marketplace_monitor

    return get_marketplace_monitor(simulation_mode=simulation_mode)


def _get_breach_scanner(simulation_mode: bool = False):
    from app.osint.darkweb.breach_scanner import get_breach_scanner

    return get_breach_scanner(simulation_mode=simulation_mode)


def _get_crypto_tracer(simulation_mode: bool = False):
    from app.osint.darkweb.crypto_tracer import get_crypto_tracer

    return get_crypto_tracer(simulation_mode=simulation_mode)


def _get_correlator():
    from app.osint.darkweb.entity_correlator import get_entity_correlator

    return get_entity_correlator()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status")
async def darkweb_status():
    """
    Check availability of dark web services.

    Returns status of Tor, HIBP API key, and Etherscan API key.
    """
    import os

    status = {
        "tor_configured": True,  # Always true — degrades gracefully
        "hibp_api_key": bool(os.getenv("HIBP_API_KEY")),
        "etherscan_api_key": bool(os.getenv("ETHERSCAN_API_KEY")),
        "blockchair_api_key": bool(os.getenv("BLOCKCHAIR_API_KEY")),
        "optional_deps": {},
    }

    # Check optional dependencies
    for dep in ["aiohttp", "aiohttp_socks", "stem"]:
        try:
            __import__(dep)
            status["optional_deps"][dep] = "available"
        except ImportError:
            status["optional_deps"][dep] = "missing"

    status["tor_functional"] = (
        status["optional_deps"].get("aiohttp") == "available"
        and status["optional_deps"].get("aiohttp_socks") == "available"
    )

    return status


@router.get("/sites")
async def list_monitored_sites():
    """List all known dark web sites in the monitoring registry."""
    from app.osint.darkweb.marketplace_monitor import (
        KNOWN_DARK_WEB_SITES,
        CLEARNET_INTELLIGENCE_SITES,
    )

    return {
        "dark_web_sites": [
            {
                "name": s.name,
                "url": s.url,
                "category": s.category.value,
                "description": s.description,
                "active": s.active,
                "tags": s.tags,
            }
            for s in KNOWN_DARK_WEB_SITES
        ],
        "clearnet_intelligence_sites": [
            {
                "name": s.name,
                "url": s.url,
                "category": s.category.value,
                "description": s.description,
                "tags": s.tags,
            }
            for s in CLEARNET_INTELLIGENCE_SITES
        ],
        "total": len(KNOWN_DARK_WEB_SITES) + len(CLEARNET_INTELLIGENCE_SITES),
    }


@router.post("/scan/marketplace")
async def scan_marketplace(req: MarketplaceScanRequest):
    """
    Scan dark web marketplaces and forums for entity mentions.

    Uses Tor if available, otherwise simulation mode.
    Typical scan time: 30-120 seconds (Tor is slow).
    """
    try:
        from app.osint.darkweb.marketplace_monitor import SiteCategory

        categories = None
        if req.categories:
            try:
                categories = [SiteCategory(c) for c in req.categories]
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid category: {exc}")

        monitor = _get_marketplace_monitor(req.simulation_mode)
        result = await monitor.scan_entity(
            entity_name=req.entity_name,
            additional_terms=req.additional_terms or None,
            categories=categories,
            include_clearnet=req.include_clearnet,
            max_sites=req.max_sites,
        )
        return result.to_dict()

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Marketplace scan error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scan/breach")
async def scan_breach(req: BreachScanRequest):
    """
    Scan breach databases and paste sites for entity PII exposure.

    Checks Have I Been Pwned (requires HIBP_API_KEY env var) and
    public paste sites.
    """
    if not req.emails and not req.usernames and not req.phone_numbers and not req.full_name:
        raise HTTPException(
            status_code=400,
            detail="At least one of emails, usernames, phone_numbers, or full_name required",
        )

    try:
        scanner = _get_breach_scanner(req.simulation_mode)
        result = await scanner.scan(
            emails=req.emails or None,
            usernames=req.usernames or None,
            phone_numbers=req.phone_numbers or None,
            full_name=req.full_name,
            check_pastes=req.check_pastes,
        )
        return result.to_dict()

    except Exception as exc:
        logger.error(f"Breach scan error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scan/crypto")
async def trace_crypto(req: CryptoTraceRequest):
    """
    Trace cryptocurrency addresses via public blockchain APIs.

    Supports Bitcoin (Blockchain.info) and Ethereum (Etherscan).
    No API keys required for basic lookups.
    """
    try:
        tracer = _get_crypto_tracer(req.simulation_mode)
        result = await tracer.trace_addresses(
            addresses=req.addresses,
            max_txs_per_address=req.max_txs_per_address,
        )
        return result.to_dict()

    except Exception as exc:
        logger.error(f"Crypto trace error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/crypto/extract")
async def extract_and_trace_crypto(req: CryptoExtractRequest):
    """
    Extract cryptocurrency addresses from text and trace them all.

    Useful for analyzing dark web pages, documents, or social media posts
    that may contain crypto addresses.
    """
    try:
        from app.osint.darkweb.crypto_tracer import detect_crypto_addresses

        # First show what was found
        found = detect_crypto_addresses(req.text)
        all_addresses = []
        for addr_list in found.values():
            all_addresses.extend(addr_list)

        if not all_addresses:
            return {
                "addresses_found": {},
                "trace_result": None,
                "message": "No cryptocurrency addresses found in provided text",
            }

        tracer = _get_crypto_tracer(req.simulation_mode)
        result = await tracer.trace_addresses(
            addresses=all_addresses,
            max_txs_per_address=req.max_txs,
        )

        return {
            "addresses_found": found,
            "total_addresses": len(all_addresses),
            "trace_result": result.to_dict(),
        }

    except Exception as exc:
        logger.error(f"Crypto extract error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/correlate")
async def correlate_entity(req: CorrelateRequest):
    """
    Cross-correlate dark web + surface web data into a unified entity profile.

    Pass results from previous scans (breach, marketplace, crypto) along with
    surface web OSINT data to generate a comprehensive risk assessment.
    """
    try:
        correlator = _get_correlator()

        # Reconstruct result objects from dicts if provided
        breach_result = None
        monitor_result = None
        crypto_result = None

        if req.breach_result:
            # Minimal reconstruction for correlation scoring
            breach_result = _reconstruct_breach_result(req.breach_result)

        if req.monitor_result:
            monitor_result = _reconstruct_monitor_result(req.monitor_result)

        if req.crypto_result:
            crypto_result = _reconstruct_crypto_result(req.crypto_result)

        profile = correlator.correlate(
            entity_name=req.entity_name,
            breach_result=breach_result,
            monitor_result=monitor_result,
            crypto_result=crypto_result,
            surface_data=req.surface_data,
        )
        return profile.to_dict()

    except Exception as exc:
        logger.error(f"Correlation error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scan/full")
async def full_darkweb_scan(req: FullScanRequest):
    """
    Comprehensive dark web investigation scan.

    Runs all enabled sub-scans (marketplace, breach, crypto) in parallel
    and then correlates results into a unified entity profile.

    This is the primary endpoint for a complete Phase 8 investigation.

    Typical duration: 60-300 seconds depending on Tor availability
    and number of addresses/emails.
    """
    import asyncio

    try:
        tasks = _build_scan_tasks(req)

        results: dict[str, Any] = {}
        if tasks:
            gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
            for key, result in zip(tasks.keys(), gathered):
                if isinstance(result, Exception):
                    logger.error(f"Sub-scan {key} failed: {result}")
                    results[key] = None
                else:
                    results[key] = result

        correlator = _get_correlator()
        surface_data = _build_surface_data(req)

        profile = correlator.correlate(
            entity_name=req.entity_name,
            breach_result=results.get("breach"),
            monitor_result=results.get("monitor"),
            crypto_result=results.get("crypto"),
            surface_data=surface_data,
        )

        return _build_scan_response(req.entity_name, profile, results)

    except Exception as exc:
        logger.error(f"Full dark web scan error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


def _build_scan_tasks(req: FullScanRequest) -> dict[str, Any]:
    tasks: dict[str, Any] = {}
    if req.include_darkweb:
        monitor = _get_marketplace_monitor(req.simulation_mode)
        additional = req.aliases + req.usernames + req.emails
        tasks["monitor"] = monitor.scan_entity(
            entity_name=req.entity_name,
            additional_terms=additional or None,
            include_clearnet=True,
            max_sites=10,
        )
    if req.include_breach:
        scanner = _get_breach_scanner(req.simulation_mode)
        tasks["breach"] = scanner.scan(
            emails=req.emails or None,
            usernames=req.usernames or None,
            phone_numbers=req.phone_numbers or None,
            full_name=req.entity_name,
            check_pastes=True,
        )
    if req.include_crypto and req.crypto_addresses:
        tracer = _get_crypto_tracer(req.simulation_mode)
        tasks["crypto"] = tracer.trace_addresses(
            addresses=req.crypto_addresses,
            max_txs_per_address=20,
        )
    return tasks


def _build_surface_data(req: FullScanRequest) -> dict[str, Any]:
    surface_data = req.surface_data or {}
    if req.emails:
        surface_data.setdefault("emails", req.emails)
    if req.aliases:
        surface_data.setdefault("aliases", req.aliases)
    if req.usernames:
        surface_data.setdefault("usernames", req.usernames)
    if req.phone_numbers:
        surface_data.setdefault("phone_numbers", req.phone_numbers)
    return surface_data


def _build_scan_response(
    entity_name: str, profile: Any, results: dict[str, Any]
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "entity_name": entity_name,
        "unified_profile": profile.to_dict(),
        "sub_scan_results": {},
    }
    if results.get("monitor"):
        response["sub_scan_results"]["marketplace"] = results["monitor"].to_dict()
    if results.get("breach"):
        response["sub_scan_results"]["breach"] = results["breach"].to_dict()
    if results.get("crypto"):
        response["sub_scan_results"]["crypto"] = results["crypto"].to_dict()
    return response


# ---------------------------------------------------------------------------
# Reconstruction helpers (for /correlate endpoint)
# ---------------------------------------------------------------------------


def _reconstruct_breach_result(data: dict[str, Any]):
    """Reconstruct a minimal BreachScanResult from dict for correlation."""
    from app.osint.darkweb.breach_scanner import (
        BreachScanResult,
        BreachRecord,
        PasteRecord,
        BreachSeverity,
    )
    from datetime import datetime

    breaches = []
    for b in data.get("breaches", []):
        try:
            sev = BreachSeverity(b.get("severity", "info"))
        except ValueError:
            sev = BreachSeverity.INFO
        breaches.append(
            BreachRecord(
                source=b.get("source", "unknown"),
                breach_name=b.get("breach_name", ""),
                breach_date=b.get("breach_date"),
                description=b.get("description", ""),
                data_classes=b.get("data_classes", []),
                severity=sev,
                pwn_count=b.get("pwn_count"),
                is_verified=b.get("is_verified", False),
                is_sensitive=b.get("is_sensitive", False),
                is_spam_list=b.get("is_spam_list", False),
                domain=b.get("domain"),
                logo_url=None,
                query_term=b.get("query_term", ""),
                found_at=datetime.now(UTC),
            )
        )

    pastes = []
    for p in data.get("pastes", []):
        pastes.append(
            PasteRecord(
                source=p.get("source", "unknown"),
                paste_id=p.get("paste_id", ""),
                paste_url=p.get("paste_url", ""),
                title=p.get("title"),
                date=p.get("date"),
                email_count=p.get("email_count", 0),
                matched_terms=p.get("matched_terms", []),
                snippet=p.get("snippet", ""),
                query_term=p.get("query_term", ""),
                found_at=datetime.now(UTC),
            )
        )

    return BreachScanResult(
        scan_id=data.get("scan_id", ""),
        query_terms=data.get("query_terms", []),
        breaches=breaches,
        pastes=pastes,
        scan_duration_s=data.get("scan_duration_s", 0),
        scanned_at=datetime.now(UTC),
        hibp_available=data.get("hibp_available", False),
        errors=data.get("errors", []),
    )


def _reconstruct_monitor_result(data: dict[str, Any]):
    """Reconstruct a minimal MonitorResult from dict."""
    from app.osint.darkweb.marketplace_monitor import (
        MonitorResult,
        EntityMention,
        ThreatLevel,
        SiteCategory,
    )
    from datetime import datetime

    mentions = []
    for m in data.get("mentions", []):
        try:
            tl = ThreatLevel(m.get("threat_level", "info"))
            cat = SiteCategory(m.get("category", "forum"))
        except ValueError:
            tl = ThreatLevel.INFO
            cat = SiteCategory.FORUM
        mentions.append(
            EntityMention(
                site_name=m.get("site_name", ""),
                site_url=m.get("site_url", ""),
                page_url=m.get("page_url", ""),
                category=cat,
                threat_level=tl,
                matched_terms=m.get("matched_terms", []),
                context_snippet=m.get("context_snippet", ""),
                full_text_hash=m.get("full_text_hash", ""),
                found_at=datetime.now(UTC),
                page_title=m.get("page_title", ""),
                confidence=m.get("confidence", 0.5),
            )
        )

    return MonitorResult(
        entity_query=data.get("entity_query", ""),
        search_terms=data.get("search_terms", []),
        sites_scanned=data.get("sites_scanned", 0),
        pages_scanned=data.get("pages_scanned", 0),
        mentions=mentions,
        scan_duration_s=data.get("scan_duration_s", 0),
        scan_id=data.get("scan_id", ""),
        scanned_at=datetime.now(UTC),
        errors=data.get("errors", []),
        tor_available=data.get("tor_available", False),
    )


def _reconstruct_crypto_result(data: dict[str, Any]):
    """Reconstruct a minimal CryptoTraceResult from dict."""
    from app.osint.darkweb.crypto_tracer import (
        CryptoTraceResult,
        AddressProfile,
        AddressRisk,
        CryptoNetwork,
    )
    from datetime import datetime

    profiles = []
    for p in data.get("profiles", []):
        try:
            risk = AddressRisk(p.get("risk_level", "clean"))
            net = CryptoNetwork(p.get("network", "unknown"))
        except ValueError:
            risk = AddressRisk.CLEAN
            net = CryptoNetwork.UNKNOWN
        profiles.append(
            AddressProfile(
                address=p.get("address", ""),
                network=net,
                balance_native=p.get("balance_native", 0),
                balance_usd=p.get("balance_usd"),
                total_received=p.get("total_received", 0),
                total_sent=p.get("total_sent", 0),
                transaction_count=p.get("transaction_count", 0),
                first_seen=None,
                last_seen=None,
                transactions=[],
                risk_level=risk,
                risk_signals=p.get("risk_signals", []),
                exchange_label=p.get("exchange_label"),
                cluster_addresses=[],
                queried_at=datetime.now(UTC),
                data_source=p.get("data_source", ""),
            )
        )

    try:
        highest = AddressRisk(data.get("highest_risk", "clean"))
    except ValueError:
        highest = AddressRisk.CLEAN

    return CryptoTraceResult(
        scan_id=data.get("scan_id", ""),
        addresses_queried=data.get("addresses_queried", []),
        profiles=profiles,
        total_usd_value=data.get("total_usd_value"),
        highest_risk=highest,
        network_summary=data.get("network_summary", {}),
        scan_duration_s=data.get("scan_duration_s", 0),
        scanned_at=datetime.now(UTC),
        errors=data.get("errors", []),
    )
