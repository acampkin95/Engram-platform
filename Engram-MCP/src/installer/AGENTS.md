<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# installer

Interactive CLI for installing Engram MCP into client configurations (`engram-mcp-install` command).

## Key Files

| File | Description |
|------|-------------|
| `cli.ts` | Main entry point — interactive prompts, flow control |
| `detect-client.ts` | Detects Claude, OpenAI, Anthropic clients and config paths |
| `inject-config.ts` | Injects MCP server entry into `claude.json` or equivalent |
| `inject-claude-md.ts` | Creates/updates `.claude/CLAUDE.md` with MCP setup docs |
| `create-hookify-rules.ts` | Generates hookify rules for auto-memory integration |
| `validate.ts` | Validates install: checks config, tests connectivity, verifies hooks |

## For AI Agents

### Working In This Directory

1. **Running the Installer**
   ```bash
   npm run install-mcp
   # or
   node dist/installer/cli.ts
   ```
   - Interactive prompts guide setup
   - Detects client automatically
   - Validates before confirming

2. **Supporting a New Client**
   - Add detection logic to `detect-client.ts`
   - Implement config injection in `inject-config.ts`
   - Ensure validation covers new client paths

3. **Customizing Installation**
   - Modify `inject-claude-md.ts` for documentation template
   - Edit `create-hookify-rules.ts` for memory integration rules
   - Update CLI prompts in `cli.ts`

### Testing Requirements

- Test detection in `tests/` for all supported clients
- Test config file injection (idempotent, preserves existing content)
- Test validation catches missing dependencies
- Mock file I/O with Node.js fs stubs
- Verify CLAUDE.md and hookify rules are syntactically correct

### Common Patterns

- **Idempotent**: Running installer twice should not duplicate entries
- **Backup**: Installers should backup original config before modification
- **Validation**: Always validate install before reporting success
- **User Feedback**: Provide clear success/error messages with paths
- **Auto-detection**: Minimize user input by detecting client paths

## Dependencies

### Internal
- `../config.ts` — MCP configuration schema
- `../logger.ts` — User-friendly logging

### External
- `node:fs`, `node:path`, `node:os` — File system operations
- `node:readline` — Interactive prompts
- `node:child_process` — Execution (if needed)

<!-- MANUAL: -->
