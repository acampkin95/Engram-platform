# Memory System Skill

**Version:** 1.0.0 | **Purpose:** Comprehensive skill for Engram Memory System operations with enforced memory checks

---

## SKILL OVERVIEW

This skill provides comprehensive guidance for working with the Engram Memory System. It includes enforced memory checks, complete API coverage, hookify configuration, and autopilot integration.

---

## ACTIVATION TRIGGERS

This skill activates when:
- Working with memory-related features
- Storing or retrieving memories
- Building context for AI agents
- Managing knowledge graphs
- Performing memory maintenance

---

## MANDATORY MEMORY CHECKS

### Pre-Operation Checklist

Before ANY memory operation, verify:

```
□ MCP server is running and accessible
□ Memory API is healthy (curl http://localhost:8000/health)
□ Authentication credentials are configured
□ Project context is established (project_id set)
□ Memory tier is appropriate for operation
```

### Health Check Command

```bash
# Comprehensive health check
curl -s http://localhost:8000/health | jq '.'
curl -s http://localhost:8000/health/detailed -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## MEMORY TOOLS REFERENCE

### Core Memory Tools

| Tool | Purpose | Required Parameters |
|------|---------|---------------------|
| `search_memory` | Semantic search | query, (optional: tier, project_id, limit) |
| `add_memory` | Store memory | content, tier, (optional: project_id, tags, importance) |
| `get_memory` | Retrieve by ID | memory_id, tier |
| `delete_memory` | Remove memory | memory_id, tier |
| `list_memories` | Paginated list | (optional: limit, offset, tier, project_id) |
| `batch_add_memories` | Bulk store | memories[] |
| `build_context` | Context assembly | query, (optional: max_tokens) |
| `rag_query` | RAG over memories | query |
| `consolidate_memories` | Merge related | (optional: project_id) |
| `cleanup_expired` | Remove expired | none |

### Entity Tools

| Tool | Purpose | Required Parameters |
|------|---------|---------------------|
| `add_entity` | Add graph entity | name, entity_type |
| `add_relation` | Link entities | source_entity_id, target_entity_id, relation_type |
| `query_graph` | Graph traversal | entity_id, (optional: depth) |

### Health Tools

| Tool | Purpose | Required Parameters |
|------|---------|---------------------|
| `health_check` | System status | none |
| `get_stats` | Memory statistics | (optional: tenant_id) |

---

## COMPLETE TOOL USAGE GUIDE

### search_memory

**Purpose:** Perform semantic search across all memory tiers.

**Parameters:**
```typescript
interface SearchMemoryRequest {
  query: string;              // Search query (required)
  tier?: 1 | 2 | 3;          // Filter by tier
  project_id?: string;        // Filter by project
  user_id?: string;           // Filter by user
  tenant_id?: string;         // Filter by tenant
  tags?: string[];            // Filter by tags
  min_importance?: number;    // Min importance (0-1)
  limit?: number;             // Max results (default: 10)
}
```

**Example Usage:**
```json
{
  "tool": "search_memory",
  "arguments": {
    "query": "authentication implementation patterns for REST API",
    "tier": 1,
    "project_id": "engram-platform",
    "tags": ["auth", "api", "security"],
    "min_importance": 0.5,
    "limit": 15
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "memory_id": "uuid-here",
      "content": "Use JWT tokens with 24-hour expiry...",
      "summary": "JWT auth pattern",
      "tier": 1,
      "memory_type": "pattern",
      "importance": 0.8,
      "tags": ["auth", "jwt", "security"],
      "score": 0.92,
      "created_at": "2026-03-02T10:00:00Z"
    }
  ],
  "query": "authentication implementation patterns",
  "total": 5
}
```

**Best Practices:**
- Use specific queries for better results
- Include tier filter when scope is known
- Set min_importance to filter noise
- Review ALL results, not just top one

### add_memory

**Purpose:** Store a new memory in the appropriate tier.

**Parameters:**
```typescript
interface AddMemoryRequest {
  content: string;            // Memory content (required)
  tier: 1 | 2 | 3;           // Memory tier (required)
  memory_type?: string;       // fact, decision, insight, pattern, fix, error, preference
  source?: string;            // agent, user, system
  project_id?: string;        // Required for Tier 1
  user_id?: string;           // For Tier 2
  tenant_id?: string;         // Multi-tenant isolation
  session_id?: string;        // Session tracking
  importance?: number;        // 0.0-1.0 (default: 0.5)
  confidence?: number;        // 0.0-1.0 (default: 1.0)
  tags?: string[];            // Categorization tags
  metadata?: object;          // Additional metadata
  expires_in_days?: number;   // Auto-expiration
}
```

**Example Usage:**
```json
{
  "tool": "add_memory",
  "arguments": {
    "content": "DECISION: Use Redis for session caching with 1-hour TTL\n\nRATIONALE: Redis provides sub-millisecond latency for session lookups, which is critical for API performance. The 1-hour TTL balances memory usage with user experience.\n\nTRADEOFFS:\n- Pro: Fast session validation\n- Con: Session loss on Redis restart (mitigated by persistence)\n\nIMPLEMENTATION: Use redis-py with connection pooling, max 50 connections per instance.",
    "tier": 1,
    "memory_type": "decision",
    "source": "agent",
    "project_id": "engram-platform",
    "importance": 0.9,
    "confidence": 1.0,
    "tags": ["redis", "caching", "session", "performance", "architecture"],
    "metadata": {
      "context": "Performance optimization session",
      "files_affected": ["api.py", "cache.py"],
      "tested_at": "2026-03-02",
      "benchmark_results": "latency reduced from 50ms to 2ms"
    }
  }
}
```

**Memory Type Guide:**
| Type | When to Use | Importance Range |
|------|-------------|------------------|
| `fact` | Objective information | 0.3-0.7 |
| `decision` | Choices with rationale | 0.7-1.0 |
| `insight` | Discovered patterns | 0.5-0.8 |
| `pattern` | Code/architecture patterns | 0.6-0.9 |
| `fix` | Bug fixes with root cause | 0.5-0.8 |
| `error` | Error documentation | 0.4-0.7 |
| `preference` | User/team preferences | 0.3-0.6 |

### build_context

**Purpose:** Assemble relevant context for AI from memories.

**Parameters:**
```typescript
interface BuildContextRequest {
  query: string;              // Context query (required)
  tier?: 1 | 2 | 3;          // Filter by tier
  project_id?: string;        // Project scope
  user_id?: string;           // User scope
  session_id?: string;        // Session scope
  max_tokens?: number;        // Token budget (default: 2000)
}
```

**Example Usage:**
```json
{
  "tool": "build_context",
  "arguments": {
    "query": "What work has been done on the crawler API and what patterns should I follow?",
    "project_id": "engram-platform",
    "max_tokens": 4000
  }
}
```

**Response:**
```json
{
  "query": "What work has been done...",
  "context": "## Previous Work\n\n### Crawler API Development\n- Implemented Playwright-based browser automation\n- Added tiered data storage (hot/warm/cold/archive)\n\n## Established Patterns\n\n### Error Handling\nUse the standard error handling pattern:\n```python\ntry:\n    result = await crawler.crawl(url)\nexcept CrawlError as e:\n    logger.error(f\"Crawl failed: {e}\")\n    raise HTTPException(status_code=500, detail=str(e))\n```\n\n...",
  "token_estimate": 2847
}
```

### batch_add_memories

**Purpose:** Store multiple memories efficiently.

**Parameters:**
```typescript
interface BatchAddMemoriesRequest {
  memories: AddMemoryRequest[];  // Array of memories (max 100)
}
```

**Example Usage:**
```json
{
  "tool": "batch_add_memories",
  "arguments": {
    "memories": [
      {
        "content": "Pattern: Repository pattern for data access layer",
        "tier": 1,
        "memory_type": "pattern",
        "project_id": "engram-platform",
        "tags": ["architecture", "data-access"],
        "importance": 0.8
      },
      {
        "content": "Decision: Use async/await for all I/O operations",
        "tier": 1,
        "memory_type": "decision",
        "project_id": "engram-platform",
        "tags": ["async", "performance"],
        "importance": 0.7
      },
      {
        "content": "Insight: Connection pooling reduces latency by 40%",
        "tier": 1,
        "memory_type": "insight",
        "project_id": "engram-platform",
        "tags": ["performance", "optimization"],
        "importance": 0.6
      }
    ]
  }
}
```

### rag_query

**Purpose:** Perform RAG (Retrieval Augmented Generation) over memories.

**Parameters:**
```typescript
interface RAGQueryRequest {
  query: string;              // RAG query (required)
  tier?: 1 | 2 | 3;          // Filter by tier
  project_id?: string;        // Project scope
  user_id?: string;           // User scope
  session_id?: string;        // Session scope
}
```

**Example Usage:**
```json
{
  "tool": "rag_query",
  "arguments": {
    "query": "What is the recommended approach for handling authentication errors?",
    "project_id": "engram-platform"
  }
}
```

**Response:**
```json
{
  "query": "What is the recommended approach...",
  "mode": "hybrid",
  "synthesis_prompt": "Based on the following memories, provide a comprehensive answer...",
  "source_count": 5,
  "context": {
    "relevant_memories": [...],
    "entities": [...],
    "relations": [...]
  }
}
```

---

## KNOWLEDGE GRAPH OPERATIONS

### add_entity

**Purpose:** Add an entity to the knowledge graph.

**Parameters:**
```typescript
interface AddEntityRequest {
  name: string;               // Entity name (required)
  entity_type: string;        // Type: person, project, concept, technology, etc.
  description?: string;       // Entity description
  project_id?: string;        // Project scope
  tenant_id?: string;         // Tenant scope
  aliases?: string[];         // Alternative names
  metadata?: object;          // Additional metadata
}
```

**Example Usage:**
```json
{
  "tool": "add_entity",
  "arguments": {
    "name": "Memory API",
    "entity_type": "component",
    "description": "FastAPI-based REST API for memory operations. Handles CRUD, search, and knowledge graph operations.",
    "project_id": "engram-platform",
    "aliases": ["memory-api", "api", "backend"],
    "metadata": {
      "technology": "FastAPI",
      "port": 8000,
      "dependencies": ["Weaviate", "Redis"]
    }
  }
}
```

### add_relation

**Purpose:** Create a relationship between entities.

**Parameters:**
```typescript
interface AddRelationRequest {
  source_entity_id: string;   // Source entity UUID (required)
  target_entity_id: string;   // Target entity UUID (required)
  relation_type: string;      // Relationship type
  weight?: number;            // Relationship strength (0-1)
  project_id?: string;        // Project scope
  tenant_id?: string;         // Tenant scope
  context?: string;           // Relationship context
}
```

**Example Usage:**
```json
{
  "tool": "add_relation",
  "arguments": {
    "source_entity_id": "memory-api-uuid",
    "target_entity_id": "weaviate-uuid",
    "relation_type": "depends_on",
    "weight": 0.9,
    "context": "Memory API requires Weaviate for vector storage and search operations"
  }
}
```

### query_graph

**Purpose:** Traverse the knowledge graph from an entity.

**Parameters:**
```typescript
interface QueryGraphRequest {
  entity_id: string;          // Starting entity UUID (required)
  depth?: number;             // Traversal depth 1-5 (default: 1)
  project_id?: string;        // Project scope
  tenant_id?: string;         // Tenant scope
}
```

**Example Usage:**
```json
{
  "tool": "query_graph",
  "arguments": {
    "entity_id": "memory-api-uuid",
    "depth": 2
  }
}
```

**Response:**
```json
{
  "root_entity_id": "memory-api-uuid",
  "entities": [
    {
      "entity_id": "memory-api-uuid",
      "name": "Memory API",
      "entity_type": "component"
    },
    {
      "entity_id": "weaviate-uuid",
      "name": "Weaviate",
      "entity_type": "database"
    },
    {
      "entity_id": "redis-uuid",
      "name": "Redis",
      "entity_type": "cache"
    }
  ],
  "relations": [
    {
      "source_entity_id": "memory-api-uuid",
      "target_entity_id": "weaviate-uuid",
      "relation_type": "depends_on",
      "weight": 0.9
    },
    {
      "source_entity_id": "memory-api-uuid",
      "target_entity_id": "redis-uuid",
      "relation_type": "uses",
      "weight": 0.8
    }
  ],
  "depth_reached": 2
}
```

---

## MAINTENANCE OPERATIONS

### consolidate_memories

**Purpose:** Merge related memories to reduce redundancy.

```json
{
  "tool": "consolidate_memories",
  "arguments": {
    "project_id": "engram-platform",
    "tenant_id": "default"
  }
}
```

### cleanup_expired

**Purpose:** Remove memories past their expiration date.

```json
{
  "tool": "cleanup_expired",
  "arguments": {
    "tenant_id": "default"
  }
}
```

---

## ENFORCED MEMORY WORKFLOWS

### Workflow 1: Session Start

```python
# MANDATORY: Execute at session start
async def session_start():
    # 1. Build context
    context = await build_context(
        query="What work has been done recently and what decisions have been made?",
        project_id="engram-platform",
        max_tokens=4000
    )

    # 2. Search for recent work
    recent = await search_memory(
        query="recent work changes modifications",
        project_id="engram-platform",
        limit=20
    )

    # 3. Acknowledge context
    print(f"Loaded {len(recent['results'])} relevant memories")
    print(f"Context assembled: {context['token_estimate']} tokens")

    return context, recent
