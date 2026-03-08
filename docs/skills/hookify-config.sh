#!/bin/bash
# =============================================================================
# HOOKIFY CONFIGURATION SCRIPT
# =============================================================================
# This script sets up automatic memory hooks for AI assistants working on
# the Engram Platform. It creates hook configurations that enforce memory
# operations before and after actions.
#
# Usage:
#   ./hookify-config.sh [--install] [--uninstall] [--verify]
#
# Options:
#   --install     Install all hooks (default)
#   --uninstall   Remove all hooks
#   --verify      Verify hook installation
#
# Requirements:
#   - Memory API running on localhost:8000
#   - MCP server configured
#   - Write access to ~/.claude/
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKIFY_DIR="$CLAUDE_DIR/hookify"
MEMORY_API_URL="${MEMORY_API_URL:-http://localhost:8000}"
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# HOOK DEFINITIONS
# =============================================================================

# Create memory-recall hook
create_memory_recall_hook() {
    cat > "$HOOKIFY_DIR/memory-recall.md" << 'EOF'
# Memory Recall Hook

## Purpose
Automatically search and load relevant memories BEFORE any tool execution.

## Trigger
- **Timing**: Before tool execution
- **Condition**: All tools except health checks and read-only operations

## Configuration

```json
{
  "hook_type": "pre_tool",
  "name": "memory-recall",
  "priority": 100,
  "timeout_ms": 5000,
  "on_failure": "warn_continue",
  "conditions": {
    "exclude_tools": [
      "health_check",
      "get_stats",
      "list_memories",
      "search_memory"
    ]
  },
  "action": {
    "tool": "build_context",
    "arguments": {
      "query": "${tool_context}",
      "project_id": "${project_id}",
      "max_tokens": 2000
    }
  }
}
```

## Required Behavior

1. **Extract Context**: Analyze tool name and arguments
2. **Build Query**: Create relevant search query
3. **Call Memory**: Execute build_context
4. **Review Results**: Read returned context
5. **Proceed**: Continue with tool execution

## Example Execution

```
BEFORE: write_file(path="src/auth.py", content="...")
ACTION: build_context(query="authentication patterns file creation")
RESULT: Context loaded with auth patterns
AFTER: Write file following patterns
```

## Failure Handling

- If memory API unavailable: Log warning, continue
- If timeout: Use cached context if available
- If error: Log error, continue with caution

## Compliance

⚠️ This hook is MANDATORY. Skipping will result in:
- Loss of context
- Repeated mistakes
- Inconsistent code patterns
EOF
    log_success "Created memory-recall hook"
}

# Create memory-store hook
create_memory_store_hook() {
    cat > "$HOOKIFY_DIR/memory-store.md" << 'EOF'
# Memory Store Hook

## Purpose
Automatically store significant actions and decisions AFTER tool execution.

## Trigger
- **Timing**: After tool execution
- **Condition**: Tool modified state or made decisions

## Configuration

```json
{
  "hook_type": "post_tool",
  "name": "memory-store",
  "priority": 90,
  "timeout_ms": 10000,
  "on_failure": "warn_continue",
  "conditions": {
    "include_tools": [
      "write_file",
      "edit_file",
      "execute_command",
      "create_directory",
      "delete_file"
    ],
    "exclude_conditions": {
      "dry_run": true,
      "test_only": true
    }
  },
  "action": {
    "tool": "add_memory",
    "arguments": {
      "content": "${action_summary}",
      "tier": 1,
      "memory_type": "${memory_type}",
      "project_id": "${project_id}",
      "tags": "${auto_tags}",
      "importance": "${calculated_importance}",
      "metadata": {
        "tool": "${tool_name}",
        "files": "${files_modified}",
        "timestamp": "${timestamp}"
      }
    }
  }
}
```

## Memory Type Detection

| Tool Pattern | Memory Type | Importance |
|--------------|-------------|------------|
| Created new file | `pattern` | 0.6 |
| Modified existing | `fact` | 0.4 |
| Fixed error | `fix` | 0.7 |
| Made decision | `decision` | 0.8 |
| Discovered pattern | `insight` | 0.6 |
| Refactored code | `pattern` | 0.5 |

## Required Behavior

1. **Analyze Action**: Determine what was done
2. **Classify**: Identify memory type and importance
3. **Summarize**: Create clear, contextual content
4. **Store**: Execute add_memory
5. **Verify**: Confirm storage succeeded

## Example Execution

```
BEFORE: Tool executed successfully
ANALYSIS: Created authentication middleware
CLASSIFY: memory_type=pattern, importance=0.7
SUMMARIZE: "Created JWT authentication middleware with token validation..."
STORE: add_memory(content, tier=1, tags=["auth", "middleware"])
VERIFY: Memory stored with ID: uuid-here
```

## Failure Handling

- If storage fails: Log error, retry once
- If timeout: Queue for later storage
- If validation fails: Fix content, retry

## Compliance

⚠️ This hook is MANDATORY for state-changing operations.
EOF
    log_success "Created memory-store hook"
}

