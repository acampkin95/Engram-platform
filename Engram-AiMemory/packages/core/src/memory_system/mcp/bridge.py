"""
Stdio ↔ HTTP bridge for the AI Memory MCP Server.

Translates between the stdio MCP transport (used by CLI coding agents such as
Claude Code and Claude Desktop) and the Streamable HTTP transport used by the
AI Memory MCP server.

This lets you add the memory system to any MCP host that speaks stdio — without
changing the server or requiring a separate HTTP client.

────────────────────────────────────────────────────────────────────────────────
Claude Code (~/.claude.json or project .claude/settings.json):

    {
      "mcpServers": {
        "ai-memory": {
          "command": "python",
          "args": ["-m", "memory_system.mcp.bridge"],
          "env": {
            "MCP_SERVER_URL": "http://localhost:3000/mcp",
            "AI_MEMORY_API_KEY": "your-api-key"
          }
        }
      }
    }

Claude Desktop (~/.config/claude/claude_desktop_config.json):

    {
      "mcpServers": {
        "ai-memory": {
          "command": "python",
          "args": ["-m", "memory_system.mcp.bridge"],
          "env": {
            "MCP_SERVER_URL": "http://localhost:3000/mcp",
            "AI_MEMORY_API_KEY": "your-api-key"
          }
        }
      }
    }

Cursor / other MCP hosts: same pattern — command = python, args = ["-m", "memory_system.mcp.bridge"].

────────────────────────────────────────────────────────────────────────────────
Environment variables (same as MCPClientConfig):

    MCP_SERVER_URL          URL of the HTTP MCP server (default: http://localhost:3000/mcp)
    MCP_AUTH_TOKEN          Bearer token for server auth (optional)
    AI_MEMORY_API_KEY       X-API-Key header value (optional)
    MCP_CLIENT_TIMEOUT      Request timeout in seconds (default: 30)
    MCP_CLIENT_MAX_RETRIES  Retry attempts (default: 3)
    MCP_CLIENT_RETRY_DELAY  Initial retry delay in seconds (default: 1.0)

────────────────────────────────────────────────────────────────────────────────
Architecture:

    CLI agent (stdio)
         │  JSON-RPC over stdin/stdout
         ▼
    bridge.py  ← this file (MCP Server over stdio)
         │  Proxies tools, resources, and prompts via HTTP session
         ▼
    AI Memory MCP Server (Streamable HTTP on port 3000)
         │
         ▼
    FastAPI / Weaviate / Redis
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sys
from collections.abc import Sequence
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    EmbeddedResource,
    GetPromptResult,
    ImageContent,
    PromptArgument,
    PromptMessage,
    Resource,
    ResourceTemplate,
    TextContent,
    Tool,
)

from .client import MCPConnectionError, MemoryMCPClient
from .config import MCPClientConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static resource definitions (mirrors enhanced-resources.ts)
# ---------------------------------------------------------------------------

_STATIC_RESOURCES: list[Resource] = [
    Resource(
        uri="memory://stats",
        name="Memory Statistics",
        description="Overview of memory storage across all tiers",
        mimeType="application/json",
    ),
    Resource(
        uri="memory://health",
        name="System Health",
        description="Health status of the memory system components",
        mimeType="application/json",
    ),
    Resource(
        uri="memory://tiers",
        name="Memory Tiers Overview",
        description="Documentation of the 3-tier memory architecture",
        mimeType="application/json",
    ),
    Resource(
        uri="memory://config",
        name="Server Configuration",
        description="Current server configuration (non-sensitive)",
        mimeType="application/json",
    ),
]

_RESOURCE_TEMPLATES: list[ResourceTemplate] = [
    ResourceTemplate(
        uriTemplate="memory://recent/{limit}",
        name="Recent Memories",
        description="Most recently added memories",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://project/{projectId}",
        name="Project Memories",
        description="Memories for a specific project",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://project/{projectId}/recent/{limit}",
        name="Recent Project Memories",
        description="Recent memories for a specific project",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://user/{userId}",
        name="User Memories",
        description="Memories for a specific user",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://tier/{tier}",
        name="Tier Memories",
        description="Memories in a specific tier (1, 2, or 3)",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://type/{memoryType}",
        name="Memories by Type",
        description="Memories filtered by type (fact, insight, code, etc.)",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://search/{query}",
        name="Search Results",
        description="Semantic search results for a query",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://entity/{entityName}",
        name="Entity Details",
        description="Knowledge graph entity by name",
        mimeType="application/json",
    ),
    ResourceTemplate(
        uriTemplate="memory://graph/{entityName}/{depth}",
        name="Entity Graph",
        description="Knowledge graph relationships for an entity",
        mimeType="application/json",
    ),
]

# ---------------------------------------------------------------------------
# Static tier documentation (mirrors TIER_DOCUMENTATION in enhanced-resources.ts)
# ---------------------------------------------------------------------------

_TIER_DOCUMENTATION = {
    "tiers": [
        {
            "tier": 1,
            "name": "Project",
            "description": "Per-project isolated memory — code insights, decisions, patterns",
            "scope": "project-scoped",
            "use_cases": ["code insights", "project decisions", "implementation patterns"],
        },
        {
            "tier": 2,
            "name": "General",
            "description": "User-specific, cross-project memory — preferences, workflows",
            "scope": "user-specific",
            "use_cases": ["user preferences", "cross-project workflows", "personal knowledge"],
        },
        {
            "tier": 3,
            "name": "Global",
            "description": "Shared bootstrap knowledge — best practices, documentation",
            "scope": "global",
            "use_cases": ["best practices", "shared documentation", "bootstrap knowledge"],
        },
    ]
}

# ---------------------------------------------------------------------------
# Prompt definitions (mirrors prompts.ts)
# ---------------------------------------------------------------------------

_PROMPTS = [
    {
        "name": "remember_context",
        "description": "Store important context about the current conversation or task for future reference",
        "arguments": [
            PromptArgument(
                name="content", description="The information to remember", required=True
            ),
            PromptArgument(
                name="importance",
                description="Importance level: high, medium, or low",
                required=False,
            ),
            PromptArgument(
                name="project_id",
                description="Project identifier for scoping memories",
                required=False,
            ),
        ],
    },
    {
        "name": "recall_context",
        "description": "Retrieve relevant memories for the current context or task",
        "arguments": [
            PromptArgument(name="query", description="Search query or topic", required=True),
            PromptArgument(
                name="project_id",
                description="Project identifier for scoping memories",
                required=False,
            ),
        ],
    },
    {
        "name": "build_project_knowledge",
        "description": "Build comprehensive context about a project from stored memories",
        "arguments": [
            PromptArgument(name="project_id", description="Project identifier", required=True),
            PromptArgument(
                name="focus_area",
                description="Specific area to focus on (optional)",
                required=False,
            ),
        ],
    },
    {
        "name": "learn_pattern",
        "description": "Store a learned pattern or best practice for future use",
        "arguments": [
            PromptArgument(name="pattern_name", description="Name of the pattern", required=True),
            PromptArgument(
                name="description", description="Description of the pattern", required=True
            ),
            PromptArgument(
                name="code_example", description="Optional code example", required=False
            ),
            PromptArgument(
                name="tier",
                description="Memory tier: 1 (project), 2 (general), or 3 (global)",
                required=False,
            ),
        ],
    },
    {
        "name": "troubleshoot",
        "description": "Search for relevant error solutions and debugging knowledge",
        "arguments": [
            PromptArgument(
                name="error_description",
                description="Description of the error or issue",
                required=True,
            ),
            PromptArgument(
                name="error_type",
                description="Type of error (e.g., runtime, compile, logic)",
                required=False,
            ),
        ],
    },
    {
        "name": "code_review_context",
        "description": "Gather context for reviewing code in a specific area",
        "arguments": [
            PromptArgument(
                name="code_area", description="Area of code being reviewed", required=True
            ),
            PromptArgument(
                name="project_id",
                description="Project identifier for scoping memories",
                required=False,
            ),
        ],
    },
    {
        "name": "session_summary",
        "description": "Create a summary of the current session and store it for future reference",
        "arguments": [
            PromptArgument(
                name="summary", description="Summary of what was accomplished", required=True
            ),
            PromptArgument(name="decisions", description="Key decisions made", required=False),
            PromptArgument(name="next_steps", description="Next steps or todos", required=False),
            PromptArgument(
                name="project_id",
                description="Project identifier for scoping memories",
                required=False,
            ),
        ],
    },
    {
        "name": "entity_context",
        "description": "Get context about entities related to a topic",
        "arguments": [
            PromptArgument(
                name="entity_name",
                description="Name of the entity to explore",
                required=True,
            ),
            PromptArgument(
                name="depth",
                description="How many relationship hops to explore (1-3)",
                required=False,
            ),
        ],
    },
]


def _render_prompt(name: str, args: dict[str, str]) -> str:
    """Render a prompt template with the given arguments."""
    a = args  # shorthand

    def _opt(key: str, prefix: str = "") -> str:
        """Return 'prefix value' if key is present and non-empty, else ''."""
        val = a.get(key, "")
        return f"\n{prefix}{val}" if val else ""

    templates: dict[str, str] = {
        "remember_context": (
            f"Please store the following information in memory:\n\n"
            f"Content: {a.get('content', '')}"
            f"{_opt('importance', 'Importance: ')}"
            f"{_opt('project_id', 'Project: ')}\n\n"
            "Use the add_memory tool to store this. Choose an appropriate memory type "
            "and tier based on the content."
        ),
        "recall_context": (
            f'Search for memories relevant to: "{a.get("query", "")}"'
            f"{_opt('project_id', 'Scope: Project ')}\n\n"
            "Use the search_memory tool to find relevant information, then summarize what you found."
        ),
        "build_project_knowledge": (
            f"Build comprehensive context for project: {a.get('project_id', '')}"
            f"{_opt('focus_area', 'Focus area: ')}\n\n"
            "Steps:\n"
            "1. Use search_memory to find memories related to this project\n"
            "2. Use query_graph to explore related entities\n"
            "3. Synthesize the information into a coherent overview\n\n"
            "Provide a structured summary of what you know about this project."
        ),
        "learn_pattern": (
            f"Store this pattern for future reference:\n\n"
            f"Pattern: {a.get('pattern_name', '')}\n"
            f"Description: {a.get('description', '')}"
            + (f"\nExample:\n```\n{a['code_example']}\n```" if a.get("code_example") else "")
            + f'\n\nUse add_memory with memory_type="code" and the appropriate tier '
            f"({a.get('tier', '2')})."
        ),
        "troubleshoot": (
            f"Search for solutions related to this error:\n\n"
            f"Error: {a.get('error_description', '')}"
            f"{_opt('error_type', 'Type: ')}\n\n"
            "Steps:\n"
            "1. Use search_memory with relevant keywords\n"
            '2. Look for memories with memory_type="error_solution"\n'
            "3. Provide any found solutions or suggest storing the solution once resolved"
        ),
        "code_review_context": (
            f"Gather context for reviewing code in: {a.get('code_area', '')}"
            f"{_opt('project_id', 'Project: ')}\n\n"
            "Steps:\n"
            "1. Search for existing patterns and conventions\n"
            "2. Look for related decisions and trade-offs\n"
            "3. Check for known issues or gotchas\n"
            "4. Summarize the context for the review"
        ),
        "session_summary": (
            f"Create and store a session summary:\n\n"
            f"Summary: {a.get('summary', '')}"
            f"{_opt('decisions', 'Decisions: ')}"
            f"{_opt('next_steps', 'Next Steps: ')}"
            f"{_opt('project_id', 'Project: ')}\n\n"
            'Use add_memory with memory_type="conversation" to store this summary.'
        ),
        "entity_context": (
            f"Explore the knowledge graph for: {a.get('entity_name', '')}"
            f"{_opt('depth', 'Depth: ')}\n\n"
            "Steps:\n"
            "1. Use query_graph to find the entity and its relationships\n"
            "2. Search for memories mentioning this entity\n"
            "3. Provide a comprehensive overview of what's known about this entity"
        ),
    }
    return templates.get(name, f"Unknown prompt: {name}")


# ---------------------------------------------------------------------------
# Resource URI parser
# ---------------------------------------------------------------------------

_URI_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("stats", re.compile(r"^memory://stats$")),
    ("health", re.compile(r"^memory://health$")),
    ("tiers", re.compile(r"^memory://tiers$")),
    ("config", re.compile(r"^memory://config$")),
    ("recent", re.compile(r"^memory://recent/(?P<limit>\d+)$")),
    ("project", re.compile(r"^memory://project/(?P<projectId>[^/]+)$")),
    (
        "projectRecent",
        re.compile(r"^memory://project/(?P<projectId>[^/]+)/recent/(?P<limit>\d+)$"),
    ),
    ("user", re.compile(r"^memory://user/(?P<userId>[^/]+)$")),
    ("tier", re.compile(r"^memory://tier/(?P<tier>\d+)$")),
    ("type", re.compile(r"^memory://type/(?P<memoryType>[^/]+)$")),
    ("search", re.compile(r"^memory://search/(?P<query>.+)$")),
    ("entity", re.compile(r"^memory://entity/(?P<entityName>[^/]+)$")),
    ("graph", re.compile(r"^memory://graph/(?P<entityName>[^/]+)/(?P<depth>\d+)$")),
]


def _parse_resource_uri(uri: str) -> tuple[str, dict[str, str]]:
    """Parse a memory:// URI and return (resource_type, params)."""
    for resource_type, pattern in _URI_PATTERNS:
        m = pattern.match(uri)
        if m:
            return resource_type, m.groupdict()
    return "unknown", {}