```

### Workflow 2: Pre-Code Change

```python
# MANDATORY: Execute before ANY code modification
async def pre_code_change(component: str, action: str):
    # 1. Search for patterns
    patterns = await search_memory(
        query=f"{component} {action} patterns decisions",
        project_id="engram-platform",
        tier=1,
        limit=10
    )

    # 2. Search for related decisions
    decisions = await search_memory(
        query=f"{component} architecture decision",
        project_id="engram-platform",
        tags=["architecture", "decision"],
        min_importance=0.7
    )

    # 3. Review and acknowledge
    if patterns['results']:
        print(f"Found {len(patterns['results'])} relevant patterns")
        for p in patterns['results'][:3]:
            print(f"  - {p['content'][:100]}...")

    return patterns, decisions
```

### Workflow 3: Post-Code Change

```python
# MANDATORY: Execute after ANY significant code change
async def post_code_change(
    action: str,
    details: dict,
    files_modified: list
):
    # Determine memory type
    memory_type = classify_change(action)
    importance = calculate_importance(action, details)

    # Store the change
    result = await add_memory(
        content=format_change_memory(action, details),
        tier=1,
        memory_type=memory_type,
        source="agent",
        project_id="engram-platform",
        importance=importance,
        tags=generate_tags(action, files_modified),
        metadata={
            "files_modified": files_modified,
            "timestamp": datetime.now().isoformat(),
            "context": details.get("context", "")
        }
    )

    return result
