import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { MemoryAPIClient } from "../dist/client.js";

// Store original fetch
const originalFetch = global.fetch;

// Helper to create mock responses
function mockResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("MemoryAPIClient", () => {
	let client: MemoryAPIClient;
	let fetchCalls: Array<{ url: string; options: RequestInit }> = [];

	beforeEach(() => {
		fetchCalls = [];
		// @ts-expect-error - mocking fetch
		global.fetch = async (url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return mockResponse({ success: true });
		};
	});

	afterEach(() => {
		global.fetch = originalFetch;
		fetchCalls = [];
	});

	describe("constructor", () => {
		it("creates client with baseUrl", () => {
			const c = new MemoryAPIClient("http://localhost:8000");
			assert.ok(c);
		});

		it("creates client with trailing slash in baseUrl", () => {
			const c = new MemoryAPIClient("http://localhost:8000/");
			assert.ok(c);
		});

		it("creates client with auth token from env", () => {
			const originalKey = process.env.AI_MEMORY_API_KEY;
			process.env.AI_MEMORY_API_KEY = "test-token";
			const c = new MemoryAPIClient("http://localhost:8000");
			assert.ok(c);
			if (originalKey === undefined) {
				process.env.AI_MEMORY_API_KEY = undefined;
			} else {
				process.env.AI_MEMORY_API_KEY = originalKey;
			}
		});
	});

	describe("addMemory", () => {
		it("calls POST /memories with correct body", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ memory_id: "mem-123" }, 201);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.addMemory({
				content: "test content",
				memory_type: "episodic",
				tier: 1,
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.memory_id, "mem-123");
			assert.strictEqual(fetchCalls.length, 1);
			assert.ok(fetchCalls[0].url.includes("/memories"));
		});
	});

	describe("searchMemories", () => {
		it("calls POST /memories/search with query", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ results: [], query: "test", total: 0 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.searchMemories({
				query: "test query",
				tier: 1,
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.results.length, 0);
			assert.strictEqual(fetchCalls.length, 1);
		});
	});

	describe("getMemory", () => {
		it("calls GET /memories/:id and returns memory", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ memory_id: "mem-123", content: "test" });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getMemory("mem-123", 1, "tenant-1");

			assert.strictEqual(result?.memory_id, "mem-123");
			assert.strictEqual(fetchCalls.length, 1);
		});

		it("returns null for 404", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async () => {
				return new Response(null, { status: 404 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getMemory("nonexistent", 1, "tenant-1");

			assert.strictEqual(result, null);
		});
	});

	describe("deleteMemory", () => {
		it("calls DELETE /memories/:id", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return new Response(null, { status: 204 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.deleteMemory("mem-123", 1, "tenant-1");

			assert.strictEqual(result, true);
			assert.strictEqual(fetchCalls.length, 1);
		});
	});

	describe("getStats", () => {
		it("calls GET /stats and returns statistics", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ total_memories: 100, by_tier: {} });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getStats("tenant-1");

			assert.strictEqual(result.total_memories, 100);
		});
	});

	describe("healthCheck", () => {
		it("calls GET /health and returns status", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ status: "healthy" });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.healthCheck();

			assert.strictEqual(result.status, "healthy");
		});
	});

	describe("batchAddMemories", () => {
		it("calls POST /memories/batch with array", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ created: 2, memory_ids: ["id1", "id2"] }, 201);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.batchAddMemories({
				memories: [
					{ content: "m1", memory_type: "episodic", tier: 1, tenant_id: "t1" },
					{ content: "m2", memory_type: "semantic", tier: 1, tenant_id: "t1" },
				],
			});

			assert.strictEqual(result.created, 2);
		});
	});

	describe("buildContext", () => {
		it("calls POST /context/build", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ context: "built context" });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.buildContext({
				query: "context query",
				tenant_id: "tenant-1",
			});

			assert.ok(result);
		});
	});

	describe("ragQuery", () => {
		it("calls POST /rag/query", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ answer: "response", sources: [] });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.ragQuery({ query: "rag query" });

			assert.ok(result);
		});
	});

	describe("consolidateMemories", () => {
		it("calls POST /memories/consolidate", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ consolidated: 5 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.consolidateMemories({
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.consolidated, 5);
		});
	});

	describe("cleanupExpired", () => {
		it("calls POST /memories/cleanup", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ removed: 10 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.cleanupExpired({ tenant_id: "tenant-1" });

			assert.strictEqual(result.removed, 10);
		});
	});

	describe("runDecay", () => {
		it("calls POST /memories/decay", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ processed: 50 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.runDecay({ tenant_id: "tenant-1" });

			assert.strictEqual(result.processed, 50);
		});
	});

	describe("exportMemories", () => {
		it("calls POST /memories/export", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ data: [], count: 0 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.exportMemories({ tenant_id: "tenant-1" });

			assert.strictEqual(result.count, 0);
		});
	});

	describe("bulkDeleteMemories", () => {
		it("calls POST /memories/bulk-delete", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ deleted: 3 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.bulkDeleteMemories({
				memory_ids: ["m1", "m2", "m3"],
			});

			assert.strictEqual(result.deleted, 3);
		});
	});

	describe("triggerConfidenceMaintenance", () => {
		it("calls POST /maintenance/confidence", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ processed: 100, contradictions_found: 5 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.triggerConfidenceMaintenance({
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.processed, 100);
			assert.strictEqual(result.contradictions_found, 5);
		});
	});

	describe("getMemoryGrowthAnalytics", () => {
		it("calls GET /analytics/growth", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ growth: [] });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getMemoryGrowthAnalytics("tenant-1");

			assert.ok(result);
		});
	});

	describe("getActivityTimeline", () => {
		it("calls GET /analytics/timeline", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ timeline: [] });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getActivityTimeline("tenant-1");

			assert.ok(result);
		});
	});

	describe("getSearchStats", () => {
		it("calls GET /analytics/search", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ searches: 0 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getSearchStats("tenant-1");

			assert.ok(result);
		});
	});

	describe("getKnowledgeGraphStats", () => {
		it("calls GET /analytics/graph", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ entities: 0 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getKnowledgeGraphStats("tenant-1");

			assert.ok(result);
		});
	});

	describe("getSystemMetrics", () => {
		it("calls GET /analytics/system", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ cpu: 0, memory: 0 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getSystemMetrics();

			assert.ok(result);
		});
	});

	describe("createTenant", () => {
		it("calls POST /tenants", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse(
					{ tenant_id: "new-tenant", name: "Test Tenant" },
					201,
				);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.createTenant({
				tenant_id: "new-tenant",
				name: "Test Tenant",
			});

			assert.strictEqual(result.tenant_id, "new-tenant");
		});
	});

	describe("listTenants", () => {
		it("calls GET /tenants", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ tenants: [] });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.listTenants();

			assert.strictEqual(result.tenants.length, 0);
		});
	});

	describe("deleteTenant", () => {
		it("calls DELETE /tenants/:id", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ success: true });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.deleteTenant("tenant-1");

			assert.strictEqual(result.success, true);
		});
	});

	describe("addEntity", () => {
		it("calls POST /entities", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ entity_id: "ent-1", name: "Entity" }, 201);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.addEntity({
				name: "Entity",
				entity_type: "person",
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.entity_id, "ent-1");
		});
	});

	describe("addRelation", () => {
		it("calls POST /relations", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ relation_id: "rel-1", from: "a", to: "b" }, 201);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.addRelation({
				from_entity_id: "a",
				to_entity_id: "b",
				relation_type: "knows",
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.relation_id, "rel-1");
		});
	});

	describe("queryGraph", () => {
		it("calls POST /graph/query", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ nodes: [], edges: [] });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.queryGraph({
				query: "test",
				tenant_id: "tenant-1",
			});

			assert.strictEqual(result.nodes.length, 0);
		});
	});

	describe("getEntity", () => {
		it("calls GET /entities/:id", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ entity_id: "ent-1", name: "Entity" });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getEntity("ent-1", "tenant-1");

			assert.strictEqual(result?.entity_id, "ent-1");
		});

		it("returns null for 404", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async () => {
				return new Response(null, { status: 404 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.getEntity("nonexistent", "tenant-1");

			assert.strictEqual(result, null);
		});
	});

	describe("deleteEntity", () => {
		it("calls DELETE /entities/:id", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return new Response(null, { status: 204 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.deleteEntity("ent-1", "tenant-1");

			assert.strictEqual(result, true);
		});
	});

	describe("findEntityByName", () => {
		it("calls GET /entities/by-name", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ entity_id: "ent-1", name: "Entity" });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.findEntityByName(
				"Entity",
				"person",
				"tenant-1",
			);

			assert.strictEqual(result?.name, "Entity");
		});

		it("returns null for 404", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async () => {
				return new Response(null, { status: 404 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.findEntityByName(
				"Nonexistent",
				"person",
				"tenant-1",
			);

			assert.strictEqual(result, null);
		});
	});

	describe("createMatter", () => {
		it("calls POST /matters", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ matter_id: "mat-1", name: "Test Matter" }, 201);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.createMatter({
				name: "Test Matter",
				description: "A test matter",
			});

			assert.strictEqual(result.matter_id, "mat-1");
		});
	});

	describe("ingestDocument", () => {
		it("calls POST /documents/ingest", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ document_id: "doc-1", chunks: 5 }, 201);
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.ingestDocument({
				content: "document content",
				matter_id: "mat-1",
			});

			assert.strictEqual(result.document_id, "doc-1");
		});
	});

	describe("searchMatter", () => {
		it("calls POST /matters/search", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async (url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return mockResponse({ results: [], total: 0 });
			};

			client = new MemoryAPIClient("http://localhost:8000");
			const result = await client.searchMatter({
				query: "search query",
				matter_id: "mat-1",
			});

			assert.strictEqual(result.total, 0);
		});
	});

	describe("error handling", () => {
		it("throws on network error", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async () => {
				throw new Error("Network error");
			};

			client = new MemoryAPIClient("http://localhost:8000");

			await assert.rejects(async () => await client.healthCheck(), Error);
		});

		it("throws on 500 error", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async () => {
				return mockResponse({ error: "Internal error" }, 500);
			};

			client = new MemoryAPIClient("http://localhost:8000");

			await assert.rejects(async () => await client.healthCheck());
		});

		it("throws on 400 error with message", async () => {
			// @ts-expect-error - mocking fetch
			global.fetch = async () => {
				return mockResponse({ detail: "Bad request" }, 400);
			};

			client = new MemoryAPIClient("http://localhost:8000");

			await assert.rejects(
				async () =>
					await client.addMemory({
						content: "",
						memory_type: "episodic",
						tier: 1,
						tenant_id: "tenant-1",
					}),
			);
		});
	});
});
