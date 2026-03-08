# CLAUDE.md — Memory-Enforced Configuration for Claude

**Version:** 1.0.0 | **Purpose:** Enforce full MCP memory feature usage for Claude Code and Claude Desktop

---

## ⚠️ CRITICAL: MEMORY INTEGRATION MANDATORY

This configuration enforces automatic memory integration for Claude when working on the Engram Platform. **Failure to use memory features will result in context loss, repeated mistakes, and degraded performance.**

---

## MANDATORY BEHAVIOR PROTOCOLS

### Protocol 1: Session Initialization

**At the START of EVERY session, Claude MUST:**

```
STEP 1: Build Context
→ Call build_context with session description
→ Review returned context
→ Acknowledge relevant memories found

STEP 2: Search Recent Work
→ Call search_memory with project context
→ Review decisions and patterns from recent sessions

STEP 3: Confirm Understanding
→ State: "I have loaded context from previous sessions including: [list key memories]"
→ Only then proceed with work
```

**Required Invocation:**
```json
{
  "tool": "build_context",
  "arguments": {
    "query": "What is the current state of the Engram Platform and what work has been done recently?",
    "project_id": "engram-platform",
    "max_tokens": 4000
  }
}
```

### Protocol 2: Pre-Action Memory Recall

**Before ANY code modification, Claude MUST:**

```
STEP 1: Search for Relevant Context
→ Identify keywords related to the task
→ Call search_memory with appropriate filters
→ Review ALL returned memories (not just the first)

STEP 2: Analyze Patterns
→ Check for existing patterns that apply
→ Look for previous decisions on similar topics
→ Note any warnings or anti-patterns

STEP 3: Apply Context
→ Follow established patterns
→ Respect previous decisions
→ Avoid known pitfalls

STEP 4: Document Compliance
→ State: "Based on memory context, I will: [approach]"
→ Only then proceed
```

**Required Invocation Before Code Changes:**
```json
{
  "tool": "search_memory",
  "arguments": {
    "query": "[task-related keywords] patterns decisions implementation",
    "project_id": "engram-platform",
    "tier": 1,
    "limit": 10,
    "min_importance": 0.3
  }
}
```

### Protocol 3: Post-Action Memory Storage

**After ANY significant action, Claude MUST:**

```
STEP 1: Identify Store-Worthy Information
→ Was a decision made? → Store as "decision"
→ Was a pattern discovered? → Store as "pattern"
→ Was a bug fixed? → Store as "fix"
→ Was insight gained? → Store as "insight"

STEP 2: Structure the Memory
→ Clear, descriptive content
→ Include rationale and context
→ Add appropriate tags
→ Set importance score

STEP 3: Store Immediately
→ Call add_memory within 30 seconds of action
→ Verify storage succeeded
→ Reference memory ID if needed
```

**Required Invocation After Actions:**
```json
{
  "tool": "add_memory",
  "arguments": {
    "content": "[DETAILED content with context, rationale, and implications]",
    "tier": 1,
    "memory_type": "[fact|decision|insight|pattern|fix|error|preference]",
    "source": "claude",
    "project_id": "engram-platform",
    "importance": 0.8,
    "tags": ["[component]", "[action]", "[context]"],
    "metadata": {
      "session_id": "[current-session]",
      "timestamp": "[ISO-8601]",
      "files_modified": ["[list]"],
      "context": "[additional context]"
    }
  }
}
```

### Protocol 4: Decision Documentation

**For EVERY architectural or technical decision:**

```
STEP 1: Document the Decision
→ What was decided
→ Why it was decided
→ What alternatives were considered
→ What tradeoffs exist

STEP 2: Store with High Importance
→ importance >= 0.8 for architectural decisions
→ Include "architecture" tag

STEP 3: Cross-Reference
→ Link to related decisions
→ Note implications
```

**Decision Memory Template:**
```json
{
  "tool": "add_memory",
  "arguments": {
    "content": "DECISION: [What was decided]\n\nRATIONALE: [Why this approach]\n\nALTERNATIVES CONSIDERED:\n1. [Alternative 1] - Rejected because [reason]\n2. [Alternative 2] - Rejected because [reason]\n\nTRADEOFFS:\n- Pro: [benefit]\n- Con: [drawback]\n\nIMPLICATIONS: [What this means for the codebase]",
    "tier": 1,
    "memory_type": "decision",
    "source": "claude",
    "project_id": "engram-platform",
    "importance": 0.9,
    "tags": ["architecture", "decision", "[domain]"],
    "metadata": {
      "decision_date": "[date]",
      "decision_maker": "claude",
      "affected_components": ["[list]"]
    }
  }
}
```

