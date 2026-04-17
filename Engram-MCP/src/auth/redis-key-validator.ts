/**
 * API key validator for the Engram MCP Server.
 *
 * Validates API keys by calling the Platform's BetterAuth api-key/verify endpoint.
 * Platform is the single source of truth for all API keys.
 */

import { logger } from "../logger.js";

/** Validated key metadata. */
export interface KeyInfo {
	id: string;
	name: string;
}

/** In-memory cache entry with TTL. */
interface CacheEntry {
	info: KeyInfo;
	expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const STALE_GRACE_MS = 5 * 60_000; // 5 minutes: accept stale cache if Platform is down

export class ApiKeyValidator {
	private readonly platformUrl: string;
	private readonly cache = new Map<string, CacheEntry>();

	constructor(platformUrl: string) {
		this.platformUrl = platformUrl;
	}

	/**
	 * Validate an API key against BetterAuth's api-key/verify endpoint.
	 * Returns key metadata if valid, null otherwise.
	 */
	async validateKey(rawKey: string): Promise<KeyInfo | null> {
		// Check in-memory cache first (keyed by first 16 chars to avoid storing full keys)
		const cacheKey = rawKey.slice(0, 16);
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.info;
		}
		this.cache.delete(cacheKey);

		let res: Response;
		try {
			res = await fetch(`${this.platformUrl}/api/auth/api-key/verify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: rawKey }),
				signal: AbortSignal.timeout(5000),
			});
		} catch (err) {
			// Network error — Platform unreachable. Use stale cache if within grace period.
			const message = err instanceof Error ? err.message : String(err);
			logger.warn("API key validation fetch failed, checking stale cache", {
				error: { message },
			});
			const stale = this.cache.get(cacheKey);
			if (stale && Date.now() - stale.expiresAt < STALE_GRACE_MS) {
				logger.info("Allowing request via stale cache fallback");
				return stale.info;
			}
			return null;
		}

		if (!res.ok) {
			logger.debug("API key verification failed", {
				status: res.status,
			});
			return null;
		}

		const data = (await res.json()) as {
			valid?: boolean;
			key?: { id?: string; name?: string };
		};

		if (!data.valid) {
			return null;
		}

		const info: KeyInfo = {
			id: data.key?.id ?? "unknown",
			name: data.key?.name ?? "",
		};

		// Cache the result
		this.cache.set(cacheKey, {
			info,
			expiresAt: Date.now() + CACHE_TTL_MS,
		});

		return info;
	}
}
