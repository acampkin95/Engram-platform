import sys

content = open("packages/core/src/memory_system/workers.py").read()

import re

# Fix indentation of _job_update_decay
content = content.replace("        async def _job_update_decay", "    async def _job_update_decay")

open("packages/core/src/memory_system/workers.py", "w").write(content)
print("Fixed indent")
