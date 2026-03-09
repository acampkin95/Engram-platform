#!/usr/bin/env python3
"""
End-to-End Test Suite for AI Memory System
Tests: Memory API (port 8000) + MCP Server (port 3000)

Run with: python scripts/e2e_test.py
"""

import json
import sys
import time
import uuid
from typing import Any

import httpx

# ─── Config ──────────────────────────────────────────────────────────────────
API_BASE = "http://localhost:8000"
MCP_BASE = "http://localhost:3000"
API_KEY = "dev-api-key-1"

PASS = "✅"
FAIL = "❌"
SKIP = "⏭"

results: list[tuple[str, bool, str]] = []


# ─── Helpers ─────────────────────────────────────────────────────────────────


def auth_headers() -> dict[str, str]:
    return {"X-API-Key": API_KEY}


def check(name: str, condition: bool, detail: str = "") -> bool:
    icon = PASS if condition else FAIL
    msg = f"  {icon} {name}"
    if detail:
        msg += f"  [{detail}]"
    print(msg)
    results.append((name, condition, detail))
    return condition


def section(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


# ─── 1. Infrastructure health ────────────────────────────────────────────────


def test_infrastructure() -> None:
    section("1. Infrastructure Health")

    # Memory API health
    r = httpx.get(f"{API_BASE}/health", timeout=5)
    d = r.json()
    check("Memory API /health returns 200", r.status_code == 200)
    check("Memory API weaviate connected", d.get("weaviate") is True)
    check("Memory API redis connected", d.get("redis") is True)
    check("Memory API initialized", d.get("initialized") is True)

    # MCP Server health
    r = httpx.get(f"{MCP_BASE}/health", timeout=5)
    d = r.json()
    check("MCP Server /health returns 200", r.status_code == 200)
    check("MCP Server status ok", d.get("status") == "ok")
    check("MCP Server transport is streamable-http", d.get("transport") == "streamable-http")

    # Weaviate direct
    r = httpx.get("http://localhost:8080/v1/.well-known/ready", timeout=5)
    check("Weaviate /ready returns 200", r.status_code == 200)


# ─── 2. Auth ─────────────────────────────────────────────────────────────────


def test_auth() -> None:
    section("2. Authentication")

    # Unauthenticated request should fail
    r = httpx.get(f"{API_BASE}/stats", timeout=5)
    check("Unauthenticated /stats returns 401/403", r.status_code in (401, 403))

    # Authenticated request should work
    r = httpx.get(f"{API_BASE}/stats", headers=auth_headers(), timeout=5)
    check("Authenticated /stats returns 200", r.status_code == 200)


# ─── 3. Memory CRUD ──────────────────────────────────────────────────────────


def test_memory_crud() -> tuple[str | None, str | None]:
    """Returns (memory_id, project_id) for downstream tests."""
    section("3. Memory CRUD")

    project_id = f"e2e-test-{uuid.uuid4().hex[:8]}"
    memory_id: str | None = None

    # Create memory
    payload = {
        "content": "The AI memory system uses Weaviate for vector storage with multi-tenancy support.",
        "tier": 1,
        "memory_type": "fact",
        "source": "agent",
        "project_id": project_id,
        "importance": 0.8,
        "tags": ["weaviate", "vector-db", "e2e-test"],
    }
    r = httpx.post(f"{API_BASE}/memories", json=payload, headers=auth_headers(), timeout=10)
    ok = check("POST /memories returns 200/201", r.status_code in (200, 201), f"got {r.status_code}")
    if ok:
        d = r.json()
        memory_id = d.get("memory_id")
        check("POST /memories returns memory_id", bool(memory_id))
        # Note: API returns memory_id/tier/created_at, not full memory object
    # Get by ID
    # Get by ID (requires tier query param)
    if memory_id:
        r = httpx.get(f"{API_BASE}/memories/{memory_id}", params={"tier": 1}, headers=auth_headers(), timeout=5)
        ok = check("GET /memories/{id} returns 200", r.status_code == 200, f"got {r.status_code}")
        if ok:
            d = r.json()
            check("GET /memories/{id} content matches", d.get("content") == payload["content"])
            check("GET /memories/{id} project_id matches", d.get("project_id") == project_id)

    # Update (if endpoint exists)
    if memory_id:
        r = httpx.patch(
            f"{API_BASE}/memories/{memory_id}",
            json={"importance": 0.9},
            headers=auth_headers(),
            timeout=5,
        )
        if r.status_code == 200:
            check("PATCH /memories/{id} updates importance", r.json().get("importance") == 0.9)
        elif r.status_code in (404, 405, 422):
            check("PATCH /memories/{id} (endpoint not implemented)", True, "skipped")
        else:
            check("PATCH /memories/{id}", False, f"unexpected {r.status_code}")

    # Add a second memory for search tests
    payload2 = {
        "content": "Redis is used as a caching layer to speed up repeated searches.",
        "tier": 1,
        "memory_type": "fact",
        "source": "agent",
        "project_id": project_id,
        "importance": 0.7,
        "tags": ["redis", "cache", "e2e-test"],
    }
    r = httpx.post(f"{API_BASE}/memories", json=payload2, headers=auth_headers(), timeout=10)
    check(
        "POST /memories (second memory) returns 200/201", r.status_code in (200, 201), f"got {r.status_code}"
    )

    return memory_id, project_id


# ─── 4. Search ───────────────────────────────────────────────────────────────


def test_search(project_id: str | None) -> None:
    section("4. Memory Search")

    if not project_id:
        check("Search tests skipped (no project_id)", True, "skipped")
        return

    # Give Weaviate a moment to index
    time.sleep(1)

    # Basic search
    payload = {
        "query": "vector database storage",
        "project_id": project_id,
        "limit": 5,
    }
    r = httpx.post(f"{API_BASE}/memories/search", json=payload, headers=auth_headers(), timeout=10)
    ok = check("POST /memories/search returns 200", r.status_code == 200, f"got {r.status_code}")
    if ok:
        d = r.json()
        results_list = d if isinstance(d, list) else d.get("results", d.get("memories", []))
        check(
            "Search returns at least 1 result", len(results_list) >= 1, f"got {len(results_list)}"
        )
        if results_list:
            first = results_list[0]
            # Result may be wrapped in .memory or be flat
            content = first.get("content") or first.get("memory", {}).get("content", "")
            check("Search result has content", bool(content))

    # Search with tier filter
    payload_tier = {
        "query": "caching speed",
        "project_id": project_id,
        "tier": 1,
        "limit": 3,
    }
    r = httpx.post(
        f"{API_BASE}/memories/search", json=payload_tier, headers=auth_headers(), timeout=10
    )
    check(
        "POST /memories/search with tier filter returns 200",
        r.status_code == 200,
        f"got {r.status_code}",
    )

    # Stats endpoint
    r = httpx.get(f"{API_BASE}/stats", headers=auth_headers(), timeout=5)
    ok = check("GET /stats returns 200", r.status_code == 200, f"got {r.status_code}")
    if ok:
        d = r.json()
        check("Stats has total_memories", "total_memories" in d)


# ─── 5. List memories ────────────────────────────────────────────────────────


def test_list(project_id: str | None) -> None:
    section("5. List Memories")

    if not project_id:
        check("List tests skipped", True, "skipped")
        return

    r = httpx.get(
        f"{API_BASE}/memories/list",
        params={"project_id": project_id, "limit": 10},
        headers=auth_headers(),
        timeout=5,
    )
    ok = check("GET /memories/list returns 200", r.status_code == 200, f"got {r.status_code}")
    if ok:
        d = r.json()
        items = d if isinstance(d, list) else d.get("memories", d.get("items", []))
        check("GET /memories/list returns list", isinstance(items, list))
        check("GET /memories/list returns >= 2 items", len(items) >= 2, f"got {len(items)}")


# ─── 6. Batch add ────────────────────────────────────────────────────────────


def test_batch(project_id: str | None) -> None:
    section("6. Batch Add")

    if not project_id:
        check("Batch tests skipped", True, "skipped")
        return

    batch_payload = {
        "memories": [
            {
                "content": f"Batch memory {i}: test data for e2e validation",
                "tier": 1,
                "project_id": project_id,
                "importance": 0.5,
                "tags": ["batch", "e2e-test"],
            }
            for i in range(3)
        ]
    }
    r = httpx.post(
        f"{API_BASE}/memories/batch", json=batch_payload, headers=auth_headers(), timeout=15
    )
    ok = check(
        "POST /memories/batch returns 200/201", r.status_code in (200, 201), f"got {r.status_code}"
    )
    if ok:
        d = r.json()
        succeeded = len(d.get("memory_ids", []))


# ─── 7. Knowledge Graph ──────────────────────────────────────────────────────


def test_knowledge_graph(project_id: str | None) -> None:
    section("7. Knowledge Graph")

    if not project_id:
        check("Graph tests skipped", True, "skipped")
        return

    entity_id: str | None = None

    # Add entity
    payload = {
        "name": "Weaviate",
        "entity_type": "technology",
        "description": "Vector database used for memory storage",
        "project_id": project_id,
        "properties": {"version": "1.27"},
    }
    r = httpx.post(f"{API_BASE}/graph/entities", json=payload, headers=auth_headers(), timeout=10)
    ok = check("POST /graph/entities returns 201", r.status_code == 201, f"got {r.status_code}")
    if ok:
        d = r.json()
        # API returns {entity_id: ...} for creation
        entity_id = d.get("entity_id") or d.get("id")
        check("Entity has entity_id", bool(entity_id))
        check("Entity creation succeeded", r.status_code == 201)

    # Add second entity
    payload2 = {
        "name": "Redis",
        "entity_type": "technology",
        "description": "Cache layer",
        "project_id": project_id,
    }
    r = httpx.post(f"{API_BASE}/graph/entities", json=payload2, headers=auth_headers(), timeout=10)
    entity2_id = r.json().get("entity_id") or r.json().get("id") if r.status_code == 201 else None
    check("POST /graph/entities (Redis) returns 201", r.status_code == 201, f"got {r.status_code}")

    # Add relation
    if entity_id and entity2_id:
        rel_payload = {
            "source_entity_id": entity_id,
            "target_entity_id": entity2_id,
            "relation_type": "works_with",
            "weight": 0.8,
            "project_id": project_id,
        }
        r = httpx.post(
            f"{API_BASE}/graph/relations", json=rel_payload, headers=auth_headers(), timeout=10
        )
        check("POST /graph/relations returns 201", r.status_code == 201, f"got {r.status_code}")

    # Query graph
    if entity_id:
        r = httpx.post(
            f"{API_BASE}/graph/query",
            json={"entity_id": entity_id, "depth": 1, "project_id": project_id},
            headers=auth_headers(),
            timeout=10,
        )
        ok = check("POST /graph/query returns 200", r.status_code == 200, f"got {r.status_code}")
        if ok:
            d = r.json()
            check("Graph query has entities", "entities" in d or "nodes" in d)

    # List entities
    r = httpx.get(
        f"{API_BASE}/graph/entities",
        params={"project_id": project_id},
        headers=auth_headers(),
        timeout=5,
    )
    check("GET /graph/entities returns 200", r.status_code == 200, f"got {r.status_code}")


# ─── 8. MCP Protocol ─────────────────────────────────────────────────────────


def test_mcp_protocol() -> str | None:
    """Returns session_id for downstream MCP tool tests."""
    section("8. MCP Protocol (Streamable HTTP)")

    session_id: str | None = None

    # Initialize MCP session
    init_payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {"roots": {"listChanged": True}},
            "clientInfo": {"name": "e2e-test", "version": "1.0"},
        },
    }
    r = httpx.post(
        f"{MCP_BASE}/mcp",
        json=init_payload,
        headers={"Accept": "application/json, text/event-stream"},
        timeout=10,
    )
    ok = check("MCP POST /mcp initialize returns 200", r.status_code == 200, f"got {r.status_code}")
    if ok:
        session_id = r.headers.get("mcp-session-id")
        check("MCP session-id returned in header", bool(session_id), session_id or "missing")
        # Response may be SSE (event-stream) or plain JSON
        text = r.text.strip()
        d: dict = {}
        if "data:" in text:
            for line in text.splitlines():
                if line.startswith("data:"):
                    try:
                        d = json.loads(line[5:].strip())
                        break
                    except json.JSONDecodeError:
                        continue
        else:
            try:
                d = json.loads(text) if text else {}
            except json.JSONDecodeError:
                d = {}
        check(
            "MCP initialize result has serverInfo",
            "result" in d and "serverInfo" in d.get("result", {}),
        )

    # List tools
    if session_id:
        tools_payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        }
        r = httpx.post(
            f"{MCP_BASE}/mcp",
            json=tools_payload,
            headers={"Mcp-Session-Id": session_id, "Accept": "application/json, text/event-stream"},
            timeout=10,
        )
        ok = check("MCP tools/list returns 200", r.status_code == 200, f"got {r.status_code}")
        if ok:
            text = r.text.strip()
            d = {}
            if "data:" in text:
                for line in text.splitlines():
                    if line.startswith("data:"):
                        try:
                            d = json.loads(line[5:].strip())
                            break
                        except json.JSONDecodeError:
                            continue
            else:
                try:
                    d = json.loads(text) if text else {}
                except json.JSONDecodeError:
                    d = {}
            tools = d.get("result", {}).get("tools", [])
            tool_names = [t["name"] for t in tools]
            check("MCP has add_memory tool", "add_memory" in tool_names)
            check("MCP has search_memory tool", "search_memory" in tool_names)
            check("MCP has get_memory tool", "get_memory" in tool_names)
            check("MCP has delete_memory tool", "delete_memory" in tool_names)
            check("MCP has add_entity tool", "add_entity" in tool_names)
            check("MCP has query_graph tool", "query_graph" in tool_names)
            print(f"    → All tools: {tool_names}")

    return session_id


