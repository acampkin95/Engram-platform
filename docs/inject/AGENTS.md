# AGENTS.md — Memory-Enforced Configuration

**Version:** 1.0.0 | **Purpose:** Enforce full MCP memory feature usage for AI agents

---

## ⚠️ MANDATORY MEMORY INTEGRATION

This configuration enforces automatic memory integration for all AI agents working on this project. **Non-compliance will result in degraded context and repeated mistakes.**

---

## MEMORY ENFORCEMENT RULES

### Rule 1: Pre-Action Memory Recall (MANDATORY)

**Before ANY code modification, file creation, or architectural decision:**

```
MANDATORY SEQUENCE:
1. Call search_memory with relevant query
2. Review returned memories for:
   - Previous decisions on this topic
   - Established patterns
   - Known pitfalls
   - Context from past sessions
3. Only proceed AFTER memory context is loaded
```

**Example Invocation:**
```json
{
  "tool": "search_memory",
  "arguments": {
    "query": "authentication implementation patterns",
    "project_id": "engram-platform",
    "tier": 1,
    "limit": 10
  }
}
```

### Rule 2: Post-Action Memory Storage (MANDATORY)

**After ANY significant action:**

```
MANDATORY SEQUENCE:
1. Identify learnings, decisions, or patterns discovered
2. Call add_memory with structured content
3. Include appropriate metadata:
   - project_id for Tier 1 memories
   - user_id for Tier 2 memories
   - tags for categorization
   - importance score (0.0-1.0)
```

**Triggers for Memory Storage:**
- ✅ Code changes committed
- ✅ New patterns discovered
- ✅ Decisions made (technical or architectural)
- ✅ Bugs fixed (with root cause)
- ✅ Errors encountered and resolved
- ✅ API integrations completed
- ✅ Configuration changes
- ✅ Performance optimizations

**Example Invocation:**
```json
{
  "tool": "add_memory",
  "arguments": {
    "content": "Decision: Use Redis connection pooling with max 50 connections per instance. Rationale: Prevents connection exhaustion under high load. Tested with 1000 concurrent requests.",
    "tier": 1,
    "memory_type": "decision",
    "source": "agent",
    "project_id": "engram-platform",
    "importance": 0.8,
    "tags": ["redis", "performance", "architecture"],
    "metadata": {
      "context": "Performance optimization session",
      "tested_at": "2026-03-02",
      "results": "40% latency reduction"
    }
  }
}
```

### Rule 3: Session Continuity (MANDATORY)

**At the START of every session:**

```
MANDATORY SEQUENCE:
1. Call build_context with current task description
2. Review context for:
   - Previous session work
   - Outstanding tasks
   - Relevant decisions
   - Active patterns
3. Acknowledge context before proceeding
```

**Example Invocation:**
```json
{
  "tool": "build_context",
  "arguments": {
    "query": "What work was done on the crawler API and what decisions were made?",
    "project_id": "engram-platform",
    "max_tokens": 2000
  }
}
```

---

## MEMORY TIERS

### Tier 1: Project Memories (Isolated)

| Attribute | Value |
|-----------|-------|
| Scope | Single project |
| Isolation | project_id required |
| Retention | Project lifetime |
| Use Case | Code decisions, patterns, bugs |

**When to use:** Project-specific technical decisions, code patterns, bug fixes

### Tier 2: General Memories (User)

| Attribute | Value |
|-----------|-------|
| Scope | Cross-project, user-specific |
| Isolation | user_id required |
| Retention | Indefinite |
| Use Case | Preferences, workflows, style |

**When to use:** User preferences, coding style preferences, workflow patterns

### Tier 3: Global Memories (Shared)

| Attribute | Value |
|-----------|-------|
| Scope | System-wide |
| Isolation | None (shared) |
| Retention | Permanent |
| Use Case | Best practices, documentation |

**When to use:** Universal best practices, documentation references, shared knowledge

---

## MEMORY TYPES

| Type | Description | Example Content |
|------|-------------|-----------------|
| `fact` | Objective information | "API runs on port 8000" |
| `decision` | Choices made with rationale | "Use JWT for auth because..." |
| `insight` | Discovered patterns | "Connection pooling reduces latency by 40%" |
| `preference` | User/team preferences | "Prefer functional components over class components" |
| `pattern` | Code patterns | "Repository pattern for data access" |
| `error` | Error documentation | "Error 500 occurs when Weaviate is unreachable" |
| `fix` | Bug fixes with root cause | "Fixed OOM by increasing container memory to 4GB" |

---

## TAGGING CONVENTIONS

### Required Tags

```
[component]-[action]-[context]
```

**Examples:**
- `api-auth-implementation`
- `database-migration-schema`
- `crawler-performance-optimization`
- `frontend-component-refactor`

### Category Tags

| Category | Tags |
|----------|------|
| Architecture | `architecture`, `design`, `pattern`, `structure` |
| API | `api`, `endpoint`, `rest`, `graphql` |
| Database | `database`, `weaviate`, `redis`, `migration` |
| Security | `security`, `auth`, `encryption`, `cors` |
| Performance | `performance`, `optimization`, `caching`, `latency` |
| Testing | `test`, `unit`, `integration`, `e2e` |
| Deployment | `deploy`, `docker`, `kubernetes`, `ci-cd` |
| Documentation | `docs`, `readme`, `manual`, `guide` |

---

## MEMORY IMPORTANCE SCORING

| Score | Criteria | Examples |
|-------|----------|----------|
| 0.9-1.0 | Critical, system-wide | Security decisions, architecture choices |
| 0.7-0.9 | High impact | Performance optimizations, major refactors |
| 0.5-0.7 | Moderate impact | Bug fixes, feature implementations |
| 0.3-0.5 | Low impact | Minor adjustments, style changes |
| 0.0-0.3 | Informational | Notes, observations, references |

