import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import { handleEntityTool } from "../dist/tools/entity-tools.js";

const ENTITY_UUID = "123e4567-e89b-12d3-a456-426614174000";
const SOURCE_UUID = "223e4567-e89b-12d3-a456-426614174000";
const TARGET_UUID = "323e4567-e89b-12d3-a456-426614174000";

function createMockClient() {
	return {
		addEntity: mock.fn(async () => ({ entity_id: ENTITY_UUID })),
		addRelation: mock.fn(async () => ({ relation_id: "rel-123" })),
		findEntityByName: mock.fn(async (name: string) => {
			if (name === "Unknown Entity") return null;
			if (name === "Source Entity") return { entity_id: SOURCE_UUID, name };
			if (name === "Target Entity") return { entity_id: TARGET_UUID, name };
			return { entity_id: ENTITY_UUID, name };
		}),
		queryGraph: mock.fn(async () => ({
			root_entity_id: ENTITY_UUID,
			entities: [
				{ entity_id: ENTITY_UUID, name: "Test Entity", entity_type: "person", tenant_id: "t1", aliases: [], created_at: "2024-01-01" },
			],
			relations: [],
			depth: 1,
		})),
	} as unknown as Parameters<typeof handleEntityTool>[2];
}

describe("handleEntityTool", () => {
	let mockClient: ReturnType<typeof createMockClient>;

	beforeEach(() => {
		mockClient = createMockClient();
	});

	describe("add_entity", () => {
		it("adds entity and returns formatted response", async () => {
			const result = await handleEntityTool("add_entity", {
				name: "Test Entity",
				entity_type: "person",
				description: "A test entity",
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			assert.equal(result?.content[0].type, "text");
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, true);
			assert.equal(parsed.entity_id, ENTITY_UUID);
			assert.ok(parsed.message.includes("Test Entity"));
		});

		it("requires name field", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("add_entity", {
					entity_type: "person",
				}, mockClient);
			});
		});

		it("requires entity_type field", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("add_entity", {
					name: "Test",
				}, mockClient);
			});
		});

		it("accepts optional aliases array", async () => {
			const result = await handleEntityTool("add_entity", {
				name: "Test Entity",
				entity_type: "person",
				aliases: ["Alias 1", "Alias 2"],
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, true);
		});
	});

	describe("add_relation", () => {
		it("adds relation between two entities", async () => {
			const result = await handleEntityTool("add_relation", {
				source_entity: "Source Entity",
				target_entity: "Target Entity",
				relation_type: "knows",
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, true);
			assert.equal(parsed.relation_id, "rel-123");
			assert.ok(parsed.message.includes("knows"));
		});

		it("fails when source entity not found", async () => {
			const result = await handleEntityTool("add_relation", {
				source_entity: "Unknown Entity",
				target_entity: "Target Entity",
				relation_type: "knows",
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, false);
			assert.ok(parsed.error.includes("Source entity"));
		});

		it("fails when target entity not found", async () => {
			const result = await handleEntityTool("add_relation", {
				source_entity: "Source Entity",
				target_entity: "Unknown Entity",
				relation_type: "knows",
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, false);
			assert.ok(parsed.error.includes("Target entity"));
		});

		it("requires source_entity field", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("add_relation", {
					target_entity: "Target",
					relation_type: "knows",
				}, mockClient);
			});
		});

		it("requires target_entity field", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("add_relation", {
					source_entity: "Source",
					relation_type: "knows",
				}, mockClient);
			});
		});

		it("requires relation_type field", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("add_relation", {
					source_entity: "Source",
					target_entity: "Target",
				}, mockClient);
			});
		});

		it("accepts optional weight parameter", async () => {
			const result = await handleEntityTool("add_relation", {
				source_entity: "Source Entity",
				target_entity: "Target Entity",
				relation_type: "knows",
				weight: 0.8,
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, true);
		});
	});

	describe("query_graph", () => {
		it("queries graph from entity and returns results", async () => {
			const result = await handleEntityTool("query_graph", {
				entity_name: "Test Entity",
				depth: 2,
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.root_entity, "Test Entity");
			assert.ok(Array.isArray(parsed.entities));
			assert.ok(Array.isArray(parsed.relations));
			assert.ok(typeof parsed.depth === "number");
		});

		it("fails when entity not found", async () => {
			const result = await handleEntityTool("query_graph", {
				entity_name: "Unknown Entity",
				depth: 1,
				tenant_id: "t1",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result!.content[0].text);
			assert.equal(parsed.success, false);
			assert.ok(parsed.error.includes("not found"));
		});

		it("requires entity_name field", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("query_graph", {
					depth: 1,
				}, mockClient);
			});
		});

		it("validates depth is positive", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("query_graph", {
					entity_name: "Test",
					depth: 0,
				}, mockClient);
			});
		});

		it("validates depth is not too large", async () => {
			await assert.rejects(async () => {
				await handleEntityTool("query_graph", {
					entity_name: "Test",
					depth: 10,
				}, mockClient);
			});
		});
	});

	describe("unknown tool", () => {
		it("returns null for unknown tool name", async () => {
			const result = await handleEntityTool("unknown_tool", {}, mockClient);
			assert.equal(result, null);
		});
	});
});
