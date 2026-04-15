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

// ---------------------------------------------------------------------------
// Startup banner
// ---------------------------------------------------------------------------

function printBanner(): void {
	const lines = [
		"",
		"  ┌─────────────────────────────────────────────┐",
		"  │  Engram MCP Server                          │",
		`  │  v${config.serverVersion.padEnd(43)}│`,
		`  │  Transport: ${config.transport.padEnd(32)}│`,
		`  │  API: ${config.apiUrl.padEnd(39)}│`,
		"  └─────────────────────────────────────────────┘",
		"",
	];
	for (const line of lines) {
		logger.info(line);
	}
}

// ---------------------------------------------------------------------------
// Graceful shutdown (works for both transports)
// ---------------------------------------------------------------------------

let shuttingDown = false;

function handleShutdown(signal: string): void {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info(`Received ${signal}, shutting down gracefully`);
	// Allow 5s for in-flight requests to complete before force-exit
	const forceTimer = setTimeout(() => {
		logger.warn("Forced shutdown after timeout");
		process.exit(1);
	}, 5000);
	forceTimer.unref();
	// HTTP transport's own shutdown handler closes sessions + server.
	// For stdio the process simply exits.
	process.exit(0);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Global error handlers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	printBanner();

	logger.info("Engram MCP Server starting", {
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

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	logger.error("Fatal server error", {
		error: { message, stack: error instanceof Error ? error.stack : undefined },
	});
	process.exit(1);
}
