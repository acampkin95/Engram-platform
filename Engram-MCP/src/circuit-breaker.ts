/**
 * Circuit breaker pattern for resilience
 * Prevents cascading failures by stopping requests to a failing service
 */

import { config } from "./config.js";
import { CircuitOpenError } from "./errors.js";
import { logger } from "./logger.js";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
	/** Number of failures before opening circuit */
	failureThreshold?: number;
	/** Time in ms before attempting to close circuit */
	resetTimeoutMs?: number;
	/** Number of successes in half-open state to close circuit */
	successThreshold?: number;
	/** Time window in ms for counting failures */
	failureWindowMs?: number;
	/** Callback when state changes */
	onStateChange?: (state: CircuitState, failures: number) => void;
}

interface FailureRecord {
	timestamp: number;
	error: Error;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
	private state: CircuitState = "closed";
	private failures: FailureRecord[] = [];
	private successes = 0;
	private lastFailureTime = 0;
	private readonly options: Required<CircuitBreakerOptions>;

	constructor(options: CircuitBreakerOptions = {}) {
		this.options = {
			failureThreshold:
				options.failureThreshold ?? config.circuitBreaker.failureThreshold,
			resetTimeoutMs:
				options.resetTimeoutMs ?? config.circuitBreaker.resetTimeoutMs,
			successThreshold:
				options.successThreshold ?? config.circuitBreaker.successThreshold,
			failureWindowMs:
				options.failureWindowMs ?? config.circuitBreaker.failureWindowMs,
			onStateChange: options.onStateChange ?? this.defaultOnStateChange,
		};
	}

	/**
	 * Execute a function through the circuit breaker
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		// Check if circuit should transition from open to half-open
		if (this.state === "open") {
			if (this.shouldAttemptReset()) {
				this.transitionTo("half-open");
			} else {
				const retryAfter = Math.ceil(
					(this.lastFailureTime + this.options.resetTimeoutMs - Date.now()) /
						1000,
				);
				throw new CircuitOpenError("Circuit breaker is open", {
					retryAfter: Math.max(1, retryAfter),
				});
			}
		}

		try {
			const result = await fn();
			this.onSuccess();
			return result;
		} catch (error) {
			this.onFailure(error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}

	/**
	 * Get current circuit state
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * Get current failure count (within window)
	 */
	getFailureCount(): number {
		this.pruneOldFailures();
		return this.failures.length;
	}

	/**
	 * Check if circuit is currently open
	 */
	isOpen(): boolean {
		return this.state === "open";
	}

	/**
	 * Check if circuit is currently closed
	 */
	isClosed(): boolean {
		return this.state === "closed";
	}

	/**
	 * Manually reset the circuit breaker
	 */
	reset(): void {
		this.failures = [];
		this.successes = 0;
		this.transitionTo("closed");
	}

	/**
	 * Manually trip the circuit breaker
	 */
	trip(): void {
		this.transitionTo("open");
	}

	/**
	 * Handle successful execution
	 */
	private onSuccess(): void {
		if (this.state === "half-open") {
			this.successes++;
			if (this.successes >= this.options.successThreshold) {
				this.failures = [];
				this.successes = 0;
				this.transitionTo("closed");
			}
		}
	}

	/**
	 * Handle failed execution
	 */
	private onFailure(error: Error): void {
		this.lastFailureTime = Date.now();
		this.failures.push({ timestamp: this.lastFailureTime, error });
		this.pruneOldFailures();

		if (this.state === "half-open") {
			// Any failure in half-open state opens the circuit
			this.successes = 0;
			this.transitionTo("open");
		} else if (this.state === "closed") {
			if (this.failures.length >= this.options.failureThreshold) {
				this.transitionTo("open");
			}
		}
	}

	/**
	 * Check if enough time has passed to attempt reset
	 */
	private shouldAttemptReset(): boolean {
		return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
	}

	/**
	 * Remove failures outside the time window
	 */
	private pruneOldFailures(): void {
		const cutoff = Date.now() - this.options.failureWindowMs;
		this.failures = this.failures.filter((f) => f.timestamp > cutoff);
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: CircuitState): void {
		this.state = newState;
		this.options.onStateChange(newState, this.failures.length);
	}

	/**
	 * Default state change callback
	 */
	private defaultOnStateChange = (
		state: CircuitState,
		failures: number,
	): void => {
		logger.circuitBreaker(state, failures);
	};
}

/**
 * Create a circuit breaker wrapper for a function
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
	options?: CircuitBreakerOptions,
): { execute: (...args: TArgs) => Promise<TResult>; circuit: CircuitBreaker } {
	const circuit = new CircuitBreaker(options);

	return {
		execute: (...args: TArgs) => circuit.execute(() => fn(...args)),
		circuit,
	};
}

/**
 * Global circuit breaker instance for API calls
 */
export const apiCircuitBreaker = new CircuitBreaker();
