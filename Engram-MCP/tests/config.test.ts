import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	DEFAULT_CIRCUIT_BREAKER_CONFIG,
	DEFAULT_LOGGING_CONFIG,
	DEFAULT_RETRY_CONFIG,
	DEFAULT_TIMEOUT_CONFIG,
	type MCPConfig,
	loadConfig,
} from "../dist/config.js";

describe("loadConfig", () => {
	// Save and restore env vars around tests
	const savedEnv: Record<string, string | undefined> = {};
	const envKeysToRestore = [
		"MCP_SERVER_NAME",
		"MCP_SERVER_VERSION",
		"MCP_TRANSPORT",
		"MCP_SERVER_PORT",
		"MEMORY_API_URL",
		"AI_MEMORY_API_KEY",
		"MCP_AUTH_TOKEN",
		"CORS_ORIGINS",
		"OAUTH_ENABLED",
		"OAUTH_ISSUER",
		"OAUTH_SECRET",
		"OAUTH_ACCESS_TOKEN_TTL",
		"OAUTH_REFRESH_TOKEN_TTL",
		"MCP_RETRY_MAX",
		"MCP_RETRY_INITIAL_MS",
		"MCP_RETRY_MAX_MS",
		"MCP_RETRY_BACKOFF",
		"MCP_RETRY_JITTER",
		"MCP_CB_FAILURE_THRESHOLD",
		"MCP_CB_RESET_MS",
		"MCP_CB_SUCCESS_THRESHOLD",
		"MCP_CB_WINDOW_MS",
		"MCP_TIMEOUT_MS",
		"MCP_CONNECT_TIMEOUT_MS",
		"MCP_READ_TIMEOUT_MS",
		"MCP_LOG_LEVEL",
		"MCP_LOG_TIMESTAMPS",
		"MCP_LOG_REQUEST_IDS",
		"MCP_LOG_STDERR",
	];

	beforeEach(() => {
		for (const key of envKeysToRestore) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of envKeysToRestore) {
			if (savedEnv[key] !== undefined) {
				process.env[key] = savedEnv[key];
			} else {
				delete process.env[key];
			}
		}
	});

	describe("defaults", () => {
		it("uses default server name and version", () => {
			const cfg = loadConfig();
			assert.equal(cfg.serverName, "engram-mcp");
			assert.equal(cfg.serverVersion, "1.2.0");
		});

		it("defaults transport to http", () => {
			const cfg = loadConfig();
			assert.equal(cfg.transport, "http");
		});

		it("defaults port to 3000", () => {
			const cfg = loadConfig();
			assert.equal(cfg.port, 3000);
		});

		it("defaults apiUrl to localhost:8000", () => {
			const cfg = loadConfig();
			assert.equal(cfg.apiUrl, "http://localhost:8000");
		});

		it("uses default retry config", () => {
			const cfg = loadConfig();
			assert.deepEqual(cfg.retry, DEFAULT_RETRY_CONFIG);
		});

		it("uses default circuit breaker config", () => {
			const cfg = loadConfig();
			assert.deepEqual(cfg.circuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG);
		});

		it("uses default timeout config", () => {
			const cfg = loadConfig();
			assert.deepEqual(cfg.timeout, DEFAULT_TIMEOUT_CONFIG);
		});

		it("uses default logging config", () => {
			const cfg = loadConfig();
			assert.deepEqual(cfg.logging, DEFAULT_LOGGING_CONFIG);
		});

		it("apiKey and platformUrl are undefined by default", () => {
			const cfg = loadConfig();
			assert.equal(cfg.apiKey, undefined);
			assert.equal(cfg.platformUrl, undefined);
		});

		it("corsOrigins is undefined when no env set", () => {
			const cfg = loadConfig();
			assert.equal(cfg.corsOrigins, undefined);
		});
	});

	describe("env var overrides", () => {
		it("reads MCP_SERVER_NAME", () => {
			process.env.MCP_SERVER_NAME = "my-server";
			assert.equal(loadConfig().serverName, "my-server");
		});

		it("reads MCP_SERVER_VERSION", () => {
			process.env.MCP_SERVER_VERSION = "2.0.0";
			assert.equal(loadConfig().serverVersion, "2.0.0");
		});

		it("reads MCP_TRANSPORT as stdio", () => {
			process.env.MCP_TRANSPORT = "stdio";
			assert.equal(loadConfig().transport, "stdio");
		});

		it("reads MCP_SERVER_PORT as integer", () => {
			process.env.MCP_SERVER_PORT = "4000";
			assert.equal(loadConfig().port, 4000);
		});

		it("reads MEMORY_API_URL", () => {
			process.env.MEMORY_API_URL = "http://api.example.com";
			assert.equal(loadConfig().apiUrl, "http://api.example.com");
		});

		it("reads AI_MEMORY_API_KEY", () => {
			process.env.AI_MEMORY_API_KEY = "key123";
			assert.equal(loadConfig().apiKey, "key123");
		});

		it("reads CORS_ORIGINS as comma-separated list", () => {
			process.env.CORS_ORIGINS = "http://a.com, http://b.com";
			const cfg = loadConfig();
			assert.deepEqual(cfg.corsOrigins, ["http://a.com", "http://b.com"]);
		});

		it("reads PLATFORM_URL", () => {
			process.env.PLATFORM_URL = "http://platform:3000";
			assert.equal(loadConfig().platformUrl, "http://platform:3000");
		});

		it("reads retry config from env", () => {
			process.env.MCP_RETRY_MAX = "5";
			process.env.MCP_RETRY_INITIAL_MS = "200";
			const cfg = loadConfig();
			assert.equal(cfg.retry.maxRetries, 5);
			assert.equal(cfg.retry.initialDelayMs, 200);
		});

		it("reads circuit breaker config from env", () => {
			process.env.MCP_CB_FAILURE_THRESHOLD = "10";
			process.env.MCP_CB_RESET_MS = "60000";
			const cfg = loadConfig();
			assert.equal(cfg.circuitBreaker.failureThreshold, 10);
			assert.equal(cfg.circuitBreaker.resetTimeoutMs, 60000);
		});

		it("reads timeout config from env", () => {
			process.env.MCP_TIMEOUT_MS = "15000";
			assert.equal(loadConfig().timeout.requestMs, 15000);
		});

		it("reads log level from env", () => {
			process.env.MCP_LOG_LEVEL = "debug";
			assert.equal(loadConfig().logging.level, "debug");
		});

		it("falls back to default for invalid integer env vars", () => {
			process.env.MCP_SERVER_PORT = "not_a_number";
			assert.equal(loadConfig().port, 3000);
		});

		it("falls back to default for empty env vars", () => {
			process.env.MCP_SERVER_PORT = "";
			assert.equal(loadConfig().port, 3000);
		});
	});
});

