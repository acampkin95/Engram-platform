#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

python3 -m json.tool "$ROOT/.claude-plugin/plugin.json" >/dev/null
python3 -m json.tool "$ROOT/.mcp.json" >/dev/null

test -f "$ROOT/README.md"
test -f "$ROOT/docs/api-surface.md"

for skill in \
  engram-memory-helper \
  engram-memory-search \
  engram-memory-context \
  engram-memory-graph \
  engram-memory-ingest \
  engram-memory-extract \
  engram-memory-matter \
  engram-memory-personal \
  engram-memory-admin \
  engram-memory-debug
do
  test -f "$ROOT/skills/$skill/SKILL.md"
done

test -f "$ROOT/docs/document-workflows.md"

echo "engram-memory-helper plugin structure is valid"
