"""
Python 3.9+ compatibility module for newer stdlib features.

Provides StrEnum and UTC from Python 3.11+ for earlier versions.
"""
from __future__ import annotations
import sys

# Check Python version
PY311_PLUS = sys.version_info >= (3, 11)

# Python 3.11+ StrEnum compatibility
if PY311_PLUS:
    from enum import StrEnum
else:
    # For Python 3.9-3.10, use a simpler approach
    # Just use str directly - this avoids the Enum complexity
    class StrEnum(str):
        """Compatibility shim for StrEnum - just use str for older Python."""
        pass

# Python 3.11+ UTC timezone compatibility
if PY311_PLUS:
    from datetime import UTC
else:
    from datetime import timezone
    UTC = timezone.utc

__all__ = ["StrEnum", "UTC", "PY311_PLUS"]
