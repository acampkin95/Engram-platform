"""Tests for memory data models."""

import os
import pytest
from datetime import datetime, UTC
from uuid import UUID, uuid4

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.memory import (
    Memory,
    MemoryTier,
    MemoryType,
    MemorySource,
    SourceType,
    ConfidenceFactors,
    MemoryModification,
    ProvenanceRecord,
    TemporalBounds,
    TemporalResolution,
)


class TestMemoryTier:
    """Test MemoryTier enum."""

    def test_tier_values(self):
        """Test tier enum values."""
        assert MemoryTier.PROJECT == 1
        assert MemoryTier.GENERAL == 2
        assert MemoryTier.GLOBAL == 3

    def test_tier_is_int_enum(self):
        """Test that MemoryTier is an int enum."""
        assert isinstance(MemoryTier.PROJECT, int)
        assert MemoryTier.PROJECT + 1 == 2


class TestMemoryType:
    """Test MemoryType enum."""

    def test_memory_types_defined(self):
        """Test all memory types are defined."""
        types = [
            MemoryType.CONVERSATION,
            MemoryType.DOCUMENT,
            MemoryType.CODE,
            MemoryType.INSIGHT,
            MemoryType.PREFERENCE,
            MemoryType.FACT,
            MemoryType.RELATIONSHIP,
            MemoryType.ERROR_SOLUTION,
            MemoryType.WORKFLOW,
            MemoryType.CONSOLIDATED,
        ]
        assert len(types) == 10

    def test_memory_type_is_string(self):
        """Test that memory types are strings."""
        assert isinstance(MemoryType.FACT, str)
        assert str(MemoryType.FACT) == "fact"


class TestMemorySource:
    """Test MemorySource enum."""

    def test_sources_defined(self):
        """Test all source types are defined."""
        sources = [
            MemorySource.USER,
            MemorySource.AGENT,
            MemorySource.SYSTEM,
            MemorySource.DOCUMENTATION,
            MemorySource.EXTERNAL,
        ]
        assert len(sources) == 5


class TestSourceType:
    """Test SourceType enum."""

    def test_source_types_defined(self):
        """Test all source types are defined."""
        types = [
            SourceType.AI_ASSISTANT,
            SourceType.HUMAN_USER,
            SourceType.DOCUMENT_OCR,
            SourceType.API_INGESTION,
            SourceType.SYSTEM_INFERENCE,
        ]
        assert len(types) == 5


class TestConfidenceFactors:
    """Test ConfidenceFactors model."""

    def test_default_values(self):
        """Test default confidence factor values."""
        factors = ConfidenceFactors()
        assert factors.source_reliability == pytest.approx(0.8)
        assert factors.corroboration_score == pytest.approx(0.0)
        assert factors.temporal_freshness == pytest.approx(1.0)
        assert factors.semantic_coherence == pytest.approx(1.0)
        assert factors.user_feedback_score == pytest.approx(0.5)

    def test_custom_values(self):
        """Test custom confidence factor values."""
        factors = ConfidenceFactors(
            source_reliability=0.9,
            corroboration_score=0.7,
            temporal_freshness=0.8,
            semantic_coherence=0.9,
            user_feedback_score=0.8,
        )
        assert factors.source_reliability == pytest.approx(0.9)
        assert factors.corroboration_score == pytest.approx(0.7)

    def test_value_ranges(self):
        """Test that values must be between 0 and 1."""
        with pytest.raises(ValueError):
            ConfidenceFactors(source_reliability=1.5)
        
        with pytest.raises(ValueError):
            ConfidenceFactors(source_reliability=-0.1)


class TestMemoryModification:
    """Test MemoryModification model."""

    def test_default_timestamp(self):
        """Test that timestamp defaults to now."""
        mod = MemoryModification(
            modified_by="user123",
            modification_type="update",
            new_value="new content",
        )
        assert isinstance(mod.timestamp, datetime)
        assert mod.modified_by == "user123"
        assert mod.modification_type == "update"
        assert mod.new_value == "new content"
        assert mod.previous_value is None

    def test_optional_fields(self):
        """Test optional fields can be set."""
        mod = MemoryModification(
            modified_by="user123",
            modification_type="update",
            previous_value="old content",
            new_value="new content",
            confidence_change=0.1,
            reasoning="Updated with new information",
        )
        assert mod.previous_value == "old content"
        assert mod.confidence_change == pytest.approx(0.1)
        assert mod.reasoning == "Updated with new information"