# Create session-context hook
create_session_context_hook() {
    cat > "$HOOKIFY_DIR/session-context.md" << 'EOF'
# Session Context Hook

## Purpose
Load comprehensive context at the START of every session.

## Trigger
- **Timing**: Session initialization
- **Condition**: Always, before any other operations

## Configuration

```json
{
  "hook_type": "session_start",
  "name": "session-context",
  "priority": 1000,
  "timeout_ms": 15000,
  "on_failure": "warn_stop",
  "action": {
    "sequence": [
      {
        "tool": "build_context",
        "arguments": {
          "query": "What work has been done recently and what decisions have been made?",
          "project_id": "${project_id}",
          "max_tokens": 4000
        }
      },
      {
        "tool": "search_memory",
        "arguments": {
          "query": "recent work changes patterns",
          "project_id": "${project_id}",
          "tier": 1,
          "limit": 20
        }
      }
    ]
  }
}
```

## Required Behavior

1. **Build Context**: Load comprehensive session context
2. **Search Recent**: Find recent work and changes
3. **Review All**: Read and understand all returned memories
4. **Acknowledge**: State understanding before proceeding
5. **Proceed**: Begin session work

## Example Output

```
## Session Context Loaded

### Memory Search Results
- Searched for: recent work changes patterns
- Found: 12 relevant memories
- Key memories:
  1. JWT auth implementation completed (2026-03-01)
  2. Redis caching added (2026-03-01)
  3. Error handling patterns established (2026-02-28)

### Active Patterns
- Repository pattern for data access
- Async/await for I/O operations
- Centralized error handling

### Previous Decisions
- Use JWT with 24h expiry
- Redis for session caching
- Weaviate for vector storage

### Context Acknowledgment
I have loaded and understood the above context. I will follow established
patterns and respect previous decisions.
```

## Failure Handling

- If context load fails: Retry with simpler query
- If memory API down: Proceed with caution, log issue
- If timeout: Reduce max_tokens, retry

## Compliance

⚠️ This hook is MANDATORY at session start. NEVER proceed without context.
EOF
    log_success "Created session-context hook"
}

# Create error-documentation hook
create_error_documentation_hook() {
    cat > "$HOOKIFY_DIR/error-documentation.md" << 'EOF'
# Error Documentation Hook

## Purpose
Automatically document errors encountered during operations.

## Trigger
- **Timing**: After tool failure
- **Condition**: Tool execution resulted in error

## Configuration

```json
{
  "hook_type": "on_error",
  "name": "error-documentation",
  "priority": 95,
  "timeout_ms": 10000,
  "on_failure": "log_only",
  "action": {
    "tool": "add_memory",
    "arguments": {
      "content": "${error_documentation}",
      "tier": 1,
      "memory_type": "error",
      "project_id": "${project_id}",
      "importance": 0.6,
      "tags": ["error", "${error_type}", "${component}"],
      "metadata": {
        "error_message": "${error_message}",
        "error_type": "${error_type}",
        "tool": "${failed_tool}",
        "timestamp": "${timestamp}",
        "stack_trace": "${stack_trace}"
      }
    }
  }
}
```

## Error Documentation Template

```
ERROR: [Error Type]
====================

MESSAGE: [Error Message]

CONTEXT:
- Tool: [Failed Tool]
- Operation: [What was being attempted]
- Files: [Affected files]

ROOT CAUSE:
[Analysis of why error occurred]

RESOLUTION:
[How to fix or work around]

PREVENTION:
[How to prevent in future]

RELATED:
- [Links to related errors or patterns]
```

## Required Behavior

1. **Capture Error**: Record all error details
2. **Analyze**: Determine root cause if possible
3. **Document**: Create comprehensive error record
4. **Store**: Save to memory system
5. **Continue**: Proceed with error handling

## Compliance

⚠️ Document ALL errors for future reference and prevention.
EOF
    log_success "Created error-documentation hook"
}

