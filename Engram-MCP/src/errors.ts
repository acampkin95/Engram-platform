/**
 * Typed error classes for MCP server
 * Categorizes errors for proper retry logic and client feedback
 */

export enum ErrorCode {
	// Network/Transient errors (retryable)
	NETWORK_ERROR = "NETWORK_ERROR",
	TIMEOUT = "TIMEOUT",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
	RATE_LIMITED = "RATE_LIMITED",

	// Client errors (not retryable)
	INVALID_INPUT = "INVALID_INPUT",
	NOT_FOUND = "NOT_FOUND",
	UNAUTHORIZED = "UNAUTHORIZED",
	FORBIDDEN = "FORBIDDEN",

	// Server errors (may be retryable)
	INTERNAL_ERROR = "INTERNAL_ERROR",
	BAD_GATEWAY = "BAD_GATEWAY",
	GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",

	// Circuit breaker
	CIRCUIT_OPEN = "CIRCUIT_OPEN",

	// Unknown
	UNKNOWN = "UNKNOWN",
}

export enum ErrorCategory {
	/** Transient errors that should be retried */
	TRANSIENT = "TRANSIENT",
	/** Client errors - fix the request, don't retry */
	CLIENT = "CLIENT",
	/** Fatal errors - stop and report */
	FATAL = "FATAL",
}

/**
 * Base error class for MCP operations
 */
export class MemoryError extends Error {
	public readonly code: ErrorCode;
	public readonly category: ErrorCategory;
	public readonly retryable: boolean;
	public readonly retryAfter?: number; // seconds
	public readonly cause?: Error;
	public readonly context?: Record<string, unknown>;

	constructor(
		message: string,
		code: ErrorCode,
		category: ErrorCategory,
		options?: {
			retryable?: boolean;
			retryAfter?: number;
			cause?: Error;
			context?: Record<string, unknown>;
		},
	) {
		super(message);
		this.name = "MemoryError";
		this.code = code;
		this.category = category;
		this.retryable = options?.retryable ?? category === ErrorCategory.TRANSIENT;
		this.retryAfter = options?.retryAfter;
		this.cause = options?.cause;
		this.context = options?.context;
	}

	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			category: this.category,
			retryable: this.retryable,
			retryAfter: this.retryAfter,
			context: this.context,
		};
	}
}

/**
 * Network/Transient errors
 */
export class NetworkError extends MemoryError {
	constructor(
		message: string,
		options?: { cause?: Error; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.NETWORK_ERROR, ErrorCategory.TRANSIENT, {
			retryable: true,
			...options,
		});
		this.name = "NetworkError";
	}
}

export class TimeoutError extends MemoryError {
	constructor(
		message: string,
		options?: { cause?: Error; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.TIMEOUT, ErrorCategory.TRANSIENT, {
			retryable: true,
			...options,
		});
		this.name = "TimeoutError";
	}
}

export class ServiceUnavailableError extends MemoryError {
	constructor(
		message: string,
		options?: {
			cause?: Error;
			retryAfter?: number;
			context?: Record<string, unknown>;
		},
	) {
		super(message, ErrorCode.SERVICE_UNAVAILABLE, ErrorCategory.TRANSIENT, {
			retryable: true,
			...options,
		});
		this.name = "ServiceUnavailableError";
	}
}

export class RateLimitedError extends MemoryError {
	constructor(
		message: string,
		retryAfter: number,
		options?: { cause?: Error; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.RATE_LIMITED, ErrorCategory.TRANSIENT, {
			retryable: true,
			retryAfter,
			...options,
		});
		this.name = "RateLimitedError";
	}
}

/**
 * Client errors (not retryable)
 */
export class InvalidInputError extends MemoryError {
	constructor(
		message: string,
		options?: { context?: Record<string, unknown>; issues?: string[] },
	) {
		super(message, ErrorCode.INVALID_INPUT, ErrorCategory.CLIENT, {
			retryable: false,
			context: options?.issues
				? { issues: options.issues, ...options.context }
				: options?.context,
		});
		this.name = "InvalidInputError";
	}
}

