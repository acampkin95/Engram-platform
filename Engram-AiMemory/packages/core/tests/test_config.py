"""Tests for configuration management module."""

import os
import pytest
from pydantic import ValidationError

# Set required env var before importing
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only-do-not-use-in-production"

from memory_system.config import (
    Settings,
    get_settings,
    TIER1_COLLECTION,
    TIER2_COLLECTION,
    TIER3_COLLECTION,
    ENTITY_COLLECTION,
    RELATION_COLLECTION,
    ANALYSIS_COLLECTION,
    INVESTIGATION_MATTER,
    EVIDENCE_DOCUMENT,
    TIMELINE_EVENT,
    INTELLIGENCE_REPORT,
    SUBJECT_PERSON,
    SUBJECT_ORGANISATION,
    INVESTIGATION_TENANT_COLLECTIONS,
    GLOBAL_REGISTRY_COLLECTIONS,
    ALL_INVESTIGATION_COLLECTIONS,
)


class TestSettingsValidation:
    """Test configuration validation and defaults."""

    def test_default_settings_load(self):
        """Test that settings load with valid JWT_SECRET."""
        settings = Settings()
        assert settings.weaviate_url == "http://localhost:8080"
        assert settings.redis_url == "redis://localhost:6379"
        assert settings.embedding_provider == "nomic"

    def test_weaviate_url_trailing_slash_removed(self):
        """Test that trailing slashes are removed from Weaviate URL."""
        settings = Settings(weaviate_url="http://weaviate:8080/", jwt_secret="test-secret")
        assert settings.weaviate_url == "http://weaviate:8080"

    def test_embedding_dimensions_validation_valid(self):
        """Test valid embedding dimensions are accepted."""
        settings = Settings(embedding_dimensions=512, jwt_secret="test-secret")
        assert settings.embedding_dimensions == 512

    def test_embedding_dimensions_validation_too_low(self):
        """Test that dimensions below 128 raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(embedding_dimensions=64, jwt_secret="test-secret")
        assert "between 128 and 4096" in str(exc_info.value)

    def test_embedding_dimensions_validation_too_high(self):
        """Test that dimensions above 4096 raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(embedding_dimensions=5000, jwt_secret="test-secret")
        assert "between 128 and 4096" in str(exc_info.value)

    def test_cors_origins_parsing_from_string(self):
        """Test parsing comma-separated CORS origins."""
        settings = Settings(
            cors_origins="http://localhost:3000, https://app.example.com", jwt_secret="test-secret"
        )
        assert settings.cors_origins == ["http://localhost:3000", "https://app.example.com"]

    def test_cors_origins_parsing_from_list(self):
        """Test that list of CORS origins is preserved."""
        settings = Settings(
            cors_origins=["http://localhost:3000", "https://app.example.com"],
            jwt_secret="test-secret",
        )
        assert settings.cors_origins == ["http://localhost:3000", "https://app.example.com"]

    def test_cors_origins_empty_string(self):
        """Test that empty CORS origins string results in empty list."""
        settings = Settings(cors_origins="", jwt_secret="test-secret")
        assert settings.cors_origins == []

    def test_api_keys_parsing_from_string(self):
        """Test parsing comma-separated API keys."""
        settings = Settings(api_keys="key1, key2, key3", jwt_secret="test-secret")
        assert settings.api_keys == ["key1", "key2", "key3"]

    def test_api_keys_parsing_from_list(self):
        """Test that list of API keys is preserved."""
        settings = Settings(api_keys=["key1", "key2"], jwt_secret="test-secret")
        assert settings.api_keys == ["key1", "key2"]

    def test_admin_password_hash_empty_string_becomes_none(self):
        """Test that empty admin password hash becomes None."""
        settings = Settings(admin_password_hash="", jwt_secret="test-secret")
        assert settings.admin_password_hash is None

    def test_admin_password_hash_whitespace_becomes_none(self):
        """Test that whitespace-only admin password hash becomes None."""
        settings = Settings(admin_password_hash="   ", jwt_secret="test-secret")
        assert settings.admin_password_hash is None

    def test_jwt_secret_required(self):
        """Test that empty JWT_SECRET raises ValidationError."""
        # Clear the environment variable temporarily
        original_secret = os.environ.pop("JWT_SECRET", None)
        try:
            with pytest.raises(ValidationError) as exc_info:
                Settings(jwt_secret="")
            assert "JWT_SECRET environment variable must be set" in str(exc_info.value)
        finally:
            if original_secret:
                os.environ["JWT_SECRET"] = original_secret

    def test_jwt_secret_insecure_default_rejected(self):
        """Test that insecure default JWT secret is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(jwt_secret="change-me-in-production")
        assert "JWT_SECRET environment variable must be set" in str(exc_info.value)

    def test_embedding_provider_valid_options(self):
        """Test all valid embedding provider options."""
        valid_providers = ["openai", "cohere", "local", "ollama", "nomic", "deepinfra"]
        for provider in valid_providers:
            settings = Settings(embedding_provider=provider, jwt_secret="test-secret")
            assert settings.embedding_provider == provider

    def test_embedding_provider_invalid_option(self):
        """Test that invalid embedding provider raises ValidationError."""
        with pytest.raises(ValidationError):
            Settings(embedding_provider="invalid_provider", jwt_secret="test-secret")

    def test_llm_provider_valid_options(self):
        """Test all valid LLM provider options."""
        valid_providers = ["openai", "anthropic", "local", "deepinfra"]
        for provider in valid_providers:
            settings = Settings(llm_provider=provider, jwt_secret="test-secret")
            assert settings.llm_provider == provider


class TestSettingsDefaults:
    """Test configuration default values."""

    def test_default_weaviate_urls(self):
        """Test default Weaviate URLs."""
        settings = Settings()
        assert settings.weaviate_url == "http://localhost:8080"
        assert settings.weaviate_grpc_url == "http://localhost:50051"

    def test_default_redis_url(self):
        """Test default Redis URL."""
        settings = Settings()
        assert settings.redis_url == "redis://localhost:6379"

    def test_default_embedding_config(self):
        """Test default embedding configuration."""
        settings = Settings()
        assert settings.embedding_provider == "nomic"
        assert settings.embedding_model == "text-embedding-3-small"
        assert settings.embedding_dimensions == 768

    def test_default_consolidation_settings(self):
        """Test default consolidation settings."""
        settings = Settings()
        assert settings.consolidation_min_group_size == 3
        assert settings.consolidation_hours_back == 48
        assert settings.consolidation_confidence == 0.7

    def test_default_rag_settings(self):
        """Test default RAG configuration."""
        settings = Settings()
        assert settings.rag_max_context_tokens == 4000
        assert settings.rag_default_limit == 5
        assert (
            "synthesize insights" in settings.rag_synthesis_prompt.lower()
            or "Based on these memories" in settings.rag_synthesis_prompt
        )

    def test_default_search_weights_sum_to_one(self):
        """Test that default search weights sum to 1.0."""
        settings = Settings()
        total = (
            settings.search_similarity_weight
            + settings.search_recency_weight
            + settings.search_importance_weight
        )
        assert total == 1.0

    def test_default_decay_settings(self):
        """Test default decay configuration."""
        settings = Settings()
        assert settings.decay_half_life_days == 30.0
        assert settings.decay_access_boost == 0.1
        assert settings.decay_min_importance == 0.1

    def test_default_hybrid_alpha(self):
        """Test default hybrid search alpha."""
        settings = Settings()
        assert settings.search_retrieval_mode == "vector"
        assert settings.hybrid_alpha == 0.7

    def test_default_reranker_settings(self):
        """Test default reranker configuration."""
        settings = Settings()
        assert settings.reranker_enabled is False
        assert settings.reranker_top_k == 20

    def test_default_security_settings(self):
        """Test default security configuration."""
        settings = Settings()
        assert settings.admin_username == "admin"
        assert settings.jwt_expire_hours == 24
        assert settings.rate_limit_per_minute == 100

    def test_default_multi_tenancy(self):
        """Test default multi-tenancy settings."""
        settings = Settings()
        assert settings.multi_tenancy_enabled is True
        assert settings.default_tenant_id == "default"

    def test_default_feature_flags(self):
        """Test default feature flag states."""
        settings = Settings()
        assert settings.auto_importance_enabled is False
        assert settings.contradiction_detection_enabled is False
        assert settings.deduplication_enabled is False
        assert settings.clean_schema_migration is False


class TestCollectionConstants:
    """Test collection name constants."""

    def test_tier_collection_names(self):
        """Test tier collection constants are defined."""
        assert TIER1_COLLECTION == "MemoryProject"
        assert TIER2_COLLECTION == "MemoryGeneral"
        assert TIER3_COLLECTION == "MemoryGlobal"

    def test_entity_collection_names(self):
        """Test entity and relation collection constants."""
        assert ENTITY_COLLECTION == "MemoryEntity"
        assert RELATION_COLLECTION == "MemoryRelation"

    def test_analysis_collection_name(self):
        """Test analysis collection constant."""
        assert ANALYSIS_COLLECTION == "MemoryAnalysis"

    def test_investigation_collection_names(self):
        """Test investigation collection constants."""
        assert INVESTIGATION_MATTER == "InvestigationMatter"
        assert EVIDENCE_DOCUMENT == "EvidenceDocument"
        assert TIMELINE_EVENT == "TimelineEvent"
        assert INTELLIGENCE_REPORT == "IntelligenceReport"

    def test_subject_collection_names(self):
        """Test subject collection constants."""
        assert SUBJECT_PERSON == "SubjectPerson"
        assert SUBJECT_ORGANISATION == "SubjectOrganisation"

    def test_investigation_tenant_collections(self):
        """Test investigation tenant collections list."""
        expected = [
            INVESTIGATION_MATTER,
            EVIDENCE_DOCUMENT,
            TIMELINE_EVENT,
            INTELLIGENCE_REPORT,
        ]
        assert INVESTIGATION_TENANT_COLLECTIONS == expected

    def test_global_registry_collections(self):
        """Test global registry collections list."""
        expected = [SUBJECT_PERSON, SUBJECT_ORGANISATION]
        assert GLOBAL_REGISTRY_COLLECTIONS == expected

    def test_all_investigation_collections(self):
        """Test all investigation collections combines tenant and global."""
        expected = INVESTIGATION_TENANT_COLLECTIONS + GLOBAL_REGISTRY_COLLECTIONS
        assert ALL_INVESTIGATION_COLLECTIONS == expected


class TestGetSettings:
    """Test get_settings function."""

    def test_get_settings_returns_settings_instance(self):
        """Test that get_settings returns a Settings instance."""
        settings = get_settings()
        assert isinstance(settings, Settings)

    def test_get_settings_is_cached(self):
        """Test that get_settings returns cached instance."""
        settings1 = get_settings()
        settings2 = get_settings()
        assert settings1 is settings2


class TestSettingsEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_very_long_jwt_secret(self):
        """Test that very long JWT secrets are accepted."""
        long_secret = "x" * 1000
        settings = Settings(jwt_secret=long_secret)
        assert settings.jwt_secret == long_secret

    def test_special_characters_in_api_keys(self):
        """Test API keys with special characters."""
        settings = Settings(
            api_keys="key-with-dash,key_with_underscore,key.with.dot", jwt_secret="test-secret"
        )
        assert "key-with-dash" in settings.api_keys
        assert "key_with_underscore" in settings.api_keys
        assert "key.with.dot" in settings.api_keys

    def test_whitespace_in_cors_origins(self):
        """Test that whitespace is handled in CORS origins."""
        settings = Settings(
            cors_origins=" http://localhost:3000 , https://app.example.com ",
            jwt_secret="test-secret",
        )
        assert "http://localhost:3000" in settings.cors_origins
        assert "https://app.example.com" in settings.cors_origins

    def test_rate_limit_minimum(self):
        """Test rate limit minimum value constraint."""
        with pytest.raises(ValidationError):
            Settings(rate_limit_per_minute=0, jwt_secret="test-secret")

    def test_rag_default_limit_range(self):
        """Test RAG default limit range constraints."""
        # Test minimum
        with pytest.raises(ValidationError):
            Settings(rag_default_limit=0, jwt_secret="test-secret")

        # Test maximum
        with pytest.raises(ValidationError):
            Settings(rag_default_limit=51, jwt_secret="test-secret")

    def test_search_weight_range(self):
        """Test search weight range constraints."""
        # Test below minimum
        with pytest.raises(ValidationError):
            Settings(search_similarity_weight=-0.1, jwt_secret="test-secret")

        # Test above maximum
        with pytest.raises(ValidationError):
            Settings(search_similarity_weight=1.1, jwt_secret="test-secret")

    def test_auto_importance_threshold_range(self):
        """Test auto importance threshold range."""
        # Test below minimum
        with pytest.raises(ValidationError):
            Settings(auto_importance_threshold=-0.1, jwt_secret="test-secret")

        # Test above maximum
        with pytest.raises(ValidationError):
            Settings(auto_importance_threshold=1.1, jwt_secret="test-secret")
