"""
Configuration management for Dark Web OSINT addon.

Handles:
- Environment variable loading
- Configuration validation
- Default values
- Setup wizard integration
"""

import os
import json
from pathlib import Path
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings


class TorConfig(BaseModel):
    """Tor proxy configuration."""

    host: str = Field(default="127.0.0.1", description="Tor SOCKS proxy host")
    port: int = Field(default=9050, description="Tor SOCKS proxy port")
    control_port: int = Field(default=9051, description="Tor control port")
    password: Optional[str] = Field(default=None, description="Tor control password")
    timeout: int = Field(default=30, description="Connection timeout in seconds")
    retry_count: int = Field(default=3, description="Number of retry attempts")
    retry_delay: float = Field(default=1.0, description="Delay between retries in seconds")

    @property
    def proxy_url(self) -> str:
        """Get SOCKS5 proxy URL."""
        return f"socks5h://{self.host}:{self.port}"

    @property
    def control_url(self) -> str:
        """Get Tor control URL."""
        return f"{self.host}:{self.control_port}"


class LLMProviderConfig(BaseModel):
    """LLM provider configuration."""

    provider: Literal[
        "lmstudio", "ollama", "openai", "anthropic", "openai_compatible", "minimax"
    ] = Field(default="lmstudio", description="LLM provider to use")
    model: str = Field(
        default="glm-5", description="Model name (e.g., glm-5, llama3, gpt-4, claude-3-opus)"
    )
    base_url: Optional[str] = Field(
        default=None, description="Base URL for provider (auto-set for lmstudio/ollama)"
    )
    api_key: Optional[str] = Field(
        default=None, description="API key (required for openai, anthropic, minimax)"
    )
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, description="Maximum tokens in response")
    timeout: int = Field(default=60, description="Request timeout in seconds")

    @field_validator("base_url", mode="before")
    @classmethod
    def set_default_base_url(cls, v, info):
        """Set default base URL based on provider."""
        if v is not None:
            return v

        provider = info.data.get("provider", "lmstudio")
        defaults = {
            "lmstudio": "http://localhost:1234/v1",
            "ollama": "http://localhost:11434/v1",
            "openai": "https://api.openai.com/v1",
            "anthropic": "https://api.anthropic.com/v1",
            "minimax": "https://api.minimax.chat/v1",
        }
        return defaults.get(provider)

    @field_validator("api_key", mode="before")
    @classmethod
    def validate_api_key(cls, v, info):
        """Validate API key is present for cloud providers."""
        provider = info.data.get("provider", "lmstudio")
        requires_key = ["openai", "anthropic", "minimax"]

        if provider in requires_key and not v:
            # Try to get from environment
            env_var = f"{provider.upper()}_API_KEY"
            env_key = os.getenv(env_var)
            if env_key:
                return env_key
            # Don't fail here, let it fail at runtime with clear message

        return v


class DiscoveryConfig(BaseModel):
    """Discovery/search configuration."""

    engines: list[str] = Field(
        default=[
            "ahmia",
            "onionland",
            "torgle",
            "amnesia",
            "kaizer",
            "anima",
            "tornado",
            "tornet",
            "torland",
            "findtor",
            "excavator",
            "onionway",
            "tor66",
            "oss",
            "torgol",
            "thedeepsearch",
        ],
        description="List of search engines to use",
    )
    max_results_per_engine: int = Field(default=50, description="Max results per engine")
    timeout_per_engine: int = Field(default=30, description="Timeout per engine request")
    parallel_engines: int = Field(default=5, description="Number of engines to query in parallel")
    dedup_enabled: bool = Field(default=True, description="Enable result deduplication")
    dedup_threshold: float = Field(default=0.85, description="Similarity threshold for dedup")


class ExtractionConfig(BaseModel):
    """Extraction/crawling configuration."""

    js_rendering: bool = Field(default=True, description="Enable JavaScript rendering")
    page_timeout: int = Field(default=60000, description="Page load timeout in ms")
    wait_for_selector: Optional[str] = Field(default=None, description="CSS selector to wait for")
    screenshot: bool = Field(default=False, description="Take screenshots")
    pdf: bool = Field(default=False, description="Generate PDFs")
    max_content_length: int = Field(default=100000, description="Max content length to extract")
    excluded_tags: list[str] = Field(
        default=["script", "style", "nav", "footer", "header"], description="HTML tags to exclude"
    )


class AnalysisConfig(BaseModel):
    """Analysis configuration."""

    preset: Literal[
        "threat_intel", "ransomware_malware", "personal_identity", "corporate_espionage"
    ] = Field(default="threat_intel", description="Analysis preset to use")
    extract_artifacts: bool = Field(
        default=True, description="Extract artifacts (emails, crypto, IPs)"
    )
    generate_report: bool = Field(default=True, description="Generate markdown report")
    include_raw_content: bool = Field(default=False, description="Include raw content in results")