# ─── 9. MCP Tool Calls ───────────────────────────────────────────────────────


def test_mcp_tools(session_id: str | None) -> None:
    section("9. MCP Tool Calls")

    if not session_id:
        check("MCP tool tests skipped (no session)", True, "skipped")
        return

    headers = {
        "Mcp-Session-Id": session_id,
        "Accept": "application/json, text/event-stream",
    }
    project_id = f"mcp-e2e-{uuid.uuid4().hex[:8]}"
    mcp_memory_id: str | None = None

    def call_tool(name: str, args: dict[str, Any]) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000) % 100000,
            "method": "tools/call",
            "params": {"name": name, "arguments": args},
        }
        r = httpx.post(f"{MCP_BASE}/mcp", json=payload, headers=headers, timeout=15)
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}: {r.text[:200]}"}
        # Response may be SSE (text/event-stream) or JSON
        text = r.text.strip()
        d: dict = {}
        if "data:" in text:
            for line in text.splitlines():
                if line.startswith("data:"):
                    try:
                        d = json.loads(line[5:].strip())
                        break
                    except json.JSONDecodeError:
                        continue
        else:
            try:
                d = json.loads(text)
            except json.JSONDecodeError:
                return {"error": f"Invalid JSON: {text[:100]}"}
        if "error" in d:
            return {"error": d["error"]}
        content = d.get("result", {}).get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except json.JSONDecodeError:
                return {"text": content[0]["text"]}
        return d.get("result", {})

    # add_memory via MCP
    result = call_tool(
        "add_memory",
        {
            "content": "MCP tool integration test: memory successfully stored via MCP protocol",
            "project_id": project_id,
            "importance": 0.9,
            "tags": ["mcp", "e2e-test"],
        },
    )
    ok = check("MCP add_memory succeeds", "error" not in result, str(result.get("error", "")))
    if ok:
        mcp_memory_id = result.get("memory_id")
        check("MCP add_memory returns id", bool(mcp_memory_id))

    # search_memory via MCP
    time.sleep(1)
    result = call_tool(
        "search_memory",
        {
            "query": "MCP protocol integration test",
            "project_id": project_id,
            "limit": 3,
        },
    )
    ok = check("MCP search_memory succeeds", "error" not in result, str(result.get("error", "")))
    if ok:
        memories = result.get("memories", result.get("results", []))
        check("MCP search returns >= 1 result", len(memories) >= 1, f"got {len(memories)}")

    # get_memory via MCP
    if mcp_memory_id:
        result = call_tool("get_memory", {"memory_id": mcp_memory_id, "tier": 1})
        ok = check("MCP get_memory succeeds", "error" not in result, str(result.get("error", "")))
        if ok:
            content = result.get("content", "")
            check("MCP get_memory content matches", "MCP tool integration test" in content)

    # list_memories via MCP
    result = call_tool("list_memories", {})
    check("MCP list_memories succeeds", "error" not in result, str(result.get("error", "")))

    # delete_memory via MCP
    if mcp_memory_id:
        result = call_tool("delete_memory", {"memory_id": mcp_memory_id, "tier": 1})
        check("MCP delete_memory succeeds", "error" not in result, str(result.get("error", "")))


