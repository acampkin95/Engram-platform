<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# scripts

Build and deployment scripts.

## Key Files

| File | Description |
|------|-------------|
| `smoke.mjs` | Smoke test — build + quick connectivity check to MCP server |
| `deploy/` | Deployment scripts (if any) |

## For AI Agents

### Working In This Directory

1. **Running Smoke Test**
   ```bash
   npm run smoke    # builds and runs tests/smoke.mjs
   ```
   - Verifies TypeScript compilation
   - Checks basic server startup and health endpoint
   - Quick validation before deployment

2. **Adding Scripts**
   - Use `.mjs` extension for ES modules
   - Make executable if CLI: `#!/usr/bin/env node`
   - Import from `dist/` (compiled output)
   - Log progress and errors to console

### Common Patterns

- **Pre-deploy**: Run smoke test to catch build errors early
- **Idempotent**: Scripts should be safe to run multiple times
- **Error Handling**: Exit with non-zero on failure for CI/CD

## Dependencies

### External
- `node:http`, `node:https` — Network operations

<!-- MANUAL: -->
