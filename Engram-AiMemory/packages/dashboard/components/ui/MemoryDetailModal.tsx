"use client";

import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Copy, ExternalLink, Layers, Tag, TrendingUp, X } from "lucide-react";

interface Memory {
  memory_id: string;
  content: string;
  tier: number;
  memory_type: string;
  importance: number;
  tags: string[];
  project_id?: string;
  created_at?: string;
}

interface MemoryDetailModalProps {
  memory: Memory | null;
  onClose: () => void;
}

const TIER_META: Record<number, { label: string; bg: string; text: string; dot: string }> = {
  1: {
    label: "Tier 1 — Project",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  2: {
    label: "Tier 2 — General",
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    dot: "bg-violet-400",
  },
  3: { label: "Tier 3 — Global", bg: "bg-teal-500/15", text: "text-teal-400", dot: "bg-teal-400" },
};

export function MemoryDetailModal({ memory, onClose }: MemoryDetailModalProps) {
  if (!memory) return null;

  const tierMeta = TIER_META[memory.tier] ?? TIER_META[1];

  const handleCopy = () => {
    navigator.clipboard.writeText(memory.content);
  };

  return (
    <AnimatePresence>
      {memory && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                       md:w-full md:max-w-2xl md:max-h-[80vh] bg-[#120f2b] border border-white/[0.08] rounded-2xl 
                       shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    tierMeta.bg,
                    tierMeta.text
                  )}
                >
                  <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", tierMeta.dot)} />
                  {tierMeta.label}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] text-slate-400 capitalize">
                  {memory.memory_type}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Memory Content */}
              <div>
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Content</h3>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {memory.content}
                  </p>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Importance */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs">Importance</span>
                  </div>
                  <p className="text-lg font-semibold text-amber-400">
                    {(memory.importance * 100).toFixed(0)}%
                  </p>
                </div>

                {/* Tier */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Layers className="w-3 h-3" />
                    <span className="text-xs">Tier</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-200">{memory.tier}</p>
                </div>

                {/* Created */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">Created</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    {memory.created_at
                      ? formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })
                      : "—"}
                  </p>
                </div>

                {/* ID */}
                <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Tag className="w-3 h-3" />
                    <span className="text-xs">ID</span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 truncate" title={memory.memory_id}>
                    {memory.memory_id.slice(0, 8)}...
                  </p>
                </div>
              </div>

              {/* Tags */}
              {memory.tags && memory.tags.length > 0 && (
                <div>
                  <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {memory.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-lg text-xs bg-white/[0.04] text-slate-400 border border-white/[0.06]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Project ID */}
              {memory.project_id && (
                <div>
                  <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Project</h3>
                  <p className="text-sm font-mono text-slate-400">{memory.project_id}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] bg-white/[0.02]">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 
                           hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 
                           hover:bg-amber-400 text-[#03020A] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
