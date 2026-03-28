<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# tests

Comprehensive test suite using Node.js `node --test` runner.

## Key Files

| File | Description |
|------|-------------|
| `client.test.ts` | Memory API client — resilience, timeout, retry, circuit breaker |
| `server.test.ts` | MCP server factory — tool registration, execution |
| `memory-tools.test.ts` | Memory CRUD tools — add, search, list, clear |
| `entity-tools.test.ts` | Entity tools — create, find, update, relationships |
| `investigation-tools.test.ts` | Investigation tools — case, matter, evidence |
| `oauth-server.test.ts` | OAuth endpoints — register, authorize, token |
| `oauth-middleware-bootstrap.test.ts` | Bearer token validation |
| `hook-manager.test.ts` | Hook registration and execution order |
| `pkce.test.ts` | PKCE code challenge/verifier |
| `http.test.ts` | HTTP transport endpoints |
| `config.test.ts` | Configuration loading and validation |
| `errors.test.ts` | Error classification and handling |
| `circuit-breaker.test.ts` | Resilience pattern — state machine |
| `prompts.test.ts` | MCP prompt rendering |
| `read-body.test.ts` | HTTP request body parsing |
| `health.test.ts` | Health check endpoint |
| `token-store.test.ts` | Token storage and expiry |

## For AI Agents

### Working In This Directory

1. **Running Tests**
   ```bash
   npm run build && npm run test        # All tests
   npm run test:coverage               # With coverage report
   npm test -- tests/client.test.ts    # Single file
   ```

2. **Test Structure**
   - Each test file mirrors source structure (e.g., `tests/client.test.ts` for `src/client.ts`)
   - Use `import test from "node:test"` and `describe/it` from test framework
   - Mock HTTP/Redis as needed

3. **Writing New Tests**
   - Create `feature.test.ts` alongside source
   - Use consistent naming: `test("should ...", async (t) => { ... })`
   - Mock external dependencies (Memory API, Redis)
   - Test both success and failure paths

### Testing Requirements

- Target: 80%+ coverage across all modules
- All new code requires tests before merge
- Mocks must be realistic (e.g., actual Memory API response formats)
- Async tests: use `async (t) => { ... }` pattern
- Cleanup: Properly close mocks, reset state between tests

### Common Patterns

- **Mocking HTTP**: Use `node:http` stubs to mock Memory API
- **Mocking Redis**: Mock `redis` client methods
- **Assertions**: Use Node.js `assert` or custom assertions
- **Fixtures**: Place test data in separate `fixtures/` if large
- **Isolation**: Each test independent — no shared state

## Dependencies

### Internal
- All source modules in `src/`

### External
- `node:test` — Test runner (built-in)
- `node:assert` — Assertions (built-in)
- `node:http`, `node:stream` — Mock primitives

## Running in CI/CD

- `npm run test` runs via GitHub Actions
- Coverage thresholds enforced
- All tests must pass before merge

<!-- MANUAL: -->
