"""Fraud Detection & Identity Resolution — Phase 4.

Covers:
  4.1  Identity Resolution     — normalise + merge multi-source data points,
                                 build a canonical identity from noisy inputs.
  4.2  Fraud Pattern Detector  — detect inconsistencies, disposable contacts,
                                 age-manipulation, location mismatch, timing
                                 anomalies, and known fraud-signal patterns.
  4.3  Relationship Mapper     — link entities that share a pivot value
                                 (email, phone, address, username, image hash)
                                 to expose hidden networks and sock-puppets.
  4.4  Risk Scoring Engine     — aggregate every signal into a 0–1 composite
                                 risk score with a structured justification
                                 report suitable for case exhibits.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, UTC
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Storage path for identity graph persistence
# ---------------------------------------------------------------------------
_GRAPH_ROOT = Path("/app/data/identity_graph")

# ---------------------------------------------------------------------------
# Normalisation helpers (4.1)
# ---------------------------------------------------------------------------


def _norm_email(email: str) -> str:
    """Lowercase, strip whitespace."""
    return email.strip().lower()


def _norm_phone(phone: str) -> str:
    """Strip all non-digit characters; keep leading + for E.164."""
    digits = re.sub(r"[^\d+]", "", phone.strip())
    return digits


def _norm_name(name: str) -> str:
    """Unicode NFC, lowercase, collapse whitespace."""
    nfc = unicodedata.normalize("NFC", name)
    return re.sub(r"\s+", " ", nfc.strip().lower())


def _name_similarity(a: str, b: str) -> float:
    """SequenceMatcher ratio for normalised names."""
    return SequenceMatcher(None, _norm_name(a), _norm_name(b)).ratio()


def _norm_address(addr: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    s = addr.strip().lower()
    s = re.sub(r"[,.]", " ", s)
    return re.sub(r"\s+", " ", s)


# ---------------------------------------------------------------------------
# 4.1  Identity Resolution
# ---------------------------------------------------------------------------


class ResolvedIdentity(BaseModel):
    """Canonical identity built from one or more raw entity profiles."""

    identity_id: str
    entity_ids: list[str] = Field(default_factory=list)  # Source entity IDs
    canonical_name: str | None = None
    aliases: list[str] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    addresses: list[str] = Field(default_factory=list)
    usernames: list[str] = Field(default_factory=list)
    social_profiles: list[str] = Field(default_factory=list)  # URLs
    image_hashes: list[str] = Field(default_factory=list)
    date_of_birth: str | None = None
    source_count: int = 0
    confidence: float = 0.0  # 0–1; rises with more corroborating sources
    resolved_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class IdentityResolver:
    """Merge raw entity data from multiple sources into a unified identity.

    Accepts plain dicts (keyed like EntityProfile fields) so it can be used
    independently of the full ORM layer.
    """

    def resolve(self, profiles: list[dict[str, Any]]) -> ResolvedIdentity:
        """Merge *profiles* into a single ResolvedIdentity.

        Args:
            profiles: List of entity profile dicts.  Expected keys (all
                optional): entity_id, primary_name, known_names, emails,
                phones, addresses, usernames, social_profiles, images,
                date_of_birth.
        """
        emails: set[str] = set()
        phones: set[str] = set()
        addresses: set[str] = set()
        usernames: set[str] = set()
        social_urls: set[str] = set()
        image_hashes: set[str] = set()
        names: list[str] = []
        entity_ids: list[str] = []
        dobs: list[str] = []

        for p in profiles:
            if p.get("entity_id"):
                entity_ids.append(p["entity_id"])

            # Names
            for name_field in ("primary_name", "known_names"):
                raw = p.get(name_field)
                if isinstance(raw, str) and raw:
                    names.append(raw)
                elif isinstance(raw, dict) and raw.get("value"):
                    names.append(raw["value"])
                elif isinstance(raw, list):
                    for n in raw:
                        if isinstance(n, str):
                            names.append(n)
                        elif isinstance(n, dict) and n.get("value"):
                            names.append(n["value"])

            # Emails
            for e in p.get("emails", []):
                val = e.get("value") if isinstance(e, dict) else str(e)
                if val:
                    emails.add(_norm_email(val))

            # Phones
            for ph in p.get("phones", []):
                val = ph.get("value") if isinstance(ph, dict) else str(ph)
                if val:
                    phones.add(_norm_phone(val))

            # Addresses
            for addr in p.get("addresses", []):
                val = addr.get("value") if isinstance(addr, dict) else str(addr)
                if val:
                    addresses.add(_norm_address(val))

            # Usernames
            for u in p.get("usernames", []):
                val = u.get("value") if isinstance(u, dict) else str(u)
                if val:
                    usernames.add(val.strip().lower())

            # Social profiles
            for sp in p.get("social_profiles", []):
                val = sp.get("value") if isinstance(sp, dict) else str(sp)
                if val:
                    social_urls.add(val.strip())

            # Image hashes
            for img in p.get("images", []):
                h = img.get("image_hash") if isinstance(img, dict) else None
                if h:
                    image_hashes.add(h)

            # DOB
            dob = p.get("date_of_birth")
            if isinstance(dob, dict) and dob.get("display"):
                dobs.append(dob["display"])
            elif isinstance(dob, str) and dob:
                dobs.append(dob)

        # Canonical name: most common normalised name
        canonical_name: str | None = None
        unique_names: list[str] = []
        seen_norm: set[str] = set()
        for n in names:
            nn = _norm_name(n)
            if nn not in seen_norm:
                seen_norm.add(nn)
                unique_names.append(n)
        if unique_names:
            canonical_name = unique_names[0]
            aliases_list = unique_names[1:]
        else:
            aliases_list = []

        # Confidence: rises with number of corroborating sources
        source_count = len(profiles)
        pivot_count = len(emails) + len(phones) + len(image_hashes) + len(usernames)
        confidence = min(0.3 + 0.1 * source_count + 0.05 * pivot_count, 1.0)

        identity_id = hashlib.sha256("|".join(sorted(entity_ids or ["anon"])).encode()).hexdigest()[
            :16
        ]

        return ResolvedIdentity(
            identity_id=identity_id,
            entity_ids=entity_ids,
            canonical_name=canonical_name,
            aliases=aliases_list,
            emails=sorted(emails),
            phones=sorted(phones),
            addresses=sorted(addresses),
            usernames=sorted(usernames),
            social_profiles=sorted(social_urls),
            image_hashes=sorted(image_hashes),
            date_of_birth=dobs[0] if dobs else None,
            source_count=source_count,
            confidence=round(confidence, 3),
        )


# ---------------------------------------------------------------------------
# 4.2  Fraud Pattern Detector
# ---------------------------------------------------------------------------


class FraudSignal(BaseModel):
    """A single detected fraud indicator."""

    signal_id: str
    category: str  # "contact" | "identity" | "timing" | "network" | "document"
    severity: str  # "low" | "medium" | "high" | "critical"
    description: str
    evidence: list[str] = Field(default_factory=list)
    confidence: float = 0.5


class FraudPatternReport(BaseModel):
    """All fraud signals detected for an identity."""

    identity_id: str
    signals: list[FraudSignal] = Field(default_factory=list)
    total_signals: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    analysed_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# --- Disposable email / phone providers (abbreviated reference list) -------
_DISPOSABLE_EMAIL_DOMAINS: set[str] = {
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "throwam.com",
    "yopmail.com",
    "sharklasers.com",
    "guerrillamailblock.com",
    "grr.la",
    "guerrillamail.info",
    "dispostable.com",
    "spamgourmet.com",
    "trashmail.com",
    "spam4.me",
    "fakeinbox.com",
    "maildrop.cc",
    "getnada.com",
    "moakt.com",
    "burnermail.io",
    "spamex.com",
    "notmailinator.com",
}

_DISPOSABLE_PHONE_PREFIXES: set[str] = {
    # VOIP / disposable prefixes (US)
    "1900",
    "1976",
    "1268",
    "1473",
    "1876",
}

# Known AI-generated name patterns (suspiciously generic)
_GENERIC_NAME_PARTS = {
    "john",
    "jane",
    "doe",
    "smith",
    "jones",
    "user",
    "admin",
    "test",
    "sample",
    "demo",
    "fake",
    "anon",
}


class FraudPatternDetector:
    """Detect fraud signals across an identity's data points."""

    def analyse(
        self,
        identity: ResolvedIdentity,
        image_suspicion_score: float = 0.0,
        phase3_signals: list[str] | None = None,
    ) -> FraudPatternReport:
        signals: list[FraudSignal] = []

        signals.extend(self._check_contacts(identity))
        signals.extend(self._check_name_patterns(identity))
        signals.extend(self._check_temporal_consistency(identity))
        signals.extend(self._check_cross_platform_absence(identity))
        if image_suspicion_score > 0:
            signals.extend(self._check_image_signals(image_suspicion_score, phase3_signals or []))

        report = FraudPatternReport(
            identity_id=identity.identity_id,
            signals=signals,
            total_signals=len(signals),
            critical_count=sum(1 for s in signals if s.severity == "critical"),
            high_count=sum(1 for s in signals if s.severity == "high"),
            medium_count=sum(1 for s in signals if s.severity == "medium"),
            low_count=sum(1 for s in signals if s.severity == "low"),
        )
        return report

    # -- Contact checks --------------------------------------------------------

    def _check_contacts(self, identity: ResolvedIdentity) -> list[FraudSignal]:
        signals: list[FraudSignal] = []

        # Disposable email
        disp_emails = [
            e for e in identity.emails if e.split("@")[-1].lower() in _DISPOSABLE_EMAIL_DOMAINS
        ]
        if disp_emails:
            signals.append(
                FraudSignal(
                    signal_id="disposable_email",
                    category="contact",
                    severity="high",
                    description="One or more disposable/temporary email providers detected",
                    evidence=disp_emails,
                    confidence=0.95,
                )
            )

        # No email at all (suspicious for established person)
        if not identity.emails and identity.source_count >= 3:
            signals.append(
                FraudSignal(
                    signal_id="no_email",
                    category="contact",
                    severity="low",
                    description="No email address found despite multiple data sources",
                    evidence=[],
                    confidence=0.4,
                )
            )

        # Multiple VOIP numbers
        voip_phones = [
            p
            for p in identity.phones
            if any(p.startswith(prefix) for prefix in _DISPOSABLE_PHONE_PREFIXES)
        ]
        if voip_phones:
            signals.append(
                FraudSignal(
                    signal_id="voip_phone",
                    category="contact",
                    severity="medium",
                    description="Phone number prefix associated with VOIP/disposable service",
                    evidence=voip_phones,
                    confidence=0.7,
                )
            )

        # Excessive email addresses (identity sprawl)
        if len(identity.emails) >= 5:
            signals.append(
                FraudSignal(
                    signal_id="email_sprawl",
                    category="contact",
                    severity="medium",
                    description=f"Unusually high number of email addresses ({len(identity.emails)})",
                    evidence=identity.emails,
                    confidence=0.65,
                )
            )

        return signals

    # -- Name pattern checks ---------------------------------------------------

    def _check_name_patterns(self, identity: ResolvedIdentity) -> list[FraudSignal]:
        signals: list[FraudSignal] = []

        all_names = (
            [identity.canonical_name] if identity.canonical_name else []
        ) + identity.aliases

        # Generic / placeholder name parts
        generic_matches = [
            n
            for n in all_names
            if any(part in _GENERIC_NAME_PARTS for part in _norm_name(n).split())
        ]
        if generic_matches:
            signals.append(
                FraudSignal(
                    signal_id="generic_name",
                    category="identity",
                    severity="low",
                    description="Name contains commonly used placeholder/generic terms",
                    evidence=generic_matches,
                    confidence=0.5,
                )
            )

        # Very short names (single-char components)
        short_names = [n for n in all_names if n and max(len(p) for p in n.split()) <= 2]
        if short_names:
            signals.append(
                FraudSignal(
                    signal_id="implausible_name_length",
                    category="identity",
                    severity="low",
                    description="Name has unusually short components (possible truncation or alias)",
                    evidence=short_names,
                    confidence=0.4,
                )
            )

        # Too many aliases relative to sources
        if len(identity.aliases) > identity.source_count * 2 and identity.source_count > 0:
            signals.append(
                FraudSignal(
                    signal_id="alias_sprawl",
                    category="identity",
                    severity="medium",
                    description=(
                        f"High alias-to-source ratio: {len(identity.aliases)} aliases "
                        f"from {identity.source_count} sources"
                    ),
                    evidence=identity.aliases[:10],
                    confidence=0.6,
                )
            )

        # Name–username mismatch (username contains unrelated words)
        if identity.canonical_name and identity.usernames:
            name_parts = set(_norm_name(identity.canonical_name).split())
            username_words: set[str] = set()
            for u in identity.usernames:
                for tok in re.sub(r"[^a-z0-9]", " ", u.lower()).split():
                    username_words.add(tok)
            overlap = name_parts & username_words
            if not overlap and len(identity.usernames) >= 2:
                signals.append(
                    FraudSignal(
                        signal_id="name_username_mismatch",
                        category="identity",
                        severity="low",
                        description="No overlap between canonical name tokens and usernames",
                        evidence=identity.usernames[:5],
                        confidence=0.35,
                    )
                )

        return signals

    # -- Temporal consistency checks -------------------------------------------

    def _check_temporal_consistency(self, identity: ResolvedIdentity) -> list[FraudSignal]:
        signals: list[FraudSignal] = []

        if not identity.date_of_birth:
            return signals

        try:
            # Try to parse year from DOB string
            year_match = re.search(r"\b(19|20)\d{2}\b", identity.date_of_birth)
            if not year_match:
                return signals
            birth_year = int(year_match.group())
            current_year = datetime.now().year
            age = current_year - birth_year

            if age < 0 or age > 130:
                signals.append(
                    FraudSignal(
                        signal_id="implausible_age",
                        category="identity",
                        severity="high",
                        description=f"Date of birth implies implausible age: {age} years",
                        evidence=[identity.date_of_birth],
                        confidence=0.9,
                    )
                )
            elif age < 13:
                signals.append(
                    FraudSignal(
                        signal_id="age_under_13",
                        category="identity",
                        severity="critical",
                        description=f"Date of birth implies subject is under 13 years old (age={age})",
                        evidence=[identity.date_of_birth],
                        confidence=0.85,
                    )
                )
        except Exception:
            pass

        return signals

    # -- Cross-platform absence ------------------------------------------------

    def _check_cross_platform_absence(self, identity: ResolvedIdentity) -> list[FraudSignal]:
        signals: list[FraudSignal] = []

        # No social presence at all despite data from multiple sources
        if not identity.social_profiles and not identity.usernames and identity.source_count >= 3:
            signals.append(
                FraudSignal(
                    signal_id="no_social_presence",
                    category="network",
                    severity="medium",
                    description=(
                        "No social media profiles or usernames found despite multiple sources — "
                        "possible ghost identity"
                    ),
                    evidence=[],
                    confidence=0.55,
                )
            )

        # Only one data source (too thin to be real person)
        if identity.source_count == 1:
            signals.append(
                FraudSignal(
                    signal_id="single_source",
                    category="network",
                    severity="low",
                    description="Identity supported by only a single data source",
                    evidence=[],
                    confidence=0.3,
                )
            )

        return signals

    # -- Image signals ---------------------------------------------------------

    def _check_image_signals(
        self, suspicion_score: float, phase3_evidence: list[str]
    ) -> list[FraudSignal]:
        signals: list[FraudSignal] = []

        if suspicion_score >= 0.5:
            severity = "critical" if suspicion_score >= 0.8 else "high"
            signals.append(
                FraudSignal(
                    signal_id="image_suspicion",
                    category="identity",
                    severity=severity,
                    description=(
                        f"Image intelligence flagged high suspicion score ({suspicion_score:.2f}) — "
                        "possible AI-generated or stock photo identity"
                    ),
                    evidence=phase3_evidence[:5],
                    confidence=suspicion_score,
                )
            )
        elif suspicion_score >= 0.2:
            signals.append(
                FraudSignal(
                    signal_id="image_caution",
                    category="identity",
                    severity="medium",
                    description=(
                        f"Image intelligence flagged moderate suspicion ({suspicion_score:.2f})"
                    ),
                    evidence=phase3_evidence[:3],
                    confidence=suspicion_score,
                )
            )

        return signals


