/**
 * In-memory OAuth 2.1 token store.
 *
 * Holds all OAuth state (clients, authorization codes, access tokens, refresh
 * tokens) for the lifetime of the process.  State is intentionally volatile:
 * a restart clears everything and clients must re-register / re-authorise.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A dynamically registered OAuth 2.0 client (RFC 7591). */
export interface OAuthClient {
	/** Unique client identifier. */
	clientId: string;
	/** Client secret (kept server-side only). */
	clientSecret: string;
	/** Allowed redirect URIs. */
	redirectUris: string[];
	/** Human-readable client name. */
	clientName?: string;
	/** Supported grant types, e.g. `["authorization_code", "refresh_token"]`. */
	grantTypes: string[];
	/** Supported response types, e.g. `["code"]`. */
	responseTypes: string[];
	/** Space-delimited list of allowed scopes. */
	scope: string;
	/** Unix timestamp (ms) when the client was registered. */
	registeredAt: number;
}

/** A single-use authorization code issued by the `/oauth/authorize` endpoint. */
export interface AuthorizationCode {
	/** The opaque code value. */
	code: string;
	/** Owning client. */
	clientId: string;
	/** The redirect URI that was used when the code was issued. */
	redirectUri: string;
	/** PKCE challenge value. */
	codeChallenge: string;
	/** PKCE challenge method (`"S256"`). */
	codeChallengeMethod: string;
	/** Space-delimited list of granted scopes. */
	scope: string;
	/** Unix timestamp (ms) after which the code is no longer valid. */
	expiresAt: number;
	/** Whether this code has already been redeemed. */
	used: boolean;
}

/** An issued OAuth 2.0 Bearer access token. */
export interface AccessToken {
	/** The opaque token value. */
	token: string;
	/** Owning client. */
	clientId: string;
	/** Space-delimited list of granted scopes. */
	scope: string;
	/** Unix timestamp (ms) after which the token is no longer valid. */
	expiresAt: number;
	/** Companion refresh token, if one was issued. */
	refreshToken?: string;
}

/** An issued OAuth 2.0 refresh token. */
export interface RefreshToken {
	/** The opaque token value. */
	token: string;
	/** Owning client. */
	clientId: string;
	/** Space-delimited list of granted scopes. */
	scope: string;
	/** Unix timestamp (ms) after which the token is no longer valid. */
	expiresAt: number;
}

// ---------------------------------------------------------------------------
// TokenStore
// ---------------------------------------------------------------------------

/**
 * Thread-safe (single-process) in-memory store for all OAuth entities.
 *
 * All write operations are synchronous; there are no async I/O paths.
 * Call {@link pruneExpired} periodically (e.g. on every token-endpoint hit)
 * to prevent unbounded memory growth.
 */
export class TokenStore {
	private readonly clients = new Map<string, OAuthClient>();
	private readonly codes = new Map<string, AuthorizationCode>();
	private readonly accessTokens = new Map<string, AccessToken>();
	private readonly refreshTokens = new Map<string, RefreshToken>();

	// -----------------------------------------------------------------------
	// Clients
	// -----------------------------------------------------------------------

	/**
	 * Persists a newly registered client.
	 *
	 * @param client - The client metadata to store, keyed by `clientId`.
	 */
	registerClient(client: OAuthClient): void {
		this.clients.set(client.clientId, client);
	}

	/**
	 * Returns the number of registered clients.
	 */
	get clientCount(): number {
		return this.clients.size;
	}

	/**
	 * Retrieves a registered client by its identifier.
	 *
	 * @param clientId - The client identifier to look up.
	 * @returns The client, or `undefined` if not found.
	 */
	getClient(clientId: string): OAuthClient | undefined {
		return this.clients.get(clientId);
	}

	// -----------------------------------------------------------------------
	// Authorization codes
	// -----------------------------------------------------------------------

	/**
	 * Stores a newly issued authorization code.
	 *
	 * @param code - The authorization code object to store.
	 */
	storeCode(code: AuthorizationCode): void {
		this.codes.set(code.code, code);
	}

	/**
	 * Retrieves an authorization code by its value.
	 *
	 * @param code - The code value to look up.
	 * @returns The stored code, or `undefined` if not found.
	 */
	getCode(code: string): AuthorizationCode | undefined {
		return this.codes.get(code);
	}

	/**
	 * Marks an authorization code as consumed so it cannot be redeemed again.
	 *
	 * @param code - The code value to mark as used.
	 */
	markCodeUsed(code: string): void {
		const stored = this.codes.get(code);
		if (stored !== undefined) {
			this.codes.set(code, { ...stored, used: true });
		}
	}

	// -----------------------------------------------------------------------
	// Access tokens
	// -----------------------------------------------------------------------

	/**
	 * Persists a newly issued access token.
	 *
	 * @param token - The access token object to store.
	 */
	storeAccessToken(token: AccessToken): void {
		this.accessTokens.set(token.token, token);
	}

	/**
	 * Revokes all access tokens that are linked to the given refresh token.
	 *
	 * @param refreshToken - The refresh token value whose access tokens should be revoked.
	 */
	revokeAccessTokensByRefreshToken(refreshToken: string): void {
		for (const [key, token] of this.accessTokens) {
			if (token.refreshToken === refreshToken) {
				this.accessTokens.delete(key);
			}
		}
	}

	/**
	 * Retrieves an access token by its value.
	 *
	 * @param token - The token value to look up.
	 * @returns The stored token, or `undefined` if not found.
	 */
	getAccessToken(token: string): AccessToken | undefined {
		return this.accessTokens.get(token);
	}

	/**
	 * Returns `true` if `token` exists and has not yet expired.
	 *
	 * @param token - The token value to validate.
	 */
	isTokenValid(token: string): boolean {
		const stored = this.accessTokens.get(token);
		if (stored === undefined) {
			return false;
		}
		return Date.now() < stored.expiresAt;
	}

	// -----------------------------------------------------------------------
	// Refresh tokens
	// -----------------------------------------------------------------------

	/**
	 * Persists a newly issued refresh token.
	 *
	 * @param token - The refresh token object to store.
	 */
	storeRefreshToken(token: RefreshToken): void {
		this.refreshTokens.set(token.token, token);
	}

	/**
	 * Retrieves a refresh token by its value.
	 *
	 * @param token - The token value to look up.
	 * @returns The stored refresh token, or `undefined` if not found.
	 */
	getRefreshToken(token: string): RefreshToken | undefined {
		return this.refreshTokens.get(token);
	}

	// -----------------------------------------------------------------------
	// Cleanup
	// -----------------------------------------------------------------------

	/**
	 * Removes all expired entries from every collection.
	 *
	 * Should be called on each token-endpoint request to bound memory usage.
	 */
	pruneExpired(): void {
		const now = Date.now();

		for (const [key, code] of this.codes) {
			if (now > code.expiresAt) {
				this.codes.delete(key);
			}
		}

		for (const [key, token] of this.accessTokens) {
			if (now > token.expiresAt) {
				this.accessTokens.delete(key);
			}
		}

		for (const [key, token] of this.refreshTokens) {
			if (now > token.expiresAt) {
				this.refreshTokens.delete(key);
			}
		}
	}
}
