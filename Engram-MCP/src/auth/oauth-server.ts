/**
 * OAuth 2.1 Authorization Server — Engram MCP
 *
 * Implements the MCP specification OAuth endpoints using raw Node.js HTTP
 * primitives (no framework).  A single module-level {@link TokenStore}
 * instance is shared between the router and the exported
 * {@link validateOAuthToken} helper so that both halves of the auth layer
 * see the same token database.
 *
 * Endpoints handled by {@link createOAuthRouter}:
 *   GET  /.well-known/oauth-authorization-server  (RFC 8414)
 *   POST /oauth/register                          (RFC 7591 dynamic registration)
 *   GET  /oauth/authorize                         (authorization code + PKCE)
 *   POST /oauth/token                             (token exchange & refresh)
 */

import { randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { MCPConfig } from "../config.js";
import { readBody } from "../utils/read-body.js";
import { verifyCodeChallenge } from "./pkce.js";
import { RedisTokenStore } from "./redis-token-store.js";
import type { OAuthClient } from "./token-store.js";
import { TokenStore } from "./token-store.js";

// ---------------------------------------------------------------------------
// Module-level singleton — shared with validateOAuthToken
// ---------------------------------------------------------------------------

type OAuthStore = TokenStore | RedisTokenStore;

const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

let tokenStore: OAuthStore | undefined;

async function getTokenStore(config?: MCPConfig): Promise<OAuthStore> {
	if (tokenStore !== undefined) {
		return tokenStore;
	}

	if (config?.oauth.redisUrl) {
		const redisStore = new RedisTokenStore({
			url: config.oauth.redisUrl,
			keyPrefix: config.oauth.redisKeyPrefix,
		});
		await redisStore.connect();
		tokenStore = redisStore;
		return tokenStore;
	}

	tokenStore = new TokenStore();
	return tokenStore;
}

export async function initializeOAuthTokenStore(
	config?: MCPConfig,
): Promise<void> {
	await getTokenStore(config);
}
// ---------------------------------------------------------------------------
// Public validator (used by oauth-middleware.ts)
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `token` is a known, unexpired OAuth access token.
 *
 * Operates on the same module-level {@link TokenStore} used by
 * {@link createOAuthRouter}, so tokens issued through the router are
 * immediately visible here.
 *
 * @param token - The raw Bearer token string extracted from the request.
 */
export async function validateOAuthToken(token: string): Promise<boolean> {
	const store = await getTokenStore();
	return await store.isTokenValid(token);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-IP, sliding window)
// ---------------------------------------------------------------------------

const MAX_CLIENTS = 1000;

interface RateBucket {
	count: number;
	windowStart: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per IP per window

const rateBuckets = new Map<string, RateBucket>();

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const bucket = rateBuckets.get(ip);
	if (bucket === undefined || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
		rateBuckets.set(ip, { count: 1, windowStart: now });
		return false;
	}
	bucket.count += 1;
	return bucket.count > RATE_LIMIT_MAX;
}

// Prune stale rate-limit buckets every 5 minutes to prevent unbounded growth
const rateBucketPruneTimer = setInterval(() => {
	const now = Date.now();
	for (const [ip, bucket] of rateBuckets) {
		if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
			rateBuckets.delete(ip);
		}
	}
}, PRUNE_INTERVAL_MS);
rateBucketPruneTimer.unref();

/**
 * Parses a request body as either `application/x-www-form-urlencoded` or
 * JSON, returning a plain record of key → unknown value.
 *
 * For form-encoded bodies every value is a `string`.  JSON bodies may
 * contain arrays or nested objects (e.g. `redirect_uris`).
 */
async function parseBody(
	req: IncomingMessage,
): Promise<Record<string, unknown>> {
	const raw = await readBody(req);
	const contentType = req.headers["content-type"] ?? "";

	if (contentType.includes("application/x-www-form-urlencoded")) {
		const params = new URLSearchParams(raw);
		const result: Record<string, string> = {};
		for (const [key, value] of params) {
			result[key] = value;
		}
		return result;
	}

	// Treat everything else as JSON
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// Fall through to empty object on malformed JSON
	}
	return {};
}

/** Writes a JSON response with the supplied HTTP status code. */
function sendJSON(
	res: ServerResponse,
	status: number,
	data: unknown,
	extraHeaders: Record<string, string> = {},
): void {
	const body = JSON.stringify(data);
	res.writeHead(status, {
		"Content-Type": "application/json",
		...extraHeaders,
	});
	res.end(body);
}

