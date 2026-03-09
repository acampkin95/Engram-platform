"""
Async MCP client for the AI Memory System.

Provides a typed Python interface to all 13 memory and knowledge graph tools
exposed by the AI Memory MCP server (Streamable HTTP transport).

Usage (recommended — context manager):
    from memory_system.mcp import MemoryMCPClient

    async with MemoryMCPClient() as client:
        result = await client.add_memory("User prefers dark mode", tier=2)
        print(result.memory_id)

        hits = await client.search_memory("user preferences", limit=5)
        for m in hits.results:
            print(m.content, m.score)

        ctx = await client.build_context("How should I format responses?")
        print(ctx.context)

Usage (manual lifecycle — for long-running services):
    client = MemoryMCPClient()
    await client.connect()
    try:
        await client.add_memory("...")
    finally:
        await client.disconnect()

Configuration via environment variables (or .env file):
    MCP_SERVER_URL          http://localhost:3000/mcp
    MCP_AUTH_TOKEN          bearer token (optional)
    AI_MEMORY_API_KEY       X-API-Key header value (optional)
    MCP_CLIENT_TIMEOUT      seconds (default 30)
    MCP_CLIENT_MAX_RETRIES  attempts (default 3)
    MCP_CLIENT_RETRY_DELAY  initial delay in seconds (default 1.0)
"""

from __future__ import annotations

