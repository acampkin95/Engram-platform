---
name: memory-session-summary
enabled: true
event: stop
action: warn
conditions:
  - field: transcript
    operator: not_contains
    pattern: session_summary|add_memory|consolidate_memories
---

📝 **Engram Memory: No memory operations detected**

This session ended without any explicit memory operations. To improve continuity across sessions:

- Use `session_summary` prompt to auto-generate a session recap
- Use `add_memory` to store important decisions or discoveries
- Use `recall_context` at the start of your next session

Enable this rule (`enabled: true`) to be reminded every session.
