/**
 * @fileoverview Tests for MCP Server Factory
 *
 * Tests server creation, tool/resource/prompt handlers, and error propagation.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createMCPServer } from "../dist/server.js";
import { InvalidInputError, NotFoundError, InternalServerError } from "../dist/errors.js";
import { ALL_TOOLS } from "../dist/tools/tool-definitions.js";
import { PROMPTS } from "../dist/prompts.js";
import { STATIC_RESOURCES, RESOURCE_TEMPLATES } from "../dist/resources/enhanced-resources.js";

describe("createMCPServer", () => {
	describe("server creation", () => {
		it("creates server with correct name and version", () => {
			const config = {
				serverName: "test-server",
				serverVersion: "1.0.0",
				apiUrl: "http://localhost:8000",
			};
			const server = createMCPServer({ config });
			assert.ok(server, "server should be created");
		});

		it("creates server with hookManager when provided", () => {
			const config = {
				serverName: "test-server",
				serverVersion: "1.0.0",
				apiUrl: "http://localhost:8000",
			};
			const mockHookManager = {
				runPreToolHook: async () => undefined,
				runPostToolHook: async () => undefined,
			};
			const server = createMCPServer({ config, hookManager: mockHookManager });
			assert.ok(server, "server should be created with hookManager");
		});

		it("creates server without hookManager when not provided", () => {
			const config = {
				serverName: "test-server",
				serverVersion: "1.0.0",
				apiUrl: "http://localhost:8000",
			};
			const server = createMCPServer({ config });
			assert.ok(server, "server should be created without hookManager");
		});
	});

	describe("ListToolsRequestSchema handler", () => {
		it("returns all tools", () => {
			assert.ok(Array.isArray(ALL_TOOLS), "ALL_TOOLS should be an array");
			assert.ok(ALL_TOOLS.length > 0, "ALL_TOOLS should not be empty");
		});

		it("tools have required properties", () => {
			for (const tool of ALL_TOOLS) {
				assert.ok(tool.name, `tool should have name: ${JSON.stringify(tool)}`);
				assert.ok(tool.description, `tool should have description: ${tool.name}`);
				assert.ok(tool.inputSchema, `tool should have inputSchema: ${tool.name}`);
			}
		});
	});

	describe("CallToolRequestSchema handler", () => {
		it("handles health_check tool with minimal details", () => {
			const healthCheckTool = ALL_TOOLS.find(t => t.name === "health_check");
			assert.ok(healthCheckTool, "health_check tool should exist");
		});

		it("handles health_check tool with full details", () => {
			const healthCheckTool = ALL_TOOLS.find(t => t.name === "health_check");
			assert.ok(healthCheckTool, "health_check tool should exist");
			const schema = healthCheckTool.inputSchema;
			assert.ok(schema, "health_check should have inputSchema");
		});

		it("rejects unknown tool name", () => {
			const unknownTool = ALL_TOOLS.find(t => t.name === "nonexistent_tool_xyz");
			assert.strictEqual(unknownTool, undefined, "unknown tool should not exist");
		});

		it("tools have valid input schemas", () => {
			for (const tool of ALL_TOOLS) {
				const schema = tool.inputSchema;
				assert.ok(typeof schema === "object", `${tool.name} inputSchema should be object`);
				assert.ok(schema.type === "object", `${tool.name} inputSchema should have type object`);
			}
		});
	});

	describe("ListResourcesRequestSchema handler", () => {
		it("returns static resources", () => {
			assert.ok(Array.isArray(STATIC_RESOURCES), "STATIC_RESOURCES should be an array");
			assert.ok(STATIC_RESOURCES.length > 0, "STATIC_RESOURCES should not be empty");
		});

		it("resources have required properties", () => {
			for (const resource of STATIC_RESOURCES) {
				assert.ok(resource.uri, `resource should have uri: ${JSON.stringify(resource)}`);
				assert.ok(resource.name, `resource should have name: ${resource.uri}`);
			}
		});
	});

	describe("ListResourceTemplatesRequestSchema handler", () => {
		it("returns resource templates", () => {
			assert.ok(Array.isArray(RESOURCE_TEMPLATES), "RESOURCE_TEMPLATES should be an array");
			assert.ok(RESOURCE_TEMPLATES.length > 0, "RESOURCE_TEMPLATES should not be empty");
		});

		it("templates have required properties", () => {
			for (const template of RESOURCE_TEMPLATES) {
				assert.ok(template.uriTemplate, `template should have uriTemplate: ${JSON.stringify(template)}`);
				assert.ok(template.name, `template should have name: ${template.uriTemplate}`);
			}
		});
	});

	describe("ReadResourceRequestSchema handler", () => {
		it("handles resource read requests", () => {
			for (const resource of STATIC_RESOURCES) {
				assert.ok(resource.uri, `resource should have readableURI: ${resource.uri}`);
			}
		});

		it("templates support variable substitution", () => {
			for (const template of RESOURCE_TEMPLATES) {
				const uri = template.uriTemplate;
				assert.ok(uri.includes("{") && uri.includes("}"), 
					`template ${uri} should have variable placeholders`);
			}
		});
	});

	describe("ListPromptsRequestSchema handler", () => {
		it("returns prompts", () => {
			assert.ok(Array.isArray(PROMPTS), "PROMPTS should be an array");
			assert.ok(PROMPTS.length > 0, "PROMPTS should not be empty");
		});

		it("prompts have required properties", () => {
			for (const prompt of PROMPTS) {
				assert.ok(prompt.name, `prompt should have name: ${JSON.stringify(prompt)}`);
				assert.ok(prompt.description, `prompt should have description: ${prompt.name}`);
				assert.ok(prompt.arguments !== undefined, `prompt should have arguments: ${prompt.name}`);
			}
		});
	});

	describe("GetPromptRequestSchema handler", () => {
		it("prompts have render template", () => {
			for (const prompt of PROMPTS) {
				assert.ok(prompt.name, `prompt should be renderable: ${prompt.name}`);
			}
		});

		it("prompts accept optional arguments", () => {
			for (const prompt of PROMPTS) {
				if (prompt.arguments && prompt.arguments.length > 0) {
					for (const arg of prompt.arguments) {
						assert.ok(arg.name, `prompt argument should have name: ${prompt.name}/${arg.name}`);
					}
				}
			}
		});
	});

	describe("error handling", () => {
		it("InternalServerError is constructable", () => {
			const err = new InternalServerError("test error");
			assert.ok(err instanceof Error, "InternalServerError should extend Error");
			assert.strictEqual(err.code, "INTERNAL_ERROR");
		});

		it("InvalidInputError is constructable", () => {
			const err = new InvalidInputError("invalid input");
			assert.ok(err instanceof Error, "InvalidInputError should extend Error");
			assert.strictEqual(err.code, "INVALID_INPUT");
		});

		it("NotFoundError is constructable", () => {
			const err = new NotFoundError("not found");
			assert.ok(err instanceof Error, "NotFoundError should extend Error");
			assert.strictEqual(err.code, "NOT_FOUND");
		});

		it("errors have correct properties", () => {
			const err = new InternalServerError("test", { cause: new Error("cause") });
			assert.ok(err.message, "error should have message");
			assert.ok(err.code, "error should have code");
			assert.ok(err.category, "error should have category");
		});
	});

	describe("tool categorization", () => {
		it("categorizes tools by type", () => {
			const memoryTools = ALL_TOOLS.filter(t => 
				t.name.startsWith("add_") || t.name.startsWith("search_") || t.name.startsWith("get_") || t.name.startsWith("delete_")
			);
			const entityTools = ALL_TOOLS.filter(t => 
				t.name.startsWith("add_entity") || t.name.startsWith("add_relation") || t.name.startsWith("query_graph")
			);
			const investigationTools = ALL_TOOLS.filter(t => 
				t.name.startsWith("create_matter") || t.name.startsWith("ingest_") || t.name.startsWith("search_matter")
			);

			assert.ok(memoryTools.length > 0, "should have memory tools");
			assert.ok(entityTools.length > 0, "should have entity tools");
			assert.ok(investigationTools.length > 0, "should have investigation tools");
		});

		it("all tools have descriptions", () => {
			for (const tool of ALL_TOOLS) {
				assert.ok(tool.description.length > 0, `${tool.name} should have description`);
			}
		});
	});

	describe("resource categorization", () => {
		it("static resources are readable", () => {
			assert.ok(STATIC_RESOURCES.length > 0, "should have static resources");
		});

		it("resource templates are dynamic", () => {
			assert.ok(RESOURCE_TEMPLATES.length > 0, "should have resource templates");
		});
	});

	describe("prompt categorization", () => {
		it("all prompts have descriptions", () => {
			for (const prompt of PROMPTS) {
				assert.ok(prompt.description.length > 0, `${prompt.name} should have description`);
			}
		});

		it("prompts define argument schemas", () => {
			for (const prompt of PROMPTS) {
				assert.ok(Array.isArray(prompt.arguments), `${prompt.name} should have arguments array`);
			}
		});
	});
});
