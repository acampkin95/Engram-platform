import sys

content = open("memory_system/workers.py").read()

bad_dict_call = """                                "temporal_bounds": memory.temporal_bounds.dict() if memory.temporal_bounds else None"""
import json

# Let's fix the JSON serialization since Pydantic dict() returns datetimes which Weaviate hates 
good_dict_call = """                                "temporal_bounds": __import__('json').dumps(memory.temporal_bounds.dict(mode='json')) if hasattr(memory.temporal_bounds, 'dict') else None"""

# Or actually we can just manually stringify it
good_dict_call = """                                "temporal_bounds": __import__('json').dumps({
                                    "start_time": memory.temporal_bounds.start_time.isoformat() if memory.temporal_bounds.start_time else None,
                                    "end_time": memory.temporal_bounds.end_time.isoformat() if memory.temporal_bounds.end_time else None,
                                    "resolution": memory.temporal_bounds.resolution,
                                    "is_ongoing": memory.temporal_bounds.is_ongoing,
                                    "relative_to": memory.temporal_bounds.relative_to
                                }) if memory.temporal_bounds else None"""

content = content.replace(bad_dict_call, good_dict_call)
open("memory_system/workers.py", "w").write(content)
print("Fixed temporal bounds serialization")
