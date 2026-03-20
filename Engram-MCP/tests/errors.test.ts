import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	BadGatewayError,
	CircuitOpenError,
	ErrorCategory,
	ErrorCode,
	ForbiddenError,
	GatewayTimeoutError,
	InternalServerError,
	InvalidInputError,
	MemoryError,
	NetworkError,
	NotFoundError,
	RateLimitedError,
	ServiceUnavailableError,
	TimeoutError,
	UnauthorizedError,
	createErrorFromStatus,
	isMemoryError,
	isRetryable,
} from "../dist/errors.js";

// ============================================
// MemoryError base class
// ============================================

describe("MemoryError", () => {
	it("stores code, category, and message", () => {
		const err = new MemoryError(
			"test error",
			ErrorCode.UNKNOWN,
			ErrorCategory.TRANSIENT,
		);
		assert.equal(err.message, "test error");
		assert.equal(err.code, ErrorCode.UNKNOWN);
		assert.equal(err.category, ErrorCategory.TRANSIENT);
		assert.equal(err.name, "MemoryError");
	});

	it("defaults retryable based on category (TRANSIENT = true)", () => {
		const err = new MemoryError(
			"t",
			ErrorCode.UNKNOWN,
			ErrorCategory.TRANSIENT,
		);
		assert.equal(err.retryable, true);
	});

	it("defaults retryable based on category (CLIENT = false)", () => {
		const err = new MemoryError("c", ErrorCode.UNKNOWN, ErrorCategory.CLIENT);
		assert.equal(err.retryable, false);
	});

	it("defaults retryable based on category (FATAL = false)", () => {
		const err = new MemoryError("f", ErrorCode.UNKNOWN, ErrorCategory.FATAL);
		assert.equal(err.retryable, false);
	});

	it("allows explicit retryable override", () => {
		const err = new MemoryError("x", ErrorCode.UNKNOWN, ErrorCategory.CLIENT, {
			retryable: true,
		});
		assert.equal(err.retryable, true);
	});

	it("stores retryAfter", () => {
		const err = new MemoryError(
			"x",
			ErrorCode.UNKNOWN,
			ErrorCategory.TRANSIENT,
			{
				retryAfter: 30,
			},
		);
		assert.equal(err.retryAfter, 30);
	});

	it("stores cause", () => {
		const cause = new Error("root");
		const err = new MemoryError(
			"x",
			ErrorCode.UNKNOWN,
			ErrorCategory.TRANSIENT,
			{ cause },
		);
		assert.equal(err.cause, cause);
	});

	it("stores context", () => {
		const err = new MemoryError(
			"x",
			ErrorCode.UNKNOWN,
			ErrorCategory.TRANSIENT,
			{
				context: { key: "value" },
			},
		);
		assert.deepEqual(err.context, { key: "value" });
	});

	it("toJSON returns serializable object", () => {
		const err = new MemoryError(
			"test",
			ErrorCode.NETWORK_ERROR,
			ErrorCategory.TRANSIENT,
			{
				retryAfter: 5,
				context: { foo: "bar" },
			},
		);
		const json = err.toJSON();
		assert.equal(json.name, "MemoryError");
		assert.equal(json.message, "test");
		assert.equal(json.code, ErrorCode.NETWORK_ERROR);
		assert.equal(json.category, ErrorCategory.TRANSIENT);
		assert.equal(json.retryable, true);
		assert.equal(json.retryAfter, 5);
		assert.deepEqual(json.context, { foo: "bar" });
	});
});

// ============================================
// Transient error subclasses
// ============================================

describe("Transient error subclasses", () => {
	it("NetworkError is transient and retryable", () => {
		const err = new NetworkError("conn refused");
		assert.equal(err.name, "NetworkError");
		assert.equal(err.code, ErrorCode.NETWORK_ERROR);
		assert.equal(err.category, ErrorCategory.TRANSIENT);
		assert.equal(err.retryable, true);
	});

	it("TimeoutError is transient and retryable", () => {
		const err = new TimeoutError("timed out");
		assert.equal(err.name, "TimeoutError");
		assert.equal(err.code, ErrorCode.TIMEOUT);
		assert.equal(err.retryable, true);
	});

	it("ServiceUnavailableError is transient with optional retryAfter", () => {
		const err = new ServiceUnavailableError("down", { retryAfter: 60 });
		assert.equal(err.name, "ServiceUnavailableError");
		assert.equal(err.code, ErrorCode.SERVICE_UNAVAILABLE);
		assert.equal(err.retryable, true);
		assert.equal(err.retryAfter, 60);
	});

	it("RateLimitedError requires retryAfter", () => {
		const err = new RateLimitedError("too many", 30);
		assert.equal(err.name, "RateLimitedError");
		assert.equal(err.code, ErrorCode.RATE_LIMITED);
		assert.equal(err.retryable, true);
		assert.equal(err.retryAfter, 30);
	});

	it("InternalServerError is transient", () => {
		const err = new InternalServerError("oops");
		assert.equal(err.name, "InternalServerError");
		assert.equal(err.code, ErrorCode.INTERNAL_ERROR);
		assert.equal(err.retryable, true);
	});

	it("BadGatewayError is transient", () => {
		const err = new BadGatewayError("bad gw");
		assert.equal(err.name, "BadGatewayError");
		assert.equal(err.code, ErrorCode.BAD_GATEWAY);
		assert.equal(err.retryable, true);
	});

	it("GatewayTimeoutError is transient", () => {
		const err = new GatewayTimeoutError("gw timeout");
		assert.equal(err.name, "GatewayTimeoutError");
		assert.equal(err.code, ErrorCode.GATEWAY_TIMEOUT);
		assert.equal(err.retryable, true);
	});
});

