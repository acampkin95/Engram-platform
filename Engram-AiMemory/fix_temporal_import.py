import sys

content = open("packages/core/src/memory_system/workers.py").read()

# I need to add TemporalExtractor import at the top
import_statement = "from memory_system.temporal import TemporalExtractor\n"
if "TemporalExtractor" not in content[:500]:
    # find where other imports are
    idx = content.find("from memory_system.decay import MemoryDecay")
    if idx != -1:
        content = content[:idx] + import_statement + content[idx:]
    else:
        # just put it at top after future
        idx = content.find("import asyncio")
        content = content[:idx] + import_statement + "\n" + content[idx:]
        
    open("packages/core/src/memory_system/workers.py", "w").write(content)
    print("Fixed temporal import")

