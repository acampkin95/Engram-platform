/**
 * PKCE (Proof Key for Code Exchange) utilities per RFC 7636.
 *
 * Used by OAuth 2.1 authorization flows to prevent authorization code interception.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generates a PKCE code verifier per RFC 7636 §4.1.
 *
 * Returns a 43-character URL-safe base64 random string derived from 32
 * cryptographically secure random bytes. The output satisfies the RFC 7636
 * requirement of 43–128 unreserved ASCII characters.
 */
export function generateCodeVerifier(): string {
	return randomBytes(32).toString("base64url");
}

/**
 * Generates a PKCE code challenge from a verifier using the S256 method.
 *
 * Returns `BASE64URL(SHA-256(ASCII(code_verifier)))` per RFC 7636 §4.2.
 *
 * @param verifier - The code verifier produced by {@link generateCodeVerifier}.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
	const hash = createHash("sha256").update(verifier, "ascii").digest();
	return hash.toString("base64url");
}

/**
 * Verifies that a code verifier corresponds to a stored code challenge.
 *
 * Only `S256` is supported; `plain` always returns `false` per OAuth 2.1
 * security requirements.
 *
 * @param verifier - The code verifier sent by the client.
 * @param challenge - The code challenge stored at authorization time.
 * @param method    - The `code_challenge_method` (`"S256"` or `"plain"`).
 * @returns `true` if the verifier produces the given challenge, `false` otherwise.
 */
export async function verifyCodeChallenge(
	verifier: string,
	challenge: string,
	method: string,
): Promise<boolean> {
	if (method !== "S256") {
		return false;
	}
	const expected = await generateCodeChallenge(verifier);
	const exp = Buffer.from(expected, "utf8");
	const chal = Buffer.from(challenge, "utf8");
	if (exp.length !== chal.length) return false;
	return timingSafeEqual(exp, chal);
}
