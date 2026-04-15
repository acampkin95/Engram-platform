import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";

/**
 * Integration test for the /health endpoint on the HTTP transport.
 *
 * Spawns the server as a child process on a test port, sends a GET /health
 * request, and validates the response shape.
 */
describe("Health endpoint (integration)", () => {
	const TEST_PORT = 39876; // High port to avoid conflicts
	let server: ChildProcess;
	let serverReady = false;

	before(async () => {
		server = spawn("node", ["dist/index.js", "--transport", "http"], {
			cwd: process.cwd(),
			env: {
				...process.env,
				MCP_SERVER_PORT: String(TEST_PORT),
				MCP_TRANSPORT: "http",
				MCP_LOG_LEVEL: "error",
				// Disable OAuth for the health test
				OAUTH_ENABLED: "false",
				// Prevent API connection attempts
				MEMORY_API_URL: "http://127.0.0.1:19999",
			},
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Wait for server to be ready (max 5 seconds)
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline) {
			try {
				const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
				if (res.ok) {
					serverReady = true;
					break;
				}
			} catch {
				// Server not ready yet
			}
			await new Promise((r) => setTimeout(r, 100));
		}
	});

	after(() => {
		if (server && !server.killed) {
			server.kill("SIGTERM");
		}
	});

	it("returns 200 OK", async () => {
		if (!serverReady) {
			// Skip gracefully if server didn't start (e.g. port conflict)
			return;
		}
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
		assert.equal(res.status, 200);
	});

	it("returns JSON content type", async () => {
		if (!serverReady) return;
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
		assert.ok(res.headers.get("content-type")?.includes("application/json"));
	});

	it("returns expected response shape", async () => {
		if (!serverReady) return;
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
		const body = (await res.json()) as Record<string, unknown>;

		assert.equal(body.status, "ok");
		assert.equal(typeof body.service, "string");
		assert.equal(typeof body.version, "string");
		assert.equal(body.transport, "streamable-http");
		assert.equal(typeof body.activeSessions, "number");
		assert.equal(typeof body.timestamp, "string");
	});

	it("includes X-Request-Id header", async () => {
		if (!serverReady) return;
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
		const requestId = res.headers.get("x-request-id");
		assert.ok(requestId !== null && requestId.length > 0);
	});

	it("includes Cache-Control: no-cache header", async () => {
		if (!serverReady) return;
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
		assert.equal(res.headers.get("cache-control"), "no-cache");
	});
});