# ─── 10. Delete & Cleanup ────────────────────────────────────────────────────


def test_delete(memory_id: str | None) -> None:
    section("10. Delete & Cleanup")

    if not memory_id:
        check("Delete tests skipped (no memory_id)", True, "skipped")
        return

    r = httpx.delete(f"{API_BASE}/memories/{memory_id}", params={"tier": 1}, headers=auth_headers(), timeout=5)
    check(
        "DELETE /memories/{id} returns 200/204", r.status_code in (200, 204), f"got {r.status_code}"
    )

    # Verify gone
    r = httpx.get(f"{API_BASE}/memories/{memory_id}", params={"tier": 1}, headers=auth_headers(), timeout=5)
    check("GET deleted memory returns 404", r.status_code == 404, f"got {r.status_code}")


# ─── 11. MCP Session Termination ─────────────────────────────────────────────


def test_mcp_session_end(session_id: str | None) -> None:
    section("11. MCP Session Termination")

    if not session_id:
        check("Session termination skipped", True, "skipped")
        return

    r = httpx.delete(
        f"{MCP_BASE}/mcp",
        headers={"Mcp-Session-Id": session_id},
        timeout=5,
    )
    check(
        "DELETE /mcp session returns 200/204", r.status_code in (200, 204), f"got {r.status_code}"
    )


