'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@/src/lib/memory-client';
import { memoryClient } from '@/src/lib/memory-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contextUsed?: string[]; // memory IDs used for context
  timestamp: string;
  isStreaming?: boolean;
}

export interface UseRAGChatOptions {
  lmStudioUrl?: string; // default: 'http://localhost:1234/v1'
  model?: string; // default: 'local-model'
  contextMemoryCount?: number; // how many memories to inject, default: 5
  /** Memory API WebSocket URL. Defaults to NEXT_PUBLIC_MEMORY_API_URL/ws/events (http→ws). */
  memoryWsUrl?: string;
  /** Auth token passed as ?token= query param on the Memory API WebSocket. */
  authToken?: string;
}

export interface UseRAGChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  lmStudioConnected: boolean;
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(memories: SearchResult[]): string {
  if (memories.length === 0) {
    return 'You are a helpful AI assistant. Answer based on your knowledge.';
  }
  const contextStr = memories.map((m, i) => `[Memory ${i + 1}]: ${m.content}`).join('\n\n');
  return `You are a helpful AI assistant with access to the user's memory context.

RELEVANT MEMORIES:
${contextStr}

Use these memories to provide accurate, contextual responses. If the memories are not relevant to the question, answer based on your general knowledge.`;
}

// ─── Conversation history type ────────────────────────────────────────────────

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRAGChat({
  lmStudioUrl = 'http://localhost:1234/v1',
  model = 'local-model',
  contextMemoryCount = 5,
  memoryWsUrl,
  authToken,
}: UseRAGChatOptions = {}): UseRAGChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lmStudioConnected, setLmStudioConnected] = useState(false);

  // Keep a stable ref to conversation history for the LM Studio request
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const tokenBufferRef = useRef('');
  const rafIdRef = useRef(0);

  // ─── Connectivity check ────────────────────────────────────────────────────

  const checkLmStudioConnectivity = useCallback(async () => {
    try {
      const response = await fetch(`${lmStudioUrl}/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      setLmStudioConnected(response.ok);
    } catch {
      setLmStudioConnected(false);
    }
  }, [lmStudioUrl]);

  useEffect(() => {
    void checkLmStudioConnectivity();
    // Poll every 10 seconds
    const interval = setInterval(() => {
      void checkLmStudioConnectivity();
    }, 10_000);
    return () => clearInterval(interval);
  }, [checkLmStudioConnectivity]);

  // ─── Memory API WebSocket connection (deferred) ─────────────────────────
  // When implemented, connect to /ws/events via useWebSocket hook for live
  // memory events (memory_stored, entity_created, etc.). Options memoryWsUrl
  // and authToken are already plumbed for this purpose.
  // TODO: Replace with useWebSocket({ url, onMessage }) when backend handler is ready.

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      // Step 1: Search memories for context
      let contextMemories: SearchResult[] = [];
      let contextMemoryIds: string[] = [];

      try {
        const { data: searchData } = await memoryClient.searchMemories(content, {
          limit: contextMemoryCount,
        });
        if (searchData?.results) {
          contextMemories = searchData.results;
          contextMemoryIds = contextMemories.map((m) => m.memory_id ?? m.id).filter(Boolean);
        }
      } catch {
        // Memory search failed — degrade gracefully, continue without context
      }

      // Step 2: Build system prompt with injected context
      const systemPrompt = buildSystemPrompt(contextMemories);

      // Step 3: Build conversation history (exclude system messages from history)
      const conversationHistory: ConversationMessage[] = conversationHistoryRef.current.slice();

      // Step 4: Call LM Studio with streaming
      let assistantContent = '';
      const streamingMessageId = crypto.randomUUID();

      // Add a placeholder streaming message immediately
      const streamingMessage: Message = {
        id: streamingMessageId,
        role: 'assistant',
        content: '',
        contextUsed: contextMemoryIds,
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, streamingMessage]);

      try {
        const response = await fetch(`${lmStudioUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationHistory,
              { role: 'user', content },
            ],
            stream: true,
            temperature: 0.7,
          }),
        });

        if (!response.ok || !response.body) {
          const errText = await response.text();
          throw new Error(`LM Studio error ${response.status}: ${errText}`);
        }

        // Process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data) as {
                choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantContent += delta;
                tokenBufferRef.current = assistantContent;
                // Batch state updates at display refresh rate (~60fps)
                if (!rafIdRef.current) {
                  rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = 0;
                    const buffered = tokenBufferRef.current;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === streamingMessageId ? { ...msg, content: buffered } : msg,
                      ),
                    );
                  });
                }
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Cancel any pending batched update and flush final content
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessageId
              ? { ...msg, content: assistantContent, isStreaming: false }
              : msg,
          ),
        );
        setLmStudioConnected(true);
      } catch (err) {
        // Cancel any pending batched update
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        // Remove the streaming placeholder on error
        setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessageId));

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLmStudioConnected(false);
        setIsLoading(false);

        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Failed to get response: ${message}`,
          contextUsed: contextMemoryIds,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      // Step 5: Update conversation history ref for next turn
      conversationHistoryRef.current = [
        ...conversationHistory,
        { role: 'user', content },
        { role: 'assistant', content: assistantContent },
      ];

      setIsLoading(false);
    },
    [lmStudioUrl, model, contextMemoryCount],
  );

  // ─── Clear messages ────────────────────────────────────────────────────────

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    conversationHistoryRef.current = [];
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    lmStudioConnected,
  };
}
