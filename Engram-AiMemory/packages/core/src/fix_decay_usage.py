import sys

content = open("memory_system/api.py").read()
content = content.replace("new_decay = decay_calc.calculate_decay(\n                    created_at=memory.created_at,\n                    last_accessed=memory.last_accessed_at,\n                    access_count=memory.access_count,\n                )", "new_decay = decay_calc.calculate_decay(\n                    created_at=memory.created_at,\n                    last_accessed=memory.last_accessed_at,\n                    access_count=memory.access_count,\n                )")
open("memory_system/api.py", "w").write(content)
print("api.py is ok")

content = open("memory_system/workers.py").read()
# Replace the exponential decay and calculation lines with our new reusable method 
# so it matches api.py and works properly.

new_decay_block = """                            # Compute decay based on last access or creation
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

                            await self._ms._weaviate.update_memory_fields("""

# Use string replace for the entire block
old_block = """                            # Compute decay based on last access or creation
                            reference_time = memory.last_accessed_at or memory.created_at
                            if reference_time and reference_time.tzinfo is None:
                                reference_time = reference_time.replace(tzinfo=timezone)

                            if reference_time:
                                days_since = (now - reference_time).days
                                # Exponential decay: factor = 2^(-days/half_life)
                                decay = math.pow(2, -days_since / half_life)
                            else:
                                decay = 1.0

                            # Access boost: each access adds to importance
                            access_factor = min(1.0, 1.0 + (memory.access_count * access_boost))
                            new_decay = max(min_importance, decay * access_factor)

                            await self._ms._weaviate.update_memory_fields("""

content = content.replace(old_block, new_decay_block)
open("memory_system/workers.py", "w").write(content)
print("workers.py decay fixed")
