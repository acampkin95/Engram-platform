"""
AI Memory MCP Client — Python async client + stdio bridge.

Provides:
  - MemoryMCPClient: typed async Python client for the AI Memory MCP server
  - MCPClientConfig: Pydantic Settings config (env-driven)
  - MCPToolError / MCPConnectionError: exception types
  - AddMemoryInput: typed input model for batch_add_memories
  - bridge: stdio ↔ HTTP proxy (run with `python -m memory_system.mcp` or
            `python -m memory_system.mcp.bridge`)

Quick start:
    from memory_system.mcp import MemoryMCPClient

    async with MemoryMCPClient() as client:
        await client.add_memory("User prefers concise answers", tier=2)
        results = await client.search_memory("user preferences")
        context = await client.build_context("How should I format responses?")

Batch add with typed input:
    from memory_system.mcp import MemoryMCPClient, AddMemoryInput

    async with MemoryMCPClient() as client:
        inputs = [
            AddMemoryInput(content="Prefer dark mode", tier=2, memory_type="preference"),
            AddMemoryInput(content="Use FastAPI", tier=1, project_id="my-project"),
        ]
        await client.batch_add_memories([m.model_dump(exclude_none=True) for m in inputs])

DX helpers:
    hits = await client.search_memory("user preferences")
    print(hits.texts())           # list of content strings
    print(hits.top(3))            # top-3 MemoryRecord objects
    print(hits.to_context())      # formatted context string for LLM prompts
    for m in hits.results:
        print(m.to_context_line())  # "[T2|preference|0.91] User prefers dark mode"
"""

from .client import MCPConnectionError, MCPToolError, MemoryMCPClient
from .config import MCPClientConfig
from .models import AddMemoryInput

__all__ = [
    "MemoryMCPClient",
    "MCPClientConfig",
    "MCPToolError",
    "MCPConnectionError",
    "AddMemoryInput",
]