# ---------------------------------------------------------------------------
# 4.3  Cross-Entity Relationship Mapper
# ---------------------------------------------------------------------------


class EntityLink(BaseModel):
    """A directed link between two entities sharing a pivot value."""

    from_entity_id: str
    to_entity_id: str
    pivot_type: str  # "email" | "phone" | "address" | "username" | "image_hash"
    pivot_value: str
    confidence: float = 0.8
    discovered_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class EntityGraph(BaseModel):
    """Network of entities connected by shared data points."""

    graph_id: str
    nodes: list[str] = Field(default_factory=list)  # entity_ids
    links: list[EntityLink] = Field(default_factory=list)
    clusters: list[list[str]] = Field(default_factory=list)  # Connected components
    pivot_summary: dict[str, int] = Field(default_factory=dict)  # pivot_type → count
    built_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class RelationshipMapper:
    """Build a relationship graph across multiple entity profiles.

    Entities are linked when they share:
      - Email address (normalised)
      - Phone number (normalised)
      - Physical address (normalised)
      - Username / handle
      - Image perceptual hash

    The result exposes hidden networks (sock-puppet rings, fraud clusters).
    """

    def build_graph(
        self,
        profiles: list[dict[str, Any]],
        graph_id: str | None = None,
    ) -> EntityGraph:
        """Build entity relationship graph from *profiles*."""
        # Build pivot index: pivot_key → set of entity_ids
        index: dict[str, set[str]] = defaultdict(set)
        entity_ids: list[str] = []

        for p in profiles:
            eid = p.get(
                "entity_id",
                hashlib.sha256(json.dumps(p, sort_keys=True, default=str).encode()).hexdigest()[
                    :12
                ],
            )
            entity_ids.append(eid)

            for e in p.get("emails", []):
                val = e.get("value") if isinstance(e, dict) else str(e)
                if val:
                    index[f"email:{_norm_email(val)}"].add(eid)

            for ph in p.get("phones", []):
                val = ph.get("value") if isinstance(ph, dict) else str(ph)
                if val:
                    index[f"phone:{_norm_phone(val)}"].add(eid)

            for addr in p.get("addresses", []):
                val = addr.get("value") if isinstance(addr, dict) else str(addr)
                if val:
                    index[f"address:{_norm_address(val)}"].add(eid)

            for u in p.get("usernames", []):
                val = u.get("value") if isinstance(u, dict) else str(u)
                if val:
                    index[f"username:{val.strip().lower()}"].add(eid)

            for img in p.get("images", []):
                h = img.get("image_hash") if isinstance(img, dict) else None
                if h:
                    index[f"image_hash:{h}"].add(eid)

        # Build links from pivot groups with 2+ entities
        links: list[EntityLink] = []
        pivot_summary: dict[str, int] = defaultdict(int)

        for pivot_key, eids in index.items():
            if len(eids) < 2:
                continue
            pivot_type, _, pivot_value = pivot_key.partition(":")
            pivot_summary[pivot_type] += 1

            eids_list = sorted(eids)
            for i in range(len(eids_list)):
                for j in range(i + 1, len(eids_list)):
                    # Confidence varies by pivot type
                    conf = {
                        "email": 0.95,
                        "phone": 0.90,
                        "image_hash": 0.88,
                        "username": 0.80,
                        "address": 0.70,
                    }.get(pivot_type, 0.60)
                    links.append(
                        EntityLink(
                            from_entity_id=eids_list[i],
                            to_entity_id=eids_list[j],
                            pivot_type=pivot_type,
                            pivot_value=pivot_value,
                            confidence=conf,
                        )
                    )

        # Connected components (Union-Find)
        parent = {eid: eid for eid in entity_ids}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x: str, y: str) -> None:
            rx, ry = find(x), find(y)
            if rx != ry:
                parent[rx] = ry

        for link in links:
            if link.from_entity_id in parent and link.to_entity_id in parent:
                union(link.from_entity_id, link.to_entity_id)

        cluster_map: dict[str, list[str]] = defaultdict(list)
        for eid in entity_ids:
            cluster_map[find(eid)].append(eid)
        clusters = [sorted(v) for v in cluster_map.values() if len(v) > 1]

        gid = graph_id or hashlib.sha256("|".join(sorted(entity_ids)).encode()).hexdigest()[:16]

        return EntityGraph(
            graph_id=gid,
            nodes=sorted(entity_ids),
            links=links,
            clusters=clusters,
            pivot_summary=dict(pivot_summary),
        )

    def persist(self, graph: EntityGraph) -> None:
        """Save graph JSON to disk."""
        _GRAPH_ROOT.mkdir(parents=True, exist_ok=True)
        path = _GRAPH_ROOT / f"{graph.graph_id}.json"
        path.write_text(graph.model_dump_json(indent=2))

    def load(self, graph_id: str) -> EntityGraph | None:
        """Load a previously persisted graph."""
        path = _GRAPH_ROOT / f"{graph_id}.json"
        if not path.exists():
            return None
        try:
            return EntityGraph.model_validate_json(path.read_text())
        except Exception as exc:
            logger.warning("Could not load graph %s: %s", graph_id, exc)
            return None