# Create decision-documentation hook
create_decision_documentation_hook() {
    cat > "$HOOKIFY_DIR/decision-documentation.md" << 'EOF'
# Decision Documentation Hook

## Purpose
Automatically document architectural and technical decisions.

## Trigger
- **Timing**: After decision-making operations
- **Condition**: Significant choice was made

## Configuration

```json
{
  "hook_type": "on_decision",
  "name": "decision-documentation",
  "priority": 85,
  "timeout_ms": 10000,
  "on_failure": "warn_continue",
  "conditions": {
    "decision_types": [
      "architecture",
      "technology_choice",
      "pattern_selection",
      "api_design",
      "security"
    ]
  },
  "action": {
    "tool": "add_memory",
    "arguments": {
      "content": "${decision_documentation}",
      "tier": 1,
      "memory_type": "decision",
      "project_id": "${project_id}",
      "importance": 0.9,
      "tags": ["decision", "${decision_domain}", "architecture"],
      "metadata": {
        "decision_date": "${timestamp}",
        "decision_maker": "ai_assistant",
        "alternatives": "${alternatives_considered}",
        "affected_components": "${affected_components}"
      }
    }
  }
}
```

## Decision Documentation Template

```
DECISION: [What was decided]
============================

CONTEXT:
[Why this decision was needed]

OPTIONS CONSIDERED:
1. [Option A]
   - Pros: [...]
   - Cons: [...]
   - Selected: No - [reason]

2. [Option B] ← SELECTED
   - Pros: [...]
   - Cons: [...]
   - Selected: Yes - [reason]

RATIONALE:
[Detailed explanation of why this choice was made]

TRADEOFFS:
- Benefit: [What we gain]
- Cost: [What we sacrifice]

IMPLICATIONS:
- [Impact on codebase]
- [Impact on team]
- [Impact on future work]

REVERSIBILITY: [High/Medium/Low]
```

## Compliance

⚠️ Document ALL significant decisions with full rationale.
EOF
    log_success "Created decision-documentation hook"
}

# Create hook configuration file
create_hook_config() {
    cat > "$HOOKIFY_DIR/hooks.json" << EOF
{
  "version": "1.0.0",
  "memory_api_url": "$MEMORY_API_URL",
  "mcp_server_url": "$MCP_SERVER_URL",
  "hooks": {
    "session_start": ["session-context"],
    "pre_tool": ["memory-recall"],
    "post_tool": ["memory-store"],
    "on_error": ["error-documentation"],
    "on_decision": ["decision-documentation"]
  },
  "settings": {
    "default_timeout_ms": 10000,
    "max_retries": 2,
    "cache_context": true,
    "cache_ttl_seconds": 300,
    "log_level": "info"
  },
  "compliance": {
    "enforce_hooks": true,
    "fail_on_missing_context": false,
    "require_memory_storage": true
  }
}
EOF
    log_success "Created hook configuration"
}

# Create hook loader script
create_hook_loader() {
    cat > "$HOOKIFY_DIR/load-hooks.sh" << 'EOF'
#!/bin/bash
# Hook Loader Script
# Loads hook configurations into AI assistant environment

HOOKIFY_DIR="$HOME/.claude/hookify"
HOOKS_FILE="$HOOKIFY_DIR/hooks.json"

if [ ! -f "$HOOKS_FILE" ]; then
    echo "ERROR: hooks.json not found. Run hookify-config.sh --install first."
    exit 1
fi

# Export hook configuration
export HOOKIFY_ENABLED=true
export HOOKIFY_CONFIG="$HOOKS_FILE"
export HOOKIFY_DIR="$HOOKIFY_DIR"

# Set memory API URL
export MEMORY_API_URL=$(jq -r '.memory_api_url' "$HOOKS_FILE")
export MCP_SERVER_URL=$(jq -r '.mcp_server_url' "$HOOKS_FILE")

echo "Hooks loaded successfully"
echo "Memory API: $MEMORY_API_URL"
echo "MCP Server: $MCP_SERVER_URL"
echo "Config: $HOOKS_FILE"
EOF
    chmod +x "$HOOKIFY_DIR/load-hooks.sh"
    log_success "Created hook loader script"
}

