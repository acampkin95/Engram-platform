/**
 * Shared request body reader utility
 *
 * Drains an incoming HTTP request body into a UTF-8 string,
 * rejecting payloads that exceed the configured byte limit.
 */

import type { IncomingMessage } from "node:http";

const MAX_BODY_BYTES = 64 * 1024; // 64 KB

export class RequestBodyTooLargeError extends Error {
	constructor(maxBytes: number) {
		super(`Request body exceeds ${maxBytes} bytes`);
		this.name = "RequestBodyTooLargeError";
	}
}

export class RequestBodyAbortedError extends Error {
	constructor() {
		super("Request body stream was aborted");
		this.name = "RequestBodyAbortedError";
	}
}

/**
 * Reads the full request body as a UTF-8 string.
 * Rejects with an error if the body exceeds {@link MAX_BODY_BYTES}.
 */
export async function readBody(req: IncomingMessage): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		let settled = false;

		const cleanup = (): void => {
			req.off("data", onData);
			req.off("end", onEnd);
			req.off("error", onError);
			req.off("aborted", onAborted);
		};

		const settleResolve = (value: string): void => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(value);
		};

		const settleReject = (error: Error): void => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(error);
		};

		const onData = (chunk: Buffer): void => {
			total += chunk.length;
			if (total > MAX_BODY_BYTES) {
				settleReject(new RequestBodyTooLargeError(MAX_BODY_BYTES));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		};

		const onEnd = (): void => {
			settleResolve(Buffer.concat(chunks).toString("utf-8"));
		};

		const onError = (error: Error): void => {
			settleReject(error);
		};

		const onAborted = (): void => {
			settleReject(new RequestBodyAbortedError());
		};

		req.on("data", onData);
		req.on("end", onEnd);
		req.on("error", onError);
		req.on("aborted", onAborted);
	});
}
