"""Tests for propagation.py - ConfidencePropagator."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from memory_system.propagation import ConfidencePropagator


class MockMemory:
    def __init__(self, memory_id, overall_confidence, supporting_evidence_ids):
        self.id = memory_id
        self.overall_confidence = overall_confidence
        self.supporting_evidence_ids = supporting_evidence_ids


class TestConfidencePropagatorInit:
    def test_takes_memory_system(self):
        mock_ms = object()
        propagator = ConfidencePropagator(mock_ms)
        assert propagator.ms is mock_ms


class TestPropagateConfidenceScores:
    @pytest.mark.asyncio
    async def test_returns_no_evidence_found_when_memory_not_found(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.return_value = None

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("some-id")

        assert result == {"status": "no_evidence_found"}

    @pytest.mark.asyncio
    async def test_returns_no_evidence_found_when_no_supporting_ids(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.return_value = MockMemory("seed-id", 0.5, supporting_evidence_ids=[])

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("seed-id")

        assert result == {"status": "no_evidence_found"}

    @pytest.mark.asyncio
    async def test_returns_evidence_not_resolvable_when_evidence_missing(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.side_effect = [
            MockMemory("seed-id", 0.5, supporting_evidence_ids=["ev1", "ev2"]),
            None,
            None,
        ]

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("seed-id")

        assert result == {"status": "evidence_not_resolvable"}

    @pytest.mark.asyncio
    async def test_returns_unchanged_when_change_too_small(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.side_effect = [
            MockMemory("seed-id", 0.8, supporting_evidence_ids=["ev1"]),
            MockMemory("ev1", 0.8, supporting_evidence_ids=[]),
        ]

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("seed-id")

        assert result == {"status": "unchanged"}
        mock_ms.update_memory.assert_not_called()

    @pytest.mark.asyncio
    async def test_updates_confidence_when_change_significant(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.side_effect = [
            MockMemory("seed-id", 0.3, supporting_evidence_ids=["ev1"]),
            MockMemory("ev1", 0.9, supporting_evidence_ids=[]),
        ]

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("seed-id")

        assert result["status"] == "updated"
        assert result["old_conf"] == pytest.approx(0.3)
        assert "new_conf" in result
        mock_ms.update_memory.assert_called_once()

    @pytest.mark.asyncio
    async def test_calculates_average_confidence_correctly(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.side_effect = [
            MockMemory("seed-id", 0.5, supporting_evidence_ids=["ev1", "ev2"]),
            MockMemory("ev1", 0.6, supporting_evidence_ids=[]),
            MockMemory("ev2", 0.8, supporting_evidence_ids=[]),
        ]

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("seed-id")

        avg = (0.6 + 0.8) / 2
        expected_new = min(1.0, (0.5 * 0.7) + (avg * 0.3))
        assert abs(result["new_conf"] - expected_new) < 0.001

    @pytest.mark.asyncio
    async def test_uses_depth_parameter(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.side_effect = [
            MockMemory("seed-id", 0.5, supporting_evidence_ids=["ev1"]),
            MockMemory("ev1", 0.7, supporting_evidence_ids=[]),
        ]

        propagator = ConfidencePropagator(mock_ms)
        await propagator.propagate_confidence_scores("seed-id", depth=2)

        assert mock_ms.get_memory.call_count == 2

    @pytest.mark.asyncio
    async def test_calculates_with_single_evidence(self):
        mock_ms = AsyncMock()
        mock_ms.get_memory.side_effect = [
            MockMemory("seed-id", 0.5, supporting_evidence_ids=["ev1"]),
            MockMemory("ev1", 0.7, supporting_evidence_ids=[]),
        ]

        propagator = ConfidencePropagator(mock_ms)
        result = await propagator.propagate_confidence_scores("seed-id")

        assert result["status"] == "updated"
