import { MemoryAPIClient } from "../client.js";
import type { MCPConfig } from "../config.js";
import { logger } from "../logger.js";
import type { HookManager, RecallResult } from "./hook-manager.js";
import type { ToolCallContext, ToolResultContext } from "./types.js";

// ---------------------------------------------------------------------------
// Tools that modify state — only these trigger post-hook memory storage
// ---------------------------------------------------------------------------

const WRITE_TOOLS = new Set([
	"add_memory",
	"batch_add_memories",
	"consolidate_memories",
	"cleanup_expired",
	"add_entity",
	"add_relation",
	"create_matter",
	"ingest_document",
]);

// ---------------------------------------------------------------------------
// Tools that are themselves read/recall operations — skip pre-hook recall
// to avoid redundant API calls (they already do their own memory fetching)
// ---------------------------------------------------------------------------

const SKIP_RECALL_TOOLS = new Set([
	"search_memory",
	"get_memory",
	"list_memories",
	"rag_query",
	"build_context",
	"get_analytics",
	"get_system_metrics",
	"health_check",
	"get_search_stats",
	"get_kg_stats",
]);

// ---------------------------------------------------------------------------
// Importance scores per tool — higher for richer / more durable content
// ---------------------------------------------------------------------------

const TOOL_IMPORTANCE: Partial<Record<string, number>> = {
	ingest_document: 0.8,
	add_entity: 0.7,
	add_relation: 0.7,
	create_matter: 0.7,
	add_memory: 0.6,
	batch_add_memories: 0.6,
	consolidate_memories: 0.5,
	cleanup_expired: 0.3,
};

// Minimum relevance score for recalled memories to appear in debug logs
const MIN_RECALL_SCORE = 0.6;

// Semantic text fields to extract from args — tried in order, first match wins
const SEMANTIC_FIELDS = [
	"content",
	"query",
	"text",
	"description",
	"topic",
	"entity_name",
	"name",
	"subject",
	"url",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a semantic search query from tool arguments.
 *
 * Prefers human-readable text fields (content, query, description…) over
 * raw JSON serialisation so the vector search receives meaningful input.
 */
function buildSearchQuery(
	toolName: string,
	args: Record<string, unknown>,
): string {
	for (const field of SEMANTIC_FIELDS) {
		const val = args[field];
		if (typeof val === "string" && val.length > 8) {
			return val.slice(0, 250);
		}
	}

	// Fallback: tool name + compact scalar-only JSON (skip large nested objects)
	const compactArgs = Object.fromEntries(
		Object.entries(args).filter(([, v]) => typeof v !== "object" || v === null),
	);
	return `${toolName} ${JSON.stringify(compactArgs)}`.slice(0, 200);
}

/**
 * Extract the most meaningful content to store for a tool call.
 *
 * Prefers the input args (intent) over the result text (confirmation noise).
 * For relation tools, synthesises a human-readable triple.
 */
function extractStorageContent(
	toolName: string,
	args: Record<string, unknown>,
	resultText: string,
): string {
	// Special-case: relation triple is the primary fact worth storing
	if (toolName === "add_relation") {
		const from = args.from_entity;
		const to = args.to_entity;
		const rel = args.relation_type ?? "relates_to";
		if (typeof from === "string" && typeof to === "string") {
			return `[add_relation] ${from} -[${rel}]-> ${to}`.slice(0, 500);
		}
	}

	for (const field of SEMANTIC_FIELDS) {
		const val = args[field];
		if (typeof val === "string" && val.length > 5) {
			return `[${toolName}] ${val.slice(0, 460)}`.slice(0, 500);
		}
	}

	// Fallback to result text
	return `[${toolName}] ${resultText.slice(0, 460)}`.slice(0, 500);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register pre- and post-tool hooks on the given HookManager.
 *
 * A single MemoryAPIClient is created and shared across both hooks.
 * All errors are caught and logged as warnings — hooks must never throw.
 */
export function registerMemoryHooks(
	hookManager: HookManager,
	config: MCPConfig,
): void {
	const client = new MemoryAPIClient(config.apiUrl);

	// -------------------------------------------------------------------------
	// Hook 1: Pre-tool memory recall
	// -------------------------------------------------------------------------

	hookManager.registerPreToolHook({
		name: "memory-recall",
		priority: 10,
		enabled: true,
		handler: async (ctx: ToolCallContext): Promise<void> => {
			// Skip recall for read-only memory tools — they fetch their own context
			if (SKIP_RECALL_TOOLS.has(ctx.toolName)) return;

			try {
				const query = buildSearchQuery(ctx.toolName, ctx.args);
				const searchResult = await client.searchMemories({ query, limit: 5 });

				const relevant = searchResult.results.filter(
					(m) => (m.score ?? 0) >= MIN_RECALL_SCORE,
				);

				if (relevant.length > 0) {
					logger.debug("Memory recall", {
						tool: ctx.toolName,
						query: query.slice(0, 80),
						count: relevant.length,
						memories: relevant.map((m) => ({
							memory_id: m.memory_id,
							content: m.content?.slice(0, 120),
							score: m.score,
						})),
					});
					hookManager.storeRecallResult({
						requestId: ctx.requestId,
						toolName: ctx.toolName,
						query,
						memories: relevant.map((m) => ({
							memory_id: m.memory_id,
							content: m.content ?? "",
							score: m.score ?? 0,
						})),
						timestamp: Date.now(),
					});
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.warn(
					`Memory recall hook failed for tool "${ctx.toolName}": ${message}`,
				);
			}
		},
	});

	// -------------------------------------------------------------------------
	// Hook 2: Post-tool memory storage (write tools only)
	// -------------------------------------------------------------------------

	hookManager.registerPostToolHook({
		name: "memory-store",
		priority: 10,
		enabled: true,
		handler: async (ctx: ToolResultContext): Promise<void> => {
			// Only store memories for tools that mutate state
			if (!WRITE_TOOLS.has(ctx.toolName)) return;

			try {
				const firstTextBlock = ctx.result.content.find(
					(b) => b.type === "text",
				);
				const resultText = firstTextBlock?.text ?? "";

				const content = extractStorageContent(
					ctx.toolName,
					ctx.args,
					resultText,
				);

				// Skip if the composed content is too thin to be useful
				if (content.length < 20) return;

				const importance = TOOL_IMPORTANCE[ctx.toolName] ?? 0.5;

				await client.addMemory({
					content,
					memory_type: "fact",
					importance,
					tags: ["auto-hook", ctx.toolName],
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.warn(
					`Memory store hook failed for tool "${ctx.toolName}": ${message}`,
				);
			}
		},
	});
}
