/**
 * HTTP Streaming Transport — Streamable HTTP (MCP spec 2025-06-18)
 *
 * Single endpoint: /mcp
 *   POST   — JSON-RPC requests (tools, resources, init)
 *   GET    — SSE server-push stream
 *   DELETE — session termination
 *
 * Also serves:
 *   GET /health              — health check
 *   GET /.well-known/oauth-authorization-server — OAuth metadata (if enabled)
 *   POST /oauth/register     — dynamic client registration (if enabled)
 *   GET  /oauth/authorize    — authorization endpoint (if enabled)
 *   POST /oauth/token        — token endpoint (if enabled)
 */

import { createServer } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { initKeyValidator, validateAuth } from "../auth/middleware.js";
import type { MCPConfig } from "../config.js";
import { HookManager } from "../hooks/hook-manager.js";
import { registerMemoryHooks } from "../hooks/memory-hooks.js";
import { generateRequestId, logger } from "../logger.js";
import { createMCPServer } from "../server.js";
import {
	RequestBodyAbortedError,
	RequestBodyTooLargeError,
	readBody,
} from "../utils/read-body.js";

// ---------------------------------------------------------------------------
// Active session registry
// ---------------------------------------------------------------------------

interface SessionEntry {
	transport: StreamableHTTPServerTransport;
	lastActivity: number;
}

const sessions = new Map<string, SessionEntry>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function buildAllowedOrigins(config: MCPConfig): Set<string> {
	const devOrigins =
		process.env.NODE_ENV !== "production"
			? [
					"http://localhost",
					"http://localhost:3000",
					"http://localhost:3001",
					"http://127.0.0.1",
				]
			: [];
	return new Set<string>([...devOrigins, ...(config.corsOrigins ?? [])]);
}

function corsHeaders(
	origin: string | undefined,
	allowedOrigins: Set<string>,
): Record<string, string> {
	const allowed = origin && allowedOrigins.has(origin) ? origin : undefined;
	if (!allowed) {
		return {
			"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
			"Access-Control-Allow-Headers":
				"Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Accept, Last-Event-ID",
			"Access-Control-Expose-Headers": "Mcp-Session-Id",
			"Access-Control-Max-Age": "86400",
		};
	}
	return {
		"Access-Control-Allow-Origin": allowed,
		"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Accept, Last-Event-ID",
		"Access-Control-Expose-Headers": "Mcp-Session-Id",
		"Access-Control-Max-Age": "86400",
	};
}

// ---------------------------------------------------------------------------
// Start HTTP transport
// ---------------------------------------------------------------------------

