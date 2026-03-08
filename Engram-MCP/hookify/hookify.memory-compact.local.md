---
name: memory-persist-before-compact
enabled: true
event: stop
action: warn
---

🗜️ **Engram Memory: Session ending**

Before this session ends, consider persisting critical context:

1. Run `session_summary` prompt to generate a summary
2. Use `add_memory` to store key decisions, blockers, or next steps
3. Use `consolidate_memories` to merge related memories

This ensures continuity across sessions. The memory system will automatically recall this context in future sessions.
