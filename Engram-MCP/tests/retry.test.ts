import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withRetry, createRetryWrapper } from "../dist/retry.js";
import { InvalidInputError, NetworkError } from "../dist/errors.js";

describe("withRetry", () => {
	it("returns result on first success", async () => {
		const result = await withRetry(async () => 42, { maxRetries: 3 });
		assert.equal(result, 42);
	});

	it("retries on transient failure then succeeds", async () => {
		let attempt = 0;
		const result = await withRetry(
			async () => {
				attempt++;
				if (attempt < 3) throw new NetworkError("fail");
				return "ok";
			},
			{
				maxRetries: 3,
				initialDelayMs: 1,
				maxDelayMs: 5,
				backoffMultiplier: 1,
				jitterFactor: 0,
				onRetry: () => {},
			},
		);
		assert.equal(result, "ok");
		assert.equal(attempt, 3);
	});

	it("throws after exhausting retries", async () => {
		await assert.rejects(
			() =>
				withRetry(
					async () => { throw new NetworkError("always fails"); },
					{
						maxRetries: 2,
						initialDelayMs: 1,
						maxDelayMs: 5,
						backoffMultiplier: 1,
						jitterFactor: 0,
						onRetry: () => {},
					},
				),
			(err: unknown) => {
				assert.ok(err instanceof NetworkError);
				return true;
			},
		);
	});

	it("does not retry non-retryable errors", async () => {
		let attempts = 0;
		await assert.rejects(
			() =>
				withRetry(
					async () => {
						attempts++;
						throw new InvalidInputError("bad input");
					},
					{
						maxRetries: 3,
						initialDelayMs: 1,
						maxDelayMs: 5,
						backoffMultiplier: 1,
						jitterFactor: 0,
						onRetry: () => {},
					},
				),
			(err: unknown) => {
				assert.ok(err instanceof InvalidInputError);
				return true;
			},
		);
		assert.equal(attempts, 1);
	});

	it("respects custom shouldRetry predicate", async () => {
		let attempts = 0;
		await assert.rejects(
			() =>
				withRetry(
					async () => {
						attempts++;
						throw new NetworkError("fail");
					},
					{
						maxRetries: 5,
						initialDelayMs: 1,
						maxDelayMs: 5,
						backoffMultiplier: 1,
						jitterFactor: 0,
						shouldRetry: (_err, attempt) => attempt < 2,
						onRetry: () => {},
					},
				),
		);
		// shouldRetry returns false when attempt >= 2, so only 2 attempts
		assert.equal(attempts, 2);
	});

	it("calls onRetry callback before each retry", async () => {
		const retryLog: Array<{ attempt: number; delayMs: number }> = [];
		let attempt = 0;

		await withRetry(
			async () => {
				attempt++;
				if (attempt < 3) throw new NetworkError("fail");
				return "done";
			},
			{
				maxRetries: 3,
				initialDelayMs: 10,
				maxDelayMs: 100,
				backoffMultiplier: 2,
				jitterFactor: 0,
				onRetry: (_err, a, d) => retryLog.push({ attempt: a, delayMs: d }),
			},
		);

		assert.equal(retryLog.length, 2);
		assert.equal(retryLog[0]?.attempt, 1);
		assert.equal(retryLog[1]?.attempt, 2);
		// With backoff multiplier 2 and jitter 0:
		// attempt 1: 10 * 2^0 = 10
		// attempt 2: 10 * 2^1 = 20
		assert.equal(retryLog[0]?.delayMs, 10);
		assert.equal(retryLog[1]?.delayMs, 20);
	});

	it("caps delay at maxDelayMs", async () => {
		const delays: number[] = [];
		let attempt = 0;

		await assert.rejects(() =>
			withRetry(
				async () => {
					attempt++;
					throw new NetworkError("fail");
				},
				{
					maxRetries: 4,
					initialDelayMs: 100,
					maxDelayMs: 200,
					backoffMultiplier: 10,
					jitterFactor: 0,
					onRetry: (_err, _a, d) => delays.push(d),
				},
			),
		);

		// All delays should be capped at maxDelayMs (200)
		for (const d of delays) {
			assert.ok(d <= 200, `delay ${d} exceeds maxDelayMs 200`);
		}
	});
});

describe("createRetryWrapper", () => {
	it("wraps a function with retry logic", async () => {
		let calls = 0;
		const fn = async (x: number): Promise<number> => {
			calls++;
			if (calls < 2) throw new NetworkError("fail");
			return x * 3;
		};

		const wrapped = createRetryWrapper(fn, {
			maxRetries: 3,
			initialDelayMs: 1,
			maxDelayMs: 5,
			backoffMultiplier: 1,
			jitterFactor: 0,
			onRetry: () => {},
		});

		const result = await wrapped(7);
		assert.equal(result, 21);
		assert.equal(calls, 2);
	});

	it("passes arguments through to the wrapped function", async () => {
		const fn = async (a: string, b: number) => `${a}-${b}`;
		const wrapped = createRetryWrapper(fn, { maxRetries: 0 });

		const result = await wrapped("hello", 42);
		assert.equal(result, "hello-42");
	});
});
