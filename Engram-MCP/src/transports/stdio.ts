/**
 * stdio Transport — for local process-spawned MCP connections
 *
 * Used when Claude Code (or any MCP client) spawns the server as a child process
 * and communicates via stdin/stdout JSON-RPC.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { MCPConfig } from "../config.js";
import { HookManager } from "../hooks/hook-manager.js";
import { registerMemoryHooks } from "../hooks/memory-hooks.js";
import { logger } from "../logger.js";
import { createMCPServer } from "../server.js";

export async function startStdioTransport(config: MCPConfig): Promise<void> {
	logger.info("Starting Engram MCP Server (stdio transport)", {
		serverVersion: config.serverVersion,
		apiUrl: config.apiUrl,
	});

	// Set up hook manager with memory hooks
	const hookManager = new HookManager();
	registerMemoryHooks(hookManager, config);

	// Create the shared MCP server with all tools/resources/prompts
	const server = createMCPServer({ config, hookManager });

	// Connect via stdio
	const transport = new StdioServerTransport();
	await server.connect(transport);

	logger.info("Engram MCP Server running on stdio");
}
