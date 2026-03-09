import sys

# We need to clean up the indentation issues in workers.py. Let's just fix the function we injected.
content = open("packages/core/src/memory_system/workers.py").read()

# I injected _job_confidence_maintenance incorrectly or messed up indentation.
# Let's fix it by parsing and rebuilding the file or stripping out the bad block.

# Find the start of the bad block
bad_block_start = content.find("    async def _job_confidence_maintenance(self) -> None:")
if bad_block_start != -1:
    # Find where the next function starts to cut it out
    next_func_start = content.find("    async def _job_update_decay", bad_block_start)
    if next_func_start != -1:
        content = content[:bad_block_start] + content[next_func_start:]

# Write back
open("packages/core/src/memory_system/workers.py", "w").write(content)
print("Removed bad block")
