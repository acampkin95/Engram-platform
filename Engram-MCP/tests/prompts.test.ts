/**
 * @fileoverview Tests for prompt templates
 *
 * Tests all prompt generators with various argument combinations.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPromptTemplate, renderPrompt, PROMPT_TEMPLATES } from "../dist/prompts.js";

describe("Prompt Templates", () => {
	describe("getPromptTemplate", () => {
		it("returns template for valid name", () => {
			const template = getPromptTemplate("recall_context");
			assert.ok(typeof template === "function");
		});

		it("returns undefined for invalid name", () => {
			const template = getPromptTemplate("nonexistent");
			assert.strictEqual(template, undefined);
		});

		it("returns all defined templates", () => {
			const templateNames = Object.keys(PROMPT_TEMPLATES);
			for (const name of templateNames) {
				const template = getPromptTemplate(name);
				assert.ok(typeof template === "function", `Template ${name} should be a function`);
			}
		});
	});

	describe("renderPrompt", () => {
		it("renders recall_context with project scope", () => {
			const result = renderPrompt("recall_context", {
				query: "test query",
				project_id: "proj-456",
			});
			assert.ok(result!.includes("test query"));
			assert.ok(result!.includes("Scope: Project proj-456"));
		});

		it("renders recall_context without project scope", () => {
			const result = renderPrompt("recall_context", { query: "test" });
			assert.ok(result!.includes("test"));
			assert.ok(!result!.includes("Scope:"));
		});

		it("renders build_project_knowledge with focus area", () => {
			const result = renderPrompt("build_project_knowledge", {
				project_id: "proj-789",
				focus_area: "authentication",
			});
			assert.ok(result!.includes("proj-789"));
			assert.ok(result!.includes("Focus area: authentication"));
		});

		it("renders learn_pattern with code example", () => {
			const result = renderPrompt("learn_pattern", {
				pattern_name: "Singleton",
				description: "Ensure single instance",
				code_example: "class Singleton { }",
				tier: "2",
			});
			assert.ok(result!.includes("Singleton"));
			assert.ok(result!.includes("Ensure single instance"));
			assert.ok(result!.includes("class Singleton"));
		});

		it("renders learn_pattern without code example", () => {
			const result = renderPrompt("learn_pattern", {
				pattern_name: "Factory",
				description: "Create objects",
			});
			assert.ok(result!.includes("Factory"));
			assert.ok(!result!.includes("Example:"));
		});

		it("renders troubleshoot with error type", () => {
			const result = renderPrompt("troubleshoot", {
				error_description: "Connection refused",
				error_type: "NetworkError",
			});
			assert.ok(result!.includes("Connection refused"));
			assert.ok(result!.includes("Type: NetworkError"));
		});

		it("renders code_review_context with project", () => {
			const result = renderPrompt("code_review_context", {
				code_area: "authentication",
				project_id: "proj-123",
			});
			assert.ok(result!.includes("authentication"));
			assert.ok(result!.includes("Project: proj-123"));
		});

		it("renders session_summary with all fields", () => {
			const result = renderPrompt("session_summary", {
				summary: "Completed API integration",
				decisions: "Use OAuth 2.0",
				next_steps: "Add tests",
				project_id: "proj-456",
			});
			assert.ok(result!.includes("Completed API integration"));
			assert.ok(result!.includes("Use OAuth 2.0"));
			assert.ok(result!.includes("Add tests"));
		});

		it("renders session_summary with minimal fields", () => {
			const result = renderPrompt("session_summary", {
				summary: "Test summary",
			});
			assert.ok(result!.includes("Test summary"));
		});

		it("renders entity_context with depth", () => {
			const result = renderPrompt("entity_context", {
				entity_name: "User",
				depth: "3",
			});
			assert.ok(result!.includes("User"));
			assert.ok(result!.includes("Depth: 3"));
		});

		it("returns undefined for invalid prompt name", () => {
			const result = renderPrompt("invalid_prompt", {});
			assert.strictEqual(result, undefined);
		});
	});

	describe("PROMPT_TEMPLATES", () => {
		it("has all required prompt types", () => {
			const requiredTemplates = [
				"remember_context",
				"recall_context",
				"build_project_knowledge",
				"learn_pattern",
				"troubleshoot",
				"code_review_context",
				"session_summary",
				"entity_context",
			];

			for (const name of requiredTemplates) {
				assert.ok(PROMPT_TEMPLATES[name], `Should have ${name} template`);
			}
		});
	});
});

	describe("remember_context", () => {
		it("renders with all optional fields", () => {
			const result = renderPrompt("remember_context", {
				content: "Important concept",
				importance: 0.8,
				project_id: "proj-123",
			});
			assert.ok(result!.includes("Important concept"));
			assert.ok(result!.includes("Importance: 0.8"));
			assert.ok(result!.includes("Project: proj-123"));
		});

		it("renders with content only", () => {
			const result = renderPrompt("remember_context", {
				content: "Basic info",
			});
			assert.ok(result!.includes("Basic info"));
			assert.ok(!result!.includes("Importance:"));
			assert.ok(!result!.includes("Project:"));
		});
	});
