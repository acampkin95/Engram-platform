/**
 * Memory hooks — automatic recall/storage around every tool call
 *
 * Hook 1 (pre):  search for relevant memories before tool executes
 * Hook 2 (post): store a memory entry after write-like tools complete
 */

import { MemoryAPIClient } from "../client.js";
import type { MCPConfig } from "../config.js";
import { logger } from "../logger.js";
import type { HookManager } from "./hook-manager.js";
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
]);

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
			if (SKIP_RECALL_TOOLS.has(ctx.toolName)) {
				return;
			}
			try {
				// Build a compact search query (toolName + truncated args JSON)
				const argsStr = JSON.stringify(ctx.args).slice(0, 150);
				const query = `${ctx.toolName} ${argsStr}`.slice(0, 200);

				const searchResult = await client.searchMemories({ query, limit: 5 });

				if (searchResult.results.length > 0) {
					logger.debug("Memory recall", {
						tool: ctx.toolName,
						count: searchResult.results.length,
						memories: searchResult.results.map((m) => ({
							memory_id: m.memory_id,
							content: m.content,
							score: m.score,
						})),
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
			if (!WRITE_TOOLS.has(ctx.toolName)) {
				return;
			}

			try {
				// Extract the first text block from the result content array
				const firstTextBlock = ctx.result.content.find(
					(block) => block.type === "text",
				);
				const resultText = (firstTextBlock?.text ?? "").slice(0, 450);

				// Compose the memory entry and cap at 500 chars
				const content = `[Tool: ${ctx.toolName}] ${resultText}`.slice(0, 500);

				await client.addMemory({
					content,
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
