<!-- AI-MEMORY:START -->
## Engram Memory System

This project uses the **Engram MCP memory system** for persistent AI context across sessions.

### Automatic Behavior
- **Memory recall**: Relevant past context is automatically searched before each tool call
- **Memory storage**: Key decisions and file changes are automatically stored after write operations
- **Session continuity**: Use `recall_context` at the start of each session to restore context

### Available Memory Tools
| Tool | Purpose |
|------|---------|
| `search_memory` | Search for relevant memories by query |
| `add_memory` | Store a new memory (decision, discovery, context) |
| `recall_context` | Recall full project context for current session |
| `session_summary` | Generate and store a session summary |
| `consolidate_memories` | Merge related memories to reduce noise |
| `build_project_knowledge` | Build comprehensive project knowledge base |
| `rag_query` | Query memories with RAG for complex questions |

### Memory Best Practices
1. **Start sessions** with `recall_context` to restore prior context
2. **After major decisions**: `add_memory` with rationale and trade-offs
3. **Before ending**: `session_summary` to capture what was accomplished
4. **When confused**: `search_memory` with relevant keywords

### MCP Server Connection
The Engram MCP server runs at `http://localhost:3000` (HTTP) or via stdio.
Configure in your MCP client settings — see `README.md` for setup instructions.
<!-- AI-MEMORY:END -->