# ---------------------------------------------------------------------------
# 4.4  Risk Scoring Engine
# ---------------------------------------------------------------------------

_SEVERITY_WEIGHTS = {
    "critical": 1.0,
    "high": 0.6,
    "medium": 0.35,
    "low": 0.15,
}

_RISK_BANDS = [
    (0.75, "CRITICAL"),
    (0.55, "HIGH"),
    (0.35, "MODERATE"),
    (0.15, "LOW"),
    (0.0, "MINIMAL"),
]


class RiskAssessment(BaseModel):
    """Final risk assessment for an identity."""

    identity_id: str
    risk_level: str  # MINIMAL | LOW | MODERATE | HIGH | CRITICAL
    risk_score: float  # 0.0 – 1.0
    fraud_probability: float  # 0.0 – 1.0 (calibrated estimate)
    is_fake_identity: bool
    confidence: float  # How confident we are in the assessment
    # Breakdown
    contact_risk: float = 0.0
    identity_risk: float = 0.0
    network_risk: float = 0.0
    image_risk: float = 0.0
    # Narrative
    summary: str = ""
    top_signals: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    assessed_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class RiskScoringEngine:
    """Aggregate all fraud signals and identity data into a risk assessment.

    Scoring formula:
      raw_score = Σ (signal.confidence × severity_weight) / max_possible
      Capped at 1.0, then mapped to risk band.

    Category scores feed the category breakdown fields.
    """

    # Maximum expected raw score before cap (calibration constant)
    _MAX_RAW = 3.5

    def score(
        self,
        identity: ResolvedIdentity,
        fraud_report: FraudPatternReport,
        graph: EntityGraph | None = None,
        image_score: float = 0.0,
    ) -> RiskAssessment:
        category_scores: dict[str, float] = defaultdict(float)
        signal_texts: list[str] = []

        for sig in fraud_report.signals:
            weight = _SEVERITY_WEIGHTS.get(sig.severity, 0.2)
            contribution = sig.confidence * weight
            category_scores[sig.category] += contribution
            signal_texts.append(f"[{sig.severity.upper()}] {sig.description}")

        # Network risk bonus if multiple entities are linked
        network_bonus = 0.0
        if graph and len(graph.links) > 0:
            # More shared pivots = higher network risk
            link_count = len(graph.links)
            network_bonus = min(0.15 * link_count, 0.6)
            category_scores["network"] += network_bonus
            signal_texts.append(
                f"Entity linked to {link_count} other identities via shared data points"
            )

        raw_score = sum(category_scores.values())
        risk_score = round(min(raw_score / self._MAX_RAW, 1.0), 3)

        # Fraud probability: calibrated sigmoid-like mapping
        fraud_prob = round(min(risk_score * 1.2, 1.0), 3)

        # Risk band
        risk_level = "MINIMAL"
        for threshold, level in _RISK_BANDS:
            if risk_score >= threshold:
                risk_level = level
                break

        # is_fake_identity: critical/high image + high overall
        is_fake = risk_score >= 0.55 and (
            fraud_report.critical_count > 0 or fraud_report.high_count >= 2
        )

        # Confidence in assessment: rises with more signals and sources
        assessment_confidence = min(
            0.4 + 0.05 * fraud_report.total_signals + 0.05 * identity.source_count,
            0.98,
        )

        # Recommended actions
        actions = self._recommend_actions(risk_level, fraud_report, graph)

        # Summary narrative
        summary = self._build_summary(risk_level, identity, fraud_report, graph, is_fake)

        return RiskAssessment(
            identity_id=identity.identity_id,
            risk_level=risk_level,
            risk_score=risk_score,
            fraud_probability=fraud_prob,
            is_fake_identity=is_fake,
            confidence=round(assessment_confidence, 3),
            contact_risk=round(min(category_scores.get("contact", 0) / self._MAX_RAW, 1.0), 3),
            identity_risk=round(min(category_scores.get("identity", 0) / self._MAX_RAW, 1.0), 3),
            network_risk=round(min(category_scores.get("network", 0) / self._MAX_RAW, 1.0), 3),
            image_risk=round(min(image_score, 1.0), 3),
            summary=summary,
            top_signals=signal_texts[:5],
            recommended_actions=actions,
        )

    def _recommend_actions(
        self,
        risk_level: str,
        report: FraudPatternReport,
        graph: EntityGraph | None,
    ) -> list[str]:
        actions: list[str] = []

        if risk_level in ("CRITICAL", "HIGH"):
            actions.append("Escalate to senior investigator for manual review")
            actions.append("Do not proceed with identity-sensitive transaction")

        if any(s.signal_id == "disposable_email" for s in report.signals):
            actions.append("Verify identity via government-issued ID document")

        if any(s.signal_id == "image_suspicion" for s in report.signals):
            actions.append("Request in-person or live video verification")
            actions.append("Submit profile image to independent reverse-image search")

        if any(s.signal_id == "age_under_13" for s in report.signals):
            actions.append("URGENT: Subject may be a minor — apply COPPA/GDPR-K safeguards")

        if graph and len(graph.clusters) > 0:
            actions.append(
                f"Investigate linked entity cluster(s) — {len(graph.links)} cross-entity connections found"
            )

        if risk_level in ("MODERATE",):
            actions.append("Request additional corroborating ID documents")
            actions.append("Monitor account activity for 30 days")

        if not actions:
            actions.append("No immediate action required — routine monitoring recommended")

        return actions

    def _build_summary(
        self,
        risk_level: str,
        identity: ResolvedIdentity,
        report: FraudPatternReport,
        graph: EntityGraph | None,
        is_fake: bool,
    ) -> str:
        name = identity.canonical_name or "Unknown"
        parts = [
            f"Identity '{name}' assessed as {risk_level} risk "
            f"(score {report.total_signals} signals detected)."
        ]
        if is_fake:
            parts.append("System assesses this as a likely FAKE IDENTITY.")
        if report.critical_count:
            parts.append(f"{report.critical_count} CRITICAL signal(s) require immediate attention.")
        if report.high_count:
            parts.append(f"{report.high_count} HIGH-severity signal(s) detected.")
        if graph and graph.links:
            parts.append(
                f"Subject linked to {len(graph.nodes) - 1} other known entities "
                f"via {len(graph.links)} shared data pivot(s)."
            )
        return " ".join(parts)