describe("default config constants", () => {
	it("DEFAULT_RETRY_CONFIG has expected shape", () => {
		assert.equal(typeof DEFAULT_RETRY_CONFIG.maxRetries, "number");
		assert.equal(typeof DEFAULT_RETRY_CONFIG.initialDelayMs, "number");
		assert.equal(typeof DEFAULT_RETRY_CONFIG.maxDelayMs, "number");
		assert.equal(typeof DEFAULT_RETRY_CONFIG.backoffMultiplier, "number");
		assert.equal(typeof DEFAULT_RETRY_CONFIG.jitterFactor, "number");
	});

	it("DEFAULT_CIRCUIT_BREAKER_CONFIG has expected shape", () => {
		assert.equal(
			typeof DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
			"number",
		);
		assert.equal(
			typeof DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs,
			"number",
		);
		assert.equal(
			typeof DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold,
			"number",
		);
		assert.equal(
			typeof DEFAULT_CIRCUIT_BREAKER_CONFIG.failureWindowMs,
			"number",
		);
	});

	it("DEFAULT_TIMEOUT_CONFIG has expected shape", () => {
		assert.equal(typeof DEFAULT_TIMEOUT_CONFIG.requestMs, "number");
		assert.equal(typeof DEFAULT_TIMEOUT_CONFIG.connectionMs, "number");
		assert.equal(typeof DEFAULT_TIMEOUT_CONFIG.readMs, "number");
	});

});
