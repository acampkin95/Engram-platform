import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import type { MemoryAPIClient } from "../dist/client.js";
import { handleMemoryTool } from "../dist/tools/memory-tools.js";

const createMockClient = () => ({
	addMemory: mock.fn(async () => ({ id: "mem-1" })),
	searchMemories: mock.fn(async () => ({ results: [], total: 0 })),
	getMemory: mock.fn(async () => ({ id: "mem-1", content: "test" })),
	deleteMemory: mock.fn(async () => true),
	listMemories: mock.fn(async () => ({ memories: [], total: 0 })),
	getStats: mock.fn(async () => ({
		total: 10,
		tier1_count: 5,
		tier2_count: 3,
		tier3_count: 2,
		by_type: { fact: 5, procedure: 3, preference: 2 },
		avg_importance: 0.75,
	})),
	batchAddMemories: mock.fn(async () => ({
		memory_ids: ["mem-1"],
		failed: 0,
		total: 1,
	})),
	consolidateMemories: mock.fn(async () => ({ consolidated: 0 })),
	runDecay: mock.fn(async () => ({ decayed: 0 })),
	cleanupExpired: mock.fn(async () => ({ cleaned: 0 })),
	buildContext: mock.fn(async () => ({ context: "" })),
	ragQuery: mock.fn(async () => ({ answer: "" })),
	exportMemories: mock.fn(async () => ({ memories: [] })),
	bulkDeleteMemories: mock.fn(async () => ({ deleted: 0 })),
	triggerConfidenceMaintenance: mock.fn(async () => ({ confidence: 0.5 })),
	getAnalytics: mock.fn(async () => ({ total: 0 })),
	getSystemMetrics: mock.fn(async () => ({ uptime: 0 })),
	createTenant: mock.fn(async () => ({ tenant_id: "t1" })),
	listTenants: mock.fn(async () => ({ tenants: [] })),
	deleteTenant: mock.fn(async () => ({ success: true })),
	getMemoryGrowthAnalytics: mock.fn(async () => ({ growth: [] })),
	getActivityTimeline: mock.fn(async () => ({ timeline: [] })),
	getSearchStats: mock.fn(async () => ({ stats: [] })),
	getKnowledgeGraphStats: mock.fn(async () => ({ nodes: 0, edges: 0 })),
} as unknown as MemoryAPIClient);

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleMemoryTool", () => {
	let mockClient: ReturnType<typeof createMockClient>;

	beforeEach(() => {
		mockClient = createMockClient();
	});

	describe("basic operations", () => {
		it("add_memory works", async () => {
			const result = await handleMemoryTool("add_memory", {
				content: "test content",
				tier: 1,
				importance: 0.5,
			}, mockClient);
			assert.ok(result);
		});

		it("search_memory works", async () => {
			const result = await handleMemoryTool("search_memory", { query: "test" }, mockClient);
			assert.ok(result);
		});

		it("get_memory works", async () => {
			const result = await handleMemoryTool("get_memory", {
				memory_id: UUID,
				tier: 1,
			}, mockClient);
			assert.ok(result);
		});

		it("delete_memory works", async () => {
			const result = await handleMemoryTool("delete_memory", {
				memory_id: UUID,
				tier: 1,
			}, mockClient);
			assert.ok(result);
		});

		it("list_memories works", async () => {
			const result = await handleMemoryTool("list_memories", {}, mockClient);
			assert.ok(result);
		});

		it("batch_add_memories works", async () => {
			const result = await handleMemoryTool("batch_add_memories", {
				memories: [{ content: "test", tier: 1, importance: 0.5 }],
			}, mockClient);
			assert.ok(result);
		});
	});

	describe("maintenance operations", () => {
		it("consolidate_memories works", async () => {
			const result = await handleMemoryTool("consolidate_memories", {}, mockClient);
			assert.ok(result);
		});

		it("run_decay works", async () => {
			const result = await handleMemoryTool("run_decay", {}, mockClient);
			assert.ok(result);
		});

		it("cleanup_expired works", async () => {
			const result = await handleMemoryTool("cleanup_expired", {}, mockClient);
			assert.ok(result);
		});
	});

	describe("query operations", () => {
		it("build_context works", async () => {
			const result = await handleMemoryTool("build_context", { query: "test" }, mockClient);
			assert.ok(result);
		});

		it("rag_query works", async () => {
			const result = await handleMemoryTool("rag_query", { query: "test" }, mockClient);
			assert.ok(result);
		});
	});

	describe("bulk operations", () => {
		it("export_memories works", async () => {
			const result = await handleMemoryTool("export_memories", {}, mockClient);
			assert.ok(result);
		});

		it("bulk_delete_memories works", async () => {
			const result = await handleMemoryTool("bulk_delete_memories", {
				memory_ids: [UUID],
			}, mockClient);
			assert.ok(result);
		});

		it("trigger_confidence_maintenance works", async () => {
			const result = await handleMemoryTool("trigger_confidence_maintenance", {
				tenant_id: "t1",
			}, mockClient);
			assert.ok(result);
		});
	});

	describe("analytics operations", () => {
		it("get_analytics works", async () => {
			const result = await handleMemoryTool("get_analytics", {}, mockClient);
			assert.ok(result);
		});

		it("get_system_metrics works", async () => {
			const result = await handleMemoryTool("get_system_metrics", {}, mockClient);
			assert.ok(result);
		});

		it("get_memory_growth works", async () => {
			const result = await handleMemoryTool("get_memory_growth", {}, mockClient);
			assert.ok(result);
		});

		it("get_activity_timeline works", async () => {
			const result = await handleMemoryTool("get_activity_timeline", {}, mockClient);
			assert.ok(result);
		});

		it("get_search_stats works", async () => {
			const result = await handleMemoryTool("get_search_stats", {}, mockClient);
			assert.ok(result);
		});

		it("get_kg_stats works", async () => {
			const result = await handleMemoryTool("get_kg_stats", {}, mockClient);
			assert.ok(result);
		});
	});

	describe("manage_tenant", () => {
		it("create works", async () => {
			const result = await handleMemoryTool("manage_tenant", {
				action: "create",
				tenant_id: "t1",
				name: "Test",
			}, mockClient);
			assert.ok(result);
		});

		it("list works", async () => {
			const result = await handleMemoryTool("manage_tenant", { action: "list" }, mockClient);
			assert.ok(result);
		});

		it("delete works", async () => {
			const result = await handleMemoryTool("manage_tenant", {
				action: "delete",
				tenant_id: "t1",
			}, mockClient);
			assert.ok(result);
		});

		it("delete requires tenant_id", async () => {
			try {
				await handleMemoryTool("manage_tenant", { action: "delete" }, mockClient);
				assert.fail("Should have thrown");
			} catch (e) {
				assert.ok(e instanceof Error);
				assert.ok((e as Error).message.includes("tenant_id"));
			}
		});
	});

	describe("error cases", () => {
		it("get_memory returns error for not found", async () => {
			const mockClientNotFound = {
				...mockClient,
				getMemory: mock.fn(async () => null),
			} as unknown as MemoryAPIClient;
			const result = await handleMemoryTool("get_memory", {
				memory_id: UUID,
				tier: 1,
			}, mockClientNotFound);
			assert.ok(result);
			const text = result!.content[0];
			assert.ok("text" in text);
			if ("text" in text) {
				assert.ok(text.text.includes("error") || text.text.includes("not found"));
			}
		});
	});

	describe("unknown tool", () => {
		it("returns null for unknown tool", async () => {
			const result = await handleMemoryTool("unknown_tool", {}, mockClient);
			assert.strictEqual(result, null);
		});
	});
});
