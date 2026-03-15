import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import { handleInvestigationTool } from "../dist/tools/investigation-tools.js";

function createMockClient() {
	return {
		createMatter: mock.fn(async (data: { matter_id: string; title: string }) => ({
			matter_id: data.matter_id,
			title: data.title,
			status: "active",
			created_at: "2024-01-01T00:00:00Z",
		})),
		ingestDocument: mock.fn(async () => [
			{ chunk_id: "c1", content: "chunk 1" },
			{ chunk_id: "c2", content: "chunk 2" },
		]),
		searchMatter: mock.fn(async () => ({
			results: [
				{ chunk_id: "c1", content: "result 1", score: 0.9 },
			],
			total: 1,
			query: "test",
		})),
	} as unknown as Parameters<typeof handleInvestigationTool>[2];
}

describe("handleInvestigationTool", () => {
	let mockClient: ReturnType<typeof createMockClient>;

	beforeEach(() => {
		mockClient = createMockClient();
	});

	describe("create_matter", () => {
		it("creates matter with required fields", async () => {
			const result = await handleInvestigationTool("create_matter", {
				matter_id: "CASE-2024-001",
				title: "Test Investigation",
			}, mockClient);

			assert.ok(result);
			assert.equal(result.content.length, 1);
			const parsed = JSON.parse(result.content[0].text);
			assert.equal(parsed.success, true);
			assert.equal(parsed.matter_id, "CASE-2024-001");
		});

		it("creates matter with all fields", async () => {
			const result = await handleInvestigationTool("create_matter", {
				matter_id: "CASE-2024-002",
				title: "Full Investigation",
				description: "Detailed description",
				lead_investigator: "Detective Smith",
				tags: ["fraud", "financial"],
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result.content[0].text);
			assert.equal(parsed.success, true);
		});

		it("requires matter_id", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("create_matter", { title: "No ID" }, mockClient),
				/matter_id/,
			);
		});

		it("requires title", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("create_matter", { matter_id: "CASE-001" }, mockClient),
				/title/,
			);
		});

		it("rejects empty matter_id", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("create_matter", { matter_id: "", title: "Test" }, mockClient),
				/required/,
			);
		});
	});

	describe("ingest_document", () => {
		it("ingests document with required fields", async () => {
			const result = await handleInvestigationTool("ingest_document", {
				matter_id: "CASE-001",
				content: "This is the document content",
				source_url: "https://example.com/doc",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result.content[0].text);
			assert.equal(parsed.success, true);
			assert.equal(parsed.chunks_ingested, 2);
		});

		it("ingests document with all fields", async () => {
			const result = await handleInvestigationTool("ingest_document", {
				matter_id: "CASE-001",
				content: "Document with metadata",
				source_url: "https://example.com/doc2",
				source_type: "WEB",
				metadata: { author: "John Doe", date: "2024-01-01" },
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result.content[0].text);
			assert.equal(parsed.success, true);
		});

		it("requires matter_id", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("ingest_document", {
					content: "test",
					source_url: "https://example.com",
				}, mockClient),
				/matter_id/,
			);
		});

		it("requires content", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("ingest_document", {
					matter_id: "CASE-001",
					source_url: "https://example.com",
				}, mockClient),
				/content/,
			);
		});

		it("requires source_url", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("ingest_document", {
					matter_id: "CASE-001",
					content: "test",
				}, mockClient),
				/source_url/,
			);
		});

		it("accepts valid source_type values", async () => {
			const sourceTypes = ["WEB", "PDF", "EMAIL", "CSV", "EXCEL", "MANUAL"];
			for (const source_type of sourceTypes) {
				const result = await handleInvestigationTool("ingest_document", {
					matter_id: "CASE-001",
					content: "test",
					source_url: "https://example.com",
					source_type,
				}, mockClient);
				assert.ok(result);
			}
		});

		it("defaults source_type to MANUAL", async () => {
			const result = await handleInvestigationTool("ingest_document", {
				matter_id: "CASE-001",
				content: "test",
				source_url: "https://example.com",
			}, mockClient);
			assert.ok(result);
		});
	});

	describe("search_matter", () => {
		it("searches with required fields", async () => {
			const result = await handleInvestigationTool("search_matter", {
				matter_id: "CASE-001",
				query: "find evidence",
			}, mockClient);

			assert.ok(result);
			const parsed = JSON.parse(result.content[0].text);
			assert.ok(parsed.results);
		});

		it("searches with pagination", async () => {
			const result = await handleInvestigationTool("search_matter", {
				matter_id: "CASE-001",
				query: "evidence",
				limit: 20,
				offset: 10,
			}, mockClient);

			assert.ok(result);
		});

		it("requires matter_id", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("search_matter", { query: "test" }, mockClient),
				/matter_id/,
			);
		});

		it("requires query", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("search_matter", { matter_id: "CASE-001" }, mockClient),
				/query/,
			);
		});

		it("rejects limit below minimum", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("search_matter", {
					matter_id: "CASE-001",
					query: "test",
					limit: 0,
				}, mockClient),
				/1/,
			);
		});

		it("rejects limit above maximum", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("search_matter", {
					matter_id: "CASE-001",
					query: "test",
					limit: 100,
				}, mockClient),
				/50/,
			);
		});

		it("rejects offset below minimum", async () => {
			await assert.rejects(
				async () => await handleInvestigationTool("search_matter", {
					matter_id: "CASE-001",
					query: "test",
					offset: -1,
				}, mockClient),
				/0/,
			);
		});

		it("accepts limit at boundaries", async () => {
			// Test min boundary
			const result1 = await handleInvestigationTool("search_matter", {
				matter_id: "CASE-001",
				query: "test",
				limit: 1,
			}, mockClient);
			assert.ok(result1);

			// Test max boundary
			const result50 = await handleInvestigationTool("search_matter", {
				matter_id: "CASE-001",
				query: "test",
				limit: 50,
			}, mockClient);
			assert.ok(result50);
		});
	});

	describe("unknown tool", () => {
		it("returns null for unknown tool name", async () => {
			const result = await handleInvestigationTool("unknown_investigation_tool", {}, mockClient);
			assert.equal(result, null);
		});
	});
});