```

### Workflow 4: Error Documentation

```python
# MANDATORY: Execute when encountering errors
async def document_error(
    error: Exception,
    context: dict,
    resolution: str = None
):
    # Store error for future reference
    await add_memory(
        content=f"""ERROR: {type(error).__name__}

MESSAGE: {str(error)}

CONTEXT: {json.dumps(context, indent=2)}

ROOT CAUSE: [To be determined]

RESOLUTION: {resolution or 'Pending'}

PREVENTION: [To be determined]
""",
        tier=1,
        memory_type="error",
        source="agent",
        project_id="engram-platform",
        importance=0.6,
        tags=["error", context.get("component", "unknown")],
        metadata={
            "error_type": type(error).__name__,
            "timestamp": datetime.now().isoformat()
        }
    )
```

---

## HOOKIFY CONFIGURATION

### Memory Recall Hook

```json
{
  "name": "memory-recall",
  "trigger": "before_tool",
  "condition": {
    "exclude_tools": ["health_check", "get_stats", "search_memory", "list_memories"]
  },
  "action": {
    "tool": "build_context",
    "arguments": {
      "query": "${tool_context}",
      "project_id": "${project_id}",
      "max_tokens": 2000
    }
  },
  "on_failure": "warn",
  "timeout_ms": 5000
}
```

### Memory Store Hook

```json
{
  "name": "memory-store",
  "trigger": "after_tool",
  "condition": {
    "include_tools": ["add_memory", "batch_add_memories"],
    "memory_types": ["decision", "pattern", "fix"]
  },
  "action": {
    "tool": "add_memory",
    "arguments": {
      "content": "${action_summary}",
      "tier": 1,
      "memory_type": "${memory_type}",
      "project_id": "${project_id}",
      "tags": "${auto_tags}",
      "importance": "${calculated_importance}"
    }
  },
  "on_failure": "warn"
}
```

### Hook Configuration Script

```bash
#!/bin/bash
# hookify-config.sh - Configure memory hooks for AI assistants

