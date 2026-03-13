/**
 * Engram Unified MCP Server — Configuration
 *
 * Extends the original config with transport selection, OAuth, and hook settings.
 */

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

// ---------------------------------------------------------------------------
// OAuth config (NEW)
// ---------------------------------------------------------------------------

export interface OAuthConfig {
	enabled: boolean;
	issuer: string;
	secret: string;
	accessTokenTtl: number;
	refreshTokenTtl: number;
	redisUrl?: string;
	redisKeyPrefix: string;
}

// ---------------------------------------------------------------------------
// Transport config (NEW)
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
	authToken?: string;
	corsOrigins?: string[];
	oauth: OAuthConfig;
	retry: RetryConfig;
	circuitBreaker: CircuitBreakerConfig;
	timeout: TimeoutConfig;
	logging: LoggingConfig;
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

export const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
	enabled: false,
	issuer: "http://localhost:3000",
	secret: "",
	accessTokenTtl: 3600,
	refreshTokenTtl: 86400,
	redisUrl: undefined,
	redisKeyPrefix: "mcp:oauth:",
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
	const logLevel = (process.env.MCP_LOG_LEVEL as LoggingConfig["level"]) || "info";

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
		serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
		transport,
		port: envInt(process.env.MCP_SERVER_PORT, 3000),
		apiUrl: process.env.MEMORY_API_URL || "http://localhost:8000",
		apiKey: process.env.AI_MEMORY_API_KEY,
		authToken: process.env.MCP_AUTH_TOKEN,
		corsOrigins: corsOrigins.length > 0 ? corsOrigins : undefined,

		oauth: {
			enabled: process.env.OAUTH_ENABLED === "true",
			issuer: process.env.OAUTH_ISSUER || "http://localhost:3000",
			secret: process.env.OAUTH_SECRET || "",
			accessTokenTtl: envInt(process.env.OAUTH_ACCESS_TOKEN_TTL, 3600),
			refreshTokenTtl: envInt(process.env.OAUTH_REFRESH_TOKEN_TTL, 86400),
			redisUrl: process.env.OAUTH_REDIS_URL || process.env.REDIS_URL || undefined,
			redisKeyPrefix: process.env.OAUTH_REDIS_KEY_PREFIX || "mcp:oauth:",
		},

		retry: {
			maxRetries: envInt(process.env.MCP_RETRY_MAX, DEFAULT_RETRY_CONFIG.maxRetries),
			initialDelayMs: envInt(process.env.MCP_RETRY_INITIAL_MS, DEFAULT_RETRY_CONFIG.initialDelayMs),
			maxDelayMs: envInt(process.env.MCP_RETRY_MAX_MS, DEFAULT_RETRY_CONFIG.maxDelayMs),
			backoffMultiplier: envFloat(
				process.env.MCP_RETRY_BACKOFF,
				DEFAULT_RETRY_CONFIG.backoffMultiplier,
			),
			jitterFactor: envFloat(process.env.MCP_RETRY_JITTER, DEFAULT_RETRY_CONFIG.jitterFactor),
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
			requestMs: envInt(process.env.MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_CONFIG.requestMs),
			connectionMs: envInt(process.env.MCP_CONNECT_TIMEOUT_MS, DEFAULT_TIMEOUT_CONFIG.connectionMs),
			readMs: envInt(process.env.MCP_READ_TIMEOUT_MS, DEFAULT_TIMEOUT_CONFIG.readMs),
		},

		logging: {
			level: logLevel,
			timestamps: process.env.MCP_LOG_TIMESTAMPS !== "false",
			requestIds: process.env.MCP_LOG_REQUEST_IDS !== "false",
			stderr: process.env.MCP_LOG_STDERR !== "false",
		},
	};
}

export const config = loadConfig();
