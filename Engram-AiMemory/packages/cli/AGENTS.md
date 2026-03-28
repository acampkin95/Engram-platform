<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# CLI Package

## Purpose

Minimal TypeScript command-line interface for Engram AI Memory System. Provides executable entry point for programmatic access and shell integration. Delegates to Memory API via HTTP or Python package direct import.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | npm package config, executable definition, dependencies |
| `src/index.ts` | CLI entry point (minimal stub, delegates to API or Python import) |
| `tsconfig.json` | TypeScript compiler settings |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| (none) | Small package — all code in `src/` |

## For AI Agents

### Working In This Directory

- **Install**: `npm install` (from workspace root)
- **Run**: `npm start` or `npx tsx src/index.ts`
- **Build**: Not currently used (TypeScript run directly via tsx)
- **Type check**: Implicit via `tsx` executor

### Testing Requirements

- No tests currently (CLI is minimal)
- Type checking via TypeScript compiler

### Common Patterns

- **Entry point**: `src/index.ts` parses CLI args and calls Memory API
- **HTTP client**: Can call Memory API (port 8000) if running
- **Python alternative**: Can import Python package directly (Node.js + Python integration)
- **Bin directive**: `package.json` bin field makes executable available as `ai-memory` command

## Dependencies

### Internal

- Memory API (HTTP client or Python import)

### External

- `typescript` (5.6.0+): Type checking
- `@types/node` (20.0.0+): Node.js type definitions
- `tsx` (4.19.0+): TypeScript executor (no compilation step)

<!-- MANUAL: -->