HOOK_DIR="$HOME/.claude/hookify"
mkdir -p "$HOOK_DIR"

# Memory Recall Hook
cat > "$HOOK_DIR/memory-recall.md" << 'EOF'
# Memory Recall Hook

## Trigger
Execute BEFORE any tool that modifies state or performs significant operations.

## Required Actions
1. Extract context from tool arguments
2. Call build_context with relevant query
3. Review returned context
4. Proceed only after acknowledging context

## Example
```json
{
  "pre_hook": {
    "name": "memory-recall",
    "query_template": "What patterns and decisions relate to: ${tool_name} ${tool_args}",
    "max_tokens": 2000
  }
}
```

## Compliance
- NEVER skip this hook
- ALWAYS review context before proceeding
- DOCUMENT if hook fails
EOF

# Memory Store Hook
cat > "$HOOK_DIR/memory-store.md" << 'EOF'
# Memory Store Hook

## Trigger
Execute AFTER any tool that creates, modifies, or deletes data.

## Required Actions
1. Summarize what was done
2. Determine memory type (decision, pattern, fix, insight)
3. Calculate importance score
4. Store with full context

## Example
```json
{
  "post_hook": {
    "name": "memory-store",
    "content_template": "${action_summary}",
    "tier": 1,
    "importance": "${calculated_importance}"
  }
}
```

