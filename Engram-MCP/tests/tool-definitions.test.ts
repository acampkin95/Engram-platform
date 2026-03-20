import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
	ALL_TOOLS,
	ENTITY_TOOLS,
	MEMORY_TOOLS,
} from "../dist/tools/tool-definitions.js";

// ============================================
// Structural validation helpers
// ============================================

function assertValidTool(tool: Tool): void {
	assert.ok(
		typeof tool.name === "string" && tool.name.length > 0,
		`Tool name must be non-empty string, got: ${tool.name}`,
	);
	assert.ok(
		typeof tool.description === "string" && tool.description.length > 0,
		`Tool '${tool.name}' must have a non-empty description`,
	);
	assert.ok(
		tool.inputSchema !== undefined,
		`Tool '${tool.name}' must have inputSchema`,
	);
	assert.equal(
		tool.inputSchema.type,
		"object",
		`Tool '${tool.name}' inputSchema.type must be 'object'`,
	);
	assert.ok(
		tool.inputSchema.properties !== undefined,
		`Tool '${tool.name}' must have properties`,
	);
}

// ============================================
// MEMORY_TOOLS
// ============================================

describe("MEMORY_TOOLS", () => {
	it("is a non-empty array", () => {
		assert.ok(Array.isArray(MEMORY_TOOLS));
		assert.ok(MEMORY_TOOLS.length > 0);
	});

	it("each tool has valid structure", () => {
		for (const tool of MEMORY_TOOLS) {
			assertValidTool(tool);
		}
	});

	it("contains expected tool names", () => {
		const names = MEMORY_TOOLS.map((t) => t.name);
		const expectedNames = [
			"add_memory",
			"search_memory",
			"get_memory",
			"delete_memory",
			"list_memories",
			"batch_add_memories",
			"build_context",
			"rag_query",
			"consolidate_memories",
			"cleanup_expired",
		];
		for (const expected of expectedNames) {
			assert.ok(names.includes(expected), `Missing memory tool: ${expected}`);
		}
	});

	it("all tools have annotations", () => {
		for (const tool of MEMORY_TOOLS) {
			assert.ok(
				tool.annotations !== undefined,
				`Tool '${tool.name}' missing annotations`,
			);
		}
	});

	it("read-only tools are annotated correctly", () => {
		const readOnlyTools = [
			"search_memory",
			"get_memory",
			"list_memories",
			"build_context",
			"rag_query",
		];
		for (const name of readOnlyTools) {
			const tool = MEMORY_TOOLS.find((t) => t.name === name);
			assert.ok(tool !== undefined, `Tool '${name}' not found`);
			assert.equal(
				tool.annotations?.readOnlyHint,
				true,
				`Tool '${name}' should be readOnlyHint=true`,
			);
		}
	});

	it("destructive tools are annotated correctly", () => {
		const destructiveTools = [
			"delete_memory",
			"consolidate_memories",
			"cleanup_expired",
		];
		for (const name of destructiveTools) {
			const tool = MEMORY_TOOLS.find((t) => t.name === name);
			assert.ok(tool !== undefined, `Tool '${name}' not found`);
			assert.equal(
				tool.annotations?.destructiveHint,
				true,
				`Tool '${name}' should be destructiveHint=true`,
			);
		}
	});

	it("required fields are specified in inputSchema", () => {
		const addMemory = MEMORY_TOOLS.find((t) => t.name === "add_memory");
		assert.ok(addMemory !== undefined);
		assert.deepEqual(addMemory.inputSchema.required, ["content"]);

		const searchMemory = MEMORY_TOOLS.find((t) => t.name === "search_memory");
		assert.ok(searchMemory !== undefined);
		assert.deepEqual(searchMemory.inputSchema.required, ["query"]);
	});
});

// ============================================
// ENTITY_TOOLS
// ============================================

describe("ENTITY_TOOLS", () => {
	it("is a non-empty array", () => {
		assert.ok(Array.isArray(ENTITY_TOOLS));
		assert.ok(ENTITY_TOOLS.length > 0);
	});

	it("each tool has valid structure", () => {
		for (const tool of ENTITY_TOOLS) {
			assertValidTool(tool);
		}
	});

	it("contains expected tool names", () => {
		const names = ENTITY_TOOLS.map((t) => t.name);
		assert.ok(names.includes("add_entity"));
		assert.ok(names.includes("add_relation"));
		assert.ok(names.includes("query_graph"));
	});

	it("query_graph is read-only", () => {
		const queryGraph = ENTITY_TOOLS.find((t) => t.name === "query_graph");
		assert.ok(queryGraph !== undefined);
		assert.equal(queryGraph.annotations?.readOnlyHint, true);
	});
});

// ============================================
// ALL_TOOLS
// ============================================

describe("ALL_TOOLS", () => {
	it("is the union of MEMORY_TOOLS, ENTITY_TOOLS, and INVESTIGATION_TOOLS", () => {
		assert.ok(ALL_TOOLS.length >= MEMORY_TOOLS.length + ENTITY_TOOLS.length);
	});

	it("has no duplicate tool names", () => {
		const names = ALL_TOOLS.map((t) => t.name);
		const uniqueNames = new Set(names);
		assert.equal(
			names.length,
			uniqueNames.size,
			`Duplicate tool names found: ${names.filter((n, i) => names.indexOf(n) !== i)}`,
		);
	});

	it("every tool has valid structure", () => {
		for (const tool of ALL_TOOLS) {
			assertValidTool(tool);
		}
	});

	it("every tool name uses snake_case convention", () => {
		for (const tool of ALL_TOOLS) {
			assert.match(
				tool.name,
				/^[a-z][a-z0-9_]*$/,
				`Tool '${tool.name}' should be snake_case`,
			);
		}
	});
});
