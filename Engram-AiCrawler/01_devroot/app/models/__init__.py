# Python 3.9/3.10 compatibility for StrEnum (added in Python 3.11)
try:
    from enum import StrEnum
except ImportError:
    from enum import Enum

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


__all__ = ["StrEnum"]
