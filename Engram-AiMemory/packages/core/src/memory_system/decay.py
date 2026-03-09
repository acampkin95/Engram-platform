"""
Memory decay calculations using exponential decay.

Recency score formula: 2^(-age_days / half_life_days)
"""

from __future__ import annotations

import math
from datetime import UTC, datetime


class MemoryDecay:
    """Exponential decay calculator for memory recency and fitness scoring."""

    def __init__(self, half_life_days: int = 7):
        self.half_life_days = half_life_days

    def calculate_recency_score(
        self,
        created_at: datetime,
        now: datetime | None = None,
    ) -> float:
        """
        Exponential decay: 2^(-age / half_life).

        Returns a value in [0.0, 1.0] where 1.0 is brand-new.
        """
        now = now or datetime.now(UTC)
        age_days = (now - created_at).total_seconds() / 86400.0
        if age_days < 0:
            return 1.0
        decay = math.exp(-math.log(2) * age_days / self.half_life_days)
        return max(0.0, min(1.0, decay))


    def calculate_decay(
        self,
        created_at: datetime,
        last_accessed: datetime | None,
        access_count: int,
        access_boost: float = 0.1,
        min_importance: float = 0.1,
        now: datetime | None = None,
    ) -> float:
        """Calculate the combined decay factor based on time and access count."""
        now = now or datetime.now(UTC)
        reference_time = last_accessed or created_at
        if reference_time and reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=UTC)
        if reference_time:
            days_since = (now - reference_time).total_seconds() / 86400.0
            decay = math.exp(-math.log(2) * max(0, days_since) / self.half_life_days)
        else:
            decay = 1.0
        access_factor = min(2.0, 1.0 + (access_count * access_boost))
        return max(min_importance, decay * access_factor)

    def calculate_memory_fitness(

        self,
        access_count: int,
        importance: float,
        recency_score: float,
        access_weight: float = 0.3,
        importance_weight: float = 0.4,
        recency_weight: float = 0.3,
    ) -> float:
        """
        Composite fitness for retention decisions.

        Uses log-scaled access count to prevent access domination.
        """
        access_score = min(1.0, math.log10(access_count + 1) / 2.0)
        return (
            access_weight * access_score
            + importance_weight * importance
            + recency_weight * recency_score
        )


class MemoryReranker:
    """Optional cross-encoder reranker for search results."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self._model = None

    def _load_model(self) -> None:
        try:
            from sentence_transformers import CrossEncoder

            self._model = CrossEncoder(self.model_name)
        except ImportError:
            self._model = None

    def rerank(
        self,
        query: str,
        results: list,
        top_k: int | None = None,
    ) -> list:
        """Rerank search results using cross-encoder scoring.

        If model not available, returns original results unchanged (graceful fallback).
        """
        if self._model is None:
            self._load_model()

        if self._model is None:
            return results

        if not results:
            return results

        pairs = [(query, r.memory.content) for r in results]
        scores = self._model.predict(pairs)

        for result, score in zip(results, scores, strict=False):
            result.composite_score = float(score)
            result.score = float(score)

        results.sort(key=lambda x: x.composite_score, reverse=True)

        if top_k:
            results = results[:top_k]

        return results
