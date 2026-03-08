import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	generateCodeChallenge,
	generateCodeVerifier,
	verifyCodeChallenge,
} from "../src/auth/pkce.ts";

describe("generateCodeVerifier", () => {
	it("returns a string of length 43", () => {
		const verifier = generateCodeVerifier();
		assert.equal(verifier.length, 43);
	});

	it("only contains base64url chars [A-Za-z0-9_-]", () => {
		const verifier = generateCodeVerifier();
		assert.match(verifier, /^[A-Za-z0-9_-]+$/);
	});

	it("two calls produce different verifiers", () => {
		const v1 = generateCodeVerifier();
		const v2 = generateCodeVerifier();
		assert.notEqual(v1, v2);
	});
});

describe("generateCodeChallenge", () => {
	it("returns a non-empty string", async () => {
		const verifier = generateCodeVerifier();
		const challenge = await generateCodeChallenge(verifier);
		assert.ok(challenge.length > 0);
	});
});

describe("verifyCodeChallenge", () => {
	it("returns true when challenge matches verifier (S256)", async () => {
		const verifier = generateCodeVerifier();
		const challenge = await generateCodeChallenge(verifier);
		const result = await verifyCodeChallenge(verifier, challenge, "S256");
		assert.equal(result, true);
	});

	it("returns false when challenge does not match verifier", async () => {
		const verifier = generateCodeVerifier();
		const result = await verifyCodeChallenge(verifier, "wrong-challenge", "S256");
		assert.equal(result, false);
	});

	it("returns false when method is plain (plain not supported)", async () => {
		const verifier = generateCodeVerifier();
		const result = await verifyCodeChallenge(verifier, verifier, "plain");
		assert.equal(result, false);
	});
});
