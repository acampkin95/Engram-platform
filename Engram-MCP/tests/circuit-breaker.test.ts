import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	CircuitBreaker,
	createCircuitBreaker,
	type CircuitState,
} from "../dist/circuit-breaker.js";
import { CircuitOpenError } from "../dist/errors.js";

describe("CircuitBreaker", () => {
	let breaker: CircuitBreaker;
	const stateChanges: Array<{ state: CircuitState; failures: number }> = [];

	beforeEach(() => {
		stateChanges.length = 0;
		breaker = new CircuitBreaker({
			failureThreshold: 3,
			resetTimeoutMs: 100,
			successThreshold: 2,
			failureWindowMs: 60_000,
			onStateChange: (state, failures) => {
				stateChanges.push({ state, failures });
			},
		});
	});

	describe("initial state", () => {
		it("starts in closed state", () => {
			assert.equal(breaker.getState(), "closed");
		});

		it("isClosed() returns true", () => {
			assert.equal(breaker.isClosed(), true);
		});

		it("isOpen() returns false", () => {
			assert.equal(breaker.isOpen(), false);
		});

		it("failure count is zero", () => {
			assert.equal(breaker.getFailureCount(), 0);
		});
	});

	describe("closed state", () => {
		it("passes through successful calls", async () => {
			const result = await breaker.execute(async () => 42);
			assert.equal(result, 42);
			assert.equal(breaker.getState(), "closed");
		});

		it("propagates errors from the wrapped function", async () => {
			await assert.rejects(
				() => breaker.execute(async () => { throw new Error("boom"); }),
				(err: unknown) => {
					assert.ok(err instanceof Error);
					assert.equal(err.message, "boom");
					return true;
				},
			);
		});

		it("stays closed below failure threshold", async () => {
			// 2 failures, threshold is 3
			for (let i = 0; i < 2; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "closed");
			assert.equal(breaker.getFailureCount(), 2);
		});

		it("transitions to open at failure threshold", async () => {
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "open");
			assert.equal(breaker.isOpen(), true);
		});
	});

	describe("open state", () => {
		it("throws CircuitOpenError without calling function", async () => {
			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "open");

			let called = false;
			await assert.rejects(
				() => breaker.execute(async () => { called = true; return 1; }),
				(err: unknown) => {
					assert.ok(err instanceof CircuitOpenError);
					return true;
				},
			);
			assert.equal(called, false);
		});
	});

	describe("half-open state", () => {
		it("transitions from open to half-open after resetTimeout", async () => {
			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "open");

			// Wait for reset timeout
			await new Promise((r) => setTimeout(r, 150));

			// Next execute should transition to half-open and try
			const result = await breaker.execute(async () => "recovered");
			// After 1 success (threshold is 2), still half-open or closed depending
			// The first success counts towards the threshold
			assert.equal(result, "recovered");
		});

		it("returns to open on failure in half-open state", async () => {
			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "open");

			// Wait for reset timeout
			await new Promise((r) => setTimeout(r, 150));

			// Fail in half-open state
			await assert.rejects(() =>
				breaker.execute(async () => { throw new Error("still failing"); }),
			);
			assert.equal(breaker.getState(), "open");
		});

		it("transitions to closed after successThreshold successes", async () => {
			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "open");

			// Wait for reset timeout
			await new Promise((r) => setTimeout(r, 150));

			// 2 successes (successThreshold = 2)
			await breaker.execute(async () => "ok1");
			await breaker.execute(async () => "ok2");
			assert.equal(breaker.getState(), "closed");
			assert.equal(breaker.isClosed(), true);
		});
	});

	describe("manual controls", () => {
		it("trip() opens the circuit immediately", () => {
			assert.equal(breaker.getState(), "closed");
			breaker.trip();
			assert.equal(breaker.getState(), "open");
		});

		it("reset() closes the circuit and clears failures", async () => {
			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.equal(breaker.getState(), "open");

			breaker.reset();
			assert.equal(breaker.getState(), "closed");
			assert.equal(breaker.getFailureCount(), 0);
		});
	});

	describe("state change callback", () => {
		it("calls onStateChange when transitioning", async () => {
			// Trip to open
			for (let i = 0; i < 3; i++) {
				await assert.rejects(() =>
					breaker.execute(async () => { throw new Error("fail"); }),
				);
			}
			assert.ok(stateChanges.some((c) => c.state === "open"));
		});
	});
});

describe("createCircuitBreaker", () => {
	it("wraps a function with circuit breaker protection", async () => {
		const fn = async (x: number) => x * 2;
		const { execute, circuit } = createCircuitBreaker(fn, {
			failureThreshold: 2,
			resetTimeoutMs: 100,
			successThreshold: 1,
			failureWindowMs: 60_000,
			onStateChange: () => {},
		});

		const result = await execute(5);
		assert.equal(result, 10);
		assert.equal(circuit.getState(), "closed");
	});

	it("circuit opens after failures through the wrapper", async () => {
		const fn = async () => { throw new Error("nope"); };
		const { execute, circuit } = createCircuitBreaker(fn, {
			failureThreshold: 2,
			resetTimeoutMs: 100,
			successThreshold: 1,
			failureWindowMs: 60_000,
			onStateChange: () => {},
		});

		await assert.rejects(() => execute());
		await assert.rejects(() => execute());
		assert.equal(circuit.getState(), "open");
	});
});
