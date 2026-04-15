from __future__ import annotations

import pytest

"""
Unit tests for memory_system.decay — MemoryReranker class.

The MemoryDecay class is already tested in test_memory_system.py.
This file covers MemoryReranker (lines 58-104 of decay.py).
"""

import sys
from types import ModuleType
from unittest.mock import MagicMock, patch


from memory_system.decay import MemoryReranker


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_result(content: str = "test content") -> MagicMock:
    """Build a mock search result with .memory.content, .composite_score, .score."""
    result = MagicMock()
    result.memory = MagicMock()
    result.memory.content = content
    result.composite_score = 0.0
    result.score = 0.0
    return result


# ---------------------------------------------------------------------------
# MemoryReranker — init
# ---------------------------------------------------------------------------


class TestMemoryRerankerInit:
    def test_default_model_name(self) -> None:
        reranker = MemoryReranker()
        assert reranker.model_name == "cross-encoder/ms-marco-MiniLM-L-6-v2"
        assert reranker._model is None

    def test_custom_model_name(self) -> None:
        reranker = MemoryReranker(model_name="custom/model")
        assert reranker.model_name == "custom/model"


# ---------------------------------------------------------------------------
# MemoryReranker — _load_model
# ---------------------------------------------------------------------------


class TestLoadModel:
    def test_load_model_success(self) -> None:
        """When sentence_transformers is available, model is loaded."""
        mock_cross_encoder = MagicMock()
        mock_st_module = ModuleType("sentence_transformers")
        mock_st_module.CrossEncoder = mock_cross_encoder

        reranker = MemoryReranker()

        with patch.dict(sys.modules, {"sentence_transformers": mock_st_module}):
            reranker._load_model()

        mock_cross_encoder.assert_called_once_with(reranker.model_name)
        assert reranker._model is not None

    def test_load_model_import_error(self) -> None:
        """When sentence_transformers is missing, model stays None."""
        reranker = MemoryReranker()

        # Remove sentence_transformers from sys.modules if present
        with patch.dict(sys.modules, {"sentence_transformers": None}):
            # This will raise ImportError when trying to import
            reranker._model = None
            # Simulate ImportError path
            try:
                from sentence_transformers import CrossEncoder  # noqa: F401
            except (ImportError, TypeError):
                pass

        # Direct test of the _load_model ImportError handling
        reranker2 = MemoryReranker()
        # Patch the import to raise ImportError
        with patch("builtins.__import__", side_effect=ImportError("no module")):
            reranker2._load_model()
        assert reranker2._model is None


# ---------------------------------------------------------------------------
# MemoryReranker — rerank
# ---------------------------------------------------------------------------


class TestRerank:
    def test_rerank_with_model(self) -> None:
        """When model is available, results are scored and sorted."""
        reranker = MemoryReranker()
        mock_model = MagicMock()
        mock_model.predict = MagicMock(return_value=[0.3, 0.9, 0.1])
        reranker._model = mock_model

        r1 = _make_mock_result("content A")
        r2 = _make_mock_result("content B")
        r3 = _make_mock_result("content C")

        results = reranker.rerank("test query", [r1, r2, r3])
        # Should be sorted by composite_score descending
        assert results[0].composite_score == pytest.approx(0.9)
        assert results[1].composite_score == pytest.approx(0.3)
        assert results[2].composite_score == pytest.approx(0.1)

    def test_rerank_with_top_k(self) -> None:
        """top_k limits number of returned results."""
        reranker = MemoryReranker()
        mock_model = MagicMock()
        mock_model.predict = MagicMock(return_value=[0.3, 0.9, 0.1])
        reranker._model = mock_model

        results = [_make_mock_result(f"content {i}") for i in range(3)]
        reranked = reranker.rerank("test query", results, top_k=2)
        assert len(reranked) == 2

    def test_rerank_empty_results(self) -> None:
        """Empty input returns empty output."""
        reranker = MemoryReranker()
        reranker._model = MagicMock()
        result = reranker.rerank("test query", [])
        assert result == []

    def test_rerank_no_model_returns_original(self) -> None:
        """When model cannot be loaded, returns original results unchanged."""
        reranker = MemoryReranker()
        reranker._model = None

        # Patch _load_model to leave model as None
        with patch.object(reranker, "_load_model"):
            r1 = _make_mock_result("a")
            r2 = _make_mock_result("b")
            results = reranker.rerank("query", [r1, r2])

        assert results == [r1, r2]

    def test_rerank_triggers_lazy_load(self) -> None:
        """If model is None, rerank calls _load_model."""
        reranker = MemoryReranker()
        reranker._model = None

        with patch.object(reranker, "_load_model") as mock_load:
            reranker.rerank("query", [_make_mock_result()])
            mock_load.assert_called_once()

    def test_rerank_sets_score_and_composite(self) -> None:
        """Both .score and .composite_score are set on each result."""
        reranker = MemoryReranker()
        mock_model = MagicMock()
        mock_model.predict = MagicMock(return_value=[0.75])
        reranker._model = mock_model

        r = _make_mock_result("content")
        reranker.rerank("query", [r])
        assert r.score == pytest.approx(0.75)
        assert r.composite_score == pytest.approx(0.75)
