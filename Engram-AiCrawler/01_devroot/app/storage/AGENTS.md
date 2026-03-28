<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# storage

## Purpose

Vector database client and storage abstraction. Manages ChromaDB collections for semantic search and RAG.

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker; exports ChromaDB client |

## For AI Agents

### Working In This Directory

1. **Using ChromaDB**: Import `get_chroma_client()` to access collections.
2. **Adding collections**: Use `client.create_collection()` with metadata filtering options.
3. **Query optimization**: Use `ChromaDB optimizer` service for complex queries.

### Testing Requirements

- Mock ChromaDB client in tests.
- Test collection creation, insert, update, delete, and search.

### Common Patterns

- **Client singleton**: Use module-level client instance or factory function
- **Collection management**: Create collections with schema and metadata filters
- **Vector ops**: Insert embeddings with metadata; query by vector similarity

## Dependencies

### Internal
- None

### External
- ChromaDB

<!-- MANUAL: -->