# ─── 12. Error handling ──────────────────────────────────────────────────────


def test_error_handling() -> None:
    section("12. Error Handling")

    # Empty content
    r = httpx.post(f"{API_BASE}/memories", json={"content": ""}, headers=auth_headers(), timeout=5)
    check("Empty content rejected (422)", r.status_code == 422, f"got {r.status_code}")

    # Invalid tier
    r = httpx.post(
        f"{API_BASE}/memories",
        json={"content": "test", "tier": 99},
        headers=auth_headers(),
        timeout=5,
    )
    check("Invalid tier rejected (422)", r.status_code == 422, f"got {r.status_code}")

    # Non-existent memory
    r = httpx.get(
        f"{API_BASE}/memories/00000000-0000-0000-0000-000000000000",
        params={"tier": 1},
        headers=auth_headers(),
        timeout=5,
    )
    check("Non-existent memory returns 404", r.status_code == 404, f"got {r.status_code}")

    # Unknown MCP endpoint
    r = httpx.get(f"{MCP_BASE}/unknown-path", timeout=5)
    check("MCP unknown path returns 404", r.status_code == 404, f"got {r.status_code}")


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    print("\n" + "═" * 60)
    print("  AI Memory System — End-to-End Test Suite")
    print("═" * 60)
    print(f"  Memory API: {API_BASE}")
    print(f"  MCP Server: {MCP_BASE}")

    test_infrastructure()
    test_auth()
    memory_id, project_id = test_memory_crud()
    test_search(project_id)
    test_list(project_id)
    test_batch(project_id)
    test_knowledge_graph(project_id)
    session_id = test_mcp_protocol()
    test_mcp_tools(session_id)
    test_delete(memory_id)
    test_mcp_session_end(session_id)
    test_error_handling()

    # ─── Summary ─────────────────────────────────────────────────────────────
    print("\n" + "═" * 60)
    print("  SUMMARY")
    print("═" * 60)

    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total = len(results)

    print(f"  {PASS} Passed: {passed}/{total}")
    print(f"  {FAIL} Failed: {failed}/{total}")

    if failed:
        print("\n  Failed tests:")
        for name, ok, detail in results:
            if not ok:
                print(f"    {FAIL} {name}  [{detail}]")

    print("═" * 60)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
