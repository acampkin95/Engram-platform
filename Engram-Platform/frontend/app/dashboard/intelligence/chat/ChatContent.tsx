'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, m } from 'framer-motion';
import { ChevronDown, ChevronUp, MessageSquare, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';
import { Input } from '@/src/design-system/components/Input';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import type { Message } from '@/src/hooks/useRAGChat';
import { useRAGChat } from '@/src/hooks/useRAGChat';

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-teal/12 border border-teal/20">
        <MessageSquare className="w-3.5 h-3.5 text-[#2EC4C4]" />
      </div>
      <div className="px-4 py-3 rounded-xl max-w-[80%] bg-panel border border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <m.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#2EC4C4]"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Context badge ────────────────────────────────────────────────────────────

function ContextBadge({ memoryIds }: { memoryIds: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (memoryIds.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-mono text-[#2EC4C4] hover:text-[#2EC4C4]/80 transition-colors bg-teal/[0.08] border border-teal/20 rounded-md px-2 py-0.5"
      >
        <span>
          Context: {memoryIds.length} {memoryIds.length === 1 ? 'memory' : 'memories'} used
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-lg space-y-1 bg-teal/[0.04] border border-teal/[0.12]">
              {memoryIds.map((id, i) => (
                <p key={id} className="text-[10px] font-mono text-[#5c5878] truncate">
                  {i + 1}. {id}
                </p>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  animate: shouldAnimate = false,
}: {
  message: Message;
  animate?: boolean;
}) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <p className="text-[11px] font-mono text-[#5c5878] px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
          {message.content}
        </p>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <m.div
        initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%]">
          <div className="px-4 py-3 rounded-xl text-sm text-[#f0eef8] leading-relaxed bg-amber/12 border border-amber/20">
            {message.content}
          </div>
          <p className="text-[10px] font-mono text-[#5c5878] mt-1 text-right">
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-teal/12 border border-teal/20">
        <MessageSquare className="w-3.5 h-3.5 text-[#2EC4C4]" />
      </div>
      <div className="max-w-[80%]">
        <div className="px-4 py-3 rounded-xl text-sm text-[#f0eef8] leading-relaxed whitespace-pre-wrap bg-panel border border-white/[0.06]">
          {message.content}
        </div>
        {message.contextUsed && <ContextBadge memoryIds={message.contextUsed} />}
        <p className="text-[10px] font-mono text-[#5c5878] mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </m.div>
  );
}

// ─── Config panel ─────────────────────────────────────────────────────────────

interface ChatConfig {
  lmStudioUrl: string;
  model: string;
  contextMemoryCount: number;
}

function ConfigPanel({
  config,
  onConfigChange,
  lmStudioConnected,
}: {
  config: ChatConfig;
  onConfigChange: (c: ChatConfig) => void;
  lmStudioConnected: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-[#a09bb8] hover:text-[#f0eef8] transition-colors px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]"
      >
        <Settings className="w-3.5 h-3.5" />
        <span className="font-mono">Config</span>
        <StatusDot variant={lmStudioConnected ? 'online' : 'offline'} />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl overflow-hidden bg-panel border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#f0eef8]">LM Studio Config</span>
              <div className="flex items-center gap-2">
                <StatusDot
                  variant={lmStudioConnected ? 'online' : 'offline'}
                  label={lmStudioConnected ? 'Connected' : 'Disconnected'}
                />
              </div>
            </div>

            <div className="p-4 space-y-4">
              <Input
                label="LM Studio URL"
                value={config.lmStudioUrl}
                onChange={(e) => onConfigChange({ ...config, lmStudioUrl: e.target.value })}
                tooltip="The local URL where LM Studio is running"
                helpText="Usually http://localhost:1234/v1"
                mono
              />
              <Input
                label="Model Name"
                value={config.model}
                onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
                tooltip="The identifier of the model loaded in LM Studio"
                helpText="Leave empty to use any loaded model"
                mono
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="context-memory-count"
                  className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono"
                >
                  Context Memories: {config.contextMemoryCount}
                </label>
                <input
                  id="context-memory-count"
                  type="range"
                  min={1}
                  max={10}
                  value={config.contextMemoryCount}
                  onChange={(e) =>
                    onConfigChange({ ...config, contextMemoryCount: Number(e.target.value) })
                  }
                  title="Number of context memories"
                  className="w-full accent-[#F2A93B]"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#5c5878]">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ChatConfig = {
  lmStudioUrl: 'http://localhost:1234/v1',
  model: 'local-model',
  contextMemoryCount: 5,
};

export default function ChatContent() {
  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CONFIG);
  const [input, setInput] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, error, sendMessage, clearMessages, lmStudioConnected } = useRAGChat({
    lmStudioUrl: config.lmStudioUrl,
    model: config.model,
    contextMemoryCount: config.contextMemoryCount,
  });

  const messageCount = messages.length;

  const virtualizer = useVirtualizer({
    count: messageCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 80,
    overscan: 5,
    gap: 16,
  });

  useEffect(() => {
    if (messageCount > 0) {
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollContainerRef.current?.scrollHeight ?? 0,
          behavior: 'smooth',
        });
      });
    }
  }, [messageCount]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await sendMessage(trimmed);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      className="flex flex-col h-full animate-page-enter"
      style={{ height: 'calc(100vh - 56px - 48px)' }}
    >
      <SectionHeader
        title="RAG Chat"
        breadcrumb={['INTELLIGENCE', 'RAG CHAT']}
        action={
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
            <ConfigPanel
              config={config}
              onConfigChange={setConfig}
              lmStudioConnected={lmStudioConnected}
            />
          </div>
        }
      />

      <Card className="flex flex-col flex-1 overflow-hidden p-0 mb-0" variant="default">
        {!lmStudioConnected && (
          <div className="mx-5 mt-5 px-4 py-3 rounded-lg flex items-start gap-3 bg-amber/[0.08] border border-amber/20">
            <div className="flex-shrink-0 mt-0.5">
              <StatusDot variant="offline" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#F2A93B]">LM Studio not connected</p>
              <p className="text-xs text-[#a09bb8] mt-0.5">
                Start LM Studio, load a model, and ensure the server is running at{' '}
                <span className="font-mono text-[#F2A93B]">{config.lmStudioUrl}</span>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 mt-3 px-4 py-3 rounded-lg bg-destructive/[0.08] border border-destructive/20">
            <p className="text-xs font-mono text-[#FF6B6B]">{error}</p>
          </div>
        )}

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-amber/[0.08] border border-amber/[0.15]">
                <MessageSquare className="w-6 h-6 text-[#F2A93B]" />
              </div>
              <p className="text-sm font-medium text-[#a09bb8] mb-1">Start a conversation</p>
              <p className="text-xs text-[#5c5878] max-w-xs">
                Ask anything — your memory context will be automatically injected into each
                response.
              </p>
            </div>
          )}

          {messages.length > 0 && (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const msg = messages[virtualRow.index];
                return (
                  <div
                    key={msg.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <MessageBubble
                      message={msg}
                      animate={virtualRow.index === messages.length - 1}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {isLoading && (
            <div className={messages.length > 0 ? 'mt-4' : ''}>
              <ThinkingIndicator />
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] p-4 flex-shrink-0">
          <div className="flex gap-3">
            <Input
              placeholder="Ask anything... Memory context will be injected automatically"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={isLoading || !input.trim()}
              loading={isLoading}
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-[#5c5878] mt-2 font-mono">
            {config.contextMemoryCount} {config.contextMemoryCount === 1 ? 'memory' : 'memories'}{' '}
            will be searched for context
          </p>
        </div>
      </Card>
    </div>
  );
}
