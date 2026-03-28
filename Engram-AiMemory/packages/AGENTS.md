<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# Packages Directory

## Purpose

npm workspaces root for CLI and MCP integration tooling. Core Python backend lives in `core/` as a pip-installable package. MCP server and dashboard UI have been moved to Engram-MCP and Engram-Platform respectively.

## Key Files

| File | Description |
|------|-------------|
| (none at this level) | Package manifests in subdirectories |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `core/` | Python FastAPI backend (main package) — see `core/AGENTS.md` |
| `cli/` | TypeScript command-line interface — see `cli/AGENTS.md` |

## For AI Agents

### Working In This Directory

- This is a **workspace root** for npm and pip in parallel
- Python work: `cd core/`, set up venv, install with pip
- TypeScript work: `npm install` at workspace root, then `npm run` targets in `cli/`
- Most activity is in `core/` (99% of the codebase)

### Testing Requirements

- **Python tests**: From `core/tests/` via pytest
- **TypeScript tests**: None currently (CLI is minimal)

### Common Patterns

- Workspace symlinks allow sibling packages to import each other
- CLI can call Memory API via HTTP or direct import
- Package exports in `core/src/memory_system/__init__.py` define public API

## Dependencies

### Internal

- `core/` → `core/src/memory_system` (package entry point)
- `cli/` → `core/src/memory_system` (optional HTTP client import)

### External

- **npm**: `typescript`, `biome`, `concurrently`
- **pip**: See `core/` for full list

<!-- MANUAL: -->
