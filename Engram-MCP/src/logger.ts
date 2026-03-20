/**
 * Structured logging for MCP server
 */

import { config } from "./config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export interface LogContext {
	/** Request/correlation ID for tracing */
	requestId?: string;
	/** Tool name being executed */
	tool?: string;
	/** Resource URI being accessed */
	resource?: string;
	/** Operation being performed */
	operation?: string;
	/** Duration in milliseconds */
	durationMs?: number;
	/** Error details */
	error?: {
		code?: string;
		message: string;
		stack?: string;
	};
	/** Additional context */
	[key: string]: unknown;
}

export interface LogEntry {
	timestamp?: string;
	level: LogLevel;
	message: string;
	context?: LogContext;
}

/**
 * Logger class with structured output
 */
class Logger {
	private level: LogLevel;
	private readonly timestamps: boolean;
	private readonly requestIds: boolean;
	private readonly output: typeof console.error;

	constructor() {
		this.level = config.logging.level;
		this.timestamps = config.logging.timestamps;
		this.requestIds = config.logging.requestIds;
		this.output = config.logging.stderr ? console.error : console.log;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
	}

	private omitRequestId(context?: LogContext): LogContext | undefined {
		if (context?.requestId === undefined) {
			return context;
		}
		const { requestId: _requestId, ...rest } = context;
		return rest;
	}

	private formatEntry(
		level: LogLevel,
		message: string,
		context?: LogContext,
	): LogEntry {
		const entry: LogEntry = {
			level,
			message,
		};

		if (this.timestamps) {
			entry.timestamp = new Date().toISOString();
		}

		const effectiveContext = this.requestIds
			? context
			: this.omitRequestId(context);

		if (effectiveContext && Object.keys(effectiveContext).length > 0) {
			entry.context = effectiveContext;
		}

		return entry;
	}

	private serializeEntry(entry: LogEntry): string {
		try {
			return JSON.stringify(entry);
		} catch (error) {
			return JSON.stringify({
				...(this.timestamps ? { timestamp: new Date().toISOString() } : {}),
				level: "error" as const,
				message: "Failed to serialize log entry",
				context: {
					originalMessage: entry.message,
					serializationError:
						error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	private log(level: LogLevel, message: string, context?: LogContext): void {
		if (!this.shouldLog(level)) {
			return;
		}

		const entry = this.formatEntry(level, message, context);
		const output = this.serializeEntry(entry);
		this.output(output);
	}

	debug(message: string, context?: LogContext): void {
		this.log("debug", message, context);
	}

	info(message: string, context?: LogContext): void {
		this.log("info", message, context);
	}

	warn(message: string, context?: LogContext): void {
		this.log("warn", message, context);
	}

	error(message: string, context?: LogContext): void {
		this.log("error", message, context);
	}

	/**
	 * Create a child logger with persistent context
	 */
	child(defaultContext: LogContext): ChildLogger {
		return new ChildLogger(this, defaultContext);
	}

	/**
	 * Set log level at runtime
	 */
	setLevel(level: LogLevel): void {
		this.level = level;
	}

	/**
	 * Log tool execution start
	 */
	toolStart(
		tool: string,
		args: Record<string, unknown>,
		requestId?: string,
	): void {
		this.debug(`Tool '${tool}' started`, {
			tool,
			operation: "start",
			requestId,
			args: this.sanitizeArgs(args),
		});
	}

	/**
	 * Log tool execution success
	 */
	toolSuccess(tool: string, durationMs: number, requestId?: string): void {
		this.debug(`Tool '${tool}' completed`, {
			tool,
			operation: "success",
			requestId,
			durationMs,
		});
	}

	/**
	 * Log tool execution failure
	 */
	toolError(
		tool: string,
		error: Error,
		durationMs: number,
		requestId?: string,
	): void {
		this.error(`Tool '${tool}' failed: ${error.message}`, {
			tool,
			operation: "error",
			requestId,
			durationMs,
			error: {
				message: error.message,
				stack: error.stack,
			},
		});
	}

	/**
	 * Log API request
	 */
	apiRequest(method: string, path: string, requestId?: string): void {
		this.debug(`API ${method} ${path}`, {
			operation: "api_request",
			requestId,
			method,
			path,
		});
	}

	/**
	 * Log API response
	 */
	apiResponse(
		method: string,
		path: string,
		status: number,
		durationMs: number,
		requestId?: string,
	): void {
		const level = status >= 400 ? "warn" : "debug";
		this[level](`API ${method} ${path} -> ${status}`, {
			operation: "api_response",
			requestId,
			method,
			path,
			status,
			durationMs,
		});
	}

	/**
	 * Log circuit breaker state change
	 */
	circuitBreaker(
		state: "open" | "half-open" | "closed",
		failures: number,
	): void {
		this.warn(`Circuit breaker ${state}`, {
			operation: "circuit_breaker",
			state,
			failures,
		});
	}

	/**
	 * Log retry attempt
	 */
	retry(
		attempt: number,
		maxAttempts: number,
		delayMs: number,
		error: Error,
	): void {
		this.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delayMs}ms`, {
			operation: "retry",
			attempt,
			maxAttempts,
			delayMs,
			error: {
				message: error.message,
			},
		});
	}

	/**
	 * Sanitize args for logging (remove sensitive data)
	 */
	private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
		const sanitized: Record<string, unknown> = {};
		const sensitiveKeys = [
			"api_key",
			"apiKey",
			"password",
			"secret",
			"token",
			"credential",
		];

		for (const [key, value] of Object.entries(args)) {
			if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
				sanitized[key] = "[REDACTED]";
			} else if (typeof value === "string" && value.length > 200) {
				sanitized[key] = `${value.slice(0, 200)}...`;
			} else {
				sanitized[key] = value;
			}
		}

		return sanitized;
	}
}

/**
 * Child logger with persistent context
 */
class ChildLogger {
	constructor(
		private readonly parent: Logger,
		private readonly defaultContext: LogContext,
	) {}

	debug(message: string, context?: LogContext): void {
		this.parent.debug(message, { ...this.defaultContext, ...context });
	}

	info(message: string, context?: LogContext): void {
		this.parent.info(message, { ...this.defaultContext, ...context });
	}

	warn(message: string, context?: LogContext): void {
		this.parent.warn(message, { ...this.defaultContext, ...context });
	}

	error(message: string, context?: LogContext): void {
		this.parent.error(message, { ...this.defaultContext, ...context });
	}
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