---

## ANTI-PATTERNS (FORBIDDEN)

### ❌ Never Do These

1. **Skip memory recall before changes**
   ```
   WRONG: Directly modify code without checking memory
   RIGHT: search_memory → review → modify
   ```

2. **Forget to store decisions**
   ```
   WRONG: Make architectural decision, don't document
   RIGHT: Make decision → add_memory with rationale
   ```

3. **Store without context**
   ```
   WRONG: add_memory("fixed bug")
   RIGHT: add_memory with full context, tags, metadata
   ```

4. **Ignore existing memories**
   ```
   WRONG: Find relevant memory, ignore it
   RIGHT: Find relevant memory, acknowledge and follow
   ```

5. **Duplicate information**
   ```
   WRONG: Store same decision multiple times
   RIGHT: search first, update if exists, add if new
   ```

6. **Store sensitive data**
   ```
   WRONG: Store API keys, passwords, secrets
   RIGHT: Store references to secure locations only
   ```

---

## MEMORY INTEGRATION WORKFLOWS

### Workflow 1: New Feature Implementation

```
1. START: build_context("implementing [feature]")
2. SEARCH: search_memory("[feature] patterns decisions")
3. REVIEW: Analyze returned memories
4. IMPLEMENT: Write code following established patterns
5. STORE: add_memory for new decisions/patterns
6. VERIFY: Test implementation
7. UPDATE: Store any additional learnings
```

### Workflow 2: Bug Fix

```
1. START: search_memory("[bug description] error fix")
2. ANALYZE: Review similar bugs and fixes
3. IDENTIFY: Root cause
4. FIX: Implement fix
5. STORE: add_memory with:
   - Bug description
   - Root cause
   - Fix applied
   - Prevention measures
6. VERIFY: Confirm fix works
```

### Workflow 3: Code Review

```
1. PREPARE: search_memory("code review standards patterns")
2. REVIEW: Check code against established patterns
3. IDENTIFY: Deviations and issues
4. DOCUMENT: Store review findings
5. FEEDBACK: Communicate to author
```

### Workflow 4: Architecture Decision

```
1. PREPARE: search_memory("architecture [domain] decisions")
2. ANALYZE: Options and tradeoffs
3. DECIDE: Choose approach
4. DOCUMENT: add_memory with:
   - Decision made
   - Options considered
   - Rationale
   - Tradeoffs
   - Implications
5. PROPAGATE: Ensure team awareness
```

---

## COMPLIANCE VERIFICATION

### Self-Check Questions

Before completing any task, verify:

- [ ] Did I search memory before starting?
- [ ] Did I review all relevant memories?
- [ ] Did I follow established patterns?
- [ ] Did I store new decisions/learnings?
- [ ] Did I use appropriate tier and tags?
- [ ] Did I include sufficient context?
- [ ] Did I avoid storing sensitive data?

### Memory Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recall Rate | 100% | Searches before changes |
| Storage Rate | 100% | Decisions stored |
| Tag Accuracy | 95% | Correct tags used |
| Context Depth | High | Sufficient detail |
| Retrieval Relevance | 90% | Useful results returned |

---

## INTEGRATION WITH PROJECT STRUCTURE

### Project-Specific Memory Locations

```
Engram/
├── AGENTS.md              ← This file (memory enforcement)
├── docs/
│   ├── 05-mcp-manual.md   ← MCP tool reference
│   └── skills/
│       └── memory-skill.md ← Detailed skill guide
└── .claude/
    └── hookify/
        └── memory-*.md    ← Automatic memory rules
```

### Subproject AGENTS.md Files

Each subproject has specific memory guidance:

- `/Engram-AiMemory/AGENTS.md` - Memory system patterns
- `/Engram-AiCrawler/AGENTS.md` - Crawler patterns
- `/Engram-MCP/AGENTS.md` - MCP server patterns
- `/Engram-Platform/AGENTS.md` - Frontend patterns

---

## TROUBLESHOOTING MEMORY ISSUES

### Memory Not Found

```
Issue: search_memory returns empty
Checks:
1. Verify project_id matches
2. Check tenant_id if multi-tenant
3. Confirm memory was stored previously
4. Try broader search terms
```

### Memory Storage Failed

```
Issue: add_memory returns error
Checks:
1. Verify required fields present
2. Check content length (> 0)
3. Confirm tier is valid (1-3)
4. Validate tags format (array of strings)
```

### Context Too Large

```
Issue: build_context exceeds token limit
Solution:
1. Reduce max_tokens parameter
2. Add more specific query
3. Filter by tier or project
```

---

## APPENDIX: QUICK REFERENCE CARD

```
╔══════════════════════════════════════════════════════════════╗
║              MEMORY ENFORCEMENT QUICK REFERENCE              ║
╠══════════════════════════════════════════════════════════════╣
║ BEFORE ANY ACTION:                                           ║
║   search_memory(query, project_id, limit=10)                 ║
║                                                              ║
║ AFTER ANY ACTION:                                            ║
║   add_memory(content, tier, project_id, tags, importance)    ║
║                                                              ║
║ START OF SESSION:                                            ║
║   build_context(query, project_id, max_tokens=2000)          ║
║                                                              ║
║ TIERS: 1=Project, 2=General, 3=Global                        ║
║ TYPES: fact, decision, insight, preference, pattern          ║
║                                                              ║
║ ⚠️  NON-COMPLIANCE = DEGRADED PERFORMANCE                    ║
╚══════════════════════════════════════════════════════════════╝
```

---

**Document Control**

| Author | Purpose | Enforcement |
|--------|---------|-------------|
| Engram Team | Memory enforcement | Mandatory for all agents |