## Compliance
- NEVER skip this hook for significant changes
- ALWAYS include full context
- VERIFY storage succeeded
EOF

# Session Context Hook
cat > "$HOOK_DIR/session-context.md" << 'EOF'
# Session Context Hook

## Trigger
Execute at the START of every session.

## Required Actions
1. Call build_context with session description
2. Search for recent work
3. Review and acknowledge context
4. State understanding before proceeding

## Example
```json
{
  "session_start_hook": {
    "name": "session-context",
    "query": "What work has been done recently on this project?",
    "max_tokens": 4000
  }
}
```

## Compliance
- MANDATORY at session start
- NEVER proceed without context
EOF

echo "Hookify configuration complete!"
echo "Hooks installed to: $HOOK_DIR"
ls -la "$HOOK_DIR"
```

---

## QUALITY METRICS

### Memory Quality Score

```python
def calculate_memory_quality(memory: dict) -> float:
    """Calculate quality score for a memory."""
    score = 0.0

    # Content length (0-25 points)
    content_length = len(memory.get('content', ''))
    if content_length >= 200:
        score += 25
    elif content_length >= 100:
        score += 15
    elif content_length >= 50:
        score += 5

    # Has context (0-20 points)
    if memory.get('metadata', {}).get('context'):
        score += 20

    # Has tags (0-15 points)
    tags = memory.get('tags', [])
    if len(tags) >= 3:
        score += 15
    elif len(tags) >= 1:
        score += 5

    # Appropriate importance (0-15 points)
    importance = memory.get('importance', 0.5)
    if 0.5 <= importance <= 0.9:
        score += 15
    elif importance > 0:
        score += 5

    # Has memory_type (0-10 points)
    if memory.get('memory_type'):
        score += 10

    # Has project_id for Tier 1 (0-15 points)
    if memory.get('tier') == 1 and memory.get('project_id'):
        score += 15

    return score
```

### Quality Thresholds

| Score | Quality Level | Action |
|-------|---------------|--------|
| 90-100 | Excellent | No action needed |
| 70-89 | Good | Minor improvements possible |
| 50-69 | Acceptable | Should improve |
| 30-49 | Poor | Requires improvement |
| 0-29 | Unacceptable | Must rewrite |

---

## TROUBLESHOOTING

### Memory Search Returns Empty

```bash
# Diagnosis
1. Check memory exists: curl localhost:8000/stats
2. Verify project_id matches
3. Try broader search terms
4. Check tenant_id if multi-tenant

# Solutions
- Verify memory was stored correctly
- Check tier filter isn't too restrictive
- Ensure tags match stored memories
```

### Memory Storage Fails

```bash
# Diagnosis
1. Check API health: curl localhost:8000/health
2. Verify authentication: Check Authorization header
3. Validate content length > 0
4. Check tier is valid (1-3)

# Solutions
- Verify all required fields present
- Check content encoding
- Ensure API key is valid
```

### Context Build Timeout

```bash
# Diagnosis
1. Check Weaviate health
2. Verify Redis connection
3. Check memory count (may be too large)

# Solutions
- Reduce max_tokens parameter
- Add more specific query
- Filter by tier or project
```

---

## QUICK REFERENCE

```
╔══════════════════════════════════════════════════════════════╗
║            MEMORY SYSTEM SKILL QUICK REFERENCE               ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  SESSION START:                                              ║
║  build_context(query, project_id, max_tokens=4000)           ║
║                                                              ║
║  BEFORE CODE:                                                ║
║  search_memory(query, tier=1, limit=10)                      ║
║                                                              ║
║  AFTER CODE:                                                 ║
║  add_memory(content, tier, type, tags, importance)           ║
║                                                              ║
║  CONTEXT:                                                    ║
║  rag_query(query) for synthesis                              ║
║  build_context(query) for context assembly                   ║
║                                                              ║
║  GRAPH:                                                      ║
║  add_entity(name, type)                                      ║
║  add_relation(source, target, type)                          ║
║  query_graph(entity_id, depth)                               ║
║                                                              ║
║  MAINTENANCE:                                                ║
║  consolidate_memories()                                      ║
║  cleanup_expired()                                           ║
║                                                              ║
║  TYPES: fact | decision | insight | pattern | fix | error    ║
║  TIERS: 1=Project | 2=General | 3=Global                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

**Document Control**

| Author | Purpose | Version |
|--------|---------|---------|
| Engram Team | Memory skill reference | 1.0.0 |
