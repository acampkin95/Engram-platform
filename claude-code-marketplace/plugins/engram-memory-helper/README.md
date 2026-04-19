# Engram Memory Helper

Claude Code plugin for Engram's 3-tier memory system.

## What It Adds

- MCP connection template for the Engram HTTP MCP server
- Slash skills for memory search, context enrichment, graph workflows, ingestion, personal memory, tenant/project operations, and troubleshooting
- Additional document extraction and matter/evidence workflows for document-to-memory conversion
- PreToolUse and PostToolUse hooks for Engram API/MCP safety and troubleshooting guidance
- Repo-specific guidance for choosing between direct Memory API calls and MCP workflows

## Required Environment Variables

```bash
export ENGRAM_MCP_URL="https://app.velocitydigi.com/mcp"
export ENGRAM_MCP_AUTH_TOKEN="your-engram-mcp-bearer-token"
export ENGRAM_MEMORY_API_URL="https://app.velocitydigi.com/api/memory"
export ENGRAM_API_KEY="your-betterauth-api-key"
```

## Main Skills

- `/engram-memory-search <query>`
- `/engram-memory-context <query>`
- `/engram-memory-graph <entity-name-or-id>`
- `/engram-memory-ingest <file-path-or-url>`
- `/engram-memory-extract <file-path-or-url> [tier]`
- `/engram-memory-matter <matter-id-or-task>`
- `/engram-memory-personal <task>`
- `/engram-memory-admin <task>`
- `/engram-memory-debug [target]`

## Notes

- Use the MCP server for normal memory workflows when it is connected.
- Use direct API calls when you need endpoint-specific debugging, tenant admin, or evidence ingestion flows.
- The plugin assumes BetterAuth-backed API keys for direct Memory API access.
- Hooks auto-load from `hooks/hooks.json` when the plugin is enabled.

## Validation

Run:

```bash
bash scripts/validate-plugin.sh
```
