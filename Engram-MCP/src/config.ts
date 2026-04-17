/**
 * Engram Unified MCP Server — Configuration
 *
 * Extends the original config with transport selection, OAuth, and hook settings.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Read version from package.json at module load time
let _pkgVersion = "1.0.0";
try {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const pkg = JSON.parse(
		readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
	);
	_pkgVersion = pkg.version ?? "1.0.0";
} catch {
	// Fallback when package.json is not accessible (e.g. bundled)
}

// ---------------------------------------------------------------------------
// Resilience configs (unchanged from original)
// ---------------------------------------------------------------------------

export interface RetryConfig {
	maxRetries: number;
	initialDelayMs: number;
	maxDelayMs: number;
	backoffMultiplier: number;
	jitterFactor: number;
}

export interface CircuitBreakerConfig {
	failureThreshold: number;
	resetTimeoutMs: number;
	successThreshold: number;
	failureWindowMs: number;
}

export interface TimeoutConfig {
	requestMs: number;
	connectionMs: number;
	readMs: number;
}

export interface LoggingConfig {
	level: "debug" | "info" | "warn" | "error";
	timestamps: boolean;
	requestIds: boolean;
	stderr: boolean;
}

export interface RateLimitConfig {
	requestsPerMinute: number;
	windowMs: number;
}

// ---------------------------------------------------------------------------
// Transport config
// ---------------------------------------------------------------------------

export type TransportType = "stdio" | "http";

// ---------------------------------------------------------------------------
// Unified config
// ---------------------------------------------------------------------------

export interface MCPConfig {
	serverName: string;
	serverVersion: string;
	transport: TransportType;
	port: number;
	apiUrl: string;
	apiKey?: string;
	platformUrl?: string;
	corsOrigins?: string[];
	retry: RetryConfig;
	circuitBreaker: CircuitBreakerConfig;
	timeout: TimeoutConfig;
	logging: LoggingConfig;
	rateLimit: RateLimitConfig;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	initialDelayMs: 100,
	maxDelayMs: 5000,
	backoffMultiplier: 2,
	jitterFactor: 0.1,
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
	failureThreshold: 5,
	resetTimeoutMs: 30000,
	successThreshold: 2,
	failureWindowMs: 60000,
};

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
	requestMs: 30000,
	connectionMs: 5000,
	readMs: 30000,
};

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
	level: "info",
	timestamps: true,
	requestIds: true,
	stderr: true,
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
	requestsPerMinute: 60,
	windowMs: 60_000,
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseTransportFromArgs(): TransportType | undefined {
	const args = process.argv.slice(2);
	const idx = args.indexOf("--transport");
	if (idx !== -1 && args[idx + 1]) {
		const val = args[idx + 1].toLowerCase();
		if (val === "stdio" || val === "http") return val;
	}
	return undefined;
}

/** Parses an env var as an integer, returning `fallback` when the value is absent or NaN. */
function envInt(value: string | undefined, fallback: number): number {
	if (value === undefined || value === "") return fallback;
	const n = Number.parseInt(value, 10);
	return Number.isNaN(n) ? fallback : n;
}

/** Parses an env var as a float, returning `fallback` when the value is absent or NaN. */
function envFloat(value: string | undefined, fallback: number): number {
	if (value === undefined || value === "") return fallback;
	const n = Number.parseFloat(value);
	return Number.isNaN(n) ? fallback : n;
}

// ---------------------------------------------------------------------------
// Load from environment
// ---------------------------------------------------------------------------

export function loadConfig(): MCPConfig {
	const logLevel =
		(process.env.MCP_LOG_LEVEL as LoggingConfig["level"]) || "info";

	const corsRaw = process.env.CORS_ORIGINS ?? "";
	const corsOrigins = corsRaw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	// Transport priority: CLI arg > env > default (http)
	const rawTransport = process.env.MCP_TRANSPORT?.toLowerCase();
	const transport: TransportType =
		parseTransportFromArgs() ??
		(rawTransport === "stdio" || rawTransport === "http"
			? (rawTransport as TransportType)
			: "http");

	return {
		serverName: process.env.MCP_SERVER_NAME || "engram-mcp",
		serverVersion: process.env.MCP_SERVER_VERSION || _pkgVersion,
		transport,
		port: envInt(process.env.MCP_SERVER_PORT, 3000),
		apiUrl:
			process.env.ENGRAM_API_URL ||
			process.env.MEMORY_API_URL ||
			"http://localhost:8000",
		apiKey: process.env.ENGRAM_API_KEY || process.env.AI_MEMORY_API_KEY,
		platformUrl:
			process.env.PLATFORM_URL || process.env.BETTER_AUTH_URL || undefined,
		corsOrigins: corsOrigins.length > 0 ? corsOrigins : undefined,

		retry: {
			maxRetries: envInt(
				process.env.MCP_RETRY_MAX,
				DEFAULT_RETRY_CONFIG.maxRetries,
			),
			initialDelayMs: envInt(
				process.env.MCP_RETRY_INITIAL_MS,
				DEFAULT_RETRY_CONFIG.initialDelayMs,
			),
			maxDelayMs: envInt(
				process.env.MCP_RETRY_MAX_MS,
				DEFAULT_RETRY_CONFIG.maxDelayMs,
			),
			backoffMultiplier: envFloat(
				process.env.MCP_RETRY_BACKOFF,
				DEFAULT_RETRY_CONFIG.backoffMultiplier,
			),
			jitterFactor: envFloat(
				process.env.MCP_RETRY_JITTER,
				DEFAULT_RETRY_CONFIG.jitterFactor,
			),
		},

		circuitBreaker: {
			failureThreshold: envInt(
				process.env.MCP_CB_FAILURE_THRESHOLD,
				DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
			),
			resetTimeoutMs: envInt(
				process.env.MCP_CB_RESET_MS,
				DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs,
			),
			successThreshold: envInt(
				process.env.MCP_CB_SUCCESS_THRESHOLD,
				DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold,
			),
			failureWindowMs: envInt(
				process.env.MCP_CB_WINDOW_MS,
				DEFAULT_CIRCUIT_BREAKER_CONFIG.failureWindowMs,
			),
		},

		timeout: {
			requestMs: envInt(
				process.env.MCP_TIMEOUT_MS,
				DEFAULT_TIMEOUT_CONFIG.requestMs,
			),
			connectionMs: envInt(
				process.env.MCP_CONNECT_TIMEOUT_MS,
				DEFAULT_TIMEOUT_CONFIG.connectionMs,
			),
			readMs: envInt(
				process.env.MCP_READ_TIMEOUT_MS,
				DEFAULT_TIMEOUT_CONFIG.readMs,
			),
		},

		logging: {
			level: logLevel,
			timestamps: process.env.MCP_LOG_TIMESTAMPS !== "false",
			requestIds: process.env.MCP_LOG_REQUEST_IDS !== "false",
			stderr: process.env.MCP_LOG_STDERR !== "false",
		},

		rateLimit: {
			requestsPerMinute: envInt(
				process.env.MCP_RATE_LIMIT_PER_MINUTE,
				DEFAULT_RATE_LIMIT_CONFIG.requestsPerMinute,
			),
			windowMs: DEFAULT_RATE_LIMIT_CONFIG.windowMs,
		},
	};
}

function validateConfig(cfg: MCPConfig): MCPConfig {
	if (cfg.transport === "http" && !cfg.platformUrl) {
		console.error(
			"[engram-mcp] PLATFORM_URL not set — HTTP transport requires Platform URL for API key validation",
		);
	}
	return cfg;
}

export const config = validateConfig(loadConfig());
