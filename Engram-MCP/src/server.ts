/**
 * Engram Unified MCP Server — Shared Server Factory
 *
 * Creates a configured MCP Server instance with all tools, resources, and prompts
 * registered. This is transport-agnostic — the same server works with stdio or HTTP.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourceTemplatesRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { MemoryAPIClient } from "./client.js";
import type { MCPConfig } from "./config.js";
import { InternalServerError, InvalidInputError, NotFoundError, isMemoryError } from "./errors.js";
import type { HookManager } from "./hooks/hook-manager.js";
import { generateRequestId, logger } from "./logger.js";
import { PROMPTS, renderPrompt } from "./prompts.js";
import { RESOURCE_TEMPLATES, STATIC_RESOURCES } from "./resources/enhanced-resources.js";
import { handleResourceRequest } from "./resources/memory-resources.js";
import { handleEntityTool } from "./tools/entity-tools.js";
import { handleInvestigationTool } from "./tools/investigation-tools.js";
import { handleMemoryTool } from "./tools/memory-tools.js";
import { ALL_TOOLS } from "./tools/tool-definitions.js";

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export interface CreateServerOptions {
	config: MCPConfig;
	hookManager?: HookManager;
}

export function createMCPServer(options: CreateServerOptions): Server {
	const { config, hookManager } = options;

	const server = new Server(
		{ name: config.serverName, version: config.serverVersion },
		{
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
		},
	);

	const apiClient = new MemoryAPIClient(config.apiUrl);

	// -------------------------------------------------------------------------
	// Tools
	// -------------------------------------------------------------------------

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		try {
			return { tools: ALL_TOOLS };
		} catch (error) {
			if (isMemoryError(error)) throw error;
			const cause = error instanceof Error ? error : undefined;
			const message = cause?.message ?? String(error);
			logger.error("Failed to list tools", { error: { message, stack: cause?.stack } });
			throw new InternalServerError(`Failed to list tools: ${message}`, { cause });
		}
	});

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const requestId = generateRequestId();
		const startedAt = Date.now();
		const { name, arguments: args = {} } = request.params;

		try {
			// Pre-tool hook
			if (hookManager) {
				await hookManager.onPreToolUse(name, args, requestId);
			}

			logger.toolStart(name, args, requestId);

			let result: { content: Array<{ type: string; text: string }> } | null | undefined;

			if (name === "health_check") {
				const health = await apiClient.healthCheck();
				const includeDetails =
					typeof args.include_details === "boolean" ? args.include_details : false;

				result = {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								includeDetails
									? {
											success: true,
											status: health.status,
											memoryApi: {
												weaviate: health.weaviate,
												redis: health.redis,
											},
										}
									: {
											success: health.status === "healthy",
											status: health.status,
										},
								null,
								2,
							),
						},
					],
				};
			}

			result ??= await handleMemoryTool(name, args, apiClient);
			result ??= await handleEntityTool(name, args, apiClient);
			result ??= await handleInvestigationTool(name, args, apiClient);

			if (!result) {
				throw new InvalidInputError(`Unknown tool: ${name}`);
			}

			logger.toolSuccess(name, Date.now() - startedAt, requestId);

			// Post-tool hook
			if (hookManager) {
				await hookManager.onPostToolUse(name, args, result, requestId, Date.now() - startedAt);
			}

			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.toolError(
				name,
				error instanceof Error ? error : new Error(message),
				Date.now() - startedAt,
				requestId,
			);
			if (isMemoryError(error)) throw error;
			throw new InternalServerError(`Tool ${name} failed: ${message}`, {
				cause: error instanceof Error ? error : undefined,
			});
		}
	});

	// -------------------------------------------------------------------------
	// Resources
	// -------------------------------------------------------------------------

	server.setRequestHandler(ListResourcesRequestSchema, async () => {
		try {
			return { resources: STATIC_RESOURCES };
		} catch (error) {
			if (isMemoryError(error)) throw error;
			const cause = error instanceof Error ? error : undefined;
			const message = cause?.message ?? String(error);
			logger.error("Failed to list resources", { error: { message, stack: cause?.stack } });
			throw new InternalServerError(`Failed to list resources: ${message}`, { cause });
		}
	});

	server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
		try {
			return { resourceTemplates: RESOURCE_TEMPLATES };
		} catch (error) {
			if (isMemoryError(error)) throw error;
			const cause = error instanceof Error ? error : undefined;
			const message = cause?.message ?? String(error);
			logger.error("Failed to list resource templates", {
				error: { message, stack: cause?.stack },
			});
			throw new InternalServerError(`Failed to list resource templates: ${message}`, { cause });
		}
	});

	// -------------------------------------------------------------------------
	// Prompts
	// -------------------------------------------------------------------------

	server.setRequestHandler(ListPromptsRequestSchema, async () => {
		try {
			return { prompts: PROMPTS };
		} catch (error) {
			if (isMemoryError(error)) throw error;
			const cause = error instanceof Error ? error : undefined;
			const message = cause?.message ?? String(error);
			logger.error("Failed to list prompts", { error: { message, stack: cause?.stack } });
			throw new InternalServerError(`Failed to list prompts: ${message}`, { cause });
		}
	});

	server.setRequestHandler(GetPromptRequestSchema, async (request) => {
		try {
			const { name, arguments: args = {} } = request.params;
			const prompt = PROMPTS.find((p) => p.name === name);
			if (!prompt) {
				throw new NotFoundError("Prompt", name);
			}

			const rendered = renderPrompt(name, args);
			if (!rendered) {
				throw new NotFoundError("Prompt template", name);
			}

			return {
				description: prompt.description,
				messages: [
					{
						role: "user" as const,
						content: { type: "text" as const, text: rendered },
					},
				],
			};
		} catch (error) {
			if (isMemoryError(error)) throw error;
			const cause = error instanceof Error ? error : undefined;
			const message = cause?.message ?? String(error);
			logger.error("Failed to get prompt", { error: { message, stack: cause?.stack } });
			throw new InternalServerError(`Failed to get prompt: ${message}`, { cause });
		}
	});

	// -------------------------------------------------------------------------
	// Resource reads
	// -------------------------------------------------------------------------

	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		try {
			return await handleResourceRequest(request.params.uri, apiClient);
		} catch (error) {
			if (isMemoryError(error)) throw error;
			const cause = error instanceof Error ? error : undefined;
			const message = cause?.message ?? String(error);
			logger.error("Resource read failed", {
				resource: request.params.uri,
				error: { message, stack: cause?.stack },
			});
			throw new InternalServerError(`Resource ${request.params.uri} failed: ${message}`, { cause });
		}
	});

	return server;
}
