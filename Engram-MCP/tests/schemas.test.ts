import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidInputError } from "../dist/errors.js";
import {
	CreateMatterSchema,
	createSafeParser,
	IngestDocumentSchema,
	SearchMatterSchema,
	validate,
} from "../dist/schemas.js";

// ============================================
// CreateMatterSchema
// ============================================

describe("CreateMatterSchema", () => {
	it("parses valid input with all fields", () => {
		const input = {
			matter_id: "case-001",
			title: "Fraud Investigation",
			description: "Investigating potential fraud",
			lead_investigator: "Jane Doe",
			tags: ["fraud", "financial"],
		};
		const result = CreateMatterSchema.parse(input);
		assert.equal(result.matter_id, "case-001");
		assert.equal(result.title, "Fraud Investigation");
		assert.equal(result.description, "Investigating potential fraud");
		assert.equal(result.lead_investigator, "Jane Doe");
		assert.deepEqual(result.tags, ["fraud", "financial"]);
	});

	it("rejects missing matter_id", () => {
		const input = { title: "Fraud Investigation" };
		const result = CreateMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("rejects empty matter_id", () => {
		const input = { matter_id: "", title: "Fraud Investigation" };
		const result = CreateMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("rejects missing title", () => {
		const input = { matter_id: "case-001" };
		const result = CreateMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("accepts input with only required fields", () => {
		const input = { matter_id: "case-002", title: "Basic Case" };
		const result = CreateMatterSchema.parse(input);
		assert.equal(result.matter_id, "case-002");
		assert.equal(result.title, "Basic Case");
		assert.equal(result.description, undefined);
		assert.equal(result.lead_investigator, undefined);
		assert.equal(result.tags, undefined);
	});
});

// ============================================
// IngestDocumentSchema
// ============================================

describe("IngestDocumentSchema", () => {
	it("parses valid input with all fields", () => {
		const input = {
			matter_id: "case-001",
			content: "Document content here",
			source_url: "https://example.com/doc.pdf",
			source_type: "PDF" as const,
			metadata: { page_count: 5 },
		};
		const result = IngestDocumentSchema.parse(input);
		assert.equal(result.matter_id, "case-001");
		assert.equal(result.content, "Document content here");
		assert.equal(result.source_url, "https://example.com/doc.pdf");
		assert.equal(result.source_type, "PDF");
		assert.deepEqual(result.metadata, { page_count: 5 });
	});

	it("rejects missing matter_id", () => {
		const input = {
			content: "Document content",
			source_url: "https://example.com",
		};
		const result = IngestDocumentSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("rejects missing content", () => {
		const input = {
			matter_id: "case-001",
			source_url: "https://example.com",
		};
		const result = IngestDocumentSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("rejects missing source_url", () => {
		const input = {
			matter_id: "case-001",
			content: "Document content",
		};
		const result = IngestDocumentSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("defaults source_type to MANUAL when omitted", () => {
		const input = {
			matter_id: "case-001",
			content: "Some content",
			source_url: "https://example.com",
		};
		const result = IngestDocumentSchema.parse(input);
		assert.equal(result.source_type, "MANUAL");
	});

	it("accepts valid source_type values", () => {
		for (const sourceType of ["WEB", "PDF", "EMAIL", "CSV", "EXCEL", "MANUAL"] as const) {
			const input = {
				matter_id: "case-001",
				content: "Content",
				source_url: "https://example.com",
				source_type: sourceType,
			};
			const result = IngestDocumentSchema.parse(input);
			assert.equal(result.source_type, sourceType);
		}
	});
});

// ============================================
// SearchMatterSchema
// ============================================

describe("SearchMatterSchema", () => {
	it("parses valid input with all fields", () => {
		const input = {
			matter_id: "case-001",
			query: "fraud evidence",
			limit: 25,
		};
		const result = SearchMatterSchema.parse(input);
		assert.equal(result.matter_id, "case-001");
		assert.equal(result.query, "fraud evidence");
		assert.equal(result.limit, 25);
	});

	it("rejects missing matter_id", () => {
		const input = { query: "search term" };
		const result = SearchMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("rejects missing query", () => {
		const input = { matter_id: "case-001" };
		const result = SearchMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("defaults limit to 10 when omitted", () => {
		const input = { matter_id: "case-001", query: "search term" };
		const result = SearchMatterSchema.parse(input);
		assert.equal(result.limit, 10);
	});

	it("rejects limit below minimum (1)", () => {
		const input = { matter_id: "case-001", query: "search", limit: 0 };
		const result = SearchMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("rejects limit above maximum (50)", () => {
		const input = { matter_id: "case-001", query: "search", limit: 51 };
		const result = SearchMatterSchema.safeParse(input);
		assert.equal(result.success, false);
	});

	it("accepts limit at boundaries (1 and 50)", () => {
		const minResult = SearchMatterSchema.parse({
			matter_id: "case-001",
			query: "search",
			limit: 1,
		});
		assert.equal(minResult.limit, 1);

		const maxResult = SearchMatterSchema.parse({
			matter_id: "case-001",
			query: "search",
			limit: 50,
		});
		assert.equal(maxResult.limit, 50);
	});
});

// ============================================
// validate()
// ============================================

describe("validate", () => {
	it("returns parsed data for valid input", () => {
		const input = { matter_id: "case-001", query: "test", limit: 5 };
		const result = validate(SearchMatterSchema, input);
		assert.equal(result.matter_id, "case-001");
		assert.equal(result.query, "test");
		assert.equal(result.limit, 5);
	});

	it("applies schema defaults in returned data", () => {
		const input = { matter_id: "case-001", query: "test" };
		const result = validate(SearchMatterSchema, input);
		assert.equal(result.limit, 10);
	});

	it("throws InvalidInputError for invalid input", () => {
		const input = { query: "test" }; // missing matter_id
		assert.throws(
			() => validate(SearchMatterSchema, input),
			(err: unknown) => {
				assert.ok(err instanceof InvalidInputError);
				return true;
			},
		);
	});

	it("error message contains field path", () => {
		const input = { matter_id: "case-001", query: "test", limit: -5 };
		assert.throws(
			() => validate(SearchMatterSchema, input),
			(err: unknown) => {
				assert.ok(err instanceof InvalidInputError);
				assert.ok(err.message.includes("limit"));
				return true;
			},
		);
	});
});

// ============================================
// createSafeParser()
// ============================================

describe("createSafeParser", () => {
	const safeParseMatter = createSafeParser(CreateMatterSchema);

	it("returns success with parsed data for valid input", () => {
		const input = { matter_id: "case-001", title: "Test Matter" };
		const result = safeParseMatter(input);
		assert.equal(result.success, true);
		if (result.success) {
			assert.equal(result.data.matter_id, "case-001");
			assert.equal(result.data.title, "Test Matter");
		}
	});

	it("returns failure with InvalidInputError for invalid input", () => {
		const input = { title: "No ID" }; // missing matter_id
		const result = safeParseMatter(input);
		assert.equal(result.success, false);
		if (!result.success) {
			assert.ok(result.error instanceof InvalidInputError);
		}
	});

	it("failure error message contains validation details", () => {
		const input = {}; // missing both required fields
		const result = safeParseMatter(input);
		assert.equal(result.success, false);
		if (!result.success) {
			assert.ok(result.error.message.includes("Validation failed"));
		}
	});
});
