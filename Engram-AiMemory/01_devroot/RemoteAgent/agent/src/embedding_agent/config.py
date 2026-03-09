"""Configuration management using Pydantic Settings."""

from pathlib import Path
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class WeaviateConfig(BaseSettings):
    """Weaviate connection configuration."""

    model_config = SettingsConfigDict(env_prefix="WEAVIATE_")

    url: str = "http://devnode:8080"
    api_key: Optional[str] = None
    timeout: int = 30


class EmbeddingConfig(BaseSettings):
    """Embedding model configuration."""

    model_config = SettingsConfigDict(env_prefix="EMBEDDING_")

    # MLX embedding model name from registry
    model: str = "bge-small"
    batch_size: int = 32
    dimensions: int = 384  # Will be set based on model

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        valid_models = {"bge-small", "bge-base", "all-MiniLM-L6-v2"}
        if v not in valid_models:
            raise ValueError(f"Model must be one of: {valid_models}")
        return v


class LMStudioConfig(BaseSettings):
    """Optional LM Studio configuration for fallback."""

    model_config = SettingsConfigDict(env_prefix="LMSTUDIO_")

    url: str = "http://localhost:1234"
    embedding_model: Optional[str] = None
    enabled: bool = False


class WatcherConfig(BaseSettings):
    """File watcher configuration."""

    model_config = SettingsConfigDict(env_prefix="WATCH_")

    paths: List[Path] = Field(default_factory=lambda: [Path.home() / "Projects"])
    recursive: bool = True

    @field_validator("paths", mode="before")
    @classmethod
    def parse_paths(cls, v):
        if isinstance(v, str):
            return [Path(p.strip()) for p in v.split(",") if p.strip()]
        return v


class ProcessingConfig(BaseSettings):
    """Document processing configuration."""

    model_config = SettingsConfigDict(env_prefix="")

    # File patterns
    include_patterns: List[str] = Field(
        default_factory=lambda: [
            "*.ts", "*.tsx", "*.py", "*.md", "*.txt", "*.rtf",
            "*.csv", "*.html", "*.css", "*.js", "*.yml", "*.yaml",
            "*.json", "*.jsonc"
        ]
    )
    exclude_patterns: List[str] = Field(
        default_factory=lambda: [
            "node_modules", "__pycache__", ".git", ".next",
            "dist", "build", ".venv", "venv", "*.lock"
        ]
    )

    # Chunking
    chunk_size: int = 512
    chunk_overlap: int = 50
    max_file_size_mb: float = 10.0

    # State management
    state_db_path: Path = Path("./state.db")

    @field_validator("include_patterns", "exclude_patterns", mode="before")
    @classmethod
    def parse_patterns(cls, v):
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        return v


class Settings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    weaviate: WeaviateConfig = Field(default_factory=WeaviateConfig)
    embedding: EmbeddingConfig = Field(default_factory=EmbeddingConfig)
    lmstudio: LMStudioConfig = Field(default_factory=LMStudioConfig)
    watcher: WatcherConfig = Field(default_factory=WatcherConfig)
    processing: ProcessingConfig = Field(default_factory=ProcessingConfig)

    log_level: str = "INFO"

    @classmethod
    def load(cls) -> "Settings":
        """Load settings from environment and .env file."""
        return cls(
            weaviate=WeaviateConfig(),
            embedding=EmbeddingConfig(),
            lmstudio=LMStudioConfig(),
            watcher=WatcherConfig(),
            processing=ProcessingConfig(),
        )


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get the global settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings.load()
    return _settings
