"""
Artifact extraction from dark web content.

Extracts:
- Email addresses
- Cryptocurrency addresses (BTC, ETH, XMR, etc.)
- .onion domains
- IP addresses
- Phone numbers
- URLs
- Credit card numbers
- Social media handles
"""

import re
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Set

logger = logging.getLogger(__name__)


class ArtifactType(str, Enum):
    """Types of artifacts that can be extracted."""

    EMAIL = "email"
    BITCOIN_ADDRESS = "bitcoin"
    ETHEREUM_ADDRESS = "ethereum"
    MONERO_ADDRESS = "monero"
    ONION_DOMAIN = "onion"
    IP_ADDRESS = "ip"
    PHONE = "phone"
    URL = "url"
    CREDIT_CARD = "credit_card"
    SOCIAL_HANDLE = "social_handle"
    DOMAIN = "domain"


@dataclass
class Artifact:
    """An extracted artifact."""

    type: ArtifactType
    value: str
    context: Optional[str] = None  # Surrounding text
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "type": self.type.value,
            "value": self.value,
            "context": self.context,
            "confidence": self.confidence,
            "metadata": self.metadata,
        }


# Regex patterns for artifact extraction
PATTERNS = {
    ArtifactType.EMAIL: re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", re.IGNORECASE
    ),
    # Bitcoin: starts with 1, 3, or bc1
    ArtifactType.BITCOIN_ADDRESS: re.compile(
        r"\b(?:bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,62}\b"
    ),
    # Ethereum: starts with 0x, 40 hex chars
    ArtifactType.ETHEREUM_ADDRESS: re.compile(r"\b0x[a-fA-F0-9]{40}\b"),
    # Monero: starts with 4, 95 chars
    ArtifactType.MONERO_ADDRESS: re.compile(r"\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b"),
    # .onion domains (v2 and v3)
    ArtifactType.ONION_DOMAIN: re.compile(
        r"\b(?:http[s]?://)?[a-z2-7]{16,56}\.onion(?:[:/][^\s]*)?\b", re.IGNORECASE
    ),
    # IP addresses (IPv4)
    ArtifactType.IP_ADDRESS: re.compile(
        r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}"
        r"(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
    ),
    # Phone numbers (various formats)
    ArtifactType.PHONE: re.compile(
        r"(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}"
        r"|\+?[0-9]{1,3}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4,6}"
    ),
    # URLs
    ArtifactType.URL: re.compile(
        r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w .-]*/?(?:\?[-\w=&%.]*)?"
    ),
    # Credit cards (basic pattern)
    ArtifactType.CREDIT_CARD: re.compile(
        r"\b(?:4[0-9]{12}(?:[0-9]{3})?|"  # Visa
        r"5[1-5][0-9]{14}|"  # MasterCard
        r"3[47][0-9]{13}|"  # AmEx
        r"6(?:011|5[0-9]{2})[0-9]{12})\b"  # Discover
    ),
    # Social media handles
    ArtifactType.SOCIAL_HANDLE: re.compile(
        r"(?:(?:twitter|instagram|telegram|github|discord)\s*[:@]\s*|"
        r"@)([A-Za-z0-9_]{3,30})",
        re.IGNORECASE,
    ),
    # Generic domains (not onion)
    ArtifactType.DOMAIN: re.compile(
        r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+" r"[a-z]{2,}(?:[:/][^\s]*)?\b",
        re.IGNORECASE,
    ),
}


def extract_artifacts(
    content: str,
    artifact_types: Optional[List[ArtifactType]] = None,
    min_confidence: float = 0.5,
) -> List[Artifact]:
    """
    Extract artifacts from content.

    Args:
        content: Text content to extract from
        artifact_types: Types to extract (default: all)
        min_confidence: Minimum confidence threshold

    Returns:
        List of extracted artifacts
    """
    if not content:
        return []

    types_to_extract = artifact_types or list(ArtifactType)
    all_artifacts: List[Artifact] = []
    seen: Set[str] = set()

    for artifact_type in types_to_extract:
        pattern = PATTERNS.get(artifact_type)
        if not pattern:
            continue

        try:
            matches = pattern.finditer(content)

            for match in matches:
                value = match.group(0).strip()

                # Skip duplicates
                key = f"{artifact_type.value}:{value.lower()}"
                if key in seen:
                    continue
                seen.add(key)

                # Get context (50 chars before and after)
                start = max(0, match.start() - 50)
                end = min(len(content), match.end() + 50)
                context = content[start:end].strip()

                # Calculate confidence
                confidence = calculate_confidence(artifact_type, value, content)

                if confidence >= min_confidence:
                    artifact = Artifact(
                        type=artifact_type,
                        value=value,
                        context=context,
                        confidence=confidence,
                        metadata=extract_metadata(artifact_type, value),
                    )
                    all_artifacts.append(artifact)

        except Exception as e:
            logger.warning(f"Error extracting {artifact_type}: {e}")

    return all_artifacts