class DarkWebSettings(BaseSettings):
    """Settings loaded from environment variables."""

    # Tor settings
    DARKWEB_TOR_PROXY_HOST: str = "127.0.0.1"
    DARKWEB_TOR_PROXY_PORT: int = 9050
    DARKWEB_TOR_CONTROL_PORT: int = 9051
    DARKWEB_TOR_PASSWORD: Optional[str] = None
    DARKWEB_TOR_TIMEOUT: int = 30

    # LLM settings
    DARKWEB_LLM_PROVIDER: str = "lmstudio"
    DARKWEB_LLM_MODEL: str = "glm-5"
    DARKWEB_LLM_BASE_URL: Optional[str] = None
    DARKWEB_LLM_API_KEY: Optional[str] = None
    DARKWEB_LLM_TEMPERATURE: float = 0.7
    DARKWEB_LLM_MAX_TOKENS: int = 4096

    # Discovery settings
    DARKWEB_DISCOVERY_MAX_RESULTS: int = 50
    DARKWEB_DISCOVERY_TIMEOUT: int = 30
    DARKWEB_DISCOVERY_PARALLEL: int = 5

    # Extraction settings
    DARKWEB_EXTRACTION_JS_RENDERING: bool = True
    DARKWEB_EXTRACTION_TIMEOUT: int = 60000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


class DarkWebConfig(BaseModel):
    """Main configuration class for the addon."""

    tor: TorConfig = Field(default_factory=TorConfig)
    llm: LLMProviderConfig = Field(default_factory=LLMProviderConfig)
    discovery: DiscoveryConfig = Field(default_factory=DiscoveryConfig)
    extraction: ExtractionConfig = Field(default_factory=ExtractionConfig)
    analysis: AnalysisConfig = Field(default_factory=AnalysisConfig)

    # Runtime state
    _config_path: Path = Path.home() / ".crawl4ai" / "darkweb_config.json"
    _is_configured: bool = False

    @property
    def is_configured(self) -> bool:
        """Check if addon has been configured."""
        return self._is_configured

    @classmethod
    def from_env(cls) -> "DarkWebConfig":
        """Create configuration from environment variables."""
        settings = DarkWebSettings()

        tor = TorConfig(
            host=settings.DARKWEB_TOR_PROXY_HOST,
            port=settings.DARKWEB_TOR_PROXY_PORT,
            control_port=settings.DARKWEB_TOR_CONTROL_PORT,
            password=settings.DARKWEB_TOR_PASSWORD,
            timeout=settings.DARKWEB_TOR_TIMEOUT,
        )

        llm = LLMProviderConfig(
            provider=settings.DARKWEB_LLM_PROVIDER,
            model=settings.DARKWEB_LLM_MODEL,
            base_url=settings.DARKWEB_LLM_BASE_URL,
            api_key=settings.DARKWEB_LLM_API_KEY,
            temperature=settings.DARKWEB_LLM_TEMPERATURE,
            max_tokens=settings.DARKWEB_LLM_MAX_TOKENS,
        )

        discovery = DiscoveryConfig(
            max_results_per_engine=settings.DARKWEB_DISCOVERY_MAX_RESULTS,
            timeout_per_engine=settings.DARKWEB_DISCOVERY_TIMEOUT,
            parallel_engines=settings.DARKWEB_DISCOVERY_PARALLEL,
        )

        extraction = ExtractionConfig(
            js_rendering=settings.DARKWEB_EXTRACTION_JS_RENDERING,
            page_timeout=settings.DARKWEB_EXTRACTION_TIMEOUT,
        )

        config = cls(tor=tor, llm=llm, discovery=discovery, extraction=extraction)
        config._is_configured = True
        return config

    @classmethod
    def load(cls) -> "DarkWebConfig":
        """Load configuration from file or environment."""
        config_path = cls._config_path

        if config_path.exists():
            try:
                with open(config_path) as f:
                    data = json.load(f)
                config = cls(**data)
                config._is_configured = True
                return config
            except Exception:
                pass  # Fall through to env

        return cls.from_env()

    def save(self) -> None:
        """Save configuration to file."""
        self._config_path.parent.mkdir(parents=True, exist_ok=True)

        data = self.model_dump()
        with open(self._config_path, "w") as f:
            json.dump(data, f, indent=2)

        self._is_configured = True

    def to_env_template(self) -> str:
        """Generate .env template string."""
        return f"""# Dark Web OSINT Addon Configuration
# Generated by setup wizard

# Tor Proxy Settings
DARKWEB_TOR_PROXY_HOST={self.tor.host}
DARKWEB_TOR_PROXY_PORT={self.tor.port}
DARKWEB_TOR_CONTROL_PORT={self.tor.control_port}
# DARKWEB_TOR_PASSWORD=your_tor_control_password

# LLM Provider Settings
# Provider options: lmstudio, ollama, openai, anthropic, openai_compatible, minimax
DARKWEB_LLM_PROVIDER={self.llm.provider}
DARKWEB_LLM_MODEL={self.llm.model}
DARKWEB_LLM_BASE_URL={self.llm.base_url or ''}
# DARKWEB_LLM_API_KEY=your_api_key_if_needed

# Discovery Settings
DARKWEB_DISCOVERY_MAX_RESULTS={self.discovery.max_results_per_engine}
DARKWEB_DISCOVERY_TIMEOUT={self.discovery.timeout_per_engine}
DARKWEB_DISCOVERY_PARALLEL={self.discovery.parallel_engines}

# Extraction Settings
DARKWEB_EXTRACTION_JS_RENDERING={'true' if self.extraction.js_rendering else 'false'}
DARKWEB_EXTRACTION_TIMEOUT={self.extraction.page_timeout}
"""


# Global config instance (lazy loaded)
_config: Optional[DarkWebConfig] = None


def get_config() -> DarkWebConfig:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = DarkWebConfig.load()
    return _config


def reset_config() -> None:
    """Reset the global configuration (useful for testing)."""
    global _config
    _config = None
