"""
Configuration for the AI Memory MCP client.

All settings are loaded from environment variables (with .env file support).

Environment variables:
    MCP_SERVER_URL          URL of the MCP server (default: http://localhost:3000/mcp)
    MCP_AUTH_TOKEN          Bearer token for MCP server auth (optional)
    AI_MEMORY_API_KEY       API key sent as X-API-Key header (optional)
    MCP_CLIENT_TIMEOUT      HTTP request timeout in seconds (default: 30.0)
    MCP_CLIENT_MAX_RETRIES  Maximum retry attempts for transient errors (default: 3)
    MCP_CLIENT_RETRY_DELAY  Initial retry delay in seconds (default: 1.0)
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPClientConfig(BaseSettings):
    """Pydantic Settings for the MCP client.

    Loaded from environment variables and .env file. All fields are optional
    with sensible defaults for local development.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    mcp_server_url: str = Field(
        default="http://localhost:3000/mcp",
        description="Full URL of the AI Memory MCP server endpoint",
    )
    mcp_auth_token: str | None = Field(
        default=None,
        description="Bearer token for MCP server authentication (MCP_AUTH_TOKEN env var)",
    )
    ai_memory_api_key: str | None = Field(
        default=None,
        description="API key sent as X-API-Key header",
    )
    mcp_client_timeout: float = Field(
        default=30.0,
        ge=1.0,
        description="HTTP request timeout in seconds",
    )
    mcp_client_max_retries: int = Field(
        default=3,
        ge=0,
        le=10,
        description="Maximum retry attempts for transient network errors",
    )
    mcp_client_retry_delay: float = Field(
        default=1.0,
        ge=0.1,
        description="Initial delay between retries in seconds (doubles on each attempt)",
    )
