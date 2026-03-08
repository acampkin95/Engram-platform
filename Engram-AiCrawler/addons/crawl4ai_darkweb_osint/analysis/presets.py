"""
Analysis preset prompts for dark web content.

Provides 4 preset analysis types from Robin:
1. Threat Intelligence
2. Ransomware & Malware
3. Personal Identity
4. Corporate Espionage
"""

from enum import Enum
from typing import Dict


class AnalysisPreset(str, Enum):
    """Available analysis presets."""

    THREAT_INTEL = "threat_intel"
    RANSOMWARE_MALWARE = "ransomware_malware"
    PERSONAL_IDENTITY = "personal_identity"
    CORPORATE_ESPIONAGE = "corporate_espionage"


# Preset prompts from Robin (llm.py PRESET_PROMPTS)
PRESET_PROMPTS: Dict[str, str] = {
    AnalysisPreset.THREAT_INTEL: """You are a cybersecurity threat intelligence analyst. Analyze the following dark web content for potential threats, malicious actors, and security implications.

Focus on:
- Threat actors and their affiliations
- Attack patterns and techniques mentioned
- Targeted industries or organizations
- Indicators of Compromise (IOCs)
- Tactics, Techniques, and Procedures (TTPs)
- Potential impact assessment

Provide a structured analysis with clear sections and actionable intelligence.""",
    AnalysisPreset.RANSOMWARE_MALWARE: """You are a malware and ransomware analyst. Analyze the following dark web content for ransomware, malware, and related threats.

Focus on:
- Ransomware families and variants
- Malware types and capabilities
- Distribution methods
- Encryption techniques
- Ransom demands and payment methods
- Data leak sites and victim information
- Technical indicators (C2 servers, hashes, domains)

Provide technical analysis with specific indicators and attribution where possible.""",
    AnalysisPreset.PERSONAL_IDENTITY: """You are a personal data protection specialist. Analyze the following dark web content for personal identity information and privacy implications.

Focus on:
- Personal Identifiable Information (PII)
- Credentials and login information
- Financial data exposure
- Social media account compromises
- Identity theft indicators
- Data breach origins
- Affected individuals' risk assessment

Highlight privacy risks and recommend protective measures.""",
    AnalysisPreset.CORPORATE_ESPIONAGE: """You are a corporate security and counter-intelligence analyst. Analyze the following dark web content for corporate espionage and business threats.

Focus on:
- Targeted companies and industries
- Insider threat indicators
- Stolen corporate data
- Trade secret exposure
- M&A intelligence leaks
- Business email compromise (BEC)
- Supply chain threats

Assess business impact and provide strategic recommendations.""",
}


def get_preset_prompt(preset: str) -> str:
    """
    Get the system prompt for an analysis preset.

    Args:
        preset: Preset name (threat_intel, ransomware_malware, personal_identity, corporate_espionage)

    Returns:
        System prompt string

    Raises:
        ValueError: If preset is not found
    """
    if preset in PRESET_PROMPTS:
        return PRESET_PROMPTS[preset]

    # Try to match by enum value
    try:
        preset_enum = AnalysisPreset(preset)
        return PRESET_PROMPTS[preset_enum]
    except ValueError:
        pass

    raise ValueError(
        f"Unknown preset: {preset}. " f"Available: {[p.value for p in AnalysisPreset]}"
    )


def get_preset_description(preset: str) -> str:
    """
    Get a short description of an analysis preset.

    Args:
        preset: Preset name

    Returns:
        Description string
    """
    descriptions = {
        AnalysisPreset.THREAT_INTEL: "Identify threat actors, attack patterns, and security implications",
        AnalysisPreset.RANSOMWARE_MALWARE: "Detect ransomware families, malware types, and technical indicators",
        AnalysisPreset.PERSONAL_IDENTITY: "Find PII, credentials, and identity theft indicators",
        AnalysisPreset.CORPORATE_ESPIONAGE: "Identify corporate data exposure and business threats",
    }

    try:
        preset_enum = AnalysisPreset(preset)
        return descriptions.get(preset_enum, "Unknown preset")
    except ValueError:
        return "Unknown preset"


def list_presets() -> list:
    """
    List all available presets with descriptions.

    Returns:
        List of dicts with preset info
    """
    return [
        {
            "name": preset.value,
            "description": get_preset_description(preset.value),
        }
        for preset in AnalysisPreset
    ]


# User prompt templates for each preset
PRESET_USER_TEMPLATES: Dict[str, str] = {
    AnalysisPreset.THREAT_INTEL: """Analyze the following content for threat intelligence:

---
{content}
---

Provide a structured threat intelligence report.""",
    AnalysisPreset.RANSOMWARE_MALWARE: """Analyze the following content for ransomware and malware indicators:

---
{content}
---

Provide a technical analysis with specific indicators.""",
    AnalysisPreset.PERSONAL_IDENTITY: """Analyze the following content for personal identity information:

---
{content}
---

Identify all PII and assess privacy risks.""",
    AnalysisPreset.CORPORATE_ESPIONAGE: """Analyze the following content for corporate espionage indicators:

---
{content}
---

Assess business impact and provide recommendations.""",
}


def get_user_prompt(preset: str, content: str) -> str:
    """
    Get the user prompt for analysis.

    Args:
        preset: Preset name
        content: Content to analyze

    Returns:
        Formatted user prompt
    """
    template = PRESET_USER_TEMPLATES.get(preset)
    if template:
        return template.format(content=content)

    # Default template
    return f"""Analyze the following content:

---
{content}
---

Provide a comprehensive analysis."""