export class NotFoundError extends MemoryError {
	constructor(
		resource: string,
		id?: string,
		options?: { context?: Record<string, unknown> },
	) {
		super(
			`${resource}${id ? ` '${id}'` : ""} not found`,
			ErrorCode.NOT_FOUND,
			ErrorCategory.CLIENT,
			{ retryable: false, ...options },
		);
		this.name = "NotFoundError";
	}
}

export class UnauthorizedError extends MemoryError {
	constructor(
		message = "Unauthorized",
		options?: { context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.UNAUTHORIZED, ErrorCategory.CLIENT, {
			retryable: false,
			...options,
		});
		this.name = "UnauthorizedError";
	}
}

export class ForbiddenError extends MemoryError {
	constructor(
		message = "Forbidden",
		options?: { context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.FORBIDDEN, ErrorCategory.CLIENT, {
			retryable: false,
			...options,
		});
		this.name = "ForbiddenError";
	}
}

/**
 * Server errors
 */
export class InternalServerError extends MemoryError {
	constructor(
		message: string,
		options?: { cause?: Error; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.INTERNAL_ERROR, ErrorCategory.TRANSIENT, {
			retryable: true,
			...options,
		});
		this.name = "InternalServerError";
	}
}

export class BadGatewayError extends MemoryError {
	constructor(
		message: string,
		options?: { cause?: Error; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.BAD_GATEWAY, ErrorCategory.TRANSIENT, {
			retryable: true,
			...options,
		});
		this.name = "BadGatewayError";
	}
}

export class GatewayTimeoutError extends MemoryError {
	constructor(
		message: string,
		options?: { cause?: Error; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.GATEWAY_TIMEOUT, ErrorCategory.TRANSIENT, {
			retryable: true,
			...options,
		});
		this.name = "GatewayTimeoutError";
	}
}

/**
 * Circuit breaker error
 */
export class CircuitOpenError extends MemoryError {
	constructor(
		message: string,
		options?: { retryAfter?: number; context?: Record<string, unknown> },
	) {
		super(message, ErrorCode.CIRCUIT_OPEN, ErrorCategory.FATAL, {
			retryable: false,
			...options,
		});
		this.name = "CircuitOpenError";
	}
}

/**
 * Helper to convert HTTP status codes to appropriate error types
 */
export function createErrorFromStatus(
	status: number,
	statusText: string,
	body?: string,
	headers?: Headers,
): MemoryError {
	const context = body ? { responseBody: body.slice(0, 500) } : undefined;
	const retryAfter = headers?.get("Retry-After");
	const retryAfterSeconds = retryAfter
		? Number.parseInt(retryAfter, 10)
		: undefined;

	switch (status) {
		case 400:
			return new InvalidInputError(body || statusText, { context });
		case 401:
			return new UnauthorizedError(body || statusText, { context });
		case 403:
			return new ForbiddenError(body || statusText, { context });
		case 404:
			return new NotFoundError("Resource", undefined, { context });
		case 429:
			return new RateLimitedError(body || statusText, retryAfterSeconds || 60, {
				context,
			});
		case 500:
			return new InternalServerError(body || statusText, { context });
		case 502:
			return new BadGatewayError(body || statusText, { context });
		case 503:
			return new ServiceUnavailableError(body || statusText, {
				retryAfter: retryAfterSeconds,
				context,
			});
		case 504:
			return new GatewayTimeoutError(body || statusText, { context });
		default:
			return new MemoryError(
				`HTTP ${status}: ${statusText}`,
				ErrorCode.UNKNOWN,
				ErrorCategory.TRANSIENT,
				{ context },
			);
	}
}

/**
 * Type guard for MemoryError
 */
export function isMemoryError(error: unknown): error is MemoryError {
	return error instanceof MemoryError;
}

/**
 * Type guard for retryable errors
 */
export function isRetryable(error: unknown): boolean {
	if (isMemoryError(error)) {
		return error.retryable;
	}
	// Default to retryable for unknown errors
	return true;
}
