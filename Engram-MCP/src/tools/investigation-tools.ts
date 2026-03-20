/**
 * Investigation tools for matter management, evidence ingestion, and search.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { MemoryAPIClient } from "../client.js";
import {
	CreateMatterSchema,
	IngestDocumentSchema,
	SearchMatterSchema,
	validate,
} from "../schemas.js";

export const INVESTIGATION_TOOLS: Tool[] = [
	{
		name: "create_matter",
		description:
			"Create a new investigation matter with isolated tenant storage. Each matter gets its own Weaviate tenant for complete data isolation.",
		inputSchema: {
			type: "object",
			properties: {
				matter_id: {
					type: "string",
					description:
						"Unique identifier for the matter (e.g., 'CASE-2024-001')",
				},
				title: {
					type: "string",
					description: "Human-readable title for the matter",
				},
				description: {
					type: "string",
					description: "Detailed description of the investigation matter",
				},
				lead_investigator: {
					type: "string",
					description: "Name or ID of the lead investigator",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Tags for categorizing the matter",
				},
			},
			required: ["matter_id", "title"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "ingest_document",
		description:
			"Ingest a document into a matter's evidence store. Supports web content, text, and structured data. Content is automatically chunked and embedded for semantic search.",
		inputSchema: {
			type: "object",
			properties: {
				matter_id: {
					type: "string",
					description: "The matter ID to ingest the document into",
				},
				content: {
					type: "string",
					description: "The document content to ingest",
				},
				source_url: {
					type: "string",
					description: "Source URL or file path of the document",
				},
				source_type: {
					type: "string",
					enum: ["WEB", "PDF", "EMAIL", "CSV", "EXCEL", "MANUAL"],
					description: "Type of the source document",
					default: "MANUAL",
				},
				metadata: {
					type: "object",
					description: "Additional metadata to attach to the document",
				},
			},
			required: ["matter_id", "content", "source_url"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "search_matter",
		description:
			"Semantically search within a matter's evidence store. Returns the most relevant evidence chunks based on the query.",
		inputSchema: {
			type: "object",
			properties: {
				matter_id: {
					type: "string",
					description: "The matter ID to search within",
				},
				query: {
					type: "string",
					description: "Natural language search query",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 50,
					description: "Maximum number of results to return",
					default: 10,
				},
				offset: {
					type: "number",
					minimum: 0,
					description: "Pagination offset for evidence results",
					default: 0,
				},
			},
			required: ["matter_id", "query"],
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
];

export async function handleInvestigationTool(
	name: string,
	args: Record<string, unknown>,
	client: MemoryAPIClient,
): Promise<{ content: Array<{ type: string; text: string }> } | null> {
	switch (name) {
		case "create_matter": {
			const input = validate(CreateMatterSchema, args);
			const result = await client.createMatter({
				matter_id: input.matter_id,
				title: input.title,
				description: input.description,
				lead_investigator: input.lead_investigator,
				tags: input.tags,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								matter_id: result.matter_id,
								title: result.title,
								status: result.status,
								created_at: result.created_at,
								message: `Matter '${input.matter_id}' created successfully`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "ingest_document": {
			const input = validate(IngestDocumentSchema, args);
			const result = await client.ingestDocument({
				matter_id: input.matter_id,
				content: input.content,
				source_url: input.source_url,
				source_type: input.source_type,
				metadata: input.metadata,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								chunks_ingested: Array.isArray(result) ? result.length : 0,
								matter_id: input.matter_id,
								source_url: input.source_url,
								message: `Document ingested: ${Array.isArray(result) ? result.length : 0} chunks stored`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "search_matter": {
			const input = validate(SearchMatterSchema, args);
			const result = await client.searchMatter({
				matter_id: input.matter_id,
				query: input.query,
				limit: input.limit,
				offset: input.offset,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								matter_id: input.matter_id,
								query: input.query,
								total: result.total ?? 0,
								limit: result.limit ?? input.limit,
								offset: result.offset ?? input.offset,
								results: result.results ?? [],
							},
							null,
							2,
						),
					},
				],
			};
		}

		default:
			return null;
	}
}
