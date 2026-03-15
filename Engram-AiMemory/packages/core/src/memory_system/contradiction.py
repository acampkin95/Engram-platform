from dataclasses import dataclass
from datetime import UTC
from enum import StrEnum
from typing import Any

from memory_system.memory import Memory


class ContradictionType(StrEnum):
    FACTUAL_CONTRADICTION = "factual_contradiction"
    TEMPORAL_CONTRADICTION = "temporal_contradiction"


class ResolutionMethod(StrEnum):
    CONFIDENCE_BASED = "confidence_based"
    CORROBORATION_BASED = "corroboration_based"
    HYBRID_MULTI_FACTOR = "hybrid_multi_factor"
    AMBIGUOUS_KEPT = "ambiguous_kept"


@dataclass
class ContradictionResult:
    memory_id_a: str
    memory_id_b: str
    contradiction_type: ContradictionType
    confidence: float
    details: dict[str, Any]


class MultiFactorResolver:
    """Implement the hybrid multi-factor contradiction resolution approach."""

    def __init__(self, weaviate_client=None, llm_client=None) -> None:
        self.weaviate = weaviate_client
        self.llm = llm_client

    async def resolve_with_multi_factor(self, memory_a: Memory, memory_b: Memory) -> str:
        """
        Based on the Probabilistic Truth Convergence ADR-044.
        Returns the ID of the memory to KEEP (or 'ambiguous_keep_both').
        """
        conf_diff = abs(memory_a.overall_confidence - memory_b.overall_confidence) * 0.25
        # Direction of diff: positive means A > B
        conf_direction = 1 if memory_a.overall_confidence > memory_b.overall_confidence else -1

        corroboration_diff = (len(memory_a.supporting_evidence_ids) - len(memory_b.supporting_evidence_ids)) * 0.20
        # Positive means A > B

        # Simplified temporal relevance: newer is better
        time_a = memory_a.updated_at or memory_a.created_at
        time_b = memory_b.updated_at or memory_b.created_at

        # Make them tz-aware for comparison if needed
        if time_a.tzinfo is None: time_a = time_a.replace(tzinfo=UTC)
        if time_b.tzinfo is None: time_b = time_b.replace(tzinfo=UTC)

        time_diff_days = (time_a - time_b).total_seconds() / 86400.0
        temporal_relevance = min(1.0, max(-1.0, time_diff_days / 30.0)) * 0.20

        # Total score: positive favours A, negative favours B
        total_score = (conf_diff * conf_direction) + corroboration_diff + temporal_relevance

        if total_score > 0.3:
            return str(memory_a.id)
        elif total_score < -0.3:
            return str(memory_b.id)
        else:
            return "ambiguous_keep_both"

    async def detect_contradictions(
        self, memory: Memory, similar_memories: list[Memory]
    ) -> list[ContradictionResult]:
        """Detect contradictions against similar memories."""
        contradictions = []

        if not self.llm:
            return contradictions

        for similar in similar_memories:
            if str(memory.id) == str(similar.id):
                continue

            # Simple prompt for LLM to detect contradiction
            prompt = f"""
            Do these two statements contradict each other factually?
            Statement A: {memory.content}
            Statement B: {similar.content}
            Reply ONLY with TRUE or FALSE.
            """

            try:
                # Assuming ollama client has generate method
                if hasattr(self.llm, "generate"):
                    response = await self.llm.generate(prompt)
                else:
                    response = "FALSE"

                if "TRUE" in str(response).upper():
                    contradictions.append(
                        ContradictionResult(
                            memory_id_a=str(memory.id),
                            memory_id_b=str(similar.id),
                            contradiction_type=ContradictionType.FACTUAL_CONTRADICTION,
                            confidence=0.8,
                            details={"method": "llm_detection"}
                        )
                    )
            except Exception:
                pass

        return contradictions