---

## MEMORY ENFORCEMENT TRIGGERS

### Automatic Search Triggers

Claude MUST search memory when:

| Trigger | Search Query Pattern |
|---------|---------------------|
| User mentions a feature | `"[feature] implementation patterns"` |
| User asks to modify code | `"[component] [action] patterns decisions"` |
| User reports a bug | `"[error/bug] fix solution"` |
| User asks for architecture | `"architecture [domain] decisions"` |
| User mentions a technology | `"[technology] integration patterns"` |
| Starting a new file | `"[file-type] patterns conventions"` |
| Modifying existing code | `"[component] modifications changes"` |

### Automatic Storage Triggers

Claude MUST store memory when:

| Trigger | Memory Type | Minimum Importance |
|---------|-------------|-------------------|
| Made a technical decision | `decision` | 0.8 |
| Discovered a pattern | `pattern` | 0.6 |
| Fixed a bug | `fix` | 0.7 |
| Encountered an error | `error` | 0.5 |
| Optimized performance | `insight` | 0.7 |
| Created new component | `fact` | 0.5 |
| Refactored code | `pattern` | 0.6 |
| Added configuration | `fact` | 0.4 |

---

## ENFORCED MEMORY WORKFLOWS

### Workflow: Implement New Feature

```
┌─────────────────────────────────────────────────────────────┐
│ FEATURE IMPLEMENTATION WORKFLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. USER REQUEST                                             │
│     └─► "Implement [feature]"                                │
│                                                              │
│  2. SEARCH MEMORY [MANDATORY]                                │
│     ├─► search_memory("[feature] patterns")                  │
│     ├─► search_memory("[domain] architecture")               │
│     └─► Review ALL results                                   │
│                                                              │
│  3. BUILD CONTEXT [MANDATORY]                                │
│     └─► build_context("implementing [feature]")              │
│                                                              │
│  4. ANALYZE & PLAN                                           │
│     ├─► Identify required changes                            │
│     ├─► Map to existing patterns                             │
│     └─► Note deviations with rationale                       │
│                                                              │
│  5. IMPLEMENT                                                │
│     ├─► Follow established patterns                           │
│     ├─► Apply coding conventions                             │
│     └─► Write tests                                          │
│                                                              │
│  6. STORE DECISIONS [MANDATORY]                              │
│     ├─► add_memory(decision, importance=0.8)                 │
│     ├─► add_memory(pattern, importance=0.6)                  │
│     └─► Include full context                                 │
│                                                              │
│  7. VERIFY                                                   │
│     ├─► Run tests                                            │
│     ├─► Check linting                                        │
│     └─► Verify functionality                                 │
│                                                              │
│  8. STORE COMPLETION [MANDATORY]                             │
│     └─► add_memory(fact, "Feature [X] implemented...")       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Workflow: Fix Bug

```
┌─────────────────────────────────────────────────────────────┐
│ BUG FIX WORKFLOW                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. USER REPORT                                              │
│     └─► "Fix bug: [description]"                             │
│                                                              │
│  2. SEARCH MEMORY [MANDATORY]                                │
│     ├─► search_memory("[error] fix solution")                │
│     ├─► search_memory("[component] issues")                  │
│     └─► Check for similar bugs                               │
│                                                              │
│  3. INVESTIGATE                                              │
│     ├─► Locate bug source                                    │
│     ├─► Identify root cause                                  │
│     └─► Document findings                                    │
│                                                              │
│  4. FIX                                                      │
│     ├─► Apply minimal fix                                    │
│     └─► Don't refactor unnecessarily                         │
│                                                              │
│  5. STORE FIX [MANDATORY]                                    │
│     └─► add_memory({                                         │
│           content: "FIX: [bug description]\n                 │
│                     ROOT CAUSE: [cause]\n                    │
│                     SOLUTION: [fix]\n                        │
│                     PREVENTION: [how to avoid]",             │
│           memory_type: "fix",                                │
│           importance: 0.7,                                   │
│           tags: ["bug", "fix", "[component]"]                │
│         })                                                   │
│                                                              │
│  6. VERIFY                                                   │
│     ├─► Confirm fix works                                    │
│     └─► Check for regressions                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Workflow: Code Review

