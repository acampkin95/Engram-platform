---
name: memory-recall-session-start
enabled: true
event: prompt
action: warn
---

🧠 **Engram Memory Active**

The Engram memory system is running. Relevant context from past sessions will be recalled automatically before each tool call via the `memory-recall` pre-tool hook.

To manually search memories: use the `search_memory` tool.
To recall full context: use the `recall_context` prompt.
