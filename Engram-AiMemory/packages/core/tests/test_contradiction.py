"""
Tests for contradiction detection and resolution.

Tests ContradictionType, ResolutionMethod, ContradictionResult,
MultiFactorResolver, and detect_contradictions functionality.
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from memory_system.compat import UTC
from memory_system.contradiction import (
    ContradictionResult,
    ContradictionType,
    MultiFactorResolver,
    ResolutionMethod,
)
from memory_system.memory import Memory


class TestContradictionType:
    def test_has_factual_contradiction(self):
        assert ContradictionType.FACTUAL_CONTRADICTION == "factual_contradiction"

    def test_has_temporal_contradiction(self):
        assert ContradictionType.TEMPORAL_CONTRADICTION == "temporal_contradiction"


class TestResolutionMethod:
    def test_has_all_methods(self):
        assert ResolutionMethod.CONFIDENCE_BASED == "confidence_based"
        assert ResolutionMethod.CORROBORATION_BASED == "corroboration_based"
        assert ResolutionMethod.HYBRID_MULTI_FACTOR == "hybrid_multi_factor"
        assert ResolutionMethod.AMBIGUOUS_KEPT == "ambiguous_kept"


class TestContradictionResult:
    def test_creates_result(self):
        result = ContradictionResult(
            memory_id_a="id-a",
            memory_id_b="id-b",
            contradiction_type=ContradictionType.FACTUAL_CONTRADICTION,
            confidence=0.85,
            details={"method": "llm_detection"},
        )
        assert result.memory_id_a == "id-a"
        assert result.memory_id_b == "id-b"
        assert result.contradiction_type == ContradictionType.FACTUAL_CONTRADICTION
        assert result.confidence == 0.85
        assert result.details == {"method": "llm_detection"}


class TestMultiFactorResolverInit:
    def test_default_init(self):
        resolver = MultiFactorResolver()
        assert resolver.weaviate is None
        assert resolver.llm is None

    def test_init_with_clients(self):
        mock_weaviate = object()
        mock_llm = object()
        resolver = MultiFactorResolver(weaviate_client=mock_weaviate, llm_client=mock_llm)
        assert resolver.weaviate is mock_weaviate
        assert resolver.llm is mock_llm


def _make_memory(
    override_overall_confidence: float,
    evidence_count: int,
    days_ago: int,
) -> Memory:
    """Helper to create a Memory with specific values for testing."""
    base_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
    past_time = base_time - timedelta(days=days_ago)

    return Memory(
        id=uuid4(),
        content="Test content",
        overall_confidence=override_overall_confidence,
        confidence=override_overall_confidence,
        supporting_evidence_ids=[f"evidence-{i}" for i in range(evidence_count)],
        created_at=past_time,
        updated_at=past_time,
    )


class TestResolveWithMultiFactor:
    @pytest.mark.asyncio
    async def test_returns_memory_a_when_significantly_higher_confidence(self):
        """
        When total_score > 0.3, returns A.
        conf_diff * conf_direction + corroboration_diff + temporal_relevance > 0.3

        memory_a (0.9 overall, 2 evidence, 1000 days old) vs memory_b (0.5 overall, 1 evidence, 2000 days old):
        - conf_diff = |0.9 - 0.5| * 0.25 = 0.1
        - conf_direction = 1 (A > B)
        - conf_component = 0.1 * 1 = 0.1
        - corroboration_diff = (2 - 1) * 0.20 = 0.2
        - temporal: A is 1000 days newer, time_diff_days = 1000
          temporal_relevance = min(1.0, 1000/30) * 0.20 = 0.20
        - total_score = 0.1 + 0.2 + 0.2 = 0.5 > 0.3 -> returns A
        """
        memory_a = _make_memory(0.9, evidence_count=2, days_ago=1000)
        memory_b = _make_memory(0.5, evidence_count=1, days_ago=2000)

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == str(memory_a.id)

    @pytest.mark.asyncio
    async def test_returns_memory_b_when_higher_confidence(self):
        """
        When total_score < -0.3, returns B.

        memory_a (0.5 overall, 1 evidence, 1000 days old) vs memory_b (0.9 overall, 2 evidence, 500 days old):
        - conf_diff = |0.5 - 0.9| * 0.25 = 0.1
        - conf_direction = -1 (A < B)
        - conf_component = 0.1 * -1 = -0.1
        - corroboration_diff = (1 - 2) * 0.20 = -0.2
        - temporal: B is 500 days newer, time_diff_days = -500
          temporal_relevance = min(1.0, -500/30) * 0.20 = -0.20
        - total_score = -0.1 + (-0.2) + (-0.2) = -0.5 < -0.3 -> returns B
        """
        memory_a = _make_memory(0.5, evidence_count=1, days_ago=1000)
        memory_b = _make_memory(0.9, evidence_count=2, days_ago=500)

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == str(memory_b.id)

    @pytest.mark.asyncio
    async def test_returns_ambiguous_when_scores_similar(self):
        """When |total_score| <= 0.3, returns ambiguous_keep_both."""
        memory_a = _make_memory(0.6, evidence_count=1, days_ago=1000)
        memory_b = _make_memory(0.6, evidence_count=1, days_ago=1000)

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == "ambiguous_keep_both"

    @pytest.mark.asyncio
    async def test_considers_supporting_evidence_count(self):
        """
        More evidence favors A when confidence is equal.

        Same confidence (0.6) but A has 3 evidence vs B has 1:
        - conf_diff = |0.6 - 0.6| * 0.25 = 0
        - conf_component = 0
        - corroboration_diff = (3 - 1) * 0.20 = 0.4
        - temporal: 0 days diff -> temporal_relevance = 0
        - total_score = 0 + 0.4 + 0 = 0.4 > 0.3 -> returns A
        """
        memory_a = _make_memory(0.6, evidence_count=3, days_ago=1000)
        memory_b = _make_memory(0.6, evidence_count=1, days_ago=1000)

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == str(memory_a.id)

    @pytest.mark.asyncio
    async def test_considers_temporal_relevance_newer(self):
        """
        Newer memories favored when other factors push total over threshold.

        A has slightly higher confidence (0.75 vs 0.55) and 1 more evidence and is 2000 days newer:
        - conf_diff = |0.75 - 0.55| * 0.25 = 0.05
        - conf_component = 0.05 * 1 = 0.05
        - corroboration_diff = (2 - 1) * 0.20 = 0.2
        - temporal: 2000 days newer -> temporal_relevance = min(1.0, 2000/30) * 0.20 = 0.20
        - total_score = 0.05 + 0.2 + 0.2 = 0.45 > 0.3 -> returns A
        """
        memory_a = _make_memory(0.75, evidence_count=2, days_ago=1000)
        memory_b = _make_memory(0.55, evidence_count=1, days_ago=3000)

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == str(memory_a.id)

    @pytest.mark.asyncio
    async def test_handles_tz_aware_datetimes(self):
        """Handles timezone-aware datetimes correctly."""
        memory_a = Memory(
            id=uuid4(),
            content="A content",
            overall_confidence=0.7,
            confidence=0.7,
            supporting_evidence_ids=["e1", "e2"],
            created_at=datetime(2025, 6, 1, 12, 0, 0, tzinfo=UTC),
            updated_at=datetime(2025, 6, 1, 12, 0, 0, tzinfo=UTC),
        )
        memory_b = Memory(
            id=uuid4(),
            content="B content",
            overall_confidence=0.5,
            confidence=0.5,
            supporting_evidence_ids=["e1"],
            created_at=datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC),
            updated_at=datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC),
        )

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == str(memory_a.id)

    @pytest.mark.asyncio
    async def test_handles_tz_naive_datetimes(self):
        """Handles timezone-naive datetimes by treating them as UTC."""
        memory_a = Memory(
            id=uuid4(),
            content="A content",
            overall_confidence=0.7,
            confidence=0.7,
            supporting_evidence_ids=["e1", "e2"],
            created_at=datetime(2025, 6, 1, 12, 0, 0),
            updated_at=datetime(2025, 6, 1, 12, 0, 0),
        )
        memory_b = Memory(
            id=uuid4(),
            content="B content",
            overall_confidence=0.5,
            confidence=0.5,
            supporting_evidence_ids=["e1"],
            created_at=datetime(2025, 1, 1, 12, 0, 0),
            updated_at=datetime(2025, 1, 1, 12, 0, 0),
        )

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == str(memory_a.id)

    @pytest.mark.asyncio
    async def test_threshold_boundaries(self):
        """
        When scores are too similar to cross threshold, returns ambiguous.
        |0.525 - 0.475| * 0.25 = 0.0125 conf_component
        corroboration = 0 (same evidence)
        temporal = 0 (same age)
        total = 0.0125 < 0.3 -> ambiguous
        """
        memory_a = _make_memory(0.525, evidence_count=1, days_ago=1000)
        memory_b = _make_memory(0.475, evidence_count=1, days_ago=1000)

        resolver = MultiFactorResolver()
        result = await resolver.resolve_with_multi_factor(memory_a, memory_b)

        assert result == "ambiguous_keep_both"


class TestDetectContradictions:
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_llm(self):
        """Returns empty list when no LLM client is configured."""
        memory = Memory(id=uuid4(), content="Test content")
        similar = Memory(id=uuid4(), content="Similar content")

        resolver = MultiFactorResolver()
        result = await resolver.detect_contradictions(memory, [similar])

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_similar_memories(self):
        """Returns empty list when similar_memories is empty."""
        memory = Memory(id=uuid4(), content="Test content")

        resolver = MultiFactorResolver(llm_client=object())
        result = await resolver.detect_contradictions(memory, [])

        assert result == []

    @pytest.mark.asyncio
    async def test_skips_self_comparison(self):
        """Skips comparison when similar memory has same ID as source."""
        memory_id = uuid4()
        memory = Memory(id=memory_id, content="Test content")
        similar = Memory(id=memory_id, content="Same ID content")

        resolver = MultiFactorResolver(llm_client=object())
        result = await resolver.detect_contradictions(memory, [similar])

        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_detects_contradiction_when_llm_returns_true(self):
        """Detects contradiction when LLM returns TRUE."""
        memory = Memory(id=uuid4(), content="The sky is blue")
        similar = Memory(id=uuid4(), content="The sky is green")

        mock_llm = AsyncMockMock()
        mock_llm.generate = AsyncMockMock(return_value="TRUE")

        resolver = MultiFactorResolver(llm_client=mock_llm)
        result = await resolver.detect_contradictions(memory, [similar])

        assert len(result) == 1
        assert result[0].memory_id_a == str(memory.id)
        assert result[0].memory_id_b == str(similar.id)
        assert result[0].contradiction_type == ContradictionType.FACTUAL_CONTRADICTION
        assert result[0].confidence == 0.8

    @pytest.mark.asyncio
    async def test_no_contradiction_when_llm_returns_false(self):
        """No contradiction detected when LLM returns FALSE."""
        memory = Memory(id=uuid4(), content="The sky is blue")
        similar = Memory(id=uuid4(), content="The sky is also blue")

        mock_llm = AsyncMockMock()
        mock_llm.generate = AsyncMockMock(return_value="FALSE")

        resolver = MultiFactorResolver(llm_client=mock_llm)
        result = await resolver.detect_contradictions(memory, [similar])

        assert result == []

    @pytest.mark.asyncio
    async def test_handles_llm_exception_gracefully(self):
        """Handles LLM exceptions without crashing."""
        memory = Memory(id=uuid4(), content="Test content")
        similar = Memory(id=uuid4(), content="Similar content")

        mock_llm = AsyncMockMock()
        mock_llm.generate = AsyncMockMock(side_effect=Exception("LLM error"))

        resolver = MultiFactorResolver(llm_client=mock_llm)
        result = await resolver.detect_contradictions(memory, [similar])

        assert result == []

    @pytest.mark.asyncio
    async def test_multiple_similar_memories(self):
        """Checks multiple similar memories."""
        memory = Memory(id=uuid4(), content="The sky is blue")
        similar1 = Memory(id=uuid4(), content="The sky is green")
        similar2 = Memory(id=uuid4(), content="The sky is blue today")

        mock_llm = AsyncMockMock()
        mock_llm.generate = AsyncMockMock(side_effect=["TRUE", "FALSE"])

        resolver = MultiFactorResolver(llm_client=mock_llm)
        result = await resolver.detect_contradictions(memory, [similar1, similar2])

        assert len(result) == 1
        assert result[0].memory_id_b == str(similar1.id)

    @pytest.mark.asyncio
    async def test_uses_hasattr_for_llm_capabilities(self):
        """Falls back to FALSE when LLM doesn't have generate method."""
        memory = Memory(id=uuid4(), content="Test content")
        similar = Memory(id=uuid4(), content="Similar content")

        mock_llm = object()

        resolver = MultiFactorResolver(llm_client=mock_llm)
        result = await resolver.detect_contradictions(memory, [similar])

        assert result == []


class AsyncMockMock:
    """Simple async mock for testing."""

    def __init__(self, *args, **kwargs):
        self.return_value = kwargs.get("return_value")
        self.side_effect = kwargs.get("side_effect")

    async def __call__(self, *args, **kwargs):
        if self.side_effect:
            if isinstance(self.side_effect, list):
                return self.side_effect.pop(0)
            raise self.side_effect
        return self.return_value
