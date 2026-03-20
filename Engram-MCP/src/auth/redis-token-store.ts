import { type RedisClientType, createClient } from "redis";

import type {
	AccessToken,
	AuthorizationCode,
	OAuthClient,
	RefreshToken,
} from "./token-store.js";

type StoredEntity =
	| OAuthClient
	| AuthorizationCode
	| AccessToken
	| RefreshToken;

interface RedisLikeClient {
	connect(): Promise<unknown>;
	disconnect(): Promise<unknown>;
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<unknown>;
	setEx(key: string, ttlSeconds: number, value: string): Promise<unknown>;
	del(keys: string | string[]): Promise<number>;
	keys(pattern: string): Promise<string[]>;
}

export interface RedisTokenStoreConfig {
	url?: string;
	keyPrefix?: string;
	client?: RedisLikeClient;
}

export class RedisTokenStore {
	private readonly client: RedisLikeClient;
	private readonly keyPrefix: string;
	private isConnected = false;

	constructor(config: RedisTokenStoreConfig = {}) {
		this.keyPrefix = config.keyPrefix ?? "mcp:oauth:";
		this.client =
			config.client ??
			(createClient({
				url: config.url ?? "redis://localhost:6379",
			}) as RedisClientType);
	}

	async connect(): Promise<void> {
		if (!this.isConnected) {
			await this.client.connect();
			this.isConnected = true;
		}
	}

	async disconnect(): Promise<void> {
		if (this.isConnected) {
			await this.client.disconnect();
			this.isConnected = false;
		}
	}

	async registerClient(client: OAuthClient): Promise<void> {
		await this.setJson(this.clientKey(client.clientId), client);
	}

	async getClientCount(): Promise<number> {
		await this.connect();
		const keys = await this.client.keys(`${this.keyPrefix}client:*`);
		return keys.length;
	}

	async getClient(clientId: string): Promise<OAuthClient | undefined> {
		return this.getJson<OAuthClient>(this.clientKey(clientId));
	}

	async storeCode(code: AuthorizationCode): Promise<void> {
		await this.setExpiringJson(this.codeKey(code.code), code, code.expiresAt);
	}

	async getCode(code: string): Promise<AuthorizationCode | undefined> {
		return this.getJson<AuthorizationCode>(this.codeKey(code));
	}

	async markCodeUsed(code: string): Promise<void> {
		const stored = await this.getCode(code);
		if (stored !== undefined) {
			await this.setExpiringJson(
				this.codeKey(code),
				{ ...stored, used: true },
				stored.expiresAt,
			);
		}
	}

	async storeAccessToken(token: AccessToken): Promise<void> {
		await this.setExpiringJson(
			this.accessTokenKey(token.token),
			token,
			token.expiresAt,
		);
	}

	async revokeAccessTokensByRefreshToken(refreshToken: string): Promise<void> {
		const keys = await this.client.keys(`${this.keyPrefix}access:*`);
		for (const key of keys) {
			const token = await this.getJson<AccessToken>(key);
			if (token?.refreshToken === refreshToken) {
				await this.client.del(key);
			}
		}
	}

	async getAccessToken(token: string): Promise<AccessToken | undefined> {
		return this.getJson<AccessToken>(this.accessTokenKey(token));
	}

	async isTokenValid(token: string): Promise<boolean> {
		const stored = await this.getAccessToken(token);
		if (stored === undefined) {
			return false;
		}
		return Date.now() < stored.expiresAt;
	}

	async storeRefreshToken(token: RefreshToken): Promise<void> {
		await this.setExpiringJson(
			this.refreshTokenKey(token.token),
			token,
			token.expiresAt,
		);
	}

	async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
		return this.getJson<RefreshToken>(this.refreshTokenKey(token));
	}

	async pruneExpired(): Promise<void> {
		const patterns = ["code:*", "access:*", "refresh:*"];
		for (const pattern of patterns) {
			const keys = await this.client.keys(`${this.keyPrefix}${pattern}`);
			for (const key of keys) {
				const entity = await this.getJson<StoredEntity>(key);
				if (
					entity !== undefined &&
					"expiresAt" in entity &&
					Date.now() > entity.expiresAt
				) {
					await this.client.del(key);
				}
			}
		}
	}

	private async getJson<T>(key: string): Promise<T | undefined> {
		await this.connect();
		const raw = await this.client.get(key);
		return raw === null ? undefined : (JSON.parse(raw) as T);
	}

	private async setJson(key: string, value: StoredEntity): Promise<void> {
		await this.connect();
		await this.client.set(key, JSON.stringify(value));
	}

	private async setExpiringJson(
		key: string,
		value: StoredEntity,
		expiresAt: number,
	): Promise<void> {
		await this.connect();
		const ttlSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
		if (ttlSeconds <= 0) {
			await this.client.del(key);
			return;
		}
		await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
	}

	private clientKey(clientId: string): string {
		return `${this.keyPrefix}client:${clientId}`;
	}

	private codeKey(code: string): string {
		return `${this.keyPrefix}code:${code}`;
	}

	private accessTokenKey(token: string): string {
		return `${this.keyPrefix}access:${token}`;
	}

	private refreshTokenKey(token: string): string {
		return `${this.keyPrefix}refresh:${token}`;
	}
}
