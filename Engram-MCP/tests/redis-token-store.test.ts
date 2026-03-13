import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { AccessToken, OAuthClient } from "../src/auth/token-store.ts";
import { RedisTokenStore } from "../src/auth/redis-token-store.ts";

class FakeRedisClient {
	private readonly values = new Map<string, string>();
	private readonly expiresAt = new Map<string, number>();

	async connect(): Promise<void> {}

	async disconnect(): Promise<void> {}

	async get(key: string): Promise<string | null> {
		this.deleteIfExpired(key);
		return this.values.get(key) ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		this.values.set(key, value);
		this.expiresAt.delete(key);
	}

	async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
		this.values.set(key, value);
		this.expiresAt.set(key, Date.now() + ttlSeconds * 1000);
	}

	async del(keys: string | string[]): Promise<number> {
		const list = Array.isArray(keys) ? keys : [keys];
		let deleted = 0;
		for (const key of list) {
			if (this.values.delete(key)) {
				deleted += 1;
			}
			this.expiresAt.delete(key);
		}
		return deleted;
	}

	async keys(pattern: string): Promise<string[]> {
		const regex = new RegExp(`^${pattern.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&").replace(/\*/g, ".*")}$`);
		const result: string[] = [];
		for (const key of this.values.keys()) {
			this.deleteIfExpired(key);
			if (this.values.has(key) && regex.test(key)) {
				result.push(key);
			}
		}
		return result;
	}

	private deleteIfExpired(key: string): void {
		const expiresAt = this.expiresAt.get(key);
		if (expiresAt !== undefined && Date.now() > expiresAt) {
			this.values.delete(key);
			this.expiresAt.delete(key);
		}
	}
}

describe("RedisTokenStore", () => {
	let client: FakeRedisClient;
	let store: RedisTokenStore;

	beforeEach(async () => {
		client = new FakeRedisClient();
		store = new RedisTokenStore({
			keyPrefix: "test:mcp:oauth:",
			client,
		});
		await store.connect();
	});

	it("stores and retrieves a registered client", async () => {
		const oauthClient: OAuthClient = {
			clientId: "client-1",
			clientSecret: "secret-1",
			redirectUris: ["https://example.com/callback"],
			clientName: "Example",
			grantTypes: ["authorization_code"],
			responseTypes: ["code"],
			scope: "read write",
			registeredAt: Date.now(),
		};

		await store.registerClient(oauthClient);

		const retrieved = await store.getClient("client-1");
		assert.deepEqual(retrieved, oauthClient);
	});

	it("persists access tokens across store instances", async () => {
		const token: AccessToken = {
			token: "access-token-1",
			clientId: "client-1",
			scope: "read",
			expiresAt: Date.now() + 60_000,
			refreshToken: "refresh-token-1",
		};

		await store.storeAccessToken(token);

		const restartedStore = new RedisTokenStore({
			keyPrefix: "test:mcp:oauth:",
			client,
		});
		await restartedStore.connect();

		assert.deepEqual(await restartedStore.getAccessToken(token.token), token);
		assert.equal(await restartedStore.isTokenValid(token.token), true);
	});

	it("treats expired access tokens as invalid after reload", async () => {
		const expiredToken: AccessToken = {
			token: "expired-access-token",
			clientId: "client-1",
			scope: "read",
			expiresAt: Date.now() - 1,
		};

		await store.storeAccessToken(expiredToken);

		const restartedStore = new RedisTokenStore({
			keyPrefix: "test:mcp:oauth:",
			client,
		});
		await restartedStore.connect();

		assert.equal(await restartedStore.getAccessToken(expiredToken.token), undefined);
		assert.equal(await restartedStore.isTokenValid(expiredToken.token), false);
	});
});
