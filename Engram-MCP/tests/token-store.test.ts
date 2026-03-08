import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type {
	AccessToken,
	AuthorizationCode,
	OAuthClient,
	RefreshToken,
} from "../src/auth/token-store.ts";
import { TokenStore } from "../src/auth/token-store.ts";

describe("TokenStore", () => {
	let store: TokenStore;

	beforeEach(() => {
		store = new TokenStore();
	});

	describe("registerClient / getClient", () => {
		it("stores and retrieves a client", () => {
			const client: OAuthClient = {
				clientId: "client-1",
				clientSecret: "secret-1",
				redirectUris: ["https://example.com/callback"],
				clientName: "Test Client",
				grantTypes: ["authorization_code"],
				responseTypes: ["code"],
				scope: "read write",
				registeredAt: Date.now(),
			};
			store.registerClient(client);
			const retrieved = store.getClient("client-1");
			assert.deepEqual(retrieved, client);
		});

		it("returns undefined for unknown clientId", () => {
			const result = store.getClient("nonexistent");
			assert.equal(result, undefined);
		});
	});

	describe("storeCode / getCode", () => {
		it("stores and retrieves an authorization code", () => {
			const code: AuthorizationCode = {
				code: "auth-code-abc",
				clientId: "client-1",
				redirectUri: "https://example.com/callback",
				codeChallenge: "challenge-value",
				codeChallengeMethod: "S256",
				scope: "read",
				expiresAt: Date.now() + 60_000,
				used: false,
			};
			store.storeCode(code);
			const retrieved = store.getCode("auth-code-abc");
			assert.deepEqual(retrieved, code);
		});
	});

	describe("markCodeUsed", () => {
		it("marks an authorization code as used", () => {
			const code: AuthorizationCode = {
				code: "auth-code-xyz",
				clientId: "client-1",
				redirectUri: "https://example.com/callback",
				codeChallenge: "challenge-value",
				codeChallengeMethod: "S256",
				scope: "read",
				expiresAt: Date.now() + 60_000,
				used: false,
			};
			store.storeCode(code);
			store.markCodeUsed("auth-code-xyz");
			const retrieved = store.getCode("auth-code-xyz");
			assert.equal(retrieved?.used, true);
		});
	});

	describe("storeAccessToken / isTokenValid", () => {
		it("returns true for a valid (non-expired) token", () => {
			const token: AccessToken = {
				token: "access-token-1",
				clientId: "client-1",
				scope: "read",
				expiresAt: Date.now() + 3600_000,
			};
			store.storeAccessToken(token);
			assert.equal(store.isTokenValid("access-token-1"), true);
		});

		it("returns false for an expired token", () => {
			const token: AccessToken = {
				token: "access-token-expired",
				clientId: "client-1",
				scope: "read",
				expiresAt: Date.now() - 1,
			};
			store.storeAccessToken(token);
			assert.equal(store.isTokenValid("access-token-expired"), false);
		});
	});

	describe("storeRefreshToken / getRefreshToken", () => {
		it("stores and retrieves a refresh token", () => {
			const token: RefreshToken = {
				token: "refresh-token-1",
				clientId: "client-1",
				scope: "read write",
				expiresAt: Date.now() + 86400_000,
			};
			store.storeRefreshToken(token);
			const retrieved = store.getRefreshToken("refresh-token-1");
			assert.deepEqual(retrieved, token);
		});
	});

	describe("pruneExpired", () => {
		it("removes expired codes, access tokens, and refresh tokens", () => {
			// Store expired items
			const expiredCode: AuthorizationCode = {
				code: "expired-code",
				clientId: "client-1",
				redirectUri: "https://example.com/callback",
				codeChallenge: "challenge",
				codeChallengeMethod: "S256",
				scope: "read",
				expiresAt: Date.now() - 1,
				used: false,
			};
			const expiredAccess: AccessToken = {
				token: "expired-access",
				clientId: "client-1",
				scope: "read",
				expiresAt: Date.now() - 1,
			};
			const expiredRefresh: RefreshToken = {
				token: "expired-refresh",
				clientId: "client-1",
				scope: "read",
				expiresAt: Date.now() - 1,
			};

			// Store valid items
			const validCode: AuthorizationCode = {
				code: "valid-code",
				clientId: "client-1",
				redirectUri: "https://example.com/callback",
				codeChallenge: "challenge",
				codeChallengeMethod: "S256",
				scope: "read",
				expiresAt: Date.now() + 60_000,
				used: false,
			};

			store.storeCode(expiredCode);
			store.storeCode(validCode);
			store.storeAccessToken(expiredAccess);
			store.storeRefreshToken(expiredRefresh);

			store.pruneExpired();

			assert.equal(store.getCode("expired-code"), undefined);
			assert.equal(store.isTokenValid("expired-access"), false);
			assert.equal(store.getRefreshToken("expired-refresh"), undefined);

			// Valid items remain
			assert.ok(store.getCode("valid-code") !== undefined);
		});
	});
});