def calculate_confidence(
    artifact_type: ArtifactType,
    value: str,
    content: str,
) -> float:
    """
    Calculate confidence score for an artifact.

    Higher confidence for:
    - Valid checksums (crypto addresses)
    - Known patterns
    - Contextual clues
    """
    base_confidence = 0.7

    if artifact_type == ArtifactType.EMAIL:
        # Higher confidence for common domains
        if any(domain in value.lower() for domain in [".com", ".org", ".net", ".io"]):
            base_confidence = 0.9
        # Lower for suspicious patterns
        if "dark" in value.lower() or "hack" in value.lower():
            base_confidence = 0.6

    elif artifact_type == ArtifactType.BITCOIN_ADDRESS:
        # Validate checksum would increase confidence
        if value.startswith("bc1"):
            base_confidence = 0.95
        elif len(value) in [26, 27, 34]:
            base_confidence = 0.9

    elif artifact_type == ArtifactType.ONION_DOMAIN:
        # v3 addresses are more likely valid
        if len(value.split(".")[0]) >= 56:
            base_confidence = 0.95
        else:
            base_confidence = 0.8

    elif artifact_type == ArtifactType.IP_ADDRESS:
        # Private IPs are less interesting
        if value.startswith(("192.168.", "10.", "172.")):
            base_confidence = 0.3
        else:
            base_confidence = 0.85

    elif artifact_type == ArtifactType.CREDIT_CARD:
        # Could add Luhn check here
        base_confidence = 0.8

    return base_confidence


def extract_metadata(artifact_type: ArtifactType, value: str) -> Dict[str, Any]:
    """
    Extract additional metadata for an artifact.
    """
    metadata = {}

    if artifact_type == ArtifactType.EMAIL:
        domain = value.split("@")[-1] if "@" in value else ""
        metadata["domain"] = domain
        metadata["is_free_provider"] = domain in [
            "gmail.com",
            "yahoo.com",
            "hotmail.com",
            "outlook.com",
            "protonmail.com",
            "tutanota.com",
        ]

    elif artifact_type == ArtifactType.BITCOIN_ADDRESS:
        metadata["address_type"] = "bech32" if value.startswith("bc1") else "legacy"

    elif artifact_type == ArtifactType.ONION_DOMAIN:
        address = value.split("://")[-1].split("/")[0].split(".")[0]
        metadata["version"] = "v3" if len(address) >= 56 else "v2"
        metadata["has_path"] = "/" in value.split(".onion")[-1]

    elif artifact_type == ArtifactType.IP_ADDRESS:
        octets = value.split(".")
        metadata["first_octet"] = octets[0] if octets else None
        metadata["is_private"] = value.startswith(("192.168.", "10.", "172."))

    return metadata


def group_artifacts_by_type(artifacts: List[Artifact]) -> Dict[str, List[Artifact]]:
    """
    Group artifacts by type.

    Args:
        artifacts: List of artifacts

    Returns:
        Dict mapping type to list of artifacts
    """
    groups: Dict[str, List[Artifact]] = {}

    for artifact in artifacts:
        type_name = artifact.type.value
        if type_name not in groups:
            groups[type_name] = []
        groups[type_name].append(artifact)

    return groups


def summarize_artifacts(artifacts: List[Artifact]) -> Dict[str, Any]:
    """
    Create a summary of extracted artifacts.

    Args:
        artifacts: List of artifacts

    Returns:
        Summary dict with counts and samples
    """
    groups = group_artifacts_by_type(artifacts)

    summary = {
        "total": len(artifacts),
        "by_type": {},
    }

    for type_name, type_artifacts in groups.items():
        summary["by_type"][type_name] = {
            "count": len(type_artifacts),
            "samples": [a.value for a in type_artifacts[:5]],
        }

    return summary


# CLI entry point
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Artifact extraction")
    parser.add_argument("content", help="Content to extract from (or file path)")
    parser.add_argument("--types", nargs="+", help="Artifact types to extract")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Check if content is a file
    try:
        with open(args.content) as f:
            content = f.read()
    except FileNotFoundError:
        content = args.content

    # Parse types
    types = None
    if args.types:
        types = [
            ArtifactType(t) for t in args.types if t in [e.value for e in ArtifactType]
        ]

    # Extract
    artifacts = extract_artifacts(content, artifact_types=types)

    if args.json:
        print(json.dumps([a.to_dict() for a in artifacts], indent=2))
    else:
        print(f"Found {len(artifacts)} artifacts:\n")
        for artifact in artifacts:
            print(f"  [{artifact.type.value}] {artifact.value}")
