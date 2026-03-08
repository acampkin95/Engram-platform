/**
 * Hook system type definitions
 */

export interface ToolCallContext {
	toolName: string;
	args: Record<string, unknown>;
	requestId: string;
	timestamp: number;
}

export interface ToolResultContext extends ToolCallContext {
	result: { content: Array<{ type: string; text: string }> };
	durationMs: number;
}

export type PreToolHook = (ctx: ToolCallContext) => Promise<void>;
export type PostToolHook = (ctx: ToolResultContext) => Promise<void>;
export type SessionHook = (sessionId: string) => Promise<void>;

export interface HookRegistration {
	name: string;
	priority: number;
	enabled: boolean;
}

export interface PreToolHookRegistration extends HookRegistration {
	handler: PreToolHook;
}

export interface PostToolHookRegistration extends HookRegistration {
	handler: PostToolHook;
}
