/**
 * Authentication middleware for the Engram MCP HTTP transport.
 *
 * Supports two auth modes, evaluated in priority order:
 *   1. OAuth 2.1 Bearer token (when `config.oauth.enabled` is true)
 *   2. Static shared secret via `config.authToken` (simple Bearer fallback)
 *
 * If neither mode is configured the request is allowed through unconditionally.
 */

import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { MCPConfig } from "../config.js";
import { validateOAuthToken } from "./oauth-server.js";

/**
 * Constant-time string equality check to prevent timing attacks.
 *
 * @param a - First string.
 * @param b - Second string.
 */
function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a, "utf8");
	const bufB = Buffer.from(b, "utf8");
	// Always run timingSafeEqual to prevent length-based timing leaks.
	// Pad the shorter buffer to the length of the longer one before comparing.
	const len = Math.max(bufA.length, bufB.length);
	const paddedA = Buffer.concat([bufA, Buffer.alloc(len - bufA.length)]);
	const paddedB = Buffer.concat([bufB, Buffer.alloc(len - bufB.length)]);
	const equal = timingSafeEqual(paddedA, paddedB);
	// Length mismatch is always unequal, regardless of padded comparison.
	return equal && bufA.length === bufB.length;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by {@link validateAuth}. */
export interface AuthResult {
	/** Whether the request carries valid credentials. */
	valid: boolean;
	/** Human-readable reason for rejection, present only when `valid` is `false`. */
	error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the Bearer token from an `Authorization` header value.
 *
 * Returns `undefined` if the header is absent or not in `Bearer <token>` format.
 *
 * @param headerValue - The raw `Authorization` header string.
 */
function extractBearerToken(headerValue: string | string[] | undefined): string | undefined {
	const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
	if (typeof raw !== "string") {
		return undefined;
	}
	const prefix = "Bearer ";
	if (!raw.startsWith(prefix)) {
		return undefined;
	}
	const token = raw.slice(prefix.length).trim();
	return token.length > 0 ? token : undefined;
}

// ---------------------------------------------------------------------------
// validateAuth
// ---------------------------------------------------------------------------

/**
 * Validates the authentication credentials on an incoming HTTP request.
 *
 * Decision logic:
 * 1. If OAuth is disabled **and** no static `authToken` is configured →
 *    allow all requests (`{ valid: true }`).
 * 2. Extract the Bearer token from the `Authorization` header.
 * 3. If OAuth is enabled, check the token against the OAuth token store via
 *    {@link validateOAuthToken}.  A valid OAuth token short-circuits to
 *    `{ valid: true }`.
 * 4. If a static `authToken` is configured, compare the token with a constant-
 *    time–equivalent string comparison.  A matching static token returns
 *    `{ valid: true }`.
 * 5. Otherwise return `{ valid: false, error: "Invalid or expired token" }`.
 *
 * @param req    - The incoming Node.js HTTP request.
 * @param config - The full server configuration.
 */
export async function validateAuth(req: IncomingMessage, config: MCPConfig): Promise<AuthResult> {
	const oauthEnabled = config.oauth.enabled;
	const staticToken = config.authToken;

	// 1. No auth configured — open access
	if (!oauthEnabled && !staticToken) {
		return { valid: true };
	}

	// 2. Extract Bearer token from Authorization header
	const token = extractBearerToken(req.headers.authorization);

	if (token === undefined) {
		return { valid: false, error: "Missing Authorization: Bearer <token> header" };
	}

	// 3. OAuth token check
	if (oauthEnabled && (await validateOAuthToken(token))) {
		return { valid: true };
	}

	// 4. Static shared-secret fallback
	if (staticToken !== undefined && safeEqual(token, staticToken)) {
		return { valid: true };
	}

	// 5. Nothing matched
	return { valid: false, error: "Invalid or expired token" };
}
