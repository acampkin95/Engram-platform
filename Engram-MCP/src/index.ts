#!/usr/bin/env node
/**
 * Engram Unified MCP Server — Entry Point
 *
 * Selects transport based on CLI args or environment:
 *   --transport stdio   → stdio (stdin/stdout JSON-RPC)
 *   --transport http    → HTTP streaming (SSE + JSON-RPC over HTTP)
 *
 * Default: http (unless MCP_TRANSPORT=stdio is set)
 */

import { config } from "./config.js";
import { logger } from "./logger.js";
import { startHttpTransport } from "./transports/http.js";
import { startStdioTransport } from "./transports/stdio.js";

async function main(): Promise<void> {
	logger.info("Engram Unified MCP Server starting", {
		transport: config.transport,
		serverName: config.serverName,
		serverVersion: config.serverVersion,
	});

	switch (config.transport) {
		case "stdio":
			await startStdioTransport(config);
			break;
		case "http":
			await startHttpTransport(config);
			break;
		default:
			logger.error(`Unknown transport: ${config.transport}`);
			process.exit(1);
	}
}

// Graceful shutdown for stdio transport only
// (HTTP transport registers its own per-server handlers in transports/http.ts)
if (config.transport === "stdio") {
	const shutdown = (signal: string): void => {
		logger.info(`Received ${signal}, shutting down`);
		process.exit(0);
	};
	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

// Global error handlers — catch truly unexpected failures
process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception", {
		error: { message: error.stack ?? error.message },
	});
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	const message =
		reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
	logger.error("Unhandled rejection", { error: { message } });
	process.exit(1);
});

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	logger.error("Fatal server error", {
		error: { message, stack: error instanceof Error ? error.stack : undefined },
	});
	process.exit(1);
}