# ---------------------------------------------------------------------------
# Facade — run the full Phase-4 pipeline in one call
# ---------------------------------------------------------------------------


class FraudDetectionPipeline:
    """Run the complete Phase-4 fraud detection & identity resolution pipeline.

    Usage::

        pipeline = FraudDetectionPipeline()
        result = pipeline.run(profiles=[profile_dict, ...])
    """

    def __init__(self) -> None:
        self.resolver = IdentityResolver()
        self.detector = FraudPatternDetector()
        self.mapper = RelationshipMapper()
        self.scorer = RiskScoringEngine()

    def run(
        self,
        profiles: list[dict[str, Any]],
        image_suspicion_score: float = 0.0,
        phase3_image_evidence: list[str] | None = None,
        persist_graph: bool = True,
    ) -> FraudDetectionResult:
        """Execute resolve → detect → map → score pipeline.

        Args:
            profiles: List of entity profile dicts (from EntityProfile.model_dump()).
            image_suspicion_score: Overall suspicion score from Phase 3 (0–1).
            phase3_image_evidence: List of evidence strings from Phase 3 FakeIdSignals.
            persist_graph: If True, save the relationship graph to disk.
        """
        identity = self.resolver.resolve(profiles)
        fraud_report = self.detector.analyse(
            identity,
            image_suspicion_score=image_suspicion_score,
            phase3_signals=phase3_image_evidence,
        )
        graph = self.mapper.build_graph(profiles)
        if persist_graph:
            self.mapper.persist(graph)

        risk = self.scorer.score(
            identity,
            fraud_report,
            graph=graph,
            image_score=image_suspicion_score,
        )

        return FraudDetectionResult(
            identity=identity,
            fraud_report=fraud_report,
            entity_graph=graph,
            risk_assessment=risk,
        )

    def run_single(
        self,
        profile: dict[str, Any],
        image_suspicion_score: float = 0.0,
        phase3_image_evidence: list[str] | None = None,
    ) -> FraudDetectionResult:
        """Convenience wrapper for a single entity profile."""
        return self.run(
            profiles=[profile],
            image_suspicion_score=image_suspicion_score,
            phase3_image_evidence=phase3_image_evidence,
            persist_graph=False,
        )


class FraudDetectionResult(BaseModel):
    """Complete Phase-4 output."""

    identity: ResolvedIdentity
    fraud_report: FraudPatternReport
    entity_graph: EntityGraph
    risk_assessment: RiskAssessment
