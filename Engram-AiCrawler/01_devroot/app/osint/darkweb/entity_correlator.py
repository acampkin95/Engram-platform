"""
Advanced Entity Correlation Engine — Phase 8.5

Cross-references dark web findings (breach data, marketplace mentions,
crypto traces) with surface web OSINT data from Phases 1-4 to build
a unified risk picture for an investigation target.

Key capabilities:
  - Merge dark web + surface web findings into a unified entity profile
  - Score overall investigation risk
  - Identify corroborating evidence across sources
  - Detect identity inconsistencies (fake ID signals)
  - Generate investigation summary with actionable intelligence
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from app._compat import UTC

from app._compat import StrEnum

from typing import Any

from app.osint.darkweb.breach_scanner import BreachScanResult, BreachSeverity
from app.osint.darkweb.marketplace_monitor import MonitorResult, ThreatLevel
from app.osint.darkweb.crypto_tracer import CryptoTraceResult, AddressRisk

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Risk Scoring
# ---------------------------------------------------------------------------

class OverallRisk(StrEnum):
    CRITICAL = "critical"  # Immediate action required
    HIGH = "high"  # Significant concern, investigate urgently
    ELEVATED = "elevated"  # Multiple risk signals
    MODERATE = "moderate"  # Some concerns, monitor
    LOW = "low"  # Minimal risk signals
    UNKNOWN = "unknown"  # Insufficient data

@dataclass
class RiskFactor:
    """A single risk factor contributing to overall score."""

    source: str  # "breach", "darkweb", "crypto", "surface"
    factor: str  # Human-readable description
    weight: float  # 0.0 – 1.0 contribution to score
    evidence: list[str]  # Supporting evidence items

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "factor": self.factor,
            "weight": self.weight,
            "evidence": self.evidence,
        }

# ---------------------------------------------------------------------------
# Correlation Evidence
# ---------------------------------------------------------------------------

@dataclass
class CorroboratingEvidence:
    """Evidence that appears in multiple independent sources."""

    evidence_type: str  # "email", "username", "address", "name", "crypto"
    value: str  # The corroborated value
    sources: list[str]  # Where it was found
    confidence: float  # 0.0 – 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "evidence_type": self.evidence_type,
            "value": self.value,
            "sources": self.sources,
            "confidence": self.confidence,
        }

@dataclass
class IdentityInconsistency:
    """A detected inconsistency suggesting fake/multiple identities."""

    field: str  # "name", "age", "location", "employer"
    value_a: str  # Value from source A
    value_b: str  # Value from source B
    source_a: str
    source_b: str
    severity: str  # "high", "medium", "low"
    explanation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "field": self.field,
            "value_a": self.value_a,
            "value_b": self.value_b,
            "source_a": self.source_a,
            "source_b": self.source_b,
            "severity": self.severity,
            "explanation": self.explanation,
        }

# ---------------------------------------------------------------------------
# Unified Entity Intelligence
# ---------------------------------------------------------------------------

@dataclass
class UnifiedEntityProfile:
    """
    Merged intelligence profile combining all Phase 1-8 data sources.
    """

    entity_name: str
    correlation_id: str

    # Risk assessment
    overall_risk: OverallRisk
    risk_score: float  # 0.0 – 100.0
    risk_factors: list[RiskFactor]

    # Dark web findings
    darkweb_mentions: int
    darkweb_threat_level: str | None
    darkweb_sites: list[str]

    # Breach data
    breach_count: int
    breach_severity: str | None
    exposed_data_types: list[str]
    paste_count: int

    # Crypto
    crypto_addresses: list[str]
    crypto_risk: str | None
    crypto_total_value_usd: float | None

    # Cross-source correlations
    corroborating_evidence: list[CorroboratingEvidence]
    identity_inconsistencies: list[IdentityInconsistency]

    # Surface web summary (from Phases 1-4)
    surface_web_sources: list[str]
    known_aliases: list[str]
    known_emails: list[str]
    known_phone_numbers: list[str]
    known_locations: list[str]
    known_employers: list[str]
    known_social_profiles: list[str]

    # Investigation intelligence
    key_findings: list[str]  # Bullet-point actionable findings
    recommended_actions: list[str]  # Next steps for investigator

    # Metadata
    data_sources_used: list[str]
    correlated_at: datetime
    correlation_duration_s: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_name": self.entity_name,
            "correlation_id": self.correlation_id,
            "overall_risk": self.overall_risk.value,
            "risk_score": round(self.risk_score, 1),
            "risk_factors": [r.to_dict() for r in self.risk_factors],
            "dark_web": {
                "mentions": self.darkweb_mentions,
                "threat_level": self.darkweb_threat_level,
                "sites": self.darkweb_sites,
            },
            "breaches": {
                "count": self.breach_count,
                "severity": self.breach_severity,
                "exposed_data_types": self.exposed_data_types,
                "paste_count": self.paste_count,
            },
            "cryptocurrency": {
                "addresses": self.crypto_addresses,
                "risk": self.crypto_risk,
                "total_usd_value": self.crypto_total_value_usd,
            },
            "corroborating_evidence": [c.to_dict() for c in self.corroborating_evidence],
            "identity_inconsistencies": [i.to_dict() for i in self.identity_inconsistencies],
            "surface_web": {
                "sources": self.surface_web_sources,
                "aliases": self.known_aliases,
                "emails": self.known_emails,
                "phones": self.known_phone_numbers,
                "locations": self.known_locations,
                "employers": self.known_employers,
                "social_profiles": self.known_social_profiles,
            },
            "key_findings": self.key_findings,
            "recommended_actions": self.recommended_actions,
            "data_sources_used": self.data_sources_used,
            "correlated_at": self.correlated_at.isoformat(),
            "correlation_duration_s": self.correlation_duration_s,
        }

# ---------------------------------------------------------------------------
# Risk Scorer
# ---------------------------------------------------------------------------

class RiskScorer:
    """
    Computes overall investigation risk score from all data sources.

    Score: 0 = no risk, 100 = maximum risk
    """

    # Weight table: source -> max contribution
    WEIGHTS = {
        "breach_critical": 30.0,
        "breach_high": 20.0,
        "breach_medium": 10.0,
        "breach_low": 5.0,
        "darkweb_critical": 35.0,
        "darkweb_high": 25.0,
        "darkweb_medium": 15.0,
        "darkweb_low": 5.0,
        "crypto_critical": 20.0,
        "crypto_high": 15.0,
        "crypto_medium": 8.0,
        "identity_inconsistency_high": 15.0,
        "identity_inconsistency_medium": 8.0,
        "paste_exposure": 5.0,
        "multiple_breaches": 10.0,
        "corroborating_evidence": 5.0,
    }

    def compute(
        self,
        breach_result: BreachScanResult | None,
        monitor_result: MonitorResult | None,
        crypto_result: CryptoTraceResult | None,
        surface_data: dict[str, Any] | None,
    ) -> tuple[float, list[RiskFactor]]:
        """
        Compute risk score and return (score, risk_factors).
        Score is capped at 100.
        """
        score = 0.0
        factors: list[RiskFactor] = []

        breach_score, breach_factors = self._score_breach_signals(breach_result)
        score += breach_score
        factors.extend(breach_factors)

        darkweb_score, darkweb_factors = self._score_darkweb_signals(monitor_result)
        score += darkweb_score
        factors.extend(darkweb_factors)

        crypto_score, crypto_factors = self._score_crypto_signals(crypto_result)
        score += crypto_score
        factors.extend(crypto_factors)

        return min(score, 100.0), factors

    def _score_breach_signals(
        self, breach_result: BreachScanResult | None
    ) -> tuple[float, list[RiskFactor]]:
        if not breach_result:
            return 0.0, []
        score = 0.0
        factors: list[RiskFactor] = []
        sev = breach_result.highest_severity
        if sev == BreachSeverity.CRITICAL:
            score += self.WEIGHTS["breach_critical"]
            factors.append(
                RiskFactor(
                    source="breach",
                    factor="Critical breach exposure (passwords + PII)",
                    weight=self.WEIGHTS["breach_critical"] / 100,
                    evidence=[
                        b.breach_name
                        for b in breach_result.breaches
                        if b.severity == BreachSeverity.CRITICAL
                    ],
                )
            )
        elif sev == BreachSeverity.HIGH:
            score += self.WEIGHTS["breach_high"]
            factors.append(
                RiskFactor(
                    source="breach",
                    factor="High-severity breach exposure",
                    weight=self.WEIGHTS["breach_high"] / 100,
                    evidence=[b.breach_name for b in breach_result.breaches[:3]],
                )
            )
        elif sev == BreachSeverity.MEDIUM:
            score += self.WEIGHTS["breach_medium"]
            factors.append(
                RiskFactor(
                    source="breach",
                    factor="Medium-severity breach exposure",
                    weight=self.WEIGHTS["breach_medium"] / 100,
                    evidence=[b.breach_name for b in breach_result.breaches[:3]],
                )
            )
        elif sev == BreachSeverity.LOW:
            score += self.WEIGHTS["breach_low"]
            factors.append(
                RiskFactor(
                    source="breach",
                    factor="Low-severity breach exposure (email only)",
                    weight=self.WEIGHTS["breach_low"] / 100,
                    evidence=[b.breach_name for b in breach_result.breaches[:3]],
                )
            )
        if len(breach_result.breaches) > 3:
            score += self.WEIGHTS["multiple_breaches"]
            factors.append(
                RiskFactor(
                    source="breach",
                    factor=f"Multiple breaches ({len(breach_result.breaches)})",
                    weight=self.WEIGHTS["multiple_breaches"] / 100,
                    evidence=[f"{len(breach_result.breaches)} total breach records"],
                )
            )
        if breach_result.paste_count > 0:
            score += self.WEIGHTS["paste_exposure"]
            factors.append(
                RiskFactor(
                    source="breach",
                    factor=f"Paste site exposure ({breach_result.paste_count} pastes)",
                    weight=self.WEIGHTS["paste_exposure"] / 100,
                    evidence=[f"{breach_result.paste_count} paste records found"],
                )
            )
        return score, factors

    def _score_darkweb_signals(
        self, monitor_result: MonitorResult | None
    ) -> tuple[float, list[RiskFactor]]:
        if not monitor_result:
            return 0.0, []
        score = 0.0
        factors: list[RiskFactor] = []
        ht = monitor_result.highest_threat
        if ht == ThreatLevel.CRITICAL:
            score += self.WEIGHTS["darkweb_critical"]
            factors.append(
                RiskFactor(
                    source="darkweb",
                    factor="Critical dark web mention (PII/direct threat)",
                    weight=self.WEIGHTS["darkweb_critical"] / 100,
                    evidence=[
                        m.site_name
                        for m in monitor_result.mentions
                        if m.threat_level == ThreatLevel.CRITICAL
                    ],
                )
            )
        elif ht == ThreatLevel.HIGH:
            score += self.WEIGHTS["darkweb_high"]
            factors.append(
                RiskFactor(
                    source="darkweb",
                    factor="High-threat dark web mention",
                    weight=self.WEIGHTS["darkweb_high"] / 100,
                    evidence=[m.site_name for m in monitor_result.mentions[:3]],
                )
            )
        elif ht == ThreatLevel.MEDIUM:
            score += self.WEIGHTS["darkweb_medium"]
            factors.append(
                RiskFactor(
                    source="darkweb",
                    factor="Medium-threat dark web mention",
                    weight=self.WEIGHTS["darkweb_medium"] / 100,
                    evidence=[m.site_name for m in monitor_result.mentions[:3]],
                )
            )
        elif ht == ThreatLevel.LOW:
            score += self.WEIGHTS["darkweb_low"]
            factors.append(
                RiskFactor(
                    source="darkweb",
                    factor="Low-threat dark web mention",
                    weight=self.WEIGHTS["darkweb_low"] / 100,
                    evidence=[m.site_name for m in monitor_result.mentions[:3]],
                )
            )
        return score, factors

    def _score_crypto_signals(
        self, crypto_result: CryptoTraceResult | None
    ) -> tuple[float, list[RiskFactor]]:
        if not crypto_result:
            return 0.0, []
        score = 0.0
        factors: list[RiskFactor] = []
        cr = crypto_result.highest_risk
        if cr == AddressRisk.CRITICAL:
            score += self.WEIGHTS["crypto_critical"]
            factors.append(
                RiskFactor(
                    source="crypto",
                    factor="Critical crypto risk (known mixer/darknet market)",
                    weight=self.WEIGHTS["crypto_critical"] / 100,
                    evidence=[
                        p.address
                        for p in crypto_result.profiles
                        if p.risk_level == AddressRisk.CRITICAL
                    ],
                )
            )
        elif cr == AddressRisk.HIGH:
            score += self.WEIGHTS["crypto_high"]
            factors.append(
                RiskFactor(
                    source="crypto",
                    factor="High crypto risk (mixer/tumbler patterns)",
                    weight=self.WEIGHTS["crypto_high"] / 100,
                    evidence=[p.address[:16] + "..." for p in crypto_result.profiles[:3]],
                )
            )
        elif cr == AddressRisk.MEDIUM:
            score += self.WEIGHTS["crypto_medium"]
            factors.append(
                RiskFactor(
                    source="crypto",
                    factor="Moderate crypto risk (unhosted wallet)",
                    weight=self.WEIGHTS["crypto_medium"] / 100,
                    evidence=[p.address[:16] + "..." for p in crypto_result.profiles[:3]],
                )
            )
        return score, factors

    def score_to_risk(self, score: float) -> OverallRisk:
        if score >= 80:
            return OverallRisk.CRITICAL
        if score >= 60:
            return OverallRisk.HIGH
        if score >= 40:
            return OverallRisk.ELEVATED
        if score >= 20:
            return OverallRisk.MODERATE
        if score > 0:
            return OverallRisk.LOW
        return OverallRisk.UNKNOWN

# ---------------------------------------------------------------------------
# Correlator
# ---------------------------------------------------------------------------

class EntityCorrelator:
    """
    Merges all investigation data sources into a unified entity profile.

    Takes outputs from:
      - BreachScanner (Phase 8.3)
      - MarketplaceMonitor (Phase 8.2)
      - CryptoTracer (Phase 8.4)
      - Surface web OSINT (Phases 1-4, passed as dict)

    And produces a UnifiedEntityProfile with risk scoring, corroboration
    analysis, and actionable intelligence.
    """

    def __init__(self):
        self.scorer = RiskScorer()

    def correlate(
        self,
        entity_name: str,
        breach_result: BreachScanResult | None = None,
        monitor_result: MonitorResult | None = None,
        crypto_result: CryptoTraceResult | None = None,
        surface_data: dict[str, Any] | None = None,
    ) -> UnifiedEntityProfile:
        """
        Correlate all data sources into a unified profile.

        Args:
            entity_name: Investigation target name
            breach_result: Output from BreachScanner.scan()
            monitor_result: Output from MarketplaceMonitor.scan_entity()
            crypto_result: Output from CryptoTracer.trace_addresses()
            surface_data: Dict with surface web OSINT (emails, aliases, etc.)

        Returns:
            UnifiedEntityProfile with full intelligence picture
        """
        start_time = time.time()
        correlation_id = hashlib.md5(f"{entity_name}{time.time()}".encode()).hexdigest()[:12]

        surface_data = surface_data or {}

        # ---- Risk scoring ----
        risk_score, risk_factors = self.scorer.compute(
            breach_result, monitor_result, crypto_result, surface_data
        )
        overall_risk = self.scorer.score_to_risk(risk_score)

        darkweb_mentions, darkweb_threat_level, darkweb_sites = self._extract_darkweb_summary(
            monitor_result
        )
        breach_count, breach_severity, exposed_data_types, paste_count = (
            self._extract_breach_summary(breach_result)
        )
        crypto_addresses, crypto_risk, crypto_total_value_usd = self._extract_crypto_summary(
            crypto_result
        )

        # ---- Surface web data ----
        known_aliases = surface_data.get("aliases", [])
        known_emails = surface_data.get("emails", [])
        known_phones = surface_data.get("phone_numbers", [])
        known_locations = surface_data.get("locations", [])
        known_employers = surface_data.get("employers", [])
        known_social = surface_data.get("social_profiles", [])
        surface_sources = surface_data.get("sources", [])

        # ---- Cross-source corroboration ----
        corroborating = self._find_corroborating_evidence(
            breach_result, monitor_result, crypto_result, surface_data
        )

        # ---- Identity inconsistency detection ----
        inconsistencies = self._detect_inconsistencies(surface_data)

        # ---- Key findings ----
        key_findings = self._generate_key_findings(
            entity_name,
            breach_result,
            monitor_result,
            crypto_result,
            corroborating,
            inconsistencies,
            overall_risk,
        )

        # ---- Recommended actions ----
        recommended_actions = self._generate_recommendations(
            overall_risk,
            breach_result,
            monitor_result,
            crypto_result,
            inconsistencies,
        )

        data_sources = self._build_data_sources(
            breach_result, monitor_result, crypto_result, surface_data, surface_sources
        )

        return UnifiedEntityProfile(
            entity_name=entity_name,
            correlation_id=correlation_id,
            overall_risk=overall_risk,
            risk_score=risk_score,
            risk_factors=risk_factors,
            darkweb_mentions=darkweb_mentions,
            darkweb_threat_level=darkweb_threat_level,
            darkweb_sites=darkweb_sites,
            breach_count=breach_count,
            breach_severity=breach_severity,
            exposed_data_types=exposed_data_types,
            paste_count=paste_count,
            crypto_addresses=crypto_addresses,
            crypto_risk=crypto_risk,
            crypto_total_value_usd=crypto_total_value_usd,
            corroborating_evidence=corroborating,
            identity_inconsistencies=inconsistencies,
            surface_web_sources=surface_sources,
            known_aliases=known_aliases,
            known_emails=known_emails,
            known_phone_numbers=known_phones,
            known_locations=known_locations,
            known_employers=known_employers,
            known_social_profiles=known_social,
            key_findings=key_findings,
            recommended_actions=recommended_actions,
            data_sources_used=data_sources,
            correlated_at=datetime.now(UTC),
            correlation_duration_s=time.time() - start_time,
        )

    def _extract_darkweb_summary(
        self, monitor_result: MonitorResult | None
    ) -> tuple[int, str | None, list[str]]:
        if not monitor_result:
            return 0, None, []
        threat_level = monitor_result.highest_threat.value if monitor_result.highest_threat else None
        sites = list({m.site_name for m in monitor_result.mentions})
        return len(monitor_result.mentions), threat_level, sites

    def _extract_breach_summary(
        self, breach_result: BreachScanResult | None
    ) -> tuple[int, str | None, list[str], int]:
        if not breach_result:
            return 0, None, [], 0
        severity = breach_result.highest_severity.value if breach_result.highest_severity else None
        return (
            len(breach_result.breaches),
            severity,
            breach_result.exposed_data_types,
            len(breach_result.pastes),
        )

    def _extract_crypto_summary(
        self, crypto_result: CryptoTraceResult | None
    ) -> tuple[list[str], str | None, float | None]:
        if not crypto_result:
            return [], None, None
        risk = crypto_result.highest_risk.value if crypto_result.highest_risk else None
        return crypto_result.addresses_queried, risk, crypto_result.total_usd_value

    def _build_data_sources(
        self,
        breach_result: BreachScanResult | None,
        monitor_result: MonitorResult | None,
        crypto_result: CryptoTraceResult | None,
        surface_data: dict[str, Any],
        surface_sources: list[str],
    ) -> list[str]:
        sources: list[str] = []
        if breach_result:
            sources.append("HIBP Breach Database")
            if breach_result.paste_count > 0:
                sources.append("Paste Site Monitor")
        if monitor_result:
            sources.append("Dark Web Marketplace Monitor")
        if crypto_result:
            sources.append("Blockchain Analysis")
        if surface_data:
            sources.extend(surface_sources)
        return sources

    def _find_corroborating_evidence(
        self,
        breach_result: BreachScanResult | None,
        monitor_result: MonitorResult | None,
        crypto_result: CryptoTraceResult | None,
        surface_data: dict[str, Any],
    ) -> list[CorroboratingEvidence]:
        """Find values that appear in multiple independent sources."""
        corroborating: list[CorroboratingEvidence] = []
        corroborating.extend(
            self._corroborate_emails(breach_result, set(surface_data.get("emails", [])))
        )
        corroborating.extend(
            self._corroborate_usernames(monitor_result, set(surface_data.get("usernames", [])))
        )
        corroborating.extend(self._corroborate_crypto_addresses(crypto_result, monitor_result))
        return corroborating

    def _corroborate_emails(
        self, breach_result: BreachScanResult | None, surface_emails: set[str]
    ) -> list[CorroboratingEvidence]:
        if not breach_result or not surface_emails:
            return []
        matched = surface_emails & set(breach_result.query_terms)
        result = []
        for email in matched:
            sources = ["surface_web_osint"]
            if any(b.query_term == email for b in breach_result.breaches):
                sources.append("hibp_breach_database")
            if len(sources) > 1:
                result.append(
                    CorroboratingEvidence(
                        evidence_type="email",
                        value=email,
                        sources=sources,
                        confidence=0.95,
                    )
                )
        return result

    def _corroborate_usernames(
        self, monitor_result: MonitorResult | None, surface_usernames: set[str]
    ) -> list[CorroboratingEvidence]:
        if not monitor_result or not surface_usernames:
            return []
        result = []
        for mention in monitor_result.mentions:
            for term in mention.matched_terms:
                if term in surface_usernames:
                    result.append(
                        CorroboratingEvidence(
                            evidence_type="username",
                            value=term,
                            sources=["surface_web_osint", mention.site_name],
                            confidence=mention.confidence,
                        )
                    )
        return result

    def _corroborate_crypto_addresses(
        self,
        crypto_result: CryptoTraceResult | None,
        monitor_result: MonitorResult | None,
    ) -> list[CorroboratingEvidence]:
        if not crypto_result or not monitor_result:
            return []
        crypto_addrs = set(crypto_result.addresses_queried)
        result = []
        for mention in monitor_result.mentions:
            for addr in crypto_addrs:
                if addr.lower() in mention.context_snippet.lower():
                    result.append(
                        CorroboratingEvidence(
                            evidence_type="crypto_address",
                            value=addr,
                            sources=["blockchain_analysis", mention.site_name],
                            confidence=0.9,
                        )
                    )
        return result

    def _detect_inconsistencies(self, surface_data: dict[str, Any]) -> list[IdentityInconsistency]:
        """Detect identity inconsistencies within surface web data."""
        inconsistencies = []

        # Check for multiple conflicting locations
        locations = surface_data.get("locations", [])
        if len(locations) > 3:
            inconsistencies.append(
                IdentityInconsistency(
                    field="location",
                    value_a=locations[0],
                    value_b=", ".join(locations[1:3]),
                    source_a="primary_source",
                    source_b="secondary_sources",
                    severity="medium",
                    explanation=(
                        f"Subject associated with {len(locations)} different locations, "
                        "which may indicate frequent relocation, multiple residences, "
                        "or use of false addresses."
                    ),
                )
            )

        # Check for age inconsistencies across profiles
        birth_years = surface_data.get("birth_years", [])
        if len(set(birth_years)) > 1:
            inconsistencies.append(
                IdentityInconsistency(
                    field="birth_year",
                    value_a=str(birth_years[0]),
                    value_b=str(birth_years[-1]),
                    source_a="profile_a",
                    source_b="profile_b",
                    severity="high",
                    explanation=(
                        "Conflicting birth years detected across profiles. "
                        "This is a strong indicator of identity falsification."
                    ),
                )
            )

        # Check for name variations that exceed normal nickname patterns
        names = surface_data.get("all_names", [])
        if len(names) > 4:
            inconsistencies.append(
                IdentityInconsistency(
                    field="name",
                    value_a=names[0],
                    value_b=f"{len(names) - 1} additional name variants",
                    source_a="primary_profile",
                    source_b="multiple_sources",
                    severity="medium",
                    explanation=(
                        f"Subject uses {len(names)} different name variants. "
                        "While some variation is normal, this volume warrants review."
                    ),
                )
            )

        return inconsistencies

    def _generate_key_findings(
        self,
        entity_name: str,
        breach_result: BreachScanResult | None,
        monitor_result: MonitorResult | None,
        crypto_result: CryptoTraceResult | None,
        corroborating: list[CorroboratingEvidence],
        inconsistencies: list[IdentityInconsistency],
        overall_risk: OverallRisk,
    ) -> list[str]:
        """Generate bullet-point key findings for the investigator."""
        findings = []

        findings.append(f"Overall risk assessment: {overall_risk.value.upper()}")

        if breach_result and breach_result.breaches:
            findings.append(
                f"Subject appears in {len(breach_result.breaches)} data breach(es). "
                f"Exposed data includes: {', '.join(breach_result.exposed_data_types[:4])}."
            )

        if breach_result and breach_result.paste_count > 0:
            findings.append(
                f"Subject's PII found in {breach_result.paste_count} paste site(s), "
                "indicating active data exposure."
            )

        if monitor_result and monitor_result.mentions:
            findings.append(
                f"Dark web monitoring found {len(monitor_result.mentions)} mention(s) "
                f"across {monitor_result.sites_scanned} sites scanned. "
                f"Highest threat: {monitor_result.highest_threat.value if monitor_result.highest_threat else 'none'}."
            )

        if crypto_result and crypto_result.profiles:
            risky = [
                p
                for p in crypto_result.profiles
                if p.risk_level.value in ("critical", "high", "medium")
            ]
            if risky:
                findings.append(
                    f"Cryptocurrency analysis flagged {len(risky)} address(es) "
                    f"with elevated risk. Risk level: {crypto_result.highest_risk.value}."
                )
            else:
                findings.append(
                    f"Cryptocurrency addresses found ({len(crypto_result.profiles)}) "
                    "with no significant risk signals."
                )

        if corroborating:
            findings.append(
                f"Cross-source corroboration: {len(corroborating)} piece(s) of evidence "
                "confirmed across multiple independent sources, increasing confidence."
            )

        if inconsistencies:
            high_sev = [i for i in inconsistencies if i.severity == "high"]
            if high_sev:
                findings.append(
                    f"IDENTITY INCONSISTENCY: {len(high_sev)} high-severity identity "
                    "discrepancy(ies) detected — possible fake identity or multiple personas."
                )

        if not findings[1:]:  # Only the risk header
            findings.append(
                "No significant risk signals detected across all data sources. "
                "Subject appears clean based on available intelligence."
            )

        return findings

    def _generate_recommendations(
        self,
        overall_risk: OverallRisk,
        breach_result: BreachScanResult | None,
        monitor_result: MonitorResult | None,
        crypto_result: CryptoTraceResult | None,
        inconsistencies: list[IdentityInconsistency],
    ) -> list[str]:
        """Generate recommended next actions for the investigator."""
        actions = []

        if overall_risk in (OverallRisk.CRITICAL, OverallRisk.HIGH):
            actions.append(
                "URGENT: Escalate to senior investigator — critical/high risk profile detected."
            )

        if breach_result and breach_result.highest_severity in (
            BreachSeverity.CRITICAL,
            BreachSeverity.HIGH,
        ):
            actions.append(
                "Obtain full breach record details via HIBP API for password/credential exposure."
            )

        if monitor_result and monitor_result.highest_threat in (
            ThreatLevel.CRITICAL,
            ThreatLevel.HIGH,
        ):
            actions.append("Archive dark web page content as evidence before it disappears.")
            actions.append("Consider law enforcement referral if critical threat detected.")

        if crypto_result and crypto_result.highest_risk in (AddressRisk.CRITICAL, AddressRisk.HIGH):
            actions.append(
                "Request full blockchain transaction history from Chainalysis or "
                "similar blockchain analytics service."
            )
            actions.append("Check OFAC sanctions list for cryptocurrency addresses.")

        if inconsistencies:
            actions.append(
                "Conduct identity verification — request government-issued ID and "
                "cross-reference against official records."
            )
            actions.append(
                "Check for multiple identity documents (passport, driver's license) "
                "across different jurisdictions."
            )

        if not actions:
            actions.append("No immediate action required. Continue standard monitoring.")
            actions.append("Re-run dark web scan in 30 days for ongoing monitoring.")

        return actions

# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_correlator_instance: EntityCorrelator | None = None

def get_entity_correlator() -> EntityCorrelator:
    """Get or create the global EntityCorrelator instance."""
    global _correlator_instance
    if _correlator_instance is None:
        _correlator_instance = EntityCorrelator()
    return _correlator_instance