import json
import logging
from contextlib import AsyncExitStack
from typing import Any

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import MCPClientConfig
from .models import (
    AddEntityResult,
    AddMemoryResult,
    AddRelationResult,
    BatchAddMemoriesResult,
    BuildContextResult,
    CleanupExpiredResult,
    ConsolidateMemoriesResult,
    DeleteMemoryResult,
    GetMemoryResult,
    ListMemoriesResult,
    QueryGraphResult,
    RagQueryResult,
    SearchMemoryResult,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class MCPToolError(Exception):
    """Raised when an MCP tool call returns an error response."""


class MCPConnectionError(Exception):
    """Raised when the MCP client is not connected to the server."""


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class MemoryMCPClient:
    """Async MCP client for the AI Memory System.

    Thread-safe for use within a single asyncio event loop. Do not share
    instances across threads or event loops.

    Example::

        async with MemoryMCPClient() as client:
            await client.add_memory("Prefer dark mode", tier=2)
            results = await client.search_memory("preferences")
    """

    def __init__(self, config: MCPClientConfig | None = None) -> None:
        self._config = config or MCPClientConfig()
        self._session: ClientSession | None = None
        self._exit_stack: AsyncExitStack | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @property
    def is_connected(self) -> bool:
        """True if the client has an active MCP session."""
        return self._session is not None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def connect(self) -> None:
        """Connect to the MCP server and initialize the session.

        Idempotent — calling connect() on an already-connected client is a no-op.
        Uses tenacity retry with exponential back-off (2s → 10s, 3 attempts).

        Raises:
            httpx.ConnectError: If the server is unreachable after all retries.
            Exception: If MCP initialization fails.
        """
        if self._session is not None:
            return

        headers: dict[str, str] = {}
        if self._config.ai_memory_api_key:
            headers["X-API-Key"] = self._config.ai_memory_api_key
        if self._config.mcp_auth_token:
            headers["Authorization"] = f"Bearer {self._config.mcp_auth_token}"

        http_client = httpx.AsyncClient(
            headers=headers,
            timeout=httpx.Timeout(self._config.mcp_client_timeout),
        )

        stack = AsyncExitStack()
        try:
            await stack.enter_async_context(http_client)
            read_stream, write_stream, _ = await stack.enter_async_context(
                streamable_http_client(self._config.mcp_server_url, http_client=http_client)
            )
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()
        except Exception:
            await stack.aclose()
            raise

        self._exit_stack = stack
        self._session = session
        logger.info("Connected to AI Memory MCP server at %s", self._config.mcp_server_url)

    async def disconnect(self) -> None:
        """Disconnect from the MCP server and release resources."""
        if self._exit_stack is not None:
            await self._exit_stack.aclose()
            self._exit_stack = None
            self._session = None
            logger.info("Disconnected from AI Memory MCP server")

    async def __aenter__(self) -> MemoryMCPClient:
        await self.connect()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.disconnect()

    def __repr__(self) -> str:
        status = "connected" if self.is_connected else "disconnected"
        return f"MemoryMCPClient(url={self._config.mcp_server_url!r}, status={status!r})"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _require_session(self) -> ClientSession:
        if self._session is None:
            raise MCPConnectionError(
                "Not connected to MCP server. "
                "Use 'async with MemoryMCPClient() as client:' or call connect() first."
            )
        return self._session

    async def _call(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Call an MCP tool and return the parsed JSON response dict.

        Strips None values from args before sending (avoids null fields on the wire).
        Network/timeout errors are handled by tenacity on connect(); individual
        call failures raise MCPToolError immediately (no per-call retry — the
        session is already established at this point).

        Raises:
            MCPConnectionError: If not connected.
            MCPToolError: If the tool returns an error response.
        """
        clean_args = {k: v for k, v in args.items() if v is not None}
        session = self._require_session()

        result = await session.call_tool(tool_name, clean_args)

        if result.isError:
            error_text = ""
            if result.content:
                first = result.content[0]
                if hasattr(first, "text"):
                    error_text = first.text
            raise MCPToolError(f"Tool '{tool_name}' returned error: {error_text}")

        if not result.content:
            return {}

        first = result.content[0]
        if not hasattr(first, "text"):
            raise MCPToolError(
                f"Tool '{tool_name}' returned unexpected content type: {type(first).__name__}"
            )

        return json.loads(first.text)

    # ------------------------------------------------------------------
    # Introspection / health
    # ------------------------------------------------------------------

    async def ping(self) -> bool:
        """Check connectivity to the MCP server.

        Returns:
            True if connected and the server responds to list_tools.
            False if not connected or the server is unreachable.
        """
        if not self.is_connected:
            return False
        try:
            session = self._require_session()
            await session.list_tools()
            return True
        except Exception:
            return False

    async def list_tools(self) -> list[str]:
        """Return the names of all tools exposed by the MCP server.

        Useful for introspection and validating the server version.

        Returns:
            List of tool name strings.

        Raises:
            MCPConnectionError: If not connected.
        """
        session = self._require_session()
        result = await session.list_tools()
        return [tool.name for tool in result.tools]

    # ------------------------------------------------------------------
    # Memory tools
    # ------------------------------------------------------------------

    async def add_memory(
        self,
        content: str,
        *,
        tier: int = 1,
        memory_type: str = "fact",
        project_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str = "default",
        importance: float = 0.5,
        tags: list[str] | None = None,
    ) -> AddMemoryResult:
        """Add a new memory to the system.

        Args:
            content: The text content to store.
            tier: Storage tier — 1=project-scoped, 2=user-specific, 3=global.
            memory_type: Semantic category (fact, insight, code, preference, …).
            project_id: Required for tier 1 memories.
            user_id: Optional user identifier.
            tenant_id: Multi-tenancy identifier (default: "default").
            importance: Relevance score 0–1 (default: 0.5).
            tags: Optional list of tags for categorisation.

        Returns:
            AddMemoryResult with memory_id and tier.
        """
        raw = await self._call(
            "add_memory",
            {
                "content": content,
                "tier": tier,
                "memory_type": memory_type,
                "project_id": project_id,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "importance": importance,
                "tags": tags,
            },
        )
        return AddMemoryResult.model_validate(raw)

    async def search_memory(
        self,
        query: str,
        *,
        tier: int | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str = "default",
        limit: int = 10,
    ) -> SearchMemoryResult:
        """Search memories using semantic similarity.

        Args:
            query: Natural language search query.
            tier: Optional tier filter (1/2/3).
            project_id: Optional project filter.
            user_id: Optional user filter.
            tenant_id: Tenant scope (default: "default").
            limit: Maximum results to return (1–100, default: 10).

        Returns:
            SearchMemoryResult with a list of ranked MemoryRecord objects.
        """
        raw = await self._call(
            "search_memory",
            {
                "query": query,
                "tier": tier,
                "project_id": project_id,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "limit": limit,
            },
        )
        return SearchMemoryResult.model_validate(raw)

    async def get_memory(
        self,
        memory_id: str,
        tier: int,
        *,
        tenant_id: str = "default",
    ) -> GetMemoryResult:
        """Retrieve a specific memory by ID.

        Args:
            memory_id: UUID of the memory.
            tier: The tier the memory is stored in.
            tenant_id: Tenant scope.

        Returns:
            GetMemoryResult. Check result.found to determine if the memory exists.
        """
        raw = await self._call(
            "get_memory",
            {
                "memory_id": memory_id,
                "tier": tier,
                "tenant_id": tenant_id,
            },
        )
        return GetMemoryResult.model_validate(raw)

    async def delete_memory(
        self,
        memory_id: str,
        tier: int,
        *,
        tenant_id: str = "default",
    ) -> DeleteMemoryResult:
        """Delete a memory from the system.

        Args:
            memory_id: UUID of the memory to delete.
            tier: The tier the memory is stored in.
            tenant_id: Tenant scope.

        Returns:
            DeleteMemoryResult with success flag.
        """
        raw = await self._call(
            "delete_memory",
            {
                "memory_id": memory_id,
                "tier": tier,
                "tenant_id": tenant_id,
            },
        )
        return DeleteMemoryResult.model_validate(raw)

    async def list_memories(
        self,
        *,
        tenant_id: str = "default",
    ) -> ListMemoriesResult:
        """Get statistics and overview of stored memories across all tiers.

        Returns:
            ListMemoriesResult with total counts, per-tier breakdown, and type distribution.
        """
        raw = await self._call("list_memories", {"tenant_id": tenant_id})
        return ListMemoriesResult.model_validate(raw)

    async def batch_add_memories(
        self,
        memories: list[dict[str, Any]],
    ) -> BatchAddMemoriesResult:
        """Add multiple memories in a single batch operation.

        Args:
            memories: List of memory dicts. Each dict supports the same fields
                      as add_memory (content is required; others are optional).
                      Maximum 100 memories per batch.

        Returns:
            BatchAddMemoriesResult with memory_ids list and failure count.

        Tip:
            Use AddMemoryInput for a typed alternative::

                from memory_system.mcp import AddMemoryInput
                inputs = [AddMemoryInput(content="...", tier=2)]
                result = await client.batch_add_memories(
                    [m.model_dump(exclude_none=True) for m in inputs]
                )
        """
        raw = await self._call("batch_add_memories", {"memories": memories})
        return BatchAddMemoriesResult.model_validate(raw)

    async def build_context(
        self,
        query: str,
        *,
        tier: int | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        max_tokens: int | None = None,
    ) -> BuildContextResult:
        """Build a formatted context string from relevant memories.

        Useful for assembling prompt context from stored knowledge before
        calling an LLM.

        Args:
            query: The question or topic to build context for.
            tier: Optional tier filter.
            project_id: Optional project filter.
            user_id: Optional user filter.
            session_id: Optional session scope.
            max_tokens: Token budget for the context (100–32000).

        Returns:
            BuildContextResult with context string and token_estimate.
        """
        raw = await self._call(
            "build_context",
            {
                "query": query,
                "tier": tier,
                "project_id": project_id,
                "user_id": user_id,
                "session_id": session_id,
                "max_tokens": max_tokens,
            },
        )
        return BuildContextResult.model_validate(raw)

    async def rag_query(
        self,
        query: str,
        *,
        tier: int | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> RagQueryResult:
        """Perform a RAG (Retrieval-Augmented Generation) query over memories.

        Returns a synthesis_prompt ready to pass to an LLM together with the
        retrieved context.

        Args:
            query: The question to answer using stored memories.
            tier: Optional tier filter.
            project_id: Optional project filter.
            user_id: Optional user filter.
            session_id: Optional session scope.

        Returns:
            RagQueryResult with synthesis_prompt and source context.
        """
        raw = await self._call(
            "rag_query",
            {
                "query": query,
                "tier": tier,
                "project_id": project_id,
                "user_id": user_id,
                "session_id": session_id,
            },
        )
        return RagQueryResult.model_validate(raw)

    async def consolidate_memories(
        self,
        *,
        project_id: str | None = None,
        tenant_id: str = "default",
    ) -> ConsolidateMemoriesResult:
        """Trigger memory consolidation.

        Merges and summarises related memories to reduce redundancy and improve
        retrieval quality. Should be run periodically (e.g. end of session).

        Args:
            project_id: Consolidate only memories for this project (optional).
            tenant_id: Tenant scope.

        Returns:
            ConsolidateMemoriesResult with count of processed memories.
        """
        raw = await self._call(
            "consolidate_memories",
            {
                "project_id": project_id,
                "tenant_id": tenant_id,
            },
        )
        return ConsolidateMemoriesResult.model_validate(raw)

    async def cleanup_expired(
        self,
        *,
        tenant_id: str = "default",
    ) -> CleanupExpiredResult:
        """Remove expired memories from the system.

        Args:
            tenant_id: Tenant scope.

        Returns:
            CleanupExpiredResult with count of removed memories.
        """
        raw = await self._call("cleanup_expired", {"tenant_id": tenant_id})
        return CleanupExpiredResult.model_validate(raw)

    # ------------------------------------------------------------------
    # Entity / Knowledge Graph tools
    # ------------------------------------------------------------------

    async def add_entity(
        self,
        name: str,
        entity_type: str,
        *,
        description: str | None = None,
        tenant_id: str = "default",
        aliases: list[str] | None = None,
    ) -> AddEntityResult:
        """Add an entity to the knowledge graph.

        Args:
            name: Canonical name of the entity.
            entity_type: Category (e.g. "person", "project", "concept", "tool").
            description: Optional description.
            tenant_id: Tenant scope.
            aliases: Alternative names for the entity.

        Returns:
            AddEntityResult with entity_id.
        """
        raw = await self._call(
            "add_entity",
            {
                "name": name,
                "entity_type": entity_type,
                "description": description,
                "tenant_id": tenant_id,
                "aliases": aliases,
            },
        )
        return AddEntityResult.model_validate(raw)

    async def add_relation(
        self,
        source_entity: str,
        relation_type: str,
        target_entity: str,
        *,
        weight: float = 1.0,
        tenant_id: str = "default",
    ) -> AddRelationResult:
        """Add a relationship between two entities in the knowledge graph.

        Both entities must already exist (use add_entity first).

        Args:
            source_entity: Name of the source entity.
            relation_type: Relationship type (e.g. "works_on", "depends_on", "uses").
            target_entity: Name of the target entity.
            weight: Relationship strength 0–1 (default: 1.0).
            tenant_id: Tenant scope.

        Returns:
            AddRelationResult. Check result.success for entity-not-found errors.
        """
        raw = await self._call(
            "add_relation",
            {
                "source_entity": source_entity,
                "relation_type": relation_type,
                "target_entity": target_entity,
                "weight": weight,
                "tenant_id": tenant_id,
            },
        )
        return AddRelationResult.model_validate(raw)

    async def query_graph(
        self,
        entity_name: str,
        *,
        depth: int = 1,
        tenant_id: str = "default",
    ) -> QueryGraphResult:
        """Query the knowledge graph for an entity and its relationships.

        Args:
            entity_name: Name of the root entity to query.
            depth: How many relationship hops to traverse (1–3, default: 1).
            tenant_id: Tenant scope.

        Returns:
            QueryGraphResult with entities and relations. Check result.found
            to determine if the entity exists.
        """
        raw = await self._call(
            "query_graph",
            {
                "entity_name": entity_name,
                "depth": depth,
                "tenant_id": tenant_id,
            },
        )
        return QueryGraphResult.model_validate(raw)
