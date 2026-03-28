"""Tests for temporal.py - TemporalExtractor."""

import json
from datetime import datetime

import pytest

from memory_system.memory import Memory, TemporalBounds, TemporalResolution
from memory_system.temporal import TemporalExtractor


class TestTemporalExtractorInit:
    def test_default_init(self):
        extractor = TemporalExtractor()
        assert extractor.llm is None

    def test_init_with_llm(self):
        mock_llm = object()
        extractor = TemporalExtractor(llm_client=mock_llm)
        assert extractor.llm is mock_llm


class TestExtractTimelineEvents:
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_llm(self):
        extractor = TemporalExtractor()
        result = await extractor.extract_timeline_events("Some text")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_llm_returns_invalid_json(self):
        mock_llm = AsyncMock()
        mock_llm.generate.return_value = "not valid json"

        extractor = TemporalExtractor(llm_client=mock_llm)
        result = await extractor.extract_timeline_events("Some text")

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_llm_returns_invalid_json(self):
        mock_llm = MockLLM(return_value="not valid json")

        extractor = TemporalExtractor(llm_client=mock_llm)
        result = await extractor.extract_timeline_events("Some text")

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_llm_raises_exception(self):
        mock_llm = MockLLM(side_effect=Exception("LLM error"))

        extractor = TemporalExtractor(llm_client=mock_llm)
        result = await extractor.extract_timeline_events("Some text")

        assert result == []

    @pytest.mark.asyncio
    async def test_parses_valid_json_response(self):
        expected = [
            {
                "event": "Event 1",
                "start_time": "2024-01-01T00:00:00",
                "end_time": None,
                "is_ongoing": False,
            },
            {
                "event": "Event 2",
                "start_time": "2024-06-01T00:00:00",
                "end_time": "2024-06-30T23:59:59",
                "is_ongoing": False,
            },
        ]
        mock_llm = MockLLM(return_value=json.dumps(expected))

        extractor = TemporalExtractor(llm_client=mock_llm)
        result = await extractor.extract_timeline_events("Some text")

        assert result == expected

    @pytest.mark.asyncio
    async def test_calls_llm_with_prompt_containing_text(self):
        mock_llm = MockLLM(return_value="[]")

        extractor = TemporalExtractor(llm_client=mock_llm)
        await extractor.extract_timeline_events("Unique event text")

        assert mock_llm.generate is not None


class TestBindTemporalBounds:
    def test_binds_complete_bounds(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": "2024-01-01T00:00:00",
            "end_time": "2024-12-31T23:59:59",
            "is_ongoing": False,
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds is not None
        assert result.temporal_bounds.start_time == datetime(2024, 1, 1, 0, 0, 0)
        assert result.temporal_bounds.end_time == datetime(2024, 12, 31, 23, 59, 59)
        assert result.temporal_bounds.is_ongoing is False
        assert result.is_event is True

    def test_binds_ongoing_event(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": "2024-01-01T00:00:00",
            "end_time": None,
            "is_ongoing": True,
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds.is_ongoing is True
        assert result.temporal_bounds.end_time is None

    def test_handles_missing_start_time(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": None,
            "end_time": "2024-12-31T23:59:59",
            "is_ongoing": False,
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds.start_time is None
        assert result.temporal_bounds.end_time == datetime(2024, 12, 31, 23, 59, 59)
        assert result.temporal_bounds.resolution == TemporalResolution.APPROXIMATE

    def test_handles_invalid_date_format(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": "not-a-date",
            "end_time": "also-not-a-date",
            "is_ongoing": False,
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds.start_time is None
        assert result.temporal_bounds.end_time is None
        assert result.temporal_bounds.resolution == TemporalResolution.UNKNOWN

    def test_defaults_is_ongoing_to_false(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": "2024-01-01T00:00:00",
            "end_time": "2024-12-31T23:59:59",
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds.is_ongoing is False

    def test_sets_resolution_to_approx_when_dates_present(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": "2024-01-01T00:00:00",
            "end_time": None,
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds.resolution == TemporalResolution.APPROXIMATE

    def test_sets_resolution_to_unknown_when_no_dates(self):
        memory = Memory(content="Test memory")
        bounds = {
            "start_time": None,
            "end_time": None,
            "is_ongoing": False,
        }

        extractor = TemporalExtractor()
        result = extractor.bind_temporal_bounds(memory, bounds)

        assert result.temporal_bounds.resolution == TemporalResolution.UNKNOWN


class AsyncMock:
    def __init__(self, *args, **kwargs):
        self.return_value = kwargs.get("return_value")
        self.side_effect = kwargs.get("side_effect")

    async def __call__(self, *args, **kwargs):
        if self.side_effect:
            if isinstance(self.side_effect, list):
                return self.side_effect.pop(0)
            raise self.side_effect
        return self.return_value


class MockLLM:
    def __init__(self, return_value=None, side_effect=None):
        self._return_value = return_value
        self._side_effect = side_effect

    async def generate(self, *args, **kwargs):
        if self._side_effect:
            if isinstance(self._side_effect, list):
                return self._side_effect.pop(0)
            raise self._side_effect
        return self._return_value
