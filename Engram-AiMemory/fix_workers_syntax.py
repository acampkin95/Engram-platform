import sys

# I will recreate workers.py from a pristine state by finding the bad block
content = open("packages/core/src/memory_system/workers.py").read()

import re

# Finding the decay method
decay_start = content.find("async def _job_update_decay(self) -> None:")

if decay_start != -1:
    # We will replace the whole _job_update_decay function with a clean one
    # First, find where it ends (the next function _job_consolidate)
    consolidate_start = content.find("async def _job_consolidate(self) -> None:")
    
    clean_decay = """    async def _job_update_decay(self) -> None:
        \"\"\"Update decay_factor for all memories based on access recency.\"\"\"
        async with self._semaphore:
            self._stats["last_run"]["decay_update"] = datetime.now(UTC).isoformat()
            try:
                settings = self._ms.settings
                half_life = getattr(settings, "decay_half_life_days", 30.0)
                access_boost = getattr(settings, "decay_access_boost", 0.1)
                min_importance = getattr(settings, "decay_min_importance", 0.1)

                offset = 0
                total_updated = 0
                while True:
                    memories, total = await self._ms.list_memories(limit=100, offset=offset)
                    if not memories:
                        break

                    now = datetime.now(UTC)
                    for memory in memories:
                        try:
                            from memory_system.decay import MemoryDecay
                            decay_calc = MemoryDecay(half_life_days=half_life)
                            new_decay = decay_calc.calculate_decay(
                                created_at=memory.created_at,
                                last_accessed=memory.last_accessed_at,
                                access_count=memory.access_count,
                                access_boost=access_boost,
                                min_importance=min_importance,
                                now=now
                            )

                            await self._ms._weaviate.update_memory_fields(
                                memory_id=memory.id,
                                tier=memory.tier,
                                fields={"decay_factor": new_decay},
                                tenant_id=memory.tenant_id,
                            )
                            total_updated += 1
                        except Exception as e:
                            from memory_system.workers import logger
                            logger.warning(f"Decay update failed for {memory.id}: {e}")

                    offset += len(memories)
                    if offset >= total:
                        break

                self._stats["memories_decayed"] = total_updated
                self._stats["jobs_run"] += 1
                from memory_system.workers import logger
                logger.info(f"Updated decay for {total_updated} memories")
            except Exception as e:
                from memory_system.workers import logger
                logger.error(f"decay_update job failed: {e}")

    """
    
    content = content[:decay_start] + clean_decay + content[consolidate_start:]
    
    open("packages/core/src/memory_system/workers.py", "w").write(content)
    print("Replaced _job_update_decay with clean syntax.")