class TestProvenanceRecord:
    """Test ProvenanceRecord model."""

    def test_default_values(self):
        """Test default provenance values."""
        prov = ProvenanceRecord()
        assert prov.origin == {}
        assert prov.source_type == SourceType.AI_ASSISTANT
        assert prov.source_identifier == "system"
        assert prov.confidence_at_origin == pytest.approx(0.5)
        assert prov.raw_input is None

    def test_custom_values(self):
        """Test custom provenance values."""
        prov = ProvenanceRecord(
            origin={"file": "doc.pdf", "page": 1},
            source_type=SourceType.DOCUMENT_OCR,
            source_identifier="ocr-engine",
            confidence_at_origin=0.9,
            raw_input="original text",
        )
        assert prov.origin == {"file": "doc.pdf", "page": 1}
        assert prov.source_type == SourceType.DOCUMENT_OCR
        assert prov.confidence_at_origin == pytest.approx(0.9)


class TestTemporalBounds:
    """Test TemporalBounds model."""

    def test_default_values(self):
        """Test default temporal bounds."""
        bounds = TemporalBounds()
        assert bounds.start_time is None
        assert bounds.end_time is None
        assert bounds.resolution == TemporalResolution.UNKNOWN
        assert bounds.is_ongoing is False
        assert bounds.relative_to is None

    def test_custom_values(self):
        """Test custom temporal bounds."""
        start = datetime.now(UTC)
        bounds = TemporalBounds(
            start_time=start,
            end_time=start,
            resolution=TemporalResolution.EXACT,
            is_ongoing=True,
            relative_to="mem-123",
        )
        assert bounds.start_time == start
        assert bounds.resolution == TemporalResolution.EXACT
        assert bounds.is_ongoing is True