async def _handle_resource(uri: str, client: MemoryMCPClient) -> str:
    """Resolve a resource URI to a JSON string by calling the appropriate tool."""
    resource_type, params = _parse_resource_uri(uri)

    if resource_type == "stats":
        result = await client.list_memories()
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "health":
        alive = await client.ping()
        return json.dumps({"status": "ok" if alive else "error", "connected": alive}, indent=2)

    if resource_type == "tiers":
        return json.dumps(_TIER_DOCUMENTATION, indent=2)

    if resource_type == "config":
        cfg = client._config
        return json.dumps(
            {
                "mcp_server_url": cfg.mcp_server_url,
                "timeout": cfg.mcp_client_timeout,
                "max_retries": cfg.mcp_client_max_retries,
                "retry_delay": cfg.mcp_client_retry_delay,
            },
            indent=2,
        )

    if resource_type == "recent":
        limit = int(params.get("limit", "10"))
        result = await client.search_memory("recent", limit=limit)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type in ("project", "projectRecent"):
        project_id = params.get("projectId", "")
        limit = int(params.get("limit", "20"))
        result = await client.search_memory("project", project_id=project_id, limit=limit)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "user":
        user_id = params.get("userId", "")
        result = await client.search_memory("user", user_id=user_id, limit=20)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "tier":
        tier = int(params.get("tier", "1"))
        result = await client.search_memory("tier", tier=tier, limit=50)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "type":
        memory_type = params.get("memoryType", "fact")
        result = await client.search_memory(memory_type, limit=50)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "search":
        query = params.get("query", "")
        result = await client.search_memory(query, limit=20)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "entity":
        entity_name = params.get("entityName", "")
        result = await client.query_graph(entity_name, depth=1)
        return json.dumps(result.model_dump(), indent=2)

    if resource_type == "graph":
        entity_name = params.get("entityName", "")
        depth = int(params.get("depth", "1"))
        result = await client.query_graph(entity_name, depth=depth)
        return json.dumps(result.model_dump(), indent=2)

    return json.dumps({"error": f"Unknown resource URI: {uri}"}, indent=2)


