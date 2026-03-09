/**
 * Configuration for MCP server
 */

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to add randomness to delays */
  jitterFactor: number;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs: number;
  /** Number of successes in half-open state to close circuit */
  successThreshold: number;
  /** Time window in ms for counting failures */
  failureWindowMs: number;
}

export interface TimeoutConfig {
  /** Default request timeout in ms */
  requestMs: number;
  /** Connection timeout in ms */
  connectionMs: number;
  /** Read timeout in ms */
  readMs: number;
}

export interface LoggingConfig {
  /** Log level: 'debug' | 'info' | 'warn' | 'error' */
  level: "debug" | "info" | "warn" | "error";
  /** Include timestamps in logs */
  timestamps: boolean;
  /** Include request IDs for tracing */
  requestIds: boolean;
  /** Log to stderr (true) or stdout (false) */
  stderr: boolean;
}

export interface MCPConfig {
  /** Server name */
  serverName: string;
  /** Server version */
  serverVersion: string;
  /** HTTP port to listen on */
  port: number;
  /** Memory API URL */
  apiUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Optional bearer token to require on incoming MCP requests */
  authToken?: string;
  /** Allowed CORS origins (comma-separated in env) */
  corsOrigins?: string[];
  /** Retry configuration */
  retry: RetryConfig;
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;
  /** Timeout configuration */
  timeout: TimeoutConfig;
  /** Logging configuration */
  logging: LoggingConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  successThreshold: 2,
  failureWindowMs: 60000, // 1 minute
};

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  requestMs: 30000, // 30 seconds
  connectionMs: 5000, // 5 seconds
  readMs: 30000, // 30 seconds
};

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: "info",
  timestamps: true,
  requestIds: true,
  stderr: true,
};

/**
 * Load configuration from environment variables
 */
  // Validate required environment variables
  if (!process.env.MEMORY_API_URL) {
    throw new Error("Missing required environment variable: MEMORY_API_URL");
  }
  if (!process.env.AI_MEMORY_API_KEY) {
    throw new Error("Missing required environment variable: AI_MEMORY_API_KEY");
  }
export function loadConfig(): MCPConfig {
  const logLevel = (process.env.MCP_LOG_LEVEL as LoggingConfig["level"]) || "info";

  const corsRaw = process.env.CORS_ORIGINS ?? "";
  const corsOrigins = corsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    serverName: process.env.MCP_SERVER_NAME || "ai-memory-mcp",
    serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
    port: Number.parseInt(process.env.MCP_SERVER_PORT ?? "3000", 10),
    apiUrl: process.env.MEMORY_API_URL || "http://localhost:8000",
    apiKey: process.env.AI_MEMORY_API_KEY,
    authToken: process.env.MCP_AUTH_TOKEN,
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : undefined,

    retry: {
      maxRetries: Number.parseInt(
        process.env.MCP_RETRY_MAX ?? String(DEFAULT_RETRY_CONFIG.maxRetries),
        10
      ),
      initialDelayMs: Number.parseInt(
        process.env.MCP_RETRY_INITIAL_MS ?? String(DEFAULT_RETRY_CONFIG.initialDelayMs),
        10
      ),
      maxDelayMs: Number.parseInt(
        process.env.MCP_RETRY_MAX_MS ?? String(DEFAULT_RETRY_CONFIG.maxDelayMs),
        10
      ),
      backoffMultiplier: Number.parseFloat(
        process.env.MCP_RETRY_BACKOFF ?? String(DEFAULT_RETRY_CONFIG.backoffMultiplier)
      ),
      jitterFactor: Number.parseFloat(
        process.env.MCP_RETRY_JITTER ?? String(DEFAULT_RETRY_CONFIG.jitterFactor)
      ),
    },

    circuitBreaker: {
      failureThreshold: Number.parseInt(
        process.env.MCP_CB_FAILURE_THRESHOLD ??
          String(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold),
        10
      ),
      resetTimeoutMs: Number.parseInt(
        process.env.MCP_CB_RESET_MS ?? String(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs),
        10
      ),
      successThreshold: Number.parseInt(
        process.env.MCP_CB_SUCCESS_THRESHOLD ??
          String(DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold),
        10
      ),
      failureWindowMs: Number.parseInt(
        process.env.MCP_CB_WINDOW_MS ?? String(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureWindowMs),
        10
      ),
    },

    timeout: {
      requestMs: Number.parseInt(
        process.env.MCP_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_CONFIG.requestMs),
        10
      ),
      connectionMs: Number.parseInt(
        process.env.MCP_CONNECT_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_CONFIG.connectionMs),
        10
      ),
      readMs: Number.parseInt(
        process.env.MCP_READ_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_CONFIG.readMs),
        10
      ),
    },

    logging: {
      level: logLevel,
      timestamps: process.env.MCP_LOG_TIMESTAMPS !== "false",
      requestIds: process.env.MCP_LOG_REQUEST_IDS !== "false",
      stderr: process.env.MCP_LOG_STDERR !== "false",
    },
  };
}

/**
 * Global config instance
 */
export const config = loadConfig();
