import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HookManager } from "../dist/hooks/hook-manager.js";
import type {
	ToolCallContext,
	ToolResultContext,
} from "../dist/hooks/types.js";

describe("HookManager", () => {
	describe("registerPreToolHook / onPreToolUse", () => {
		it("calls registered pre-tool hook with correct context", async () => {
			const manager = new HookManager();
			const received: ToolCallContext[] = [];

			manager.registerPreToolHook({
				name: "test-pre",
				priority: 0,
				enabled: true,
				handler: async (ctx) => {
					received.push(ctx);
				},
			});

			await manager.onPreToolUse("search_memory", { query: "test" }, "req-1");

			assert.equal(received.length, 1);
			assert.equal(received[0]?.toolName, "search_memory");
			assert.deepEqual(received[0]?.args, { query: "test" });
			assert.equal(received[0]?.requestId, "req-1");
		});
	});

	describe("registerPostToolHook / onPostToolUse", () => {
		it("calls registered post-tool hook with correct context", async () => {
			const manager = new HookManager();
			const received: ToolResultContext[] = [];

			manager.registerPostToolHook({
				name: "test-post",
				priority: 0,
				enabled: true,
				handler: async (ctx) => {
					received.push(ctx);
				},
			});

			const result = { content: [{ type: "text", text: "done" }] };
			await manager.onPostToolUse(
				"add_memory",
				{ content: "hello" },
				result,
				"req-2",
			);

			assert.equal(received.length, 1);
			assert.equal(received[0]?.toolName, "add_memory");
			assert.deepEqual(received[0]?.result, result);
			assert.equal(received[0]?.requestId, "req-2");
		});
	});

	describe("disabled hooks", () => {
		it("does NOT call a hook with enabled: false", async () => {
			const manager = new HookManager();
			let callCount = 0;

			manager.registerPreToolHook({
				name: "disabled-hook",
				priority: 0,
				enabled: false,
				handler: async () => {
					callCount++;
				},
			});

			await manager.onPreToolUse("search_memory", {}, "req-3");
			assert.equal(callCount, 0);
		});
	});

	describe("hook failure isolation", () => {
		it("a failing hook does NOT prevent other hooks from running", async () => {
			const manager = new HookManager();
			const results: string[] = [];

			manager.registerPreToolHook({
				name: "failing-hook",
				priority: 0,
				enabled: true,
				handler: async () => {
					throw new Error("Hook intentionally failed");
				},
			});

			manager.registerPreToolHook({
				name: "succeeding-hook",
				priority: 1,
				enabled: true,
				handler: async () => {
					results.push("success");
				},
			});

			await manager.onPreToolUse("search_memory", {}, "req-4");
			assert.deepEqual(results, ["success"]);
		});
	});

	describe("listHooks", () => {
		it("returns correct pre and post hook lists", () => {
			const manager = new HookManager();

			manager.registerPreToolHook({
				name: "pre-hook-1",
				priority: 0,
				enabled: true,
				handler: async () => {},
			});

			manager.registerPostToolHook({
				name: "post-hook-1",
				priority: 0,
				enabled: false,
				handler: async () => {},
			});

			const { pre, post } = manager.listHooks();
			assert.equal(pre.length, 1);
			assert.equal(pre[0]?.name, "pre-hook-1");
			assert.equal(pre[0]?.enabled, true);
			assert.equal(post.length, 1);
			assert.equal(post[0]?.name, "post-hook-1");
			assert.equal(post[0]?.enabled, false);
		});
	});

	describe("priority ordering", () => {
		it("lower priority number runs first", async () => {
			const manager = new HookManager();
			const order: string[] = [];

			// Register higher number first
			manager.registerPreToolHook({
				name: "priority-10",
				priority: 10,
				enabled: true,
				handler: async () => {
					order.push("priority-10");
				},
			});

			manager.registerPreToolHook({
				name: "priority-1",
				priority: 1,
				enabled: true,
				handler: async () => {
					order.push("priority-1");
				},
			});

			await manager.onPreToolUse("search_memory", {}, "req-5");
			assert.deepEqual(order, ["priority-1", "priority-10"]);
		});
	});
});
