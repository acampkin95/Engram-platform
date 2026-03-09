import sys

content = open("memory_system/workers.py").read()

import_statement = "from memory_system.temporal import TemporalExtractor\n"
if "TemporalExtractor" not in content:
    idx = content.find("from memory_system.decay import MemoryDecay")
    content = content[:idx] + import_statement + content[idx:]

job_method = """
    async def _job_event_extraction(self) -> None:
        \"\"\"Extract temporal events from recent unstructured memories.\"\"\"
        if not self._ollama:
            return

        async with self._semaphore:
            self._stats["last_run"]["event_extraction"] = datetime.now(UTC).isoformat()
            try:
                # Find recent memories that are NOT already marked as events
                memories, _ = await self._ms.list_memories(limit=20)
                extractor = TemporalExtractor(self._ollama)
                
                total_extracted = 0

                for memory in memories:
                    # Skip if already processed for events
                    if memory.is_event or not memory.content:
                        continue
                    
                    # Also we should probably only extract from facts or documents, not system errors
                    if str(memory.memory_type) in ["error_solution", "workflow", "preference"]:
                        continue

                    events = await extractor.extract_timeline_events(memory.content)
                    if events:
                        # Convert this memory to an event memory using the first primary event 
                        # (in a real system we might split into multiple child memories)
                        memory = extractor.bind_temporal_bounds(memory, events[0])
                        
                        await self._ms._weaviate.update_memory_fields(
                            memory_id=memory.id,
                            tier=memory.tier,
                            fields={
                                "is_event": True,
                                "temporal_bounds": memory.temporal_bounds.dict() if memory.temporal_bounds else None
                            },
                            tenant_id=memory.tenant_id
                        )
                        total_extracted += 1

                self._stats["jobs_run"] += 1
                logger.info(f"Extracted {total_extracted} timeline events")
            except Exception as e:
                logger.error(f"event_extraction job failed: {e}")
"""

if "_job_event_extraction" not in content:
    idx = content.find("async def _job_update_decay")
    content = content[:idx] + job_method + "\n    " + content[idx:]

schedule_code = """
        # Job 8: Timeline event extraction (daily at 5am)
        self._scheduler.add_job(
            self._job_event_extraction,
            "cron",
            hour=5,
            minute=0,
            id="event_extraction",
            max_instances=1,
            coalesce=True,
        )
"""
if "Job 8: Timeline" not in content:
    idx = content.find("self._scheduler.start()")
    content = content[:idx] + schedule_code + "\n        " + content[idx:]

open("memory_system/workers.py", "w").write(content)
print("Updated workers.py with timeline event extraction")