/** Coerces an unknown value to a string, returning `""` for non-strings. */
function str(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/** Coerces an unknown value to a `string[]`, handling both arrays and single strings. */
function strArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string");
	}
	if (typeof value === "string" && value.length > 0) {
		return [value];
	}
	return [];
}

// ---------------------------------------------------------------------------
// createOAuthRouter
// ---------------------------------------------------------------------------

/**
 * Creates an OAuth 2.1 request router that handles all `/oauth/*` and
 * `/.well-known/oauth-authorization-server` paths.
 *
 * The returned function matches the calling convention in `http.ts`:
 * ```ts
 * await oauthRouter(req, res, url, corsHeaders(origin, allowedOrigins));
 * ```
 *
 * @param config - Full server configuration; `config.oauth` is used for
 *   issuer, token TTLs, etc.
 */
export function createOAuthRouter(
	config: MCPConfig,
): (
	req: IncomingMessage,
	res: ServerResponse,
	url: URL,
	corsHeaders: Record<string, string>,
) => Promise<void> {
	const { oauth } = config;

	return async (req, res, url, corsHeaders): Promise<void> => {
		const pathname = url.pathname;
		const method = req.method ?? "GET";

		if (!oauth.enabled) {
			sendJSON(
				res,
				404,
				{ error: "not_found", message: "OAuth is not enabled" },
				corsHeaders,
			);
			return;
		}

		// -----------------------------------------------------------------------
		// GET /.well-known/oauth-authorization-server  (RFC 8414 metadata)
		// -----------------------------------------------------------------------
		if (
			pathname === "/.well-known/oauth-authorization-server" &&
			method === "GET"
		) {
			const metadata = {
				issuer: oauth.issuer,
				authorization_endpoint: `${oauth.issuer}/oauth/authorize`,
				token_endpoint: `${oauth.issuer}/oauth/token`,
				registration_endpoint: `${oauth.issuer}/oauth/register`,
				response_types_supported: ["code"],
				grant_types_supported: ["authorization_code", "refresh_token"],
				code_challenge_methods_supported: ["S256"],
				token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
				scopes_supported: ["memory:read", "memory:write", "memory:admin"],
			};
			sendJSON(res, 200, metadata, corsHeaders);
			return;
		}

		// -----------------------------------------------------------------------
		// POST /oauth/register  (RFC 7591 dynamic client registration)
		// -----------------------------------------------------------------------
		if (pathname === "/oauth/register" && method === "POST") {
			const store = await getTokenStore(config);
			// Rate limit
			const regIp = String(req.socket.remoteAddress ?? "unknown");
			if (isRateLimited(regIp)) {
				sendJSON(
					res,
					429,
					{
						error: "too_many_requests",
						error_description: "Rate limit exceeded",
					},
					corsHeaders,
				);
				return;
			}
			// Client cap
			if ((await store.getClientCount()) >= MAX_CLIENTS) {
				sendJSON(
					res,
					503,
					{
						error: "service_unavailable",
						error_description: "Client registration limit reached",
					},
					corsHeaders,
				);
				return;
			}
			let body: Record<string, unknown>;
			try {
				body = await parseBody(req);
			} catch {
				sendJSON(
					res,
					413,
					{
						error: "request_entity_too_large",
						error_description: "Request body too large",
					},
					corsHeaders,
				);
				return;
			}

			const redirectUris = strArray(body.redirect_uris);
			if (redirectUris.length === 0) {
				sendJSON(
					res,
					400,
					{
						error: "invalid_request",
						error_description:
							"redirect_uris is required and must be a non-empty array",
					},
					corsHeaders,
				);
				return;
			}

			const clientId = randomUUID();
			const clientSecret = randomBytes(32).toString("hex");

			const grantTypes =
				strArray(body.grant_types).length > 0
					? strArray(body.grant_types)
					: ["authorization_code", "refresh_token"];

			const responseTypes =
				strArray(body.response_types).length > 0
					? strArray(body.response_types)
					: ["code"];

			const scope = str(body.scope) || "memory:read memory:write";

			const clientName = str(body.client_name) || undefined;

			const client: OAuthClient = {
				clientId,
				clientSecret,
				redirectUris,
				clientName,
				grantTypes,
				responseTypes,
				scope,
				registeredAt: Date.now(),
			};

			await store.registerClient(client);

			sendJSON(
				res,
				201,
				{
					client_id: clientId,
					client_secret: clientSecret,
					...(clientName !== undefined ? { client_name: clientName } : {}),
					redirect_uris: redirectUris,
					grant_types: grantTypes,
					response_types: responseTypes,
					scope,
					registered_at: client.registeredAt,
				},
				corsHeaders,
			);
			return;
		}

		// -----------------------------------------------------------------------
		// GET /oauth/authorize  (authorization code + PKCE)
		// -----------------------------------------------------------------------
		if (pathname === "/oauth/authorize" && method === "GET") {
			const store = await getTokenStore(config);
			const clientId = url.searchParams.get("client_id") ?? "";
			const redirectUri = url.searchParams.get("redirect_uri") ?? "";
			const responseType = url.searchParams.get("response_type") ?? "";
			const codeChallenge = url.searchParams.get("code_challenge") ?? "";
			const codeChallengeMethod =
				url.searchParams.get("code_challenge_method") ?? "";
			const scope = url.searchParams.get("scope") ?? "";
			const state = url.searchParams.get("state") ?? "";

			// Validate client — do NOT redirect to unknown URIs on client errors
			const client = await store.getClient(clientId);
			if (client === undefined) {
				sendJSON(
					res,
					400,
					{
						error: "invalid_client",
						error_description: "Unknown client_id",
					},
					corsHeaders,
				);
				return;
			}

			// Validate redirect_uri against registered set — also no redirect
			if (!client.redirectUris.includes(redirectUri)) {
				sendJSON(
					res,
					400,
					{
						error: "invalid_request",
						error_description:
							"redirect_uri does not match any registered URI for this client",
					},
					corsHeaders,
				);
				return;
			}

			// Helper: build error redirect to the (now validated) redirect_uri
			const errorRedirect = (error: string, description: string): string => {
				const u = new URL(redirectUri);
				u.searchParams.set("error", error);
				u.searchParams.set("error_description", description);
				if (state) u.searchParams.set("state", state);
				return u.toString();
			};

			if (responseType !== "code") {
				res.writeHead(302, {
					Location: errorRedirect(
						"unsupported_response_type",
						"Only 'code' response_type is supported",
					),
					...corsHeaders,
				});
				res.end();
				return;
			}

			if (!codeChallenge) {
				res.writeHead(302, {
					Location: errorRedirect(
						"invalid_request",
						"code_challenge is required",
					),
					...corsHeaders,
				});
				res.end();
				return;
			}

			if (codeChallengeMethod !== "S256") {
				res.writeHead(302, {
					Location: errorRedirect(
						"invalid_request",
						"Only S256 code_challenge_method is supported",
					),
					...corsHeaders,
				});
				res.end();
				return;
			}

			// Validate requested scopes are a subset of the client's registered scopes
			const requestedScopes = scope.split(" ").filter(Boolean);
			const allowedScopes = new Set(client.scope.split(" ").filter(Boolean));
			const invalidScopes = requestedScopes.filter(
				(s) => !allowedScopes.has(s),
			);
			if (invalidScopes.length > 0) {
				res.writeHead(302, {
					Location: errorRedirect(
						"invalid_scope",
						`Requested scopes not allowed: ${invalidScopes.join(", ")}`,
					),
					...corsHeaders,
				});
				res.end();
				return;
			}

			// Issue the authorization code (10-minute TTL)
			const code = randomBytes(32).toString("hex");
			await store.storeCode({
				code,
				clientId,
				redirectUri,
				codeChallenge,
				codeChallengeMethod,
				scope,
				expiresAt: Date.now() + 10 * 60 * 1000,
				used: false,
			});

			const successUrl = new URL(redirectUri);
			successUrl.searchParams.set("code", code);
			if (state) successUrl.searchParams.set("state", state);

			res.writeHead(302, {
				Location: successUrl.toString(),
				...corsHeaders,
			});
			res.end();
			return;
		}

		// -----------------------------------------------------------------------
		// POST /oauth/token  (exchange & refresh)
		// -----------------------------------------------------------------------
		if (pathname === "/oauth/token" && method === "POST") {
			const store = await getTokenStore(config);
			// Rate limit
			const tokenIp = String(req.socket.remoteAddress ?? "unknown");
			if (isRateLimited(tokenIp)) {
				sendJSON(
					res,
					429,
					{
						error: "too_many_requests",
						error_description: "Rate limit exceeded",
					},
					corsHeaders,
				);
				return;
			}
			// Prune stale entries on every token-endpoint request
			await store.pruneExpired();

			let body: Record<string, unknown>;
			try {
				body = await parseBody(req);
			} catch {
				sendJSON(
					res,
					413,
					{
						error: "request_entity_too_large",
						error_description: "Request body too large",
					},
					corsHeaders,
				);
				return;
			}
			const grantType = str(body.grant_type);

			// ------- authorization_code -------
			if (grantType === "authorization_code") {
				const code = str(body.code);
				const clientId = str(body.client_id);
				const redirectUri = str(body.redirect_uri);
				const codeVerifier = str(body.code_verifier);

				const storedCode = await store.getCode(code);

				if (storedCode === undefined) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "Authorization code not found",
						},
						corsHeaders,
					);
					return;
				}

				if (storedCode.used) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "Authorization code has already been used",
						},
						corsHeaders,
					);
					return;
				}

				if (Date.now() > storedCode.expiresAt) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "Authorization code has expired",
						},
						corsHeaders,
					);
					return;
				}

				if (storedCode.clientId !== clientId) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description:
								"client_id does not match the authorization code",
						},
						corsHeaders,
					);
					return;
				}

				if (storedCode.redirectUri !== redirectUri) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description:
								"redirect_uri does not match the authorization code",
						},
						corsHeaders,
					);
					return;
				}

				const pkceValid = await verifyCodeChallenge(
					codeVerifier,
					storedCode.codeChallenge,
					storedCode.codeChallengeMethod,
				);

				if (!pkceValid) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "PKCE code_verifier verification failed",
						},
						corsHeaders,
					);
					return;
				}

				await store.markCodeUsed(code);

				const accessToken = randomBytes(32).toString("hex");
				const refreshToken = randomBytes(32).toString("hex");
				const now = Date.now();

				await store.storeAccessToken({
					token: accessToken,
					clientId,
					scope: storedCode.scope,
					expiresAt: now + oauth.accessTokenTtl * 1000,
					refreshToken,
				});

				await store.storeRefreshToken({
					token: refreshToken,
					clientId,
					scope: storedCode.scope,
					expiresAt: now + oauth.refreshTokenTtl * 1000,
				});

				sendJSON(
					res,
					200,
					{
						access_token: accessToken,
						token_type: "Bearer",
						expires_in: oauth.accessTokenTtl,
						refresh_token: refreshToken,
						scope: storedCode.scope,
					},
					corsHeaders,
				);
				return;
			}

			// ------- refresh_token -------
			if (grantType === "refresh_token") {
				const refreshTokenValue = str(body.refresh_token);
				const clientId = str(body.client_id);

				const storedRefresh = await store.getRefreshToken(refreshTokenValue);

				if (storedRefresh === undefined) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "Refresh token not found",
						},
						corsHeaders,
					);
					return;
				}

				if (Date.now() > storedRefresh.expiresAt) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "Refresh token has expired",
						},
						corsHeaders,
					);
					return;
				}

				if (storedRefresh.clientId !== clientId) {
					sendJSON(
						res,
						400,
						{
							error: "invalid_grant",
							error_description: "client_id does not match the refresh token",
						},
						corsHeaders,
					);
					return;
				}

				const newAccessToken = randomBytes(32).toString("hex");

				// Revoke old access token(s) linked to this refresh token before issuing new one
				await store.revokeAccessTokensByRefreshToken(refreshTokenValue);

				await store.storeAccessToken({
					token: newAccessToken,
					clientId,
					scope: storedRefresh.scope,
					expiresAt: Date.now() + oauth.accessTokenTtl * 1000,
					refreshToken: refreshTokenValue,
				});

				sendJSON(
					res,
					200,
					{
						access_token: newAccessToken,
						token_type: "Bearer",
						expires_in: oauth.accessTokenTtl,
						refresh_token: refreshTokenValue,
						scope: storedRefresh.scope,
					},
					corsHeaders,
				);
				return;
			}

			// ------- unsupported grant type -------
			sendJSON(
				res,
				400,
				{
					error: "unsupported_grant_type",
					error_description:
						"Supported grant types: authorization_code, refresh_token",
				},
				corsHeaders,
			);
			return;
		}

		// -----------------------------------------------------------------------
		// 404 — unmatched OAuth path
		// -----------------------------------------------------------------------
		sendJSON(res, 404, { error: "not_found", path: pathname }, corsHeaders);
	};
}
