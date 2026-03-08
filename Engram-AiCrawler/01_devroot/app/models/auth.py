"""Authentication models for JWT tokens and user information."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class AuthenticatedUser:
    """Authenticated user extracted from JWT token."""

    user_id: str
    email: str
    role: str
    iat: int  # Issued at timestamp
    exp: int  # Expiration timestamp

    def is_token_expired(self) -> bool:
        """Check if token has expired based on current time."""
        current_timestamp = int(datetime.utcnow().timestamp())
        return current_timestamp > self.exp

    def should_refresh(self, buffer_minutes: int = 30) -> bool:
        """
        Check if token should be refreshed based on buffer.

        Args:
            buffer_minutes: Minutes before expiry to trigger refresh

        Returns:
            bool: True if token should be refreshed
        """
        current_timestamp = int(datetime.utcnow().timestamp())
        expiry_timestamp = self.exp - (buffer_minutes * 60)
        return current_timestamp > expiry_timestamp
