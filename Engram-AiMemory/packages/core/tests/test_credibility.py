"""Tests for credibility scoring and source reliability management."""

import os
import pytest
from datetime import datetime, UTC, timedelta

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.credibility import SourceCredibilityManager, MemoryQualityScorer
from memory_system.memory import Memory, MemoryType, MemorySource, SourceType


class TestSourceCredibilityManager:
    """Test SourceCredibilityManager class."""

    @pytest.fixture
    def manager(self):
        """Create a SourceCredibilityManager instance."""
        return SourceCredibilityManager()

    def test_initialization(self, manager):
        """Test that manager initializes with source profiles."""
        assert len(manager.source_profiles) == 4
        assert SourceType.HUMAN_USER in manager.source_profiles
        assert SourceType.AI_ASSISTANT in manager.source_profiles

    def test_source_profiles_have_required_fields(self, manager):
        """Test that all source profiles have required configuration fields."""
        for source_type, profile in manager.source_profiles.items():
            assert "base" in profile
            assert "decay_rate" in profile
            assert "requires_verification" in profile
            assert "min_conf" in profile
            assert "max_conf" in profile

    def test_calculate_source_confidence_basic(self, manager):
        """Test basic source confidence calculation."""
        confidence = manager.calculate_source_confidence(
            source_type=SourceType.HUMAN_USER,
            source_id="user-123",
        )
        assert 0 <= confidence <= 1

    def test_calculate_source_confidence_decay_over_time(self, manager):
        """Test that confidence decays over time."""
        old_timestamp = datetime.now(UTC) - timedelta(days=30)
        
        old_confidence = manager.calculate_source_confidence(
            source_type=SourceType.AI_ASSISTANT,
            source_id="test-source",
            timestamp=old_timestamp,
        )
        
        new_confidence = manager.calculate_source_confidence(
            source_type=SourceType.AI_ASSISTANT,
            source_id="test-source",
            timestamp=datetime.now(UTC),
        )
        
        assert new_confidence >= old_confidence

    def test_update_source_performance_creates_new_metrics(self, manager):
        """Test that updating performance creates new metrics entry."""
        assert "new-source" not in manager.source_metrics
        
        manager.update_source_performance("new-source", was_correct=True)
        
        assert "new-source" in manager.source_metrics

    def test_update_source_performance_updates_accuracy(self, manager):
        """Test that performance update adjusts accuracy score."""
        manager.update_source_performance("test-source", was_correct=True)
        initial_accuracy = manager.source_metrics["test-source"]["accuracy_score"]
        
        for _ in range(5):
            manager.update_source_performance("test-source", was_correct=True)
        
        new_accuracy = manager.source_metrics["test-source"]["accuracy_score"]
        assert new_accuracy > initial_accuracy


class TestMemoryQualityScorer:
    """Test MemoryQualityScorer class."""

    @pytest.fixture
    def scorer(self):
        """Create a MemoryQualityScorer instance without ollama."""
        return MemoryQualityScorer(ollama_client=None)

    @pytest.fixture
    def sample_memory(self):
        """Create a sample memory for testing."""
        return Memory(
            content="Test memory content",
            memory_type=MemoryType.FACT,
            source=MemorySource.USER,
        )

    @pytest.mark.asyncio
    async def test_calculate_quality_score_without_ollama(self, scorer, sample_memory):
        """Test quality score calculation without ollama client."""
        result = await scorer.calculate_quality_score(sample_memory)
        
        assert "memory_id" in result
        assert "quality_scores" in result
        assert "overall_quality" in result

    @pytest.mark.asyncio
    async def test_overall_quality_within_bounds(self, scorer, sample_memory):
        """Test that overall quality score is within 0-1 bounds."""
        result = await scorer.calculate_quality_score(sample_memory)
        assert 0 <= result["overall_quality"] <= 1

    def test_assess_completeness_with_all_fields(self, scorer, sample_memory):
        """Test completeness assessment with all required fields."""
        completeness = scorer._assess_completeness(sample_memory)
        assert completeness == pytest.approx(1.0)

    def test_assess_relevance_no_access(self, scorer, sample_memory):
        """Test relevance assessment with no accesses."""
        relevance = scorer._assess_relevance(sample_memory)
        assert relevance == pytest.approx(0.0)

    def test_assess_relevance_with_accesses(self, scorer):
        """Test relevance assessment with multiple accesses."""
        memory = Memory(content="Test", access_count=5)
        relevance = scorer._assess_relevance(memory)
        assert relevance == pytest.approx(0.5)

    def test_assess_evidence_quality_no_evidence(self, scorer, sample_memory):
        """Test evidence quality with no supporting evidence."""
        quality = scorer._assess_evidence_quality(sample_memory)
        assert quality == pytest.approx(0.0)
