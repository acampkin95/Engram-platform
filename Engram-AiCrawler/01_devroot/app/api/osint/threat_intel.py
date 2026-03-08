"""Threat Intelligence endpoints — WHOIS, DNS, IP, Shodan, VirusTotal, Email OSINT, Provider Status."""
import logging
from datetime import datetime, UTC
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.exceptions import (
    OsintServiceError,
    ProviderRateLimitError,
    ProviderUnavailableError,
)
from app.config.osint_providers import get_osint_settings
from app.models.osint import (
    BreachCheckRequest,
    BulkEmailCheckRequest,
    DnsLookupRequest,
    EmailReverseRequest,
    EmailVerifyRequest,
    IpLookupRequest,
    IpReputationRequest,
    ShodanSearchRequest,
    VirusTotalCheckRequest,
    WhoisLookupRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/osint", tags=["osint"])


# ---------------------------------------------------------------------------
# Service helpers
# ---------------------------------------------------------------------------


def _get_whois_service():
    from app.osint.whois_dns_service import WhoisDnsService

    return WhoisDnsService()


def _get_threat_service():
    from app.osint.threat_intel_service import ThreatIntelService

    return ThreatIntelService()


def _get_email_service():
    from app.osint.email_osint_service import EmailOsintService

    return EmailOsintService()


# ---------------------------------------------------------------------------
# WHOIS / DNS / IP endpoints
# ---------------------------------------------------------------------------


@router.post("/whois/domain")
async def whois_lookup_domain(request: WhoisLookupRequest) -> dict[str, Any]:
    """Look up WHOIS registration data for a domain."""
    try:
        service = _get_whois_service()
        result = await service.lookup_domain(request.domain)
        return result.model_dump()
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"WHOIS domain lookup failed: {e}")
        raise HTTPException(status_code=500, detail="WHOIS lookup failed")


@router.post("/whois/dns")
async def whois_lookup_dns(request: DnsLookupRequest) -> dict[str, Any]:
    """Look up DNS records for a domain."""
    try:
        service = _get_whois_service()
        result = await service.lookup_dns(request.domain, request.record_types)
        return result.model_dump()
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"DNS lookup failed: {e}")
        raise HTTPException(status_code=500, detail="DNS lookup failed")


@router.post("/whois/ip")
async def whois_lookup_ip(request: IpLookupRequest) -> dict[str, Any]:
    """Look up geolocation and ASN data for an IP address."""
    try:
        service = _get_whois_service()
        result = await service.lookup_ip(request.ip)
        return result.model_dump()
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"IP lookup failed: {e}")
        raise HTTPException(status_code=500, detail="IP lookup failed")


@router.post("/whois/asn")
async def whois_lookup_asn(asn: str = Query(..., min_length=1)) -> dict[str, Any]:
    """Look up ASN details."""
    try:
        service = _get_whois_service()
        return await service.lookup_asn(asn)
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"ASN lookup failed: {e}")
        raise HTTPException(status_code=500, detail="ASN lookup failed")


# ---------------------------------------------------------------------------
# Threat Intelligence endpoints (Shodan / VirusTotal)
# ---------------------------------------------------------------------------


@router.post("/threat/shodan")
async def threat_search_shodan(request: ShodanSearchRequest) -> dict[str, Any]:
    """Search Shodan for hosts matching a query."""
    try:
        service = _get_threat_service()
        result = await service.search_shodan(request.query, request.limit)
        return result.model_dump()
    except ProviderRateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=e.message)
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Shodan search failed: {e}")
        raise HTTPException(status_code=500, detail="Shodan search failed")


@router.post("/threat/vt")
async def threat_check_virustotal(request: VirusTotalCheckRequest) -> dict[str, Any]:
    """Check an indicator (URL, domain, IP, or file hash) against VirusTotal."""
    try:
        service = _get_threat_service()
        result = await service.check_virustotal(request.indicator, request.indicator_type)
        return result.model_dump()
    except ProviderRateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=e.message)
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"VirusTotal check failed: {e}")
        raise HTTPException(status_code=500, detail="VirusTotal check failed")


@router.post("/threat/ip-rep")
async def threat_check_ip_reputation(request: IpReputationRequest) -> dict[str, Any]:
    """Get aggregated IP reputation from Shodan + VirusTotal."""
    try:
        service = _get_threat_service()
        result = await service.check_ip_reputation(request.ip)
        return result.model_dump()
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"IP reputation check failed: {e}")
        raise HTTPException(status_code=500, detail="IP reputation check failed")


# ---------------------------------------------------------------------------
# Email OSINT endpoints (HIBP / Hunter.io)
# ---------------------------------------------------------------------------


@router.post("/email/breach")
async def email_check_breach(request: BreachCheckRequest) -> dict[str, Any]:
    """Check an email address against Have I Been Pwned."""
    try:
        service = _get_email_service()
        result = await service.check_breach(request.email)
        return result.model_dump()
    except ProviderRateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=e.message)
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Breach check failed: {e}")
        raise HTTPException(status_code=500, detail="Breach check failed")


@router.post("/email/verify")
async def email_verify(request: EmailVerifyRequest) -> dict[str, Any]:
    """Verify email deliverability."""
    try:
        service = _get_email_service()
        result = await service.verify_email(request.email)
        return result.model_dump()
    except ProviderRateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Email verification failed: {e}")
        raise HTTPException(status_code=500, detail="Email verification failed")


@router.post("/email/reverse")
async def email_reverse_lookup(request: EmailReverseRequest) -> dict[str, Any]:
    """Reverse-lookup an email to find associated person/company info."""
    try:
        service = _get_email_service()
        result = await service.reverse_lookup(request.email)
        return result.model_dump()
    except ProviderRateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Email reverse lookup failed: {e}")
        raise HTTPException(status_code=500, detail="Reverse lookup failed")


@router.post("/email/bulk")
async def email_bulk_check(request: BulkEmailCheckRequest) -> dict[str, Any]:
    """Check multiple emails for breaches in batch."""
    try:
        service = _get_email_service()
        result = await service.bulk_check(request.emails)
        return result.model_dump()
    except OsintServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Bulk email check failed: {e}")
        raise HTTPException(status_code=500, detail="Bulk check failed")


# ---------------------------------------------------------------------------
# Provider Status
# ---------------------------------------------------------------------------


@router.get("/providers/status")
async def get_provider_status() -> dict[str, Any]:
    """Return health and availability status for all OSINT providers."""
    settings = get_osint_settings()
    return {
        "providers": settings.get_status(),
        "timestamp": datetime.now(UTC).isoformat(),
    }
