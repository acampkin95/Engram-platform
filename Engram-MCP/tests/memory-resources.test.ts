import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import { handleResourceRequest } from "../dist/resources/memory-resources.js";

function createMockClient() {
	return {
		getStats: mock.fn(async () => ({
			total_memories: 100,
			tier1_count: 50,
			tier2_count: 30,
			tier3_count: 20,
			by_type: { fact: 60, event: 40 },
			avg_importance: 0.75,
		})),
		healthCheck: mock.fn(async () => ({
			status: "healthy",
			version: "1.0.0",
			uptime: 3600,
		})),
		searchMemories: mock.fn(async () => ({
			results: [
				{ memory_id: "m1", content: "Test", tier: 1, memory_type: "fact", source: "test", tenant_id: "t1", importance: 0.5, confidence: 0.9, tags: [], created_at: "2024-01-01" },
			],
			query: "test",
			total: 1,
		})),
		findEntityByName: mock.fn(async (name: string) => {
			if (name === "NotFound") return null;
			return {
				entity_id: "e1",
				name: name || "Test Entity",
				entity_type: "person",
				tenant_id: "default",
				aliases: [],
				created_at: "2024-01-01",
			};
		}),
		queryGraph: mock.fn(async () => ({
			root_entity_id: "e1",
			entities: [{ entity_id: "e1", name: "Test", entity_type: "person", tenant_id: "default", aliases: [], created_at: "2024-01-01" }],
			relations: [],
			depth: 1,
		})),
	} as unknown as Parameters<typeof handleResourceRequest>[1];
}

describe("handleResourceRequest", () => {
	let mockClient: ReturnType<typeof createMockClient>;

	beforeEach(() => {
		mockClient = createMockClient();
	});

	describe("static resources", () => {
		it("memory://stats returns memory statistics", async () => {
			const result = await handleResourceRequest("memory://stats", mockClient);
			assert.ok(result);
			assert.ok(result.contents);
			assert.equal(result.contents.length, 1);
			assert.equal(result.contents[0].mimeType, "application/json");
			const parsed = JSON.parse(result.contents[0].text);
			assert.equal(parsed.total_memories, 100);
		});

		it("memory://health returns health status", async () => {
			const result = await handleResourceRequest("memory://health", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.equal(parsed.status, "healthy");
		});

		it("memory://tiers returns tier documentation", async () => {
			const result = await handleResourceRequest("memory://tiers", mockClient);
			assert.ok(result);
			assert.ok(result.contents[0].text.length > 0);
		});

		it("memory://config returns safe configuration", async () => {
			const result = await handleResourceRequest("memory://config", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed.serverName !== undefined);
		});

		it("unknown static resource returns error", async () => {
			const result = await handleResourceRequest("memory://unknown_static", mockClient);
			const parsed = JSON.parse(result.contents[0].text);
			assert.equal(parsed.error, "Unknown resource");
		});
	});

	describe("dynamic resources", () => {
		it("memory://recent returns recent memories", async () => {
			const result = await handleResourceRequest("memory://recent/10", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed.results !== undefined);
		});

		it("memory://recent with limit parameter", async () => {
			const result = await handleResourceRequest("memory://recent/5", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://search with query parameter", async () => {
			const result = await handleResourceRequest("memory://search/test", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://tier with tier parameter", async () => {
			const result = await handleResourceRequest("memory://tier/2", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://type with memoryType parameter", async () => {
			const result = await handleResourceRequest("memory://type/fact", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://project with projectId", async () => {
			const result = await handleResourceRequest("memory://project/p1", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://projectRecent with projectId and limit", async () => {
			const result = await handleResourceRequest("memory://projectRecent/p1/5", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://user with userId", async () => {
			const result = await handleResourceRequest("memory://user/u1", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://entity with entityName", async () => {
			const result = await handleResourceRequest("memory://entity/Test", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed);
		});

		it("memory://entity returns error when entity not found", async () => {
			const result = await handleResourceRequest("memory://entity/NotFound", mockClient);
			const parsed = JSON.parse(result.contents[0].text);
			assert.equal(parsed.error, "Entity not found");
		});

		it("memory://graph with entityName and depth", async () => {
			const result = await handleResourceRequest("memory://graph/Test/2", mockClient);
			assert.ok(result);
			const parsed = JSON.parse(result.contents[0].text);
			assert.ok(parsed.root_entity_id);
		});

		it("memory://graph returns error when entity not found", async () => {
			const result = await handleResourceRequest("memory://graph/NotFound/1", mockClient);
			const parsed = JSON.parse(result.contents[0].text);
			assert.equal(parsed.error, "Entity not found");
		});

		it("unknown dynamic resource returns error", async () => {
			const result = await handleResourceRequest("memory://unknown_dynamic/val", mockClient);
			const parsed = JSON.parse(result.contents[0].text);
			assert.equal(parsed.error, "Unknown resource");
		});
	});
});
