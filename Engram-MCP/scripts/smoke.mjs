import { PROMPTS, renderPrompt } from "../dist/prompts.js";
import {
	parseResourceUri,
	RESOURCE_TEMPLATES,
	STATIC_RESOURCES,
} from "../dist/resources/enhanced-resources.js";
import { handleResourceRequest } from "../dist/resources/memory-resources.js";
import { handleEntityTool } from "../dist/tools/entity-tools.js";
import { handleMemoryTool } from "../dist/tools/memory-tools.js";
import { ALL_TOOLS } from "../dist/tools/tool-definitions.js";

const mockClient = {
	addMemory: async (x) => ({ memory_id: "m1", ...x }),
	searchMemories: async (x) => ({ results: [], query: x.query }),
	getMemory: async () => null,
	deleteMemory: async () => true,
	getStats: async () => ({ total: 0 }),
	batchAddMemories: async (x) => ({ added: x.memories.length }),
	buildContext: async () => ({ context: "ctx" }),
	ragQuery: async () => ({ prompt: "p" }),
	consolidateMemories: async () => ({ consolidated: 0 }),
	cleanupExpired: async () => ({ cleaned: 0 }),
	healthCheck: async () => ({ status: "ok" }),
	addEntity: async (x) => ({ entity_id: "e1", ...x }),
	findEntityByName: async (name) => (name ? { entity_id: "e1", name } : null),
	addRelation: async () => ({ relation_id: "r1" }),
	queryGraph: async () => ({ nodes: [], edges: [] }),
};

let failures = 0;
const assert = (cond, msg) => {
	if (!cond) {
		failures += 1;
		console.error(`FAIL: ${msg}`);
	} else {
		console.log(`PASS: ${msg}`);
	}
};

try {
	try {
		await handleMemoryTool("add_memory", {}, mockClient);
		assert(false, "add_memory should reject invalid input");
	} catch (e) {
		assert(String(e.message).includes("Validation failed"), "add_memory validates input");
	}

	const okAdd = await handleMemoryTool("add_memory", { content: "hello" }, mockClient);
	assert(!!okAdd && Array.isArray(okAdd.content), "add_memory works with valid input");

	try {
		await handleEntityTool(
			"add_relation",
			{ source_entity: "A", relation_type: "uses", target_entity: "" },
			mockClient,
		);
		assert(false, "add_relation should reject invalid target entity");
	} catch (e) {
		assert(String(e.message).includes("Validation failed"), "add_relation validates input");
	}

	assert(Array.isArray(ALL_TOOLS) && ALL_TOOLS.length > 0, "tool definitions exported");
	assert(
		Array.isArray(STATIC_RESOURCES) && STATIC_RESOURCES.some((r) => r.uri === "memory://stats"),
		"static resources exported",
	);
	assert(
		Array.isArray(RESOURCE_TEMPLATES) && RESOURCE_TEMPLATES.length > 0,
		"resource templates exported",
	);

	const parsed = parseResourceUri("memory://project/myproj/recent/5");
	assert(
		parsed.type === "dynamic" &&
			parsed.params?.projectId === "myproj" &&
			parsed.params?.limit === "5",
		"resource URI parsing works",
	);

	const tiers = await handleResourceRequest("memory://tiers", mockClient);
	assert(tiers.contents[0].text.includes("Project"), "tiers resource returns docs");

	assert(Array.isArray(PROMPTS) && PROMPTS.length > 0, "prompts exported");
	const rendered = renderPrompt("remember_context", { content: "x" });
	assert(typeof rendered === "string" && rendered.includes("store"), "prompt rendering works");

	console.log(`SMOKE_RESULT failures=${failures}`);
	process.exit(failures ? 1 : 0);
} catch (err) {
	console.error("SMOKE_FATAL", err);
	process.exit(1);
}
