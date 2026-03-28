<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# utils

Helper utilities for request/response handling and parsing.

## Key Files

| File | Description |
|------|-------------|
| `read-body.ts` | Parse HTTP request body (JSON, with size limit and timeout) |

## For AI Agents

### Working In This Directory

1. **Using Utilities**
   - `readBody()` — Safely parse incoming HTTP request body with limits
   - Used by OAuth endpoints and HTTP transport

2. **Adding Utilities**
   - Keep focused and single-purpose
   - Export typed functions
   - Include error handling and validation
   - Write tests in `tests/`

### Testing Requirements

- Test `readBody` with valid/invalid JSON in `tests/read-body.test.ts`
- Test size limits and timeout handling
- Mock HTTP request streams

### Common Patterns

- **Size Limits**: Enforce `config.http.maxBodyBytes` to prevent abuse
- **Timeouts**: Respect `config.timeout` settings
- **Error Handling**: Return descriptive errors for malformed input

## Dependencies

### Internal
- `../config.ts` — Size and timeout limits
- `../errors.ts` — Error types

### External
- `node:http` — HTTP request stream handling

<!-- MANUAL: -->
