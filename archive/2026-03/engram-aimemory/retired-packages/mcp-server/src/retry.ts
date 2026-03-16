/**
 * Retry logic with exponential backoff and jitter
 */

import { config } from "./config.js";
import { isRetryable } from "./errors.js";
import { logger } from "./logger.js";

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Jitter factor (0-1) */
  jitterFactor?: number;
  /** Custom retry predicate */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback before each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: Required<
    Pick<RetryOptions, "initialDelayMs" | "maxDelayMs" | "backoffMultiplier" | "jitterFactor">
  >
): number {
  const baseDelay = config.initialDelayMs * config.backoffMultiplier ** (attempt - 1);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterFactor * Math.random();
  return Math.round(cappedDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retryConfig: Required<
    Pick<
      RetryOptions,
      "maxRetries" | "initialDelayMs" | "maxDelayMs" | "backoffMultiplier" | "jitterFactor"
    >
  > = {
    maxRetries: options.maxRetries ?? config.retry.maxRetries,
    initialDelayMs: options.initialDelayMs ?? config.retry.initialDelayMs,
    maxDelayMs: options.maxDelayMs ?? config.retry.maxDelayMs,
    backoffMultiplier: options.backoffMultiplier ?? config.retry.backoffMultiplier,
    jitterFactor: options.jitterFactor ?? config.retry.jitterFactor,
  };

  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const onRetry = options.onRetry ?? defaultOnRetry;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt > retryConfig.maxRetries || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      const delayMs = calculateDelay(attempt, retryConfig);
      onRetry(lastError, attempt, delayMs);

      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error("Retry failed");
}

/**
 * Default retry predicate
 */
function defaultShouldRetry(error: Error, _attempt: number): boolean {
  return isRetryable(error);
}

/**
 * Default retry callback
 */
function defaultOnRetry(error: Error, attempt: number, delayMs: number): void {
  logger.retry(attempt, config.retry.maxRetries + 1, delayMs, error);
}

/**
 * Create a retry wrapper for a function
 */
export function createRetryWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Decorator for retry logic (for class methods)
 */
export function retry(options: RetryOptions = {}) {
  return (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>
  ) => {
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
