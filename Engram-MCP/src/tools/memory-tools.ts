import type { z } from "zod";
/**
 * Memory tools for MCP server
 */

import type { MemoryAPIClient } from "../client.js";
import {
	ActivityTimelineSchema,
	AddMemorySchema,
	BatchAddMemoriesSchema,
	BuildContextSchema,
	BulkDeleteMemoriesSchema,
	CleanupExpiredSchema,
	ConsolidateMemoriesSchema,
	DeleteMemorySchema,
	ExportMemoriesSchema,
	GetAnalyticsSchema,
	GetMemorySchema,
	GetSystemMetricsSchema,
	KnowledgeGraphStatsSchema,
	ListMemoriesSchema,
	ManageTenantSchema,
	MemoryGrowthSchema,
	RagQuerySchema,
	RunDecaySchema,
	SearchMemorySchema,
	SearchStatsSchema,
	TriggerConfidenceSchema,
	validate,
} from "../schemas.js";

export async function handleMemoryTool(
	name: string,
	args: Record<string, unknown>,
	client: MemoryAPIClient,
): Promise<{ content: Array<{ type: string; text: string }> } | null> {
	switch (name) {
		case "add_memory": {
			const input = validate(AddMemorySchema, args);
			const result = await client.addMemory({
				content: input.content,
				tier: input.tier,
				memory_type: input.memory_type,
				project_id: input.project_id,
				user_id: input.user_id,
				tenant_id: input.tenant_id,
				importance: input.importance,
				tags: input.tags,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								memory_id: result.memory_id,
								tier: result.tier,
								message: `Memory added successfully to Tier ${result.tier}`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "search_memory": {
			const input = validate(SearchMemorySchema, args);
			const result = await client.searchMemories({
				query: input.query,
				tier: input.tier,
				project_id: input.project_id,
				user_id: input.user_id,
				tenant_id: input.tenant_id,
				limit: input.limit,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		case "get_memory": {
			const input = validate(GetMemorySchema, args);
			const memory = await client.getMemory(
				input.memory_id,
				input.tier,
				input.tenant_id,
			);

			if (!memory) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ error: "Memory not found", memory_id: input.memory_id },
								null,
								2,
							),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(memory, null, 2),
					},
				],
			};
		}

		case "delete_memory": {
			const input = validate(DeleteMemorySchema, args);
			const success = await client.deleteMemory(
				input.memory_id,
				input.tier,
				input.tenant_id,
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success,
								memory_id: input.memory_id,
								message: success ? "Memory deleted" : "Failed to delete memory",
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "list_memories": {
			const input = validate(ListMemoriesSchema, args);
			const stats = await client.getStats(input.tenant_id);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								overview: {
									total: stats.total_memories,
									by_tier: {
										project: stats.tier1_count,
										general: stats.tier2_count,
										global: stats.tier3_count,
									},
									by_type: stats.by_type,
									average_importance: stats.avg_importance.toFixed(2),
								},
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "batch_add_memories": {
			const input = validate(BatchAddMemoriesSchema, args);
			const result = await client.batchAddMemories({
				memories: input.memories,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								memory_ids: result.memory_ids,
								failed: result.failed,
								total: result.total,
								message: `Batch added ${result.memory_ids.length} memories (${result.failed} failed)`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "build_context": {
			const input = validate(BuildContextSchema, args);
			const result = await client.buildContext({
				query: input.query,
				tier: input.tier,
				project_id: input.project_id,
				user_id: input.user_id,
				session_id: input.session_id,
				max_tokens: input.max_tokens,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								query: result.query,
								context: result.context,
								token_estimate: result.token_estimate,
								message: `Built context with ~${result.token_estimate} tokens`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "rag_query": {
			const input = validate(RagQuerySchema, args);
			const result = await client.ragQuery({
				query: input.query,
				tier: input.tier,
				project_id: input.project_id,
				user_id: input.user_id,
				session_id: input.session_id,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								query: result.query,
								mode: result.mode,
								synthesis_prompt: result.synthesis_prompt,
								source_count: result.source_count,
								context: result.context,
								message: `RAG query completed with ${result.source_count} sources`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "consolidate_memories": {
			const input = validate(ConsolidateMemoriesSchema, args);
			const result = await client.consolidateMemories({
				project_id: input.project_id,
				tenant_id: input.tenant_id,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								processed: result.processed,
								message: `Consolidated ${result.processed} memories`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "cleanup_expired": {
			const input = validate(CleanupExpiredSchema, args);
			const result = await client.cleanupExpired({
				tenant_id: input.tenant_id,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								removed: result.removed,
								message: `Removed ${result.removed} expired memories`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "run_decay": {
			const input = validate(RunDecaySchema, args);
			const result = await client.runDecay({
				tenant_id: input.tenant_id,
			});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								processed: result.processed,
								message: `Manually processed decay for ${result.processed} memories`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "export_memories": {
			const input = validate(ExportMemoriesSchema, args) as z.infer<
				typeof ExportMemoriesSchema
			>;
			const result = await client.exportMemories({
				format: input.format,
				tenant_id: input.tenant_id,
				project_id: input.project_id,
				tier: input.tier,
			});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ...((result as Record<string, unknown>) ?? {}), success: true },
							null,
							2,
						),
					},
				],
			};
		}

		case "bulk_delete_memories": {
			const input = validate(BulkDeleteMemoriesSchema, args) as z.infer<
				typeof BulkDeleteMemoriesSchema
			>;
			const result = await client.bulkDeleteMemories({
				memory_ids: input.memory_ids,
				project_id: input.project_id,
				tenant_id: input.tenant_id,
				tier: input.tier,
				before_date: input.before_date,
			});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								success: true,
								message: `Deleted ${result.deleted_count} memories`,
							},
							null,
							2,
						),
					},
				],
			};
		}

		case "trigger_confidence_maintenance": {
			const input = validate(TriggerConfidenceSchema, args) as z.infer<
				typeof TriggerConfidenceSchema
			>;
			const result = await client.triggerConfidenceMaintenance({
				tenant_id: input.tenant_id,
			});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ...((result as Record<string, unknown>) ?? {}), success: true },
							null,
							2,
						),
					},
				],
			};
		}

		case "get_analytics": {
			const input = validate(GetAnalyticsSchema, args) as z.infer<
				typeof GetAnalyticsSchema
			>;
			const result = await client.getAnalytics(input.tenant_id);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, analytics: result }, null, 2),
					},
				],
			};
		}

		case "get_system_metrics": {
			validate(GetSystemMetricsSchema, args);
			const result = await client.getSystemMetrics();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, metrics: result }, null, 2),
					},
				],
			};
		}

		case "manage_tenant": {
			const input = validate(ManageTenantSchema, args) as {
				action: string;
				tenant_id?: string;
				name?: string;
			};
			if (input.action === "create") {
				if (!input.tenant_id || !input.name)
					throw new Error("tenant_id and name are required for create");
				const result = await client.createTenant({
					tenant_id: input.tenant_id,
					name: input.name,
				});
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									...((result as Record<string, unknown>) ?? {}),
									success: true,
								},
								null,
								2,
							),
						},
					],
				};
			}
			if (input.action === "list") {
				const result = await client.listTenants();
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									...((result as Record<string, unknown>) ?? {}),
									success: true,
								},
								null,
								2,
							),
						},
					],
				};
			}
			if (input.action === "delete") {
				if (!input.tenant_id)
					throw new Error("tenant_id is required for delete");
				const result = await client.deleteTenant(input.tenant_id);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									...((result as Record<string, unknown>) ?? {}),
									success: true,
								},
								null,
								2,
							),
						},
					],
				};
			}
			return null;
		}

		case "get_memory_growth": {
			const input = validate(MemoryGrowthSchema, args) as z.infer<
				typeof MemoryGrowthSchema
			>;
			const result = await client.getMemoryGrowthAnalytics(input.tenant_id);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, data: result }, null, 2),
					},
				],
			};
		}

		case "get_activity_timeline": {
			const input = validate(ActivityTimelineSchema, args) as z.infer<
				typeof ActivityTimelineSchema
			>;
			const result = await client.getActivityTimeline(input.tenant_id);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, data: result }, null, 2),
					},
				],
			};
		}

		case "get_search_stats": {
			const input = validate(SearchStatsSchema, args) as z.infer<
				typeof SearchStatsSchema
			>;
			const result = await client.getSearchStats(input.tenant_id);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, data: result }, null, 2),
					},
				],
			};
		}

		case "get_kg_stats": {
			const input = validate(KnowledgeGraphStatsSchema, args) as z.infer<
				typeof KnowledgeGraphStatsSchema
			>;
			const result = await client.getKnowledgeGraphStats(input.tenant_id);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, data: result }, null, 2),
					},
				],
			};
		}

		default:
			return null;
	}
}
