/**
 * Tool definitions with MCP annotations
 * Provides metadata for tools including hints about behavior
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { INVESTIGATION_TOOLS } from "./investigation-tools.js";

/**
 * Memory tool definitions with annotations
 */
export const MEMORY_TOOLS: Tool[] = [
	{
		name: "add_memory",
		description:
			"Add a new memory to the AI memory system. Memories are stored in one of 3 tiers: Tier 1 (project-scoped), Tier 2 (user-specific, cross-project), or Tier 3 (global/shared).",
		inputSchema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The memory content to store",
				},
				tier: {
					type: "number",
					enum: [1, 2, 3],
					description:
						"Memory tier: 1=Project (isolated), 2=General (user-specific), 3=Global (shared)",
					default: 1,
				},
				memory_type: {
					type: "string",
					enum: [
						"fact",
						"insight",
						"code",
						"conversation",
						"document",
						"preference",
						"error_solution",
						"workflow",
					],
					description: "Type of memory being stored",
					default: "fact",
				},
				project_id: {
					type: "string",
					description: "Project identifier (required for Tier 1 memories)",
				},
				user_id: {
					type: "string",
					description: "User identifier for Tier 1/2 memories",
				},
				tenant_id: {
					type: "string",
					description: "Tenant identifier for multi-tenancy",
					default: "default",
				},
				importance: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description: "Importance score from 0 to 1",
					default: 0.5,
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Tags for categorization",
				},
			},
			required: ["content"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "search_memory",
		description:
			"Search memories using semantic similarity. Returns the most relevant memories based on the query.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query",
				},
				tier: {
					type: "number",
					enum: [1, 2, 3],
					description: "Filter by tier (optional)",
				},
				project_id: {
					type: "string",
					description: "Filter by project ID",
				},
				user_id: {
					type: "string",
					description: "Filter by user ID",
				},
				tenant_id: {
					type: "string",
					description: "Filter by tenant ID",
					default: "default",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 100,
					description: "Maximum results to return",
					default: 10,
				},
			},
			required: ["query"],
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "get_memory",
		description: "Retrieve a specific memory by its ID.",
		inputSchema: {
			type: "object",
			properties: {
				memory_id: {
					type: "string",
					description: "The UUID of the memory",
				},
				tier: {
					type: "number",
					enum: [1, 2, 3],
					description: "The tier the memory is stored in",
				},
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
			required: ["memory_id", "tier"],
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "delete_memory",
		description: "Delete a memory from the system.",
		inputSchema: {
			type: "object",
			properties: {
				memory_id: {
					type: "string",
					description: "The UUID of the memory to delete",
				},
				tier: {
					type: "number",
					enum: [1, 2, 3],
					description: "The tier the memory is stored in",
				},
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
			required: ["memory_id", "tier"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "list_memories",
		description: "Get statistics and overview of stored memories across all tiers.",
		inputSchema: {
			type: "object",
			properties: {
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "batch_add_memories",
		description:
			"Add multiple memories in a single batch operation. More efficient than adding one by one.",
		inputSchema: {
			type: "object",
			properties: {
				memories: {
					type: "array",
					items: {
						type: "object",
						properties: {
							content: {
								type: "string",
								description: "Memory content",
							},
							tier: {
								type: "number",
								enum: [1, 2, 3],
								description: "Memory tier: 1=Project, 2=General, 3=Global",
								default: 1,
							},
							memory_type: {
								type: "string",
								description: "Type of memory being stored",
								default: "fact",
							},
							project_id: {
								type: "string",
								description: "Project identifier",
							},
							user_id: {
								type: "string",
								description: "User identifier",
							},
							tenant_id: {
								type: "string",
								description: "Tenant identifier",
								default: "default",
							},
							importance: {
								type: "number",
								minimum: 0,
								maximum: 1,
								description: "Importance score from 0 to 1",
								default: 0.5,
							},
							tags: {
								type: "array",
								items: { type: "string" },
								description: "Tags for categorization",
							},
						},
						required: ["content"],
					},
					description: "Array of memories to add (max 100)",
					maxItems: 100,
				},
			},
			required: ["memories"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "build_context",
		description:
			"Build a formatted context string from relevant memories for a given query. Useful for assembling prompt context from stored knowledge.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Query to build context for",
				},
				tier: {
					type: "number",
					enum: [1, 2, 3],
					description: "Filter by tier (optional)",
				},
				project_id: {
					type: "string",
					description: "Filter by project ID",
				},
				user_id: {
					type: "string",
					description: "Filter by user ID",
				},
				session_id: {
					type: "string",
					description: "Session ID for context scoping",
				},
				max_tokens: {
					type: "number",
					minimum: 100,
					maximum: 32000,
					description: "Maximum token budget for context",
				},
			},
			required: ["query"],
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "rag_query",
		description:
			"Perform a RAG (Retrieval-Augmented Generation) query over memories. Returns a synthesis prompt with relevant context for LLM consumption.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Query for RAG retrieval",
				},
				tier: {
					type: "number",
					enum: [1, 2, 3],
					description: "Filter by tier (optional)",
				},
				project_id: {
					type: "string",
					description: "Filter by project ID",
				},
				user_id: {
					type: "string",
					description: "Filter by user ID",
				},
				session_id: {
					type: "string",
					description: "Session ID for context scoping",
				},
			},
			required: ["query"],
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "consolidate_memories",
		description:
			"Trigger memory consolidation. Merges and summarizes related memories to reduce redundancy and improve retrieval quality.",
		inputSchema: {
			type: "object",
			properties: {
				project_id: {
					type: "string",
					description: "Consolidate memories for a specific project",
				},
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true, // Modifies/deletes memories
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "cleanup_expired",
		description:
			"Remove expired memories from the system. Cleans up memories that have passed their expiration date.",
		inputSchema: {
			type: "object",
			properties: {
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: true,
		},
	},

        {
                name: "export_memories",
                description: "Export memories to a specific format (json, csv, markdown).",
                inputSchema: {
                        type: "object",
                        properties: {
                                format: {
                                        type: "string",
                                        enum: ["json", "csv", "markdown"],
                                        description: "Format to export to",
                                        default: "json",
                                },
                                tenant_id: { type: "string" },
                                project_id: { type: "string" },
                                tier: { type: "number" },
                        },
                },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "bulk_delete_memories",
                description: "Bulk delete memories matching specific criteria.",
                inputSchema: {
                        type: "object",
                        properties: {
                                memory_ids: { type: "array", items: { type: "string" } },
                                project_id: { type: "string" },
                                tenant_id: { type: "string" },
                                tier: { type: "number" },
                                before_date: { type: "string", description: "ISO date string" },
                        },
                },
                annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "trigger_confidence_maintenance",
                description: "Trigger confidence maintenance and contradiction detection.",
                inputSchema: {
                        type: "object",
                        properties: {
                                tenant_id: { type: "string" },
                        },
                },
                annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        {
                name: "get_analytics",
                description: "Get aggregated analytics for the memory system.",
                inputSchema: {
                        type: "object",
                        properties: {
                                tenant_id: { type: "string" },
                        },
                },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_system_metrics",
                description: "Get detailed system metrics and performance data.",
                inputSchema: {
                        type: "object",
                        properties: {},
                },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "manage_tenant",
                description: "Create, list, or delete tenants for multi-tenant deployments.",
                inputSchema: {
                        type: "object",
                        properties: {
                                action: { type: "string", enum: ["create", "list", "delete"] },
                                tenant_id: { type: "string" },
                                name: { type: "string" },
                        },
                        required: ["action"],
                },
                annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        },

        {
                name: "get_memory_growth",
                description: "Get memory growth analytics data.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_activity_timeline",
                description: "Get user activity timeline analytics.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_search_stats",
                description: "Get memory search statistics.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_kg_stats",
                description: "Get knowledge graph statistics.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
];

/**
 * Entity tool definitions with annotations
 */
export const ENTITY_TOOLS: Tool[] = [
	{
		name: "add_entity",
		description:
			"Add an entity to the knowledge graph. Entities are nodes in the graph that represent concepts, people, projects, etc.",
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Name of the entity",
				},
				entity_type: {
					type: "string",
					description: "Type of entity (e.g., person, project, concept, tool)",
				},
				description: {
					type: "string",
					description: "Description of the entity",
				},
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
				aliases: {
					type: "array",
					items: { type: "string" },
					description: "Alternative names for the entity",
				},
			},
			required: ["name", "entity_type"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "add_relation",
		description: "Add a relationship between two entities in the knowledge graph.",
		inputSchema: {
			type: "object",
			properties: {
				source_entity: {
					type: "string",
					description: "Name of the source entity",
				},
				relation_type: {
					type: "string",
					description: "Type of relationship (e.g., works_on, depends_on, knows, uses)",
				},
				target_entity: {
					type: "string",
					description: "Name of the target entity",
				},
				weight: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description: "Strength of the relationship (0-1)",
					default: 1,
				},
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
			required: ["source_entity", "relation_type", "target_entity"],
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	{
		name: "query_graph",
		description: "Query the knowledge graph for entities and their relationships.",
		inputSchema: {
			type: "object",
			properties: {
				entity_name: {
					type: "string",
					description: "Name of the entity to query",
				},
				depth: {
					type: "number",
					minimum: 1,
					maximum: 3,
					description: "How many hops to traverse",
					default: 1,
				},
				tenant_id: {
					type: "string",
					description: "Tenant ID for multi-tenancy",
					default: "default",
				},
			},
			required: ["entity_name"],
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	{
		name: "health_check",
		description:
			"Check the health status of the MCP server and its dependencies including the Memory API, Weaviate, and Redis.",
		inputSchema: {
			type: "object",
			properties: {
				include_details: {
					type: "boolean",
					description: "Whether to include detailed component health information",
					default: false,
				},
			},
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
];

export const ALL_TOOLS: Tool[] = [...MEMORY_TOOLS, ...ENTITY_TOOLS, ...INVESTIGATION_TOOLS];
