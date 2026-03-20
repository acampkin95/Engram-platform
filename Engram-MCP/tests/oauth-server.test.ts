import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { validateOAuthToken } from "../dist/auth/oauth-server.js";

// Mock request/response helpers
function createMockRequest(options: {
	method?: string;
	url?: string;
	headers?: Record<string, string>;
	body?: string;
}): { req: Partial<IncomingMessage>; body?: string } {
	return {
		req: {
			method: options.method ?? "GET",
			url: options.url ?? "/",
			headers: {
				"content-type": "application/json",
				...options.headers,
			},
		},
		body: options.body,
	};
}

function createMockResponse(): {
	res: Partial<ServerResponse>;
	headers: Record<string, string>;
	body: string;
	statusCode: number;
} {
	const headers: Record<string, string> = {};
	let body = "";
	let statusCode = 200;

	return {
		res: {
			setHeader: mock.fn((name: string, value: string) => {
				headers[name] = value;
			}),
			writeHead: mock.fn((code: number) => {
				statusCode = code;
			}),
			end: mock.fn((data?: string) => {
				if (data) body = data;
			}),
		},
		headers,
		body,
		statusCode,
	};
}

describe("OAuth Server", () => {
	describe("validateOAuthToken", () => {
		it("returns false for invalid token", async () => {
			const result = await validateOAuthToken("invalid-token");
			assert.equal(result, false);
		});

		it("returns false for empty token", async () => {
			const result = await validateOAuthToken("");
			assert.equal(result, false);
		});
	});
});
