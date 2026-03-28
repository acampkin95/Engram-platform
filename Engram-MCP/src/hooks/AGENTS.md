<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# hooks

Pre/post tool execution hooks for automatic memory recall and storage.

## Key Files

| File | Description |
|------|-------------|
| `hook-manager.ts` | Hook orchestrator — registers, prioritizes, executes hooks |
| `memory-hooks.ts` | Built-in hooks: recall context, store insights, persist critical data |
| `types.ts` | `PreToolHookRegistration`, `PostToolHookRegistration`, `ToolCallContext` |

## For AI Agents

### Working In This Directory

1. **Understanding Hook Flow**
   - **Pre-hook**: Called before tool execution — recall relevant memory context
   - **Post-hook**: Called after tool execution — store results, insights, decisions
   - Priority: Lower number = earlier execution

2. **Adding a Hook**
   - Implement `PreToolHookRegistration` or `PostToolHookRegistration`
   - Call `hookManager.registerPreToolHook()` or `.registerPostToolHook()`
   - Hook receives `ToolCallContext` with tool name, input, and result
   - Hook can modify memory or trigger side effects

3. **Hook Lifecycle**
   - Hooks execute in priority order (ascending)
   - Failures are logged but don't block tool execution
   - Async hooks supported — wrapped in `await`
   - Hooks can access Memory API via injected client

### Testing Requirements

- Test hook registration in `tests/hook-manager.test.ts`
- Test pre-hook memory recall in `tests/`
- Test post-hook storage in `tests/`
- Mock Memory API calls
- Verify hook execution order by priority

### Common Patterns

- **Pre-hook**: Query Memory API for context (entities, decisions, patterns)
- **Post-hook**: Store tool results as new memories, update entity relationships
- **Priority**: System hooks (0-10), user hooks (10-50), extensions (50+)
- **Error Handling**: Log failures, continue — hooks are optional
- **Scope**: Hooks are registered per session — reset on transport reconnect

## Dependencies

### Internal
- `../client.ts` — Memory API for hook side effects
- `../logger.ts` — Audit logging
- `../config.ts` — Hook settings (enable/disable)

### External
- `@modelcontextprotocol/sdk` — Tool context types

<!-- MANUAL: -->