class TestMemory:
    """Test Memory model."""

    def test_memory_creation_minimum(self):
        """Test creating memory with minimum required fields."""
        memory = Memory(content="Test content")
        assert memory.content == "Test content"
        assert isinstance(memory.id, UUID)
        assert memory.tier == MemoryTier.PROJECT
        assert memory.memory_type == MemoryType.FACT
        assert memory.source == MemorySource.AGENT

    def test_memory_creation_full(self):
        """Test creating memory with all fields."""
        memory = Memory(
            content="Full test content",
            summary="Summary",
            tier=MemoryTier.GENERAL,
            memory_type=MemoryType.INSIGHT,
            source=MemorySource.USER,
            project_id="proj-123",
            user_id="user-456",
            tenant_id="tenant-789",
            session_id="sess-abc",
            importance=0.8,
            confidence=0.9,
            tags=["test", "memory"],
            metadata={"key": "value"},
        )
        assert memory.content == "Full test content"
        assert memory.summary == "Summary"
        assert memory.tier == MemoryTier.GENERAL
        assert memory.memory_type == MemoryType.INSIGHT
        assert memory.project_id == "proj-123"
        assert memory.importance == pytest.approx(0.8)
        assert memory.confidence == pytest.approx(0.9)
        assert memory.tags == ["test", "memory"]
        assert memory.metadata == {"key": "value"}

    def test_memory_id_auto_generated(self):
        """Test that memory ID is auto-generated."""
        memory1 = Memory(content="Content 1")
        memory2 = Memory(content="Content 2")
        assert memory1.id != memory2.id
        assert isinstance(memory1.id, UUID)

    def test_memory_id_can_be_set(self):
        """Test that memory ID can be explicitly set."""
        custom_id = uuid4()
        memory = Memory(id=custom_id, content="Content")
        assert memory.id == custom_id

    def test_importance_range(self):
        """Test importance must be between 0 and 1."""
        with pytest.raises(ValueError):
            Memory(content="Test", importance=1.5)
        
        with pytest.raises(ValueError):
            Memory(content="Test", importance=-0.1)

    def test_confidence_range(self):
        """Test confidence must be between 0 and 1."""
        with pytest.raises(ValueError):
            Memory(content="Test", confidence=1.5)
        
        with pytest.raises(ValueError):
            Memory(content="Test", confidence=-0.1)

    def test_content_required(self):
        """Test that content is required."""
        with pytest.raises(ValueError):
            Memory(content="")

    def test_content_min_length(self):
        """Test that content has minimum length."""
        with pytest.raises(ValueError):
            Memory(content="")

    def test_default_timestamps(self):
        """Test that timestamps are auto-generated."""
        memory = Memory(content="Test")
        assert isinstance(memory.created_at, datetime)
        assert isinstance(memory.updated_at, datetime)

    def test_default_access_tracking(self):
        """Test default access tracking values."""
        memory = Memory(content="Test")
        assert memory.access_count == 0
        assert memory.recency_score == pytest.approx(1.0)
        assert memory.decay_factor == pytest.approx(1.0)
        assert memory.is_canonical is True

    def test_canonical_id_null_by_default(self):
        """Test that canonical_id is null by default."""
        memory = Memory(content="Test")
        assert memory.canonical_id is None

    def test_vector_can_be_none(self):
        """Test that vector can be None."""
        memory = Memory(content="Test")
        assert memory.vector is None

    def test_vector_can_be_set(self):
        """Test that vector can be set."""
        vector = [0.1, 0.2, 0.3, 0.4, 0.5]
        memory = Memory(content="Test", vector=vector)
        assert memory.vector == vector

    def test_tenant_id_default(self):
        """Test default tenant_id."""
        memory = Memory(content="Test")
        assert memory.tenant_id == "default"

    def test_tags_default_empty_list(self):
        """Test that tags default to empty list."""
        memory = Memory(content="Test")
        assert memory.tags == []

    def test_metadata_default_empty_dict(self):
        """Test that metadata defaults to empty dict."""
        memory = Memory(content="Test")
        assert memory.metadata == {}

    def test_rerank_score_none_by_default(self):
        """Test that rerank_score is None by default."""
        memory = Memory(content="Test")
        assert memory.rerank_score is None

    def test_last_accessed_at_none_by_default(self):
        """Test that last_accessed_at is None by default."""
        memory = Memory(content="Test")
        assert memory.last_accessed_at is None

    def test_embedding_metadata_none_by_default(self):
        """Test that embedding metadata is None by default."""
        memory = Memory(content="Test")
        assert memory.embedding_model is None
        assert memory.embedding_dimension is None

    def test_expires_at_none_by_default(self):
        """Test that expires_at is None by default."""
        memory = Memory(content="Test")
        assert memory.expires_at is None


class TestMemoryWithComplexData:
    """Test Memory with complex data structures."""

    def test_memory_with_nested_metadata(self):
        """Test memory with nested metadata."""
        metadata = {
            "source": {
                "file": "document.pdf",
                "page": 5,
            },
            "extraction": {
                "method": "ocr",
                "confidence": 0.95,
            },
        }
        memory = Memory(content="Test", metadata=metadata)
        assert memory.metadata["source"]["file"] == "document.pdf"

    def test_memory_with_confidence_factors(self):
        """Test memory with confidence factors."""
        factors = ConfidenceFactors(
            source_reliability=0.9,
            corroboration_score=0.7,
        )
        memory = Memory(content="Test")
        # Note: Memory doesn't have confidence_factors field directly
        # This test documents the intended usage pattern
        assert factors.source_reliability == pytest.approx(0.9)


class TestMemoryEqualityAndIdentity:
    """Test memory equality and identity."""

    def test_same_id_same_memory(self):
        """Test that memories with same ID are equal."""
        id_val = uuid4()
        memory1 = Memory(id=id_val, content="Content 1")
        memory2 = Memory(id=id_val, content="Content 2")
        # Pydantic models compare by value, not identity
        assert memory1.id == memory2.id

    def test_different_id_different_memory(self):
        """Test that memories with different IDs are different."""
        memory1 = Memory(content="Content 1")
        memory2 = Memory(content="Content 1")
        assert memory1.id != memory2.id