```
┌─────────────────────────────────────────────────────────────┐
│ CODE REVIEW WORKFLOW                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. REVIEW REQUEST                                           │
│     └─► "Review [file/PR]"                                   │
│                                                              │
│  2. SEARCH MEMORY [MANDATORY]                                │
│     ├─► search_memory("code review standards")               │
│     ├─► search_memory("[component] patterns")                │
│     └─► search_memory("architecture decisions")              │
│                                                              │
│  3. ANALYZE                                                  │
│     ├─► Check against patterns                               │
│     ├─► Verify conventions                                   │
│     └─► Identify deviations                                  │
│                                                              │
│  4. DOCUMENT FINDINGS                                        │
│     ├─► List issues found                                    │
│     ├─► Reference relevant memories                          │
│     └─► Provide recommendations                              │
│                                                              │
│  5. STORE INSIGHTS [MANDATORY]                               │
│     └─► add_memory(review findings)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ANTI-PATTERNS (STRICTLY FORBIDDEN)

### ❌ NEVER Do These

1. **Skip memory search before coding**
   ```
   WRONG:
   User: "Add authentication to the API"
   Claude: *immediately writes code*

   CORRECT:
   User: "Add authentication to the API"
   Claude: *searches memory first*
   "I found 3 relevant memories about authentication patterns.
    Based on these, I will implement JWT auth..."
   ```

2. **Forget to store decisions**
   ```
   WRONG:
   Claude: "I've decided to use Redis for caching"
   *does not store*

   CORRECT:
   Claude: "I've decided to use Redis for caching"
   *stores decision with rationale*
   ```

3. **Ignore retrieved memories**
   ```
   WRONG:
   Claude: *searches memory, finds pattern*
   Claude: *implements different pattern anyway*

   CORRECT:
   Claude: *searches memory, finds pattern*
   Claude: "The memory shows we use Repository pattern.
    I will follow this pattern."
   ```

4. **Store incomplete information**
   ```
   WRONG:
   add_memory("Fixed bug")

   CORRECT:
   add_memory({
     content: "FIX: Memory API returning 500 on empty query
               ROOT CAUSE: Weaviate client not handling null
               SOLUTION: Added null check in search handler
               FILES: api.py line 234
               PREVENTION: Add input validation",
     ...
   })
   ```

5. **Duplicate existing memories**
   ```
   WRONG:
   *stores same decision twice*

   CORRECT:
   *searches first*
   "This decision is already documented. I'll reference it."
   ```

6. **Use wrong tier**
   ```
   WRONG:
   Storing project-specific code pattern in Tier 3 (Global)

   CORRECT:
   Project patterns → Tier 1
   User preferences → Tier 2
   Universal best practices → Tier 3
   ```

---

## COMPLIANCE VERIFICATION CHECKLIST

Before completing ANY task, Claude MUST verify:

### Pre-Task Verification
- [ ] Called build_context at session start
- [ ] Called search_memory for relevant context
- [ ] Reviewed ALL returned memories
- [ ] Acknowledged memory context
- [ ] Identified applicable patterns

### During Task Verification
- [ ] Following established patterns
- [ ] Respecting previous decisions
- [ ] Avoiding known anti-patterns
- [ ] Documenting deviations with rationale

### Post-Task Verification
- [ ] Stored all decisions made
- [ ] Stored all patterns discovered
- [ ] Stored all bugs fixed
- [ ] Included full context in memories
- [ ] Used appropriate tier
- [ ] Applied correct tags
- [ ] Set appropriate importance

---

## MEMORY QUALITY STANDARDS

### Content Quality

| Aspect | Standard | Example |
|--------|----------|---------|
| Clarity | Unambiguous, specific | "Use JWT with 24h expiry" not "Use auth" |
| Context | Full background | Include why, what, how |
| Actionability | Can be applied | Include code examples if relevant |
| Completeness | No missing info | All necessary details included |
| Accuracy | Factually correct | Verify before storing |

### Tag Quality

| Aspect | Standard | Example |
|--------|----------|---------|
| Relevance | Tags describe content | `["auth", "jwt", "security"]` |
| Consistency | Use established tags | Check existing memories |
| Specificity | Not too broad | `["jwt-auth"]` not just `["auth"]` |
| Count | 3-7 tags optimal | Not too few, not too many |

### Importance Quality

| Score | When to Use |
|-------|-------------|
| 0.9-1.0 | Architectural decisions, security, breaking changes |
| 0.7-0.9 | Feature implementations, major refactors |
| 0.5-0.7 | Bug fixes, minor features, optimizations |
| 0.3-0.5 | Code style, minor adjustments |
| 0.0-0.3 | Notes, observations, references |

---

## SESSION CONTEXT TEMPLATE

At the start of each session, Claude should output:

```markdown
## Session Context Loaded

