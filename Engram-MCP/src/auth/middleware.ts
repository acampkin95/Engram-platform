/**
 * Authentication middleware for the Engram MCP HTTP transport.
 *
 * Validates API keys against the shared Redis key store.
 * Keys are managed via the Platform dashboard and shared with the Memory API.
 */

import type { IncomingMessage } from "node:http";
import { ApiKeyValidator, type KeyInfo } from "./redis-key-validator.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by {@link validateAuth}. */
export interface AuthResult {
	/** Whether the request carries valid credentials. */
	valid: boolean;
	/** Key metadata when valid. */
	keyId?: string;
	keyName?: string;
	/** Human-readable reason for rejection. */
	error?: string;
}

// ---------------------------------------------------------------------------
// Singleton validator
// ---------------------------------------------------------------------------

let _validator: ApiKeyValidator | null = null;

/** Initialize the key validator. Call once at startup. */
export function initKeyValidator(platformUrl: string): ApiKeyValidator {
	_validator = new ApiKeyValidator(platformUrl);
	return _validator;
}

/** Get the current validator instance. */
export function getKeyValidator(): ApiKeyValidator | null {
	return _validator;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the Bearer token from an `Authorization` header value.
 */
function extractBearerToken(
	headerValue: string | string[] | undefined,
): string | undefined {
	const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
	if (typeof raw !== "string") return undefined;
	const prefix = "Bearer ";
	if (!raw.startsWith(prefix)) return undefined;
	const token = raw.slice(prefix.length).trim();
	return token.length > 0 ? token : undefined;
}

/**
 * Extracts the API key from an `X-API-Key` header.
 */
function extractApiKey(
	headerValue: string | string[] | undefined,
): string | undefined {
	const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
	if (typeof raw !== "string" || raw.length === 0) return undefined;
	return raw;
}

// ---------------------------------------------------------------------------
// validateAuth
// ---------------------------------------------------------------------------

/**
 * Validates authentication on an incoming HTTP request.
 *
 * Accepts either:
 *   - `Authorization: Bearer <api-key>`
 *   - `X-API-Key: <api-key>`
 *
 * Validates the key against the shared Redis key store.
 * If no validator is available (Redis down), rejects all requests.
 */
export async function validateAuth(req: IncomingMessage): Promise<AuthResult> {
	// Extract key from either header
	const key =
		extractBearerToken(req.headers.authorization) ??
		extractApiKey(req.headers["x-api-key"]);

	if (!key) {
		return {
			valid: false,
			error:
				"Missing authentication: provide Authorization: Bearer <api-key> or X-API-Key header",
		};
	}

	if (!_validator) {
		return {
			valid: false,
			error: "Key validator not initialized",
		};
	}

	const info: KeyInfo | null = await _validator.validateKey(key);
	if (!info) {
		return {
			valid: false,
			error: "Invalid or revoked API key",
		};
	}

	return {
		valid: true,
		keyId: info.id,
		keyName: info.name,
	};
}
