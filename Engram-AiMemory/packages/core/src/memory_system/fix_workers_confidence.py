import sys
import re

content = open("workers.py").read()

import_statement = """from memory_system.credibility import SourceCredibilityManager, MemoryQualityScorer
from memory_system.contradiction import MultiFactorResolver
from memory_system.propagation import ConfidencePropagator
"""

if "SourceCredibilityManager" not in content:
    idx = content.find("from memory_system.decay import MemoryDecay")
    content = content[:idx] + import_statement + content[idx:]

# Let's add a _job_confidence_maintenance to the MaintenanceScheduler
job_method = """
    async def _job_confidence_maintenance(self) -> None:
        \"\"\"Batch process to evaluate memory contradictions and propagate confidence.\"\"\"
        if not self._ollama:
            return

        async with self._semaphore:
            self._stats["last_run"]["confidence_maintenance"] = datetime.now(UTC).isoformat()
            try:
                # 1. Get recent memories that haven't been checked for contradictions
                memories, _ = await self._ms.list_memories(limit=50) # simplified batch size
                
                resolver = MultiFactorResolver(weaviate_client=self._ms._weaviate, llm_client=self._ollama)
                propagator = ConfidencePropagator(self._ms)

                for memory in memories:
                    # check for contradictions against similar ones
                    query = memory.content
                    results = await self._ms.search(query=query, limit=5)
                    similar = [r.memory for r in results if str(r.memory.id) != str(memory.id)]
                    
                    contradictions = await resolver.detect_contradictions(memory, similar)
                    
                    for contradiction in contradictions:
                        # For now, just mark the contradiction ID
                        if contradiction.memory_id_b not in memory.contradictions:
                            memory.contradictions.append(contradiction.memory_id_b)
                            await self._ms._weaviate.update_memory_fields(
                                memory_id=memory.id, 
                                tier=memory.tier, 
                                fields={"contradictions": memory.contradictions}, 
                                tenant_id=memory.tenant_id
                            )

                    # Propagate confidence
                    if memory.supporting_evidence_ids:
                        await propagator.propagate_confidence_scores(str(memory.id))

                self._stats["jobs_run"] += 1
                logger.info("Confidence maintenance job completed")
            except Exception as e:
                logger.error(f"confidence_maintenance job failed: {e}")
"""

if "_job_confidence_maintenance" not in content:
    # insert before _job_decay_update
    idx = content.find("async def _job_update_decay")
    content = content[:idx] + job_method + "\n    " + content[idx:]

# Schedule it
schedule_code = """
        # Job 7: Confidence maintenance (daily at 4am)
        self._scheduler.add_job(
            self._job_confidence_maintenance,
            "cron",
            hour=4,
            minute=0,
            id="confidence_maintenance",
            max_instances=1,
            coalesce=True,
        )
"""
if "Job 7: Confidence" not in content:
    idx = content.find("self._scheduler.start()")
    content = content[:idx] + schedule_code + "\n        " + content[idx:]

open("workers.py", "w").write(content)
print("Updated workers.py with confidence propagation job")
