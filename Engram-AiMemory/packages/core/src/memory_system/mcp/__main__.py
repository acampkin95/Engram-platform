"""
Entry point for `python -m memory_system.mcp`.

Runs the stdio ↔ HTTP bridge so the AI Memory system can be used
as an MCP server by Claude Code, Claude Desktop, Cursor, and other
CLI coding agents.

Usage:
    python -m memory_system.mcp

    # Or via the bridge module directly:
    python -m memory_system.mcp.bridge

Environment variables:
    MCP_SERVER_URL      http://localhost:3000/mcp  (default)
    AI_MEMORY_API_KEY   your-api-key               (optional)
    MCP_AUTH_TOKEN      bearer-token               (optional)
"""

import asyncio
import logging
import sys

from .bridge import main

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.WARNING,
        stream=sys.stderr,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    asyncio.run(main())