### Memory Search Results
- Searched for: [query]
- Found: [N] relevant memories
- Key memories:
  1. [Memory 1 summary]
  2. [Memory 2 summary]
  3. [Memory 3 summary]

### Applicable Patterns
- Pattern 1: [description]
- Pattern 2: [description]

### Previous Decisions
- Decision 1: [summary]
- Decision 2: [summary]

### Active Considerations
- [Any warnings or anti-patterns to avoid]

### Context Acknowledgment
I have loaded and understood the above context. I will follow established patterns and respect previous decisions unless there is a compelling reason to deviate (which I will document).
```

---

## ERROR RECOVERY PROCEDURES

### Memory Search Failed

```
IF search_memory returns error:
1. Log the error
2. Attempt simpler search
3. If still failing, proceed with caution
4. Store a note about the gap
5. Report to user if critical
```

### Memory Storage Failed

```
IF add_memory returns error:
1. Log the error
2. Simplify the memory content
3. Retry with minimal required fields
4. If still failing, save content locally
5. Retry storage later
6. Report to user if persistent
```

### Context Build Failed

```
IF build_context returns error:
1. Fall back to direct search_memory calls
2. Search for recent work manually
3. Proceed with available context
4. Note the limitation
```

---

## INTEGRATION WITH TOOLS

### MCP Tools Priority

When MCP memory tools are available, they take precedence:

```
Priority Order:
1. MCP memory tools (search_memory, add_memory, etc.)
2. File-based memory (if MCP unavailable)
3. No memory (degraded mode - avoid)
```

### Tool Call Sequences

```
Standard Sequence:
1. build_context (session start)
2. search_memory (before action)
3. [perform action]
4. add_memory (after action)
5. Repeat 2-4 as needed
```

---

## QUICK REFERENCE CARD

```
╔══════════════════════════════════════════════════════════════╗
║           CLAUDE MEMORY ENFORCEMENT QUICK REFERENCE          ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  SESSION START:                                              ║
║  1. build_context(query, project_id, max_tokens=4000)        ║
║  2. search_memory("[domain] recent work")                    ║
║  3. Acknowledge loaded context                               ║
║                                                              ║
║  BEFORE CODE CHANGE:                                         ║
║  1. search_memory("[component] patterns decisions")          ║
║  2. Review ALL returned memories                             ║
║  3. State approach based on context                          ║
║                                                              ║
║  AFTER ACTION:                                               ║
║  1. Identify what was learned/decided                        ║
║  2. add_memory(content, tier, type, tags, importance)        ║
║  3. Verify storage succeeded                                 ║
║                                                              ║
║  MEMORY TYPES:                                               ║
║  fact | decision | insight | pattern | fix | error | prefer  ║
║                                                              ║
║  TIERS: 1=Project | 2=General | 3=Global                     ║
║                                                              ║
║  IMPORTANCE:                                                 ║
║  0.9+ Architecture/Security | 0.7+ Features | 0.5+ Bugs      ║
║                                                              ║
║  ⚠️  NON-COMPLIANCE = CONTEXT LOSS = DEGRADED PERFORMANCE    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## FINAL ENFORCEMENT NOTICE

**By operating on the Engram Platform codebase, Claude agrees to:**

1. ✅ Search memory before EVERY code modification
2. ✅ Store memory after EVERY significant action
3. ✅ Build context at the start of EVERY session
4. ✅ Follow established patterns from memory
5. ✅ Document all decisions with full context
6. ✅ Never skip memory operations for convenience
7. ✅ Maintain high memory quality standards
8. ✅ Report memory system issues immediately

**Violation of these rules will result in:**
- Loss of context between sessions
- Repetition of past mistakes
- Inconsistent code patterns
- Degraded assistance quality

---

**Document Control**

| Author | Purpose | Enforcement |
|--------|---------|-------------|
| Engram Team | Claude memory enforcement | Mandatory for all Claude sessions |