export async function startHttpTransport(config: MCPConfig): Promise<void> {
	const PORT = config.port;
	const allowedOrigins = buildAllowedOrigins(config);

	// Set up hook manager
	const hookManager = new HookManager();
	registerMemoryHooks(hookManager, config);

	// Initialize API key validator (validates against Platform's BetterAuth)
	if (config.platformUrl) {
		initKeyValidator(config.platformUrl);
	}

	logger.info("Starting Engram MCP Server (HTTP streaming transport)", {
		serverVersion: config.serverVersion,
		apiUrl: config.apiUrl,
		port: PORT,
	});

	const httpServer = createServer(async (req, res) => {
		const requestId = generateRequestId();
		const startedAt = Date.now();
		const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
		const origin = req.headers.origin;
		const method = req.method ?? "GET";
		const baseHeaders = {
			...corsHeaders(origin, allowedOrigins),
			"X-Request-Id": requestId,
		};

		logger.apiRequest(method, url.pathname, requestId);
		res.setHeader("X-Request-Id", requestId);

		const respondJson = (statusCode: number, payload: unknown): void => {
			if (!res.headersSent) {
				res.writeHead(statusCode, {
					"Content-Type": "application/json",
					...baseHeaders,
				});
				res.end(JSON.stringify(payload));
			}
			logger.apiResponse(
				method,
				url.pathname,
				statusCode,
				Date.now() - startedAt,
				requestId,
			);
		};

		try {
			// ----- CORS pre-flight -----
			if (method === "OPTIONS") {
				res.writeHead(204, baseHeaders);
				res.end();
				logger.apiResponse(
					method,
					url.pathname,
					204,
					Date.now() - startedAt,
					requestId,
				);
				return;
			}

			// ----- Health check -----
			if (url.pathname === "/health" && method === "GET") {
				const body = JSON.stringify({
					status: "ok",
					service: config.serverName,
					version: config.serverVersion,
					transport: "streamable-http",
					activeSessions: sessions.size,
					timestamp: new Date().toISOString(),
				});
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
					...baseHeaders,
				});
				res.end(body);
				logger.apiResponse(
					method,
					url.pathname,
					200,
					Date.now() - startedAt,
					requestId,
				);
				return;
			}

			// ----- MCP endpoint -----
			if (url.pathname === "/mcp") {
				// Auth validation (API key via Redis)
				const authResult = await validateAuth(req);
				if (!authResult.valid) {
					logger.warn("Authentication failed", {
						requestId,
						path: url.pathname,
						reason: authResult.error,
					});
					if (!res.headersSent) {
						res.writeHead(401, {
							"Content-Type": "application/json",
							"WWW-Authenticate": "Bearer",
							...baseHeaders,
						});
						res.end(
							JSON.stringify({
								error: "unauthorized",
								message: authResult.error,
							}),
						);
					}
					logger.apiResponse(
						method,
						url.pathname,
						401,
						Date.now() - startedAt,
						requestId,
					);
					return;
				}

				// --- POST: new or existing session ---
				if (method === "POST") {
					const sessionId = req.headers["mcp-session-id"] as string | undefined;
					let transport: StreamableHTTPServerTransport;

					if (sessionId && sessions.has(sessionId)) {
						const existing = sessions.get(sessionId);
						if (!existing) {
							respondJson(500, {
								error: "internal_error",
								message: "Session registry inconsistent",
							});
							return;
						}
						transport = existing.transport;
						existing.lastActivity = Date.now();
					} else if (!sessionId) {
						const newTransport = new StreamableHTTPServerTransport({
							sessionIdGenerator: () => crypto.randomUUID(),
							onsessioninitialized: (id) => {
								sessions.set(id, {
									transport: newTransport,
									lastActivity: Date.now(),
								});
								logger.info("MCP session initialized", {
									sessionId: id,
									requestId,
								});
							},
							onsessionclosed: (id) => {
								sessions.delete(id);
								logger.info("MCP session closed", { sessionId: id, requestId });
							},
						});
						transport = newTransport;

						const server = createMCPServer({ config, hookManager });
						await server.connect(transport);
					} else {
						respondJson(404, { error: "Session not found", sessionId });
						return;
					}

					let parsedBody: unknown;
					try {
						const body = await readBody(req);
						parsedBody = JSON.parse(body);
					} catch (error) {
						if (error instanceof RequestBodyTooLargeError) {
							respondJson(413, {
								error: "payload_too_large",
								message: "MCP request body exceeds the maximum allowed size",
							});
							return;
						}
						if (error instanceof RequestBodyAbortedError) {
							respondJson(400, {
								error: "request_aborted",
								message: "Request body stream was aborted before completion",
							});
							return;
						}
						if (error instanceof SyntaxError) {
							respondJson(400, {
								error: "invalid_json",
								message: "Request body must be valid JSON",
							});
							return;
						}

						const message =
							error instanceof Error ? error.message : String(error);
						logger.error("Failed to parse MCP POST body", {
							requestId,
							error: {
								message,
								stack: error instanceof Error ? error.stack : undefined,
							},
						});
						respondJson(500, {
							error: "internal_error",
							message: "Failed to parse request body",
						});
						return;
					}

					try {
						await transport.handleRequest(req, res, parsedBody);
						logger.debug("MCP POST request handled", {
							requestId,
							sessionId: req.headers["mcp-session-id"],
						});
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						logger.error("MCP POST handler error", {
							requestId,
							error: {
								message,
								stack: err instanceof Error ? err.stack : undefined,
							},
						});
						respondJson(500, {
							error: "internal_error",
							message: "Internal server error",
						});
					}
					return;
				}

				// --- GET: SSE stream ---
				if (method === "GET") {
					const sessionId = req.headers["mcp-session-id"] as string | undefined;
					if (!sessionId || !sessions.has(sessionId)) {
						respondJson(400, {
							error: "Missing or invalid Mcp-Session-Id header",
						});
						return;
					}
					const entry = sessions.get(sessionId);
					if (!entry) {
						respondJson(500, {
							error: "internal_error",
							message: "Session registry inconsistent",
						});
						return;
					}
					entry.lastActivity = Date.now();
					const transport = entry.transport;
					try {
						await transport.handleRequest(req, res);
						logger.debug("MCP GET/SSE request handled", {
							requestId,
							sessionId,
						});
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						logger.error("MCP GET/SSE handler error", {
							requestId,
							sessionId,
							error: {
								message,
								stack: err instanceof Error ? err.stack : undefined,
							},
						});
						respondJson(500, {
							error: "internal_error",
							message: "Internal server error",
						});
					}
					return;
				}

				// --- DELETE: terminate session ---
				if (method === "DELETE") {
					const sessionId = req.headers["mcp-session-id"] as string | undefined;
					if (!sessionId || !sessions.has(sessionId)) {
						respondJson(404, { error: "Session not found" });
						return;
					}
					const entry = sessions.get(sessionId);
					if (!entry) {
						respondJson(500, {
							error: "internal_error",
							message: "Session registry inconsistent",
						});
						return;
					}
					const transport = entry.transport;
					try {
						await transport.handleRequest(req, res);
						logger.debug("MCP DELETE request handled", {
							requestId,
							sessionId,
						});
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						logger.error("MCP DELETE handler error", {
							requestId,
							sessionId,
							error: {
								message,
								stack: err instanceof Error ? err.stack : undefined,
							},
						});
						respondJson(500, {
							error: "internal_error",
							message: "Internal server error",
						});
						return;
					}
					sessions.delete(sessionId);
					return;
				}

				// Method not allowed
				res.writeHead(405, {
					Allow: "GET, POST, DELETE, OPTIONS",
					...baseHeaders,
				});
				res.end();
				logger.apiResponse(
					method,
					url.pathname,
					405,
					Date.now() - startedAt,
					requestId,
				);
				return;
			}

			// ----- 404 -----
			respondJson(404, { error: "Not found", path: url.pathname });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error("Unhandled HTTP transport error", {
				requestId,
				path: url.pathname,
				method,
				error: {
					message,
					stack: error instanceof Error ? error.stack : undefined,
				},
			});
			respondJson(500, {
				error: "internal_error",
				message: "Internal server error",
			});
		}
	});

	// Prevent Slowloris attacks
	httpServer.setTimeout(30_000); // 30s socket inactivity timeout
	httpServer.headersTimeout = 10_000; // 10s to receive headers
	httpServer.keepAliveTimeout = 5_000; // 5s keep-alive

	// Prune expired sessions every 60 seconds
	const sessionPruneTimer = setInterval(() => {
		const now = Date.now();
		for (const [id, entry] of sessions) {
			if (now - entry.lastActivity > SESSION_TTL_MS) {
				entry.transport.close().catch(() => {});
				sessions.delete(id);
				logger.info("Session pruned (TTL expired)", { sessionId: id });
			}
		}
	}, 60_000);
	sessionPruneTimer.unref();

	httpServer.listen(PORT, "0.0.0.0", () => {
		logger.info("Engram MCP Server ready", {
			serverVersion: config.serverVersion,
			port: PORT,
			endpoints: {
				mcp: `http://0.0.0.0:${PORT}/mcp`,
				health: `http://0.0.0.0:${PORT}/health`,
			},
		});
	});

	// Graceful shutdown
	const shutdown = async (signal: string): Promise<void> => {
		logger.info(`Received ${signal}, shutting down gracefully`);
		clearInterval(sessionPruneTimer);
		for (const [id, entry] of sessions) {
			try {
				await entry.transport.close();
			} catch {
				// ignore close errors during shutdown
			}
			sessions.delete(id);
		}
		httpServer.close(() => {
			logger.info("HTTP server closed");
			process.exit(0);
		});
	};

	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}
