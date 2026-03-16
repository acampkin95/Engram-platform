#!/usr/bin/env node
/**
 * AI Memory MCP Server — Streamable HTTP Transport (MCP spec 2025-06-18)
 *
 * Single endpoint: /mcp
 *   POST  — JSON-RPC requests (tools, resources, init)
 *   GET   — SSE server-push stream
 *   DELETE — session termination
 *
 * Health: GET /health
 */

import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { MemoryAPIClient } from "./client.js";
import { config } from "./config.js";
import { generateRequestId, logger } from "./logger.js";
import { PROMPTS, renderPrompt } from "./prompts.js";
import { RESOURCE_TEMPLATES, STATIC_RESOURCES } from "./resources/enhanced-resources.js";
import { handleResourceRequest } from "./resources/memory-resources.js";
import { handleEntityTool } from "./tools/entity-tools.js";
import { handleInvestigationTool } from "./tools/investigation-tools.js";
import { handleMemoryTool } from "./tools/memory-tools.js";
import { ALL_TOOLS } from "./tools/tool-definitions.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = config.port;
const API_URL = config.apiUrl;
const SERVER_NAME = config.serverName;
const SERVER_VERSION = config.serverVersion;

// Allowed origins for CORS / Origin validation (DNS-rebinding protection).
// Populated from CORS_ORIGINS env var (comma-separated) plus localhost variants.
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1",
  ...(config.corsOrigins ?? []),
]);

// ---------------------------------------------------------------------------
// Active session registry
// Session ID → StreamableHTTPServerTransport instance
// ---------------------------------------------------------------------------

const sessions = new Map<string, StreamableHTTPServerTransport>();

// ---------------------------------------------------------------------------
// MCP Server factory — one Server instance per session (stateful transport)
// ---------------------------------------------------------------------------

function createMCPServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  const apiClient = new MemoryAPIClient(API_URL);

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return { tools: ALL_TOOLS };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to list tools", { error: { message } });
      throw new Error(`Failed to list tools: ${message}`);
    }
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const requestId = generateRequestId();
    const startedAt = Date.now();
    const { name, arguments: args = {} } = request.params;

    try {
      logger.toolStart(name, args, requestId);

      const memoryResult = await handleMemoryTool(name, args, apiClient);
      if (memoryResult) {
        logger.toolSuccess(name, Date.now() - startedAt, requestId);
        return memoryResult;
      }

      const entityResult = await handleEntityTool(name, args, apiClient);
      if (entityResult) {
        logger.toolSuccess(name, Date.now() - startedAt, requestId);
        return entityResult;
      }

      const investigationResult = await handleInvestigationTool(name, args, apiClient);
      if (investigationResult) {
        logger.toolSuccess(name, Date.now() - startedAt, requestId);
        return investigationResult;
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.toolError(
        name,
        error instanceof Error ? error : new Error(message),
        Date.now() - startedAt,
        requestId
      );
      throw new Error(`Tool ${name} failed: ${message}`);
    }
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return { resources: STATIC_RESOURCES };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to list resources", { error: { message } });
      throw new Error(`Failed to list resources: ${message}`);
    }
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    try {
      return { resourceTemplates: RESOURCE_TEMPLATES };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to list resource templates", { error: { message } });
      throw new Error(`Failed to list resource templates: ${message}`);
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      return { prompts: PROMPTS };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to list prompts", { error: { message } });
      throw new Error(`Failed to list prompts: ${message}`);
    }
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      const { name, arguments: args = {} } = request.params;
      const prompt = PROMPTS.find((p) => p.name === name);
      if (!prompt) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      const rendered = renderPrompt(name, args);
      if (!rendered) {
        throw new Error(`Prompt template not found: ${name}`);
      }

      return {
        description: prompt.description,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: rendered,
            },
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to get prompt", { error: { message } });
      throw new Error(`Failed to get prompt: ${message}`);
    }
  });

  // Handle resource requests
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      return await handleResourceRequest(request.params.uri, apiClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Resource read failed", {
        resource: request.params.uri,
        error: { message },
      });
      throw new Error(`Resource ${request.params.uri} failed: ${message}`);
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0];
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
// Request body reader
// ---------------------------------------------------------------------------

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info("AI Memory MCP Server starting", {
    serverVersion: SERVER_VERSION,
    apiUrl: API_URL,
    port: PORT,
    transport: "streamable-http",
  });

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const origin = req.headers.origin;
    const method = req.method ?? "GET";

    // -----------------------------------------------------------------------
    // CORS pre-flight
    // -----------------------------------------------------------------------
    if (method === "OPTIONS") {
      const headers = corsHeaders(origin);
      res.writeHead(204, headers);
      res.end();
      return;
    }

    // -----------------------------------------------------------------------
    // Health check — GET /health
    // -----------------------------------------------------------------------
    if (url.pathname === "/health" && method === "GET") {
      const body = JSON.stringify({
        status: "ok",
        service: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "streamable-http",
        activeSessions: sessions.size,
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...corsHeaders(origin),
      });
      res.end(body);
      return;
    }

    // -----------------------------------------------------------------------
    // MCP endpoint — /mcp
    // -----------------------------------------------------------------------
    if (url.pathname === "/mcp") {
      // --- POST: new or existing session request ---
      if (method === "POST") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && sessions.has(sessionId)) {
          // Resume existing session
          const existingTransport = sessions.get(sessionId);
          if (!existingTransport) {
            res.writeHead(404, {
              "Content-Type": "application/json",
              ...corsHeaders(origin),
            });
            res.end(JSON.stringify({ error: "Session not found", sessionId }));
            return;
          }
          transport = existingTransport;
        } else if (!sessionId) {
          // New session — create transport + server
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, transport);
              logger.info("MCP session initialized", { sessionId: id });
            },
            onsessionclosed: (id) => {
              sessions.delete(id);
              logger.info("MCP session closed", { sessionId: id });
            },
          });

          const server = createMCPServer();
          await server.connect(transport);
        } else {
          // Unknown session ID
          res.writeHead(404, {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          });
          res.end(JSON.stringify({ error: "Session not found", sessionId }));
          return;
        }

        // Read body and hand off to transport
        try {
          const body = await readBody(req);
          await transport.handleRequest(req, res, JSON.parse(body));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("MCP POST handler error", { error: { message } });
          if (!res.headersSent) {
            res.writeHead(500, {
              "Content-Type": "application/json",
              ...corsHeaders(origin),
            });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        }
        return;
      }

      // --- GET: SSE stream for existing session ---
      if (method === "GET") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (!sessionId || !sessions.has(sessionId)) {
          res.writeHead(400, {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          });
          res.end(JSON.stringify({ error: "Missing or invalid Mcp-Session-Id header" }));
          return;
        }

        const transport = sessions.get(sessionId);
        if (!transport) {
          res.writeHead(404, {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          });
          res.end(JSON.stringify({ error: "Session not found", sessionId }));
          return;
        }
        try {
          await transport.handleRequest(req, res);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("MCP GET/SSE handler error", {
            sessionId,
            error: { message },
          });
        }
        return;
      }

      // --- DELETE: terminate session ---
      if (method === "DELETE") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (!sessionId || !sessions.has(sessionId)) {
          res.writeHead(404, {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          });
          res.end(JSON.stringify({ error: "Session not found" }));
          return;
        }

        const transport = sessions.get(sessionId);
        if (!transport) {
          res.writeHead(404, {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          });
          res.end(JSON.stringify({ error: "Session not found", sessionId }));
          return;
        }
        try {
          await transport.handleRequest(req, res);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("MCP DELETE handler error", {
            sessionId,
            error: { message },
          });
        }
        sessions.delete(sessionId);
        return;
      }

      // Method not allowed
      res.writeHead(405, {
        Allow: "GET, POST, DELETE, OPTIONS",
        ...corsHeaders(origin),
      });
      res.end();
      return;
    }

    // -----------------------------------------------------------------------
    // 404 for everything else
    // -----------------------------------------------------------------------
    res.writeHead(404, {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    });
    res.end(JSON.stringify({ error: "Not found", path: url.pathname }));
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info("AI Memory MCP Server ready", {
      serverVersion: SERVER_VERSION,
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
    for (const [id, transport] of sessions) {
      try {
        await transport.close();
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Fatal server error", { error: { message } });
  process.exit(1);
});
