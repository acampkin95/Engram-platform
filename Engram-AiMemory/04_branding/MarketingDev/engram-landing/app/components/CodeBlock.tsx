"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
}

export default function CodeBlock({ code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy code");
    }
  };

  return (
    <div className="relative group rounded-lg overflow-hidden bg-[var(--layer-2)] border border-[var(--border)] my-4">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--layer-1)] border-b border-[var(--border)]">
        <code className="text-xs text-[var(--text-muted)] font-mono">
          code
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--engram-amber)] transition-all text-sm"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={16} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto p-4 font-mono text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
        <code>{code}</code>
      </pre>

      {/* Left border accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--engram-amber)] opacity-50"></div>
    </div>
  );
}
