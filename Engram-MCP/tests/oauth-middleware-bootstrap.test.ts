import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { afterEach, describe, it, mock } from "node:test";

import { validateAuth } from "../dist/auth/oauth-middleware.js";
import { RedisTokenStore } from "../dist/auth/redis-token-store.js";
import type { MCPConfig } from "../dist/config.js";

function createConfig(): MCPConfig {
	return {
		serverName: "test-server",
		serverVersion: "1.0.0",
		transport: "http",
		port: 3000,
		apiUrl: "http://localhost:8000",
		oauth: {
			enabled: true,
			issuer: "http://localhost:3000",
			secret: "test-secret",
			accessTokenTtl: 3600,
			refreshTokenTtl: 86400,
			redisUrl: "redis://unused:6379",
			redisKeyPrefix: "test:mcp:oauth:",
		},
		retry: {
			maxRetries: 3,
			initialDelayMs: 100,
			maxDelayMs: 1000,
			backoffMultiplier: 2,
			jitterFactor: 0.1,
		},
		circuitBreaker: {
			failureThreshold: 5,
			resetTimeoutMs: 30000,
			successThreshold: 2,
			failureWindowMs: 60000,
		},
		timeout: {
			requestMs: 30000,
			connectionMs: 5000,
			readMs: 30000,
		},
		logging: {
			level: "error",
			timestamps: false,
			requestIds: true,
		},
	};
}

afterEach(() => {
	mock.restoreAll();
});

describe("validateAuth Redis bootstrap", () => {
	it("accepts persisted OAuth access tokens when Redis-backed auth is configured before route initialization", async () => {
		const connectMock = mock.method(
			RedisTokenStore.prototype,
			"connect",
			async () => {},
		);
		const isTokenValidMock = mock.method(
			RedisTokenStore.prototype,
			"isTokenValid",
			async (token: string) => token === "persisted-token",
		);

		const req = {
			headers: {
				authorization: "Bearer persisted-token",
			},
		} as IncomingMessage;

		const result = await validateAuth(req, createConfig());

		assert.equal(result.valid, true);
		assert.equal(connectMock.mock.callCount(), 1);
		assert.equal(isTokenValidMock.mock.callCount(), 1);
	});
});