// ============================================
// Client error subclasses
// ============================================

describe("Client error subclasses", () => {
	it("InvalidInputError is CLIENT and not retryable", () => {
		const err = new InvalidInputError("bad input", {
			issues: ["missing field"],
		});
		assert.equal(err.name, "InvalidInputError");
		assert.equal(err.code, ErrorCode.INVALID_INPUT);
		assert.equal(err.category, ErrorCategory.CLIENT);
		assert.equal(err.retryable, false);
		assert.deepEqual(err.context, { issues: ["missing field"] });
	});

	it("NotFoundError formats message with resource and id", () => {
		const err = new NotFoundError("Memory", "abc-123");
		assert.equal(err.message, "Memory 'abc-123' not found");
		assert.equal(err.code, ErrorCode.NOT_FOUND);
		assert.equal(err.retryable, false);
	});

	it("NotFoundError works without id", () => {
		const err = new NotFoundError("Resource");
		assert.equal(err.message, "Resource not found");
	});

	it("UnauthorizedError defaults message", () => {
		const err = new UnauthorizedError();
		assert.equal(err.message, "Unauthorized");
		assert.equal(err.code, ErrorCode.UNAUTHORIZED);
		assert.equal(err.retryable, false);
	});

	it("ForbiddenError defaults message", () => {
		const err = new ForbiddenError();
		assert.equal(err.message, "Forbidden");
		assert.equal(err.code, ErrorCode.FORBIDDEN);
		assert.equal(err.retryable, false);
	});
});

// ============================================
// CircuitOpenError
// ============================================

describe("CircuitOpenError", () => {
	it("is FATAL and not retryable", () => {
		const err = new CircuitOpenError("breaker open", { retryAfter: 30 });
		assert.equal(err.name, "CircuitOpenError");
		assert.equal(err.code, ErrorCode.CIRCUIT_OPEN);
		assert.equal(err.category, ErrorCategory.FATAL);
		assert.equal(err.retryable, false);
		assert.equal(err.retryAfter, 30);
	});
});

// ============================================
// createErrorFromStatus
// ============================================

describe("createErrorFromStatus", () => {
	const cases: Array<[number, string, typeof MemoryError]> = [
		[400, "InvalidInputError", InvalidInputError],
		[401, "UnauthorizedError", UnauthorizedError],
		[403, "ForbiddenError", ForbiddenError],
		[404, "NotFoundError", NotFoundError],
		[429, "RateLimitedError", RateLimitedError],
		[500, "InternalServerError", InternalServerError],
		[502, "BadGatewayError", BadGatewayError],
		[503, "ServiceUnavailableError", ServiceUnavailableError],
		[504, "GatewayTimeoutError", GatewayTimeoutError],
	];

	for (const [status, name, ErrorClass] of cases) {
		it(`maps HTTP ${status} to ${name}`, () => {
			const err = createErrorFromStatus(status, "status text");
			assert.ok(err instanceof ErrorClass);
		});
	}

	it("maps unknown status to generic MemoryError", () => {
		const err = createErrorFromStatus(418, "I'm a teapot");
		assert.ok(err instanceof MemoryError);
		assert.equal(err.code, ErrorCode.UNKNOWN);
	});

	it("includes response body in context", () => {
		const err = createErrorFromStatus(500, "ISE", "some error body");
		assert.ok(err.context !== undefined);
		assert.equal(
			(err.context as Record<string, unknown>).responseBody,
			"some error body",
		);
	});

	it("parses Retry-After header for 429", () => {
		const headers = new Headers({ "Retry-After": "120" });
		const err = createErrorFromStatus(429, "rate limited", undefined, headers);
		assert.equal(err.retryAfter, 120);
	});
});

// ============================================
// Type guards
// ============================================

describe("isMemoryError", () => {
	it("returns true for MemoryError instances", () => {
		assert.equal(isMemoryError(new NetworkError("x")), true);
		assert.equal(isMemoryError(new InvalidInputError("x")), true);
	});

	it("returns false for plain Error", () => {
		assert.equal(isMemoryError(new Error("x")), false);
	});

	it("returns false for non-errors", () => {
		assert.equal(isMemoryError("string"), false);
		assert.equal(isMemoryError(null), false);
		assert.equal(isMemoryError(undefined), false);
	});
});

describe("isRetryable", () => {
	it("returns true for retryable MemoryErrors", () => {
		assert.equal(isRetryable(new NetworkError("x")), true);
	});

	it("returns false for non-retryable MemoryErrors", () => {
		assert.equal(isRetryable(new InvalidInputError("x")), false);
	});

	it("returns true for unknown errors (safe default)", () => {
		assert.equal(isRetryable(new Error("unknown")), true);
		assert.equal(isRetryable("string error"), true);
	});
});
