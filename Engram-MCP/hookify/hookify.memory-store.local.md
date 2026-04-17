---
name: memory-store-on-write
enabled: true
event: file
action: warn
conditions:
  - field: path
    operator: regex_match
    pattern: \.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|cs|rb|swift|kt|md)$
---

💾 **Engram Memory: File modified**

A source file was modified. The `memory-store` post-tool hook will automatically capture key decisions and changes for future recall.

To manually store context: use the `add_memory` tool with relevant details about this change.
