import assert from "node:assert";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { beforeEach, describe, it, mock } from "node:test";
import {
	RequestBodyAbortedError,
	RequestBodyTooLargeError,
	readBody,
} from "../dist/utils/read-body.js";

class MockIncomingMessage extends EventEmitter {
	headers: Record<string, string>;
	httpVersion: string;
	method?: string;
	url?: string;
	statusCode?: number;
	statusMessage?: string;

	constructor() {
		super();
		this.headers = {};
		this.httpVersion = "1.1";
	}

	destroy(): void {
		this.emit("close");
	}
}

describe("readBody", () => {
	let mockReq: MockIncomingMessage;

	beforeEach(() => {
		mockReq = new MockIncomingMessage();
	});

	describe("successful reads", () => {
		it("reads empty body", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("end");
			const result = await promise;
			assert.strictEqual(result, "");
		});

		it("reads small body in one chunk", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("data", Buffer.from("hello world"));
			mockReq.emit("end");
			const result = await promise;
			assert.strictEqual(result, "hello world");
		});

		it("reads body in multiple chunks", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("data", Buffer.from("hello"));
			mockReq.emit("data", Buffer.from(" "));
			mockReq.emit("data", Buffer.from("world"));
			mockReq.emit("end");
			const result = await promise;
			assert.strictEqual(result, "hello world");
		});

		it("reads UTF-8 content correctly", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("data", Buffer.from("héllo wörld 你好"));
			mockReq.emit("end");
			const result = await promise;
			assert.strictEqual(result, "héllo wörld 你好");
		});
	});

	describe("error handling", () => {
		it("rejects on request error", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("error", new Error("connection failed"));

			await assert.rejects(async () => await promise, Error);
		});

		it("rejects with RequestBodyAbortedError on aborted", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("aborted");

			await assert.rejects(async () => await promise, RequestBodyAbortedError);
		});

		it("rejects with RequestBodyTooLargeError when body exceeds limit", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			const maxBytes = 64 * 1024;
			mockReq.emit("data", Buffer.alloc(maxBytes + 1, "a"));

			await assert.rejects(async () => await promise, RequestBodyTooLargeError);
		});
	});

	describe("edge cases", () => {
		it("ignores subsequent events after error", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("error", new Error("first error"));

			await assert.rejects(async () => await promise, Error);

			mockReq.emit("data", Buffer.from("ignored"));
			mockReq.emit("end");
		});

		it("ignores subsequent events after abort", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("aborted");

			await assert.rejects(async () => await promise, RequestBodyAbortedError);

			mockReq.emit("data", Buffer.from("ignored"));
			mockReq.emit("end");
		});

		it("ignores subsequent events after body too large", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			const maxBytes = 64 * 1024;
			mockReq.emit("data", Buffer.alloc(maxBytes + 1, "a"));
			mockReq.emit("end");

			await assert.rejects(async () => await promise, RequestBodyTooLargeError);
		});
	});

	describe("cleanup", () => {
		it("removes all event listeners after successful read", async () => {
			const initialListenerCount = mockReq.listenerCount("data");
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("data", Buffer.from("test"));
			mockReq.emit("end");
			await promise;

			assert.strictEqual(mockReq.listenerCount("data"), initialListenerCount);
			assert.strictEqual(mockReq.listenerCount("end"), 0);
			assert.strictEqual(mockReq.listenerCount("error"), 0);
			assert.strictEqual(mockReq.listenerCount("aborted"), 0);
		});

		it("removes all event listeners after error", async () => {
			const promise = readBody(mockReq as IncomingMessage);
			mockReq.emit("error", new Error("test error"));

			await assert.rejects(async () => await promise);

			assert.strictEqual(mockReq.listenerCount("data"), 0);
			assert.strictEqual(mockReq.listenerCount("end"), 0);
			assert.strictEqual(mockReq.listenerCount("error"), 0);
			assert.strictEqual(mockReq.listenerCount("aborted"), 0);
		});
	});
});

describe("RequestBodyTooLargeError", () => {
	it("has correct name and message", () => {
		const error = new RequestBodyTooLargeError(1024);
		assert.strictEqual(error.name, "RequestBodyTooLargeError");
		assert.ok(error.message.includes("1024"));
		assert.ok(error.message.includes("exceeds"));
	});
});

describe("RequestBodyAbortedError", () => {
	it("has correct name and message", () => {
		const error = new RequestBodyAbortedError();
		assert.strictEqual(error.name, "RequestBodyAbortedError");
		assert.ok(error.message.includes("aborted"));
	});
});