# ---------------------------------------------------------------------------
# Bridge main
# ---------------------------------------------------------------------------


async def main() -> None:
    """Run the stdio ↔ HTTP bridge.

    Connects to the HTTP MCP server, then starts an MCP server on stdio that
    proxies all tool calls, resources, and prompts through to the HTTP server.
    Runs until stdin closes or the process receives SIGINT/SIGTERM.
    """
    config = MCPClientConfig()
    app = Server("ai-memory-bridge")
    client = MemoryMCPClient(config)

    # ------------------------------------------------------------------
    # Tool handlers — all proxied to the HTTP server
    # ------------------------------------------------------------------

    @app.list_tools()
    async def list_tools() -> list[Tool]:
        """Return the tool list from the upstream HTTP server."""
        try:
            session = client._require_session()
            result = await session.list_tools()
            return result.tools
        except MCPConnectionError:
            logger.error("Not connected to MCP server — returning empty tool list")
            return []

    @app.call_tool()
    async def call_tool(
        name: str,
        arguments: dict[str, Any] | None,
    ) -> Sequence[TextContent | ImageContent | EmbeddedResource]:
        """Proxy a tool call to the upstream HTTP server."""
        session = client._require_session()
        result = await session.call_tool(name, arguments or {})
        return result.content

    # ------------------------------------------------------------------
    # Resource handlers
    # ------------------------------------------------------------------

    @app.list_resources()
    async def list_resources() -> list[Resource]:
        """Return all static memory:// resources."""
        return _STATIC_RESOURCES

    @app.list_resource_templates()
    async def list_resource_templates() -> list[ResourceTemplate]:
        """Return all dynamic memory:// resource templates."""
        return _RESOURCE_TEMPLATES

    @app.read_resource()
    async def read_resource(uri: str) -> str | bytes:
        """Resolve a memory:// URI to JSON content."""
        try:
            return await _handle_resource(uri, client)
        except Exception as exc:
            logger.error("Resource read failed for %s: %s", uri, exc)
            return json.dumps({"error": str(exc)}, indent=2)

    # ------------------------------------------------------------------
    # Prompt handlers
    # ------------------------------------------------------------------

    @app.list_prompts()
    async def list_prompts() -> list[Any]:
        """Return all available memory workflow prompts."""
        from mcp.types import Prompt

        return [
            Prompt(
                name=p["name"],
                description=p["description"],
                arguments=p["arguments"],
            )
            for p in _PROMPTS
        ]

    @app.get_prompt()
    async def get_prompt(name: str, arguments: dict[str, str] | None) -> GetPromptResult:
        """Render a prompt template with the given arguments."""
        args = arguments or {}
        rendered = _render_prompt(name, args)
        return GetPromptResult(
            description=next(
                (p["description"] for p in _PROMPTS if p["name"] == name),
                name,
            ),
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(type="text", text=rendered),
                )
            ],
        )

    # ------------------------------------------------------------------
    # Run
    # ------------------------------------------------------------------

    logger.info("Connecting to AI Memory MCP server at %s …", config.mcp_server_url)

    async with client:
        logger.info(
            "Bridge ready — proxying stdio MCP ↔ HTTP (%s)",
            config.mcp_server_url,
        )
        async with stdio_server() as (read_stream, write_stream):
            init_options = app.create_initialization_options()
            await app.run(
                read_stream,
                write_stream,
                init_options,
                raise_exceptions=False,
            )


if __name__ == "__main__":
    # Logging goes to stderr — stdout is reserved for the MCP JSON-RPC stream.
    logging.basicConfig(
        level=logging.WARNING,
        stream=sys.stderr,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    asyncio.run(main())
