"""Pydantic models for OSINT service requests and responses."""

from __future__ import annotations
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# WHOIS / DNS / IP
# ---------------------------------------------------------------------------


class WhoisLookupRequest(BaseModel):
    domain: str = Field(..., min_length=1, max_length=253)


class WhoisLookupResponse(BaseModel):
    domain: str
    registrar: str | None = None
    creation_date: str | None = None
    expiration_date: str | None = None
    updated_date: str | None = None
    name_servers: list[str] = Field(default_factory=list)
    status: list[str] = Field(default_factory=list)
    registrant: dict[str, Any] | None = None
    raw: dict[str, Any] | None = None
    fallback_used: bool = False


class DnsLookupRequest(BaseModel):
    domain: str = Field(..., min_length=1, max_length=253)
    record_types: list[str] = Field(default=["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"])


class DnsRecord(BaseModel):
    type: str
    name: str
    value: str
    ttl: int | None = None
    priority: int | None = None


class DnsLookupResponse(BaseModel):
    domain: str
    records: list[DnsRecord] = Field(default_factory=list)
    fallback_used: bool = False


class IpLookupRequest(BaseModel):
    ip: str = Field(..., min_length=7, max_length=45)


class IpLookupResponse(BaseModel):
    ip: str
    country: str | None = None
    country_code: str | None = None
    region: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    isp: str | None = None
    org: str | None = None
    asn: str | None = None
    as_name: str | None = None
    reverse_dns: str | None = None
    fallback_used: bool = False


# ---------------------------------------------------------------------------
# Threat Intelligence (Shodan / VirusTotal)
# ---------------------------------------------------------------------------


class ShodanSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(default=20, ge=1, le=100)


class ShodanHost(BaseModel):
    ip: str
    ports: list[int] = Field(default_factory=list)
    hostnames: list[str] = Field(default_factory=list)
    org: str | None = None
    os: str | None = None
    vulns: list[str] = Field(default_factory=list)
    services: list[dict[str, Any]] = Field(default_factory=list)


class ShodanSearchResponse(BaseModel):
    query: str
    total: int = 0
    results: list[ShodanHost] = Field(default_factory=list)
    fallback_used: bool = False


class VirusTotalCheckRequest(BaseModel):
    indicator: str = Field(..., min_length=1, max_length=500)
    indicator_type: str = Field(
        default="auto",
        pattern="^(auto|url|domain|ip|file_hash)$",
    )


class VirusTotalResult(BaseModel):
    indicator: str
    indicator_type: str
    detection_ratio: str | None = None
    malicious: int = 0
    suspicious: int = 0
    harmless: int = 0
    undetected: int = 0
    total_vendors: int = 0
    threat_names: list[str] = Field(default_factory=list)
    last_analysis_date: str | None = None
    reputation_score: int | None = None
    vendor_results: list[dict[str, Any]] = Field(default_factory=list)
    fallback_used: bool = False


class IpReputationRequest(BaseModel):
    ip: str = Field(..., min_length=7, max_length=45)


class IpReputationResponse(BaseModel):
    ip: str
    threat_score: int = Field(default=0, ge=0, le=100)
    risk_level: str = "unknown"  # critical / high / medium / low / clean
    shodan_data: ShodanHost | None = None
    vt_data: VirusTotalResult | None = None
    abuse_confidence: int | None = None
    reports: list[dict[str, Any]] = Field(default_factory=list)
    fallback_used: bool = False


# ---------------------------------------------------------------------------
# Email OSINT (HIBP / Hunter.io)
# ---------------------------------------------------------------------------


class BreachCheckRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class BreachInfo(BaseModel):
    name: str
    title: str | None = None
    domain: str | None = None
    breach_date: str | None = None
    added_date: str | None = None
    pwn_count: int | None = None
    data_classes: list[str] = Field(default_factory=list)
    description: str | None = None
    is_verified: bool = True


class BreachCheckResponse(BaseModel):
    email: str
    breached: bool = False
    breach_count: int = 0
    breaches: list[BreachInfo] = Field(default_factory=list)
    fallback_used: bool = False


class EmailVerifyRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class EmailVerifyResponse(BaseModel):
    email: str
    status: str = "unknown"  # deliverable / risky / invalid / unknown
    score: int | None = None
    mx_found: bool = False
    disposable: bool = False
    role_based: bool = False
    free_provider: bool = False
    smtp_check: bool | None = None
    fallback_used: bool = False


class EmailReverseRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class EmailReverseResponse(BaseModel):
    email: str
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    position: str | None = None
    linkedin_url: str | None = None
    twitter_handle: str | None = None
    phone: str | None = None
    confidence: int | None = None
    sources: list[str] = Field(default_factory=list)
    fallback_used: bool = False


class BulkEmailCheckRequest(BaseModel):
    emails: list[str] = Field(..., min_length=1, max_length=100)


class BulkEmailCheckItem(BaseModel):
    email: str
    breached: bool = False
    breach_count: int = 0
    error: str | None = None


class BulkEmailCheckResponse(BaseModel):
    results: list[BulkEmailCheckItem] = Field(default_factory=list)
    total: int = 0
    breached_count: int = 0
    errors: int = 0
    fallback_used: bool = False


# ---------------------------------------------------------------------------
# Enhanced Scan (extends existing FullScanRequest)
# ---------------------------------------------------------------------------


class EnhancedScanRequest(BaseModel):
    """Full OSINT scan with optional domain/email/IP enrichment."""

    username: str = Field(..., min_length=1, max_length=256)
    platforms: list[str] | None = None
    max_concurrent_crawls: int = Field(default=5, ge=1, le=20)
    query_context: str = ""
    reference_photo_labels: list[str] | None = None
    # New enrichment targets
    target_domain: str | None = None
    target_email: str | None = None
    target_ip: str | None = None
    enable_whois: bool = True
    enable_threat_intel: bool = True
    enable_email_osint: bool = True


# ---------------------------------------------------------------------------
# Provider Status
# ---------------------------------------------------------------------------


class ProviderStatus(BaseModel):
    name: str
    has_api_key: bool
    mode: str  # "full" or "limited"
    cache_ttl_seconds: int
    rate_limit_per_minute: int


class ProviderStatusResponse(BaseModel):
    providers: dict[str, ProviderStatus] = Field(default_factory=dict)
    timestamp: str = ""
