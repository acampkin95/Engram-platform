"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, ExternalLink, Info, Terminal, X, Zap } from "lucide-react";
import { useState } from "react";

interface MCPConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl?: string;
}

export function MCPConnectionModal({
  isOpen,
  onClose,
  serverUrl = "https://memory.velocitydigi.com",
}: MCPConnectionModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const mcpEndpoint = `${serverUrl}/mcp`;
  const installCommands = {
    cli: `npx @modelcontextprotocol/server-memory --url ${serverUrl}`,
    curl: `curl -X POST ${mcpEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`,
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(text, id)}
      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
      title="Copy to clipboard"
    >
      {copied === id ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <Copy className="w-4 h-4 text-slate-400" />
      )}
    </button>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d1117] border border-white/[0.08] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    MCP Connection
                  </h2>
                  <p className="text-xs text-[#5C5878]">Connect AI clients to ENGRAM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Connection Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-slate-200">HTTP Endpoint</h3>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm font-mono text-amber-300 overflow-x-auto">
                    {mcpEndpoint}
                  </code>
                  <CopyButton text={mcpEndpoint} id="endpoint" />
                </div>
              </div>

              {/* Installation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Installation</h3>
                </div>

                <div className="space-y-3">
                  {/* CLI */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">
                      NPX (Recommended)
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm font-mono text-slate-300 overflow-x-auto">
                        {installCommands.cli}
                      </code>
                      <CopyButton text={installCommands.cli} id="npx" />
                    </div>
                  </div>

                  {/* cURL */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">cURL</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {installCommands.curl}
                      </code>
                      <CopyButton text={installCommands.curl} id="curl" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Start */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Quick Start</h3>
                </div>
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                  <ol className="space-y-2 text-sm text-slate-400">
                    <li className="flex gap-2">
                      <span className="text-amber-400 font-mono">1.</span>
                      Copy the NPX command above
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-400 font-mono">2.</span>
                      Add to your MCP client configuration
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-400 font-mono">3.</span>
                      The server will auto-connect via Streamable HTTP
                    </li>
                  </ol>
                </div>
              </div>

              {/* Available Tools */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Available Tools</h3>
                  <a
                    href="https://modelcontextprotocol.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                  >
                    Learn more <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    "add_memory",
                    "search_memory",
                    "get_memory",
                    "delete_memory",
                    "list_memories",
                    "add_entity",
                    "add_relation",
                    "query_graph",
                    "consolidate_memories",
                    "build_context",
                    "rag_query",
                    "cleanup_expired",
                  ].map((tool) => (
                    <div
                      key={tool}
                      className="px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-slate-400 font-mono"
                    >
                      {tool}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-400 text-[#03020A] transition-colors font-semibold"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
