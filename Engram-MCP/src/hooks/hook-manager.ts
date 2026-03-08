/**
 * Hook Manager — orchestrates pre/post tool hooks for memory operations
 *
 * Hooks intercept tool calls to automatically:
 * - Recall relevant context before tool execution (pre-hook)
 * - Store insights and decisions after tool execution (post-hook)
 * - Persist critical context before compaction
 * - Store session summaries on stop
 */

import { logger } from "../logger.js";
import type {
	PostToolHookRegistration,
	PreToolHookRegistration,
	ToolCallContext,
	ToolResultContext,
} from "./types.js";

export class HookManager {
	private preToolHooks: PreToolHookRegistration[] = [];
	private postToolHooks: PostToolHookRegistration[] = [];

	// -------------------------------------------------------------------------
	// Registration
	// -------------------------------------------------------------------------

	registerPreToolHook(registration: PreToolHookRegistration): void {
		this.preToolHooks.push(registration);
		this.preToolHooks.sort((a, b) => a.priority - b.priority);
		logger.debug(`Registered pre-tool hook: ${registration.name}`);
	}

	registerPostToolHook(registration: PostToolHookRegistration): void {
		this.postToolHooks.push(registration);
		this.postToolHooks.sort((a, b) => a.priority - b.priority);
		logger.debug(`Registered post-tool hook: ${registration.name}`);
	}

	// -------------------------------------------------------------------------
	// Execution
	// -------------------------------------------------------------------------

	async onPreToolUse(
		toolName: string,
		args: Record<string, unknown>,
		requestId: string,
	): Promise<void> {
		const ctx: ToolCallContext = {
			toolName,
			args,
			requestId,
			timestamp: Date.now(),
		};

		for (const hook of this.preToolHooks) {
			if (!hook.enabled) continue;
			try {
				await hook.handler(ctx);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.warn(`Pre-tool hook "${hook.name}" failed: ${message}`);
				// Hooks are non-blocking — failures don't prevent tool execution
			}
		}
	}

	async onPostToolUse(
		toolName: string,
		args: Record<string, unknown>,
		result: { content: Array<{ type: string; text: string }> },
		requestId: string,
		durationMs: number,
	): Promise<void> {
		const ctx: ToolResultContext = {
			toolName,
			args,
			requestId,
			timestamp: Date.now(),
			result,
			durationMs,
		};

		for (const hook of this.postToolHooks) {
			if (!hook.enabled) continue;
			try {
				await hook.handler(ctx);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.warn(`Post-tool hook "${hook.name}" failed: ${message}`);
			}
		}
	}

	// -------------------------------------------------------------------------
	// Introspection
	// -------------------------------------------------------------------------

	listHooks(): {
		pre: Array<{ name: string; enabled: boolean }>;
		post: Array<{ name: string; enabled: boolean }>;
	} {
		return {
			pre: this.preToolHooks.map((h) => ({
				name: h.name,
				enabled: h.enabled,
			})),
			post: this.postToolHooks.map((h) => ({
				name: h.name,
				enabled: h.enabled,
			})),
		};
	}
}
