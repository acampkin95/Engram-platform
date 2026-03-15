"""
Configuration management using Pydantic Settings.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Weaviate Configuration
    weaviate_url: str = Field(default="http://localhost:8080", description="Weaviate HTTP URL")
    weaviate_grpc_url: str = Field(
        default="http://localhost:50051", description="Weaviate gRPC URL"
    )
    weaviate_api_key: str | None = Field(default=None, description="Weaviate API key")

    # Redis Configuration
    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    redis_password: str | None = Field(default=None, description="Redis password")

    # Embedding Configuration
    embedding_provider: Literal["openai", "cohere", "local", "ollama", "nomic", "deepinfra"] = (
        Field(default="nomic", description="Embedding provider")
    )
    openai_api_key: str | None = Field(default=None, description="OpenAI API key")
    openai_base_url: str | None = Field(
        default=None,
        description="OpenAI-compatible API base URL (e.g. https://api.deepinfra.com/v1/openai)",
    )
    embedding_model: str = Field(
        default="text-embedding-3-small", description="Embedding model name"
    )
    embedding_dimensions: int = Field(default=768, description="Embedding vector dimensions")

    # LLM Configuration (for memory consolidation)
    llm_provider: Literal["openai", "anthropic", "local", "deepinfra"] = Field(default="openai")
    llm_model: str = Field(default="gpt-4o-mini")

    # Consolidation settings
    consolidation_min_group_size: int = Field(
        default=3, description="Minimum memories in a group to trigger consolidation"
    )
    consolidation_hours_back: int = Field(
        default=48, description="How many hours back to search for consolidation candidates"
    )
    consolidation_confidence: float = Field(
        default=0.7, description="Confidence score assigned to consolidated memories"
    )

    # RAG Configuration
    rag_max_context_tokens: int = Field(
        default=4000, description="Maximum tokens for RAG context window"
    )
    rag_default_limit: int = Field(
        default=5, ge=1, le=50, description="Default number of memories to retrieve for RAG"
    )
    rag_synthesis_prompt: str = Field(
        default=(
            "Based on these memories, provide a comprehensive response "
            "that synthesizes insights from all relevant information. "
            "If the memories don't contain relevant information, say so clearly."
        ),
        description="Default prompt template for RAG synthesis",
    )

    # Memory Configuration
    default_memory_tier: int = Field(default=1, ge=1, le=3)
    max_memory_size_mb: int = Field(default=100, description="Max memory size per project in MB")
    memory_retention_days: int = Field(default=90, description="Memory retention period")

    # Search scoring weights (must sum to 1.0)
    search_similarity_weight: float = Field(
        default=0.4, ge=0.0, le=1.0, description="Weight for similarity in composite scoring"
    )
    search_recency_weight: float = Field(
        default=0.3, ge=0.0, le=1.0, description="Weight for recency in composite scoring"
    )
    search_importance_weight: float = Field(
        default=0.3, ge=0.0, le=1.0, description="Weight for importance in composite scoring"
    )

    # Decay
    decay_half_life_days: float = Field(
        default=30.0, description="Days until memory importance halves without access"
    )
    decay_access_boost: float = Field(default=0.1, description="Importance boost per access")
    decay_min_importance: float = Field(default=0.1, description="Minimum importance floor")

    # Retrieval
    search_retrieval_mode: Literal["vector", "hybrid"] = Field(
        default="vector",
        description="Primary Weaviate retrieval mode for memory search",
    )

    # Hybrid search
    hybrid_alpha: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Hybrid search alpha when search_retrieval_mode=hybrid: 0=keyword, 1=vector",
    )

    # Reranking
    reranker_enabled: bool = Field(default=False, description="Enable cross-encoder reranking")
    reranker_model: str = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2",
        description="Cross-encoder model for reranking",
    )
    reranker_top_k: int = Field(
        default=20, ge=1, le=100, description="How many candidates to fetch before reranking"
    )

    # Ollama
    ollama_host: str | None = Field(
        default=None, description="Ollama API host (e.g. http://localhost:11434)"
    )
    ollama_maintenance_model: str = Field(
        default="liquid/lfm2.5:1.2b", description="LFM model for summarization/consolidation"
    )
    ollama_classifier_model: str = Field(
        default="qwen2.5:0.5b-instruct",
        description="Qwen model for importance scoring/entity extraction",
    )
    ollama_request_timeout: int = Field(default=30, description="Ollama request timeout in seconds")
    investigation_workers_interval_minutes: int = Field(
        default=15, description="Investigation worker APScheduler interval in minutes"
    )

    # DeepInfra Configuration
    deepinfra_api_key: str | None = Field(
        default=None, description="DeepInfra API key for cloud inference"
    )
    deepinfra_chat_model: str = Field(
        default="meta-llama/Meta-Llama-3.1-8B-Instruct", description="DeepInfra chat model"
    )
    deepinfra_embed_model: str = Field(
        default="BAAI/bge-m3", description="DeepInfra embedding model (768d)"
    )

    # Schema migration
    clean_schema_migration: bool = Field(
        default=False,
        description="Drop and recreate all Weaviate collections (WARNING: destroys all data)",
    )
    # Multi-tenancy
    multi_tenancy_enabled: bool = Field(default=True)
    default_tenant_id: str = Field(default="default")

    # Auto-importance scoring (LLM-based)
    auto_importance_enabled: bool = Field(
        default=False,
        description="Enable LLM auto-importance scoring on memory add",
    )
    auto_importance_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Min importance to auto-set (if below, keeps user value)",
    )

    # Contradiction detection
    contradiction_detection_enabled: bool = Field(
        default=False,
        description="Enable contradiction detection on memory add",
    )
    contradiction_action: Literal["flag", "merge", "reject"] = Field(
        default="flag",
        description="Action when contradiction detected: flag (store with metadata), merge (create resolution), reject (skip)",
    )

    # Semantic deduplication
    deduplication_enabled: bool = Field(
        default=False,
        description="Enable semantic deduplication on memory add",
    )
    deduplication_threshold: float = Field(
        default=0.92,
        ge=0.0,
        le=1.0,
        description="Similarity threshold for deduplication",
    )
    deduplication_action: Literal["skip", "update", "merge"] = Field(
        default="skip",
        description="Action when duplicate found: skip (don't store), update (increment count), merge (consolidate)",
    )

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO")
    log_format: Literal["json", "text"] = Field(default="json")

    # Security — JWT
    jwt_secret: str = Field(
        default="", description="JWT secret key (REQUIRED: set via JWT_SECRET env var)"
    )
    jwt_expire_hours: int = Field(default=24, ge=1, description="JWT token expiry in hours")

    # Security — API Keys (comma-separated list, e.g. key1,key2)
    # Union with str so pydantic-settings skips JSON-decode; validator handles both
    api_keys: list[str] | str = Field(default_factory=list, description="Allowed API keys")

    # Security — Admin credentials for dashboard login
    admin_username: str = Field(default="admin", description="Dashboard admin username")
    admin_password_hash: str | None = Field(
        default=None, description="bcrypt hash of admin password (None = login disabled)"
    )

    # Rate limiting
    rate_limit_per_minute: int = Field(default=100, ge=1, description="Requests per minute per IP")

    # CORS — comma-separated origins, e.g. http://localhost:3001,https://app.example.com
    cors_origins: list[str] | str = Field(
        default_factory=lambda: ["http://localhost:3001"], description="Allowed CORS origins"
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list) -> list[str]:
        """Parse comma-separated CORS_ORIGINS env var into a list."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("weaviate_url")
    @classmethod
    def validate_weaviate_url(cls, v: str) -> str:
        """Ensure Weaviate URL doesn't have trailing slash."""
        return v.rstrip("/")

    @field_validator("embedding_dimensions")
    @classmethod
    def validate_dimensions(cls, v: int) -> int:
        """Validate embedding dimensions are reasonable."""
        if v < 128 or v > 4096:
            raise ValueError("Embedding dimensions must be between 128 and 4096")
        return v

    @field_validator("api_keys", mode="before")
    @classmethod
    def parse_api_keys(cls, v: str | list) -> list[str]:
        """Parse comma-separated API_KEYS env var into a list."""
        if isinstance(v, str):
            return [k.strip() for k in v.split(",") if k.strip()]
        return v

    @field_validator("admin_password_hash", mode="before")
    @classmethod
    def parse_admin_password_hash(cls, v: str | None) -> str | None:
        """Treat empty string from env as None (login disabled)."""
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        """Require JWT_SECRET to be explicitly set to a secure value."""
        if self.jwt_secret == "" or self.jwt_secret == "change-me-in-production":
            raise ValueError(
                "JWT_SECRET environment variable must be set to a secure random string. "
                "Generate one with: openssl rand -hex 32"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Collection names for each tier
TIER1_COLLECTION = "MemoryProject"  # Project-scoped
TIER2_COLLECTION = "MemoryGeneral"  # User-specific, cross-project
TIER3_COLLECTION = "MemoryGlobal"  # Shared across all users

# Entity collections for knowledge graph
ENTITY_COLLECTION = "MemoryEntity"
RELATION_COLLECTION = "MemoryRelation"

# Analysis collection for memory self-management
ANALYSIS_COLLECTION = "MemoryAnalysis"

# Investigation collections
INVESTIGATION_MATTER = "InvestigationMatter"
EVIDENCE_DOCUMENT = "EvidenceDocument"
TIMELINE_EVENT = "TimelineEvent"
INTELLIGENCE_REPORT = "IntelligenceReport"
SUBJECT_PERSON = "SubjectPerson"
SUBJECT_ORGANISATION = "SubjectOrganisation"

INVESTIGATION_TENANT_COLLECTIONS = [
    INVESTIGATION_MATTER,
    EVIDENCE_DOCUMENT,
    TIMELINE_EVENT,
    INTELLIGENCE_REPORT,
]
GLOBAL_REGISTRY_COLLECTIONS = [SUBJECT_PERSON, SUBJECT_ORGANISATION]
ALL_INVESTIGATION_COLLECTIONS = INVESTIGATION_TENANT_COLLECTIONS + GLOBAL_REGISTRY_COLLECTIONS
