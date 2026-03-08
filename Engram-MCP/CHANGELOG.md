# Changelog

All notable changes to the Engram MCP Server are documented here.

---

## [1.0.0] — Production Release

**Date:** 2026-03-01

### Added

- **Dual transport support** — stdio and HTTP streaming modes via `--transport` flag
- **OAuth 2.1 authentication** — PKCE flow with token store, refresh, and expiry handling
- **Circuit breaker** — Automatic failure detection with open/half-open/closed state transitions
- **Retry with backoff** — Configurable retry logic for transient failures
- **Health endpoint** — `GET /health` with detailed service status and uptime metrics
- **Hookify memory hooks** — Git-style hooks for memory lifecycle events
- **Streamlined installer** — `engram-mcp-install` CLI for automated client configuration

### Test Suite

- 10 test files, 161 tests passing, 0 failures:
  - `circuit-breaker.test.ts` — State transitions, failure counting, recovery
  - `config.test.ts` — Configuration validation and defaults
  - `errors.test.ts` — Error class hierarchy and serialization
  - `health.test.ts` — Health check endpoint and service status
  - `hook-manager.test.ts` — Hook lifecycle and event dispatching
  - `pkce.test.ts` — PKCE challenge/verifier generation
  - `retry.test.ts` — Retry logic with exponential backoff
  - `schemas.test.ts` — Zod schema validation for all tool inputs
  - `token-store.test.ts` — Token storage, retrieval, and expiry
  - `tool-definitions.test.ts` — Tool structure, annotations, naming conventions

### Infrastructure

- Biome linting and formatting configured
- TypeScript strict mode with Node.js 20+ target
- Docker build support via `docker/` directory
- `.env.example` with documented configuration options
