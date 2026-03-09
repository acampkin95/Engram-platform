import asyncio
from datetime import UTC, datetime

from memory_system.memory import Memory


class ConfidencePropagator:
    """Propagate confidence scores through the knowledge graph based on network effects."""

    def __init__(self, memory_system) -> None:
        self.ms = memory_system

    async def propagate_confidence_scores(self, seed_memory_id: str, depth: int = 2) -> dict:
        """
        Simplified propagation: we will just look at supporting evidence ids
        and average their confidences to boost the seed memory.
        """
        seed_memory = await self.ms.get_memory(seed_memory_id)
        if not seed_memory or not seed_memory.supporting_evidence_ids:
            return {"status": "no_evidence_found"}

        evidence_confidences = []
        for ev_id in seed_memory.supporting_evidence_ids:
            ev_memory = await self.ms.get_memory(ev_id)
            if ev_memory:
                evidence_confidences.append(ev_memory.overall_confidence)

        if not evidence_confidences:
            return {"status": "evidence_not_resolvable"}

        avg_evidence_confidence = sum(evidence_confidences) / len(evidence_confidences)
        
        # Dampened update
        current_conf = seed_memory.overall_confidence
        new_conf = min(1.0, (current_conf * 0.7) + (avg_evidence_confidence * 0.3))

        if abs(new_conf - current_conf) > 0.05:
            await self.ms.update_memory(seed_memory_id, {"overall_confidence": new_conf})
            return {"status": "updated", "old_conf": current_conf, "new_conf": new_conf}

        return {"status": "unchanged"}