# =============================================================================
# INSTALL FUNCTIONS
# =============================================================================

install_hooks() {
    log_info "Installing memory hooks..."

    # Create directories
    mkdir -p "$HOOKIFY_DIR"

    # Create all hooks
    create_memory_recall_hook
    create_memory_store_hook
    create_session_context_hook
    create_error_documentation_hook
    create_decision_documentation_hook
    create_hook_config
    create_hook_loader

    log_success "All hooks installed to $HOOKIFY_DIR"

    # Print summary
    echo ""
    echo "=========================================="
    echo "HOOK INSTALLATION COMPLETE"
    echo "=========================================="
    echo ""
    echo "Hooks installed:"
    ls -la "$HOOKIFY_DIR"
    echo ""
    echo "To activate hooks, add to your shell profile:"
    echo "  source $HOOKIFY_DIR/load-hooks.sh"
    echo ""
    echo "Or for Claude Desktop, add to settings:"
    echo "  \"env\": {"
    echo "    \"HOOKIFY_ENABLED\": \"true\","
    echo "    \"HOOKIFY_CONFIG\": \"$HOOKIFY_DIR/hooks.json\""
    echo "  }"
}

# =============================================================================
# UNINSTALL FUNCTIONS
# =============================================================================

uninstall_hooks() {
    log_info "Uninstalling memory hooks..."

    if [ -d "$HOOKIFY_DIR" ]; then
        rm -rf "$HOOKIFY_DIR"
        log_success "Hooks uninstalled"
    else
        log_warning "No hooks found to uninstall"
    fi
}

# =============================================================================
# VERIFY FUNCTIONS
# =============================================================================

verify_hooks() {
    log_info "Verifying hook installation..."

    local errors=0

    # Check directory
    if [ ! -d "$HOOKIFY_DIR" ]; then
        log_error "Hook directory not found: $HOOKIFY_DIR"
        errors=$((errors + 1))
    else
        log_success "Hook directory exists"
    fi

    # Check required files
    local required_files=(
        "memory-recall.md"
        "memory-store.md"
        "session-context.md"
        "error-documentation.md"
        "decision-documentation.md"
        "hooks.json"
        "load-hooks.sh"
    )

    for file in "${required_files[@]}"; do
        if [ -f "$HOOKIFY_DIR/$file" ]; then
            log_success "Found: $file"
        else
            log_error "Missing: $file"
            errors=$((errors + 1))
        fi
    done

    # Check Memory API connectivity
    if curl -sf "$MEMORY_API_URL/health" > /dev/null 2>&1; then
        log_success "Memory API is reachable"
    else
        log_warning "Memory API not reachable at $MEMORY_API_URL"
    fi

    # Check MCP Server connectivity
    if curl -sf "$MCP_SERVER_URL/health" > /dev/null 2>&1; then
        log_success "MCP Server is reachable"
    else
        log_warning "MCP Server not reachable at $MCP_SERVER_URL"
    fi

    # Summary
    echo ""
    if [ $errors -eq 0 ]; then
        log_success "All hooks verified successfully"
        return 0
    else
        log_error "Verification failed with $errors errors"
        return 1
    fi
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    local action="${1:-install}"

    case "$action" in
        --install|-i|install)
            install_hooks
            ;;
        --uninstall|-u|uninstall)
            uninstall_hooks
            ;;
        --verify|-v|verify)
            verify_hooks
            ;;
        --help|-h|help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --install     Install all hooks (default)"
            echo "  --uninstall   Remove all hooks"
            echo "  --verify      Verify hook installation"
            echo "  --help        Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  MEMORY_API_URL   Memory API URL (default: http://localhost:8000)"
            echo "  MCP_SERVER_URL   MCP Server URL (default: http://localhost:3000)"
            ;;
        *)
            log_error "Unknown action: $action"
            echo "Run '$0 --help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
