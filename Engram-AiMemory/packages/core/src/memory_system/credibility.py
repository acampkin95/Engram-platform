from datetime import UTC, datetime
from typing import Any

from memory_system.memory import Memory, SourceType


class SourceCredibilityManager:
    """Manage source reliability scores based on decay, validation, and content complexity."""

    def __init__(self) -> None:
        # Define base profiles for source types
        self.source_profiles = {
            SourceType.HUMAN_USER: {
                "base": 0.9,
                "decay_rate": 0.01,
                "requires_verification": False,
                "min_conf": 0.5,
                "max_conf": 0.95,
            },
            SourceType.AI_ASSISTANT: {
                "base": 0.7,
                "decay_rate": 0.05,
                "requires_verification": True,
                "min_conf": 0.3,
                "max_conf": 0.85,
            },
            SourceType.DOCUMENT_OCR: {
                "base": 0.6,
                "decay_rate": 0.1,
                "requires_verification": True,
                "min_conf": 0.2,
                "max_conf": 0.75,
            },
            SourceType.SYSTEM_INFERENCE: {
                "base": 0.5,
                "decay_rate": 0.2,
                "requires_verification": True,
                "min_conf": 0.1,
                "max_conf": 0.6,
            },
        }
        # In memory tracker. Ideally this would be persisted in Redis/Weaviate
        self.source_metrics: dict[str, dict] = {}

    def calculate_source_confidence(
        self,
        source_type: str,
        source_id: str,
        timestamp: datetime | None = None,
        content_complexity: float = 1.0,
    ) -> float:
        """Calculate confidence score for a specific source."""
        # Fallback to AI_ASSISTANT if source_type isn't in profiles
        profile = self.source_profiles.get(source_type, self.source_profiles[SourceType.AI_ASSISTANT])

        metrics = self.source_metrics.get(
            source_id,
            {
                "accuracy_score": 0.5,
                "verification_count": 0,
                "total_contributions": 0,
                "last_contribution": timestamp or datetime.now(UTC),
            },
        )

        now = datetime.now(UTC)
        last_contrib = metrics["last_contribution"]
        if last_contrib.tzinfo is None:
            last_contrib = last_contrib.replace(tzinfo=UTC)

        time_since_last = now - last_contrib
        decay_modifier = max(0.0, 1.0 - (profile["decay_rate"] * time_since_last.days))

        base_score = profile["base"]
        accuracy_adj = metrics["accuracy_score"] - 0.5

        verification_boost = 0.0
        if profile["requires_verification"] and metrics["verification_count"] > 0:
            verification_boost = min(0.2, metrics["verification_count"] * 0.05)

        complexity_penalty = (content_complexity - 1.0) * -0.1

        confidence = (
            base_score * decay_modifier + accuracy_adj * 0.3 + verification_boost + complexity_penalty
        )

        return max(profile["min_conf"], min(profile["max_conf"], confidence))

    def update_source_performance(
        self, source_id: str, was_correct: bool, verified_externally: bool = False
    ) -> None:
        """Update source metrics based on outcome."""
        if source_id not in self.source_metrics:
            self.source_metrics[source_id] = {
                "accuracy_score": 0.5,
                "verification_count": 0,
                "total_contributions": 0,
                "last_contribution": datetime.now(UTC),
            }

        metrics = self.source_metrics[source_id]
        metrics["total_contributions"] += 1

        current_score = metrics["accuracy_score"]
        outcome_value = 1.0 if was_correct else 0.0
        metrics["accuracy_score"] = (current_score * 0.8) + (outcome_value * 0.2)

        if verified_externally:
            metrics["verification_count"] += 1

        metrics["last_contribution"] = datetime.now(UTC)


class MemoryQualityScorer:
    """Score memories for completeness, relevance, and usefulness."""

    def __init__(self, ollama_client=None) -> None:
        self.ollama = ollama_client

    async def calculate_quality_score(self, memory: Memory) -> dict[str, Any]:
        """Calculate overall quality scores based on TrustRAG survey findings."""
        scores = {
            "completeness": self._assess_completeness(memory),
            "relevance": self._assess_relevance(memory),
            "source_trustworthiness": memory.overall_confidence,
            "evidence_quality": self._assess_evidence_quality(memory),
        }

        # Add LLM-based scores if client is available
        if self.ollama:
            scores["clarity"] = await self._assess_clarity(memory)
            scores["actionability"] = await self._assess_actionability(memory)
        else:
            scores["clarity"] = 0.5
            scores["actionability"] = 0.5

        weights = {
            "completeness": 0.20,
            "relevance": 0.25,
            "clarity": 0.15,
            "actionability": 0.15,
            "source_trustworthiness": 0.15,
            "evidence_quality": 0.10,
        }

        overall_quality = sum(scores[k] * weights[k] for k in scores)

        return {
            "memory_id": str(memory.id),
            "quality_scores": scores,
            "overall_quality": overall_quality,
        }

    def _assess_completeness(self, memory: Memory) -> float:
        required_fields = ["content", "source", "memory_type"]
        has_all = all(getattr(memory, field, None) for field in required_fields)
        return 1.0 if has_all else 0.5

    def _assess_relevance(self, memory: Memory) -> float:
        access_count = getattr(memory, "access_count", 0)
        return min(1.0, access_count * 0.1)

    def _assess_evidence_quality(self, memory: Memory) -> float:
        ev_count = len(memory.supporting_evidence_ids)
        return min(1.0, ev_count * 0.2)

    async def _assess_clarity(self, memory: Memory) -> float:
        # Simplified placeholder for clarity assessment via LLM
        if not self.ollama:
            return 0.5
        # Would typically prompt LLM here: "Rate clarity of this text from 1-10"
        return 0.8  # Stubbed

    async def _assess_actionability(self, memory: Memory) -> float:
        if not self.ollama:
            return 0.5
        # Would prompt LLM: "Rate actionability of this text from 1-10"
        return 0.7  # Stubbed
