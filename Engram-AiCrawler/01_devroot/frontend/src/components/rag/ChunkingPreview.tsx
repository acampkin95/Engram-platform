import { useMemo } from'react';
import { Layers, Hash, BarChart3, Sigma } from'lucide-react';

export interface ChunkPreview {
 chunk_number: number;
 content: string;
 token_count: number;
 start_offset: number;
 end_offset: number;
}

interface ChunkingPreviewProps {
 chunks: ChunkPreview[];
}

const TOKEN_THRESHOLDS = { small: 512, medium: 2048 } as const;

function getChunkColor(tokenCount: number) {
 if (tokenCount < TOKEN_THRESHOLDS.small) {
 return {
 badge:'bg-plasma/20 text-plasma',
 border:'border-plasma/30',
 bar:'bg-plasma',
 };
 }
 if (tokenCount <= TOKEN_THRESHOLDS.medium) {
 return {
 badge:'bg-cyan/20 text-cyan',
 border:'border-cyan/30',
 bar:'bg-cyan',
 };
 }
 return {
 badge:'bg-volt/20 text-volt',
 border:'border-volt/30',
 bar:'bg-volt',
 };
}

function detectOverlap(current: ChunkPreview, next: ChunkPreview): string | null {
 if (current.end_offset <= next.start_offset) return null;
 const overlapStart = next.start_offset;
 const overlapEnd = Math.min(current.end_offset, next.end_offset);
 const relativeStart = overlapStart - current.start_offset;
 const relativeEnd = overlapEnd - current.start_offset;
 if (relativeStart >= 0 && relativeEnd > relativeStart && relativeEnd <= current.content.length) {
 return current.content.slice(relativeStart, relativeEnd);
 }
 return null;
}

function ChunkContent({
 content,
 overlapText,
}: {
 content: string;
 overlapText: string | null;
}) {
 const maxLen = 300;
 const truncated = content.length > maxLen;
 const displayContent = truncated ? content.slice(0, maxLen) : content;

 if (!overlapText || !displayContent.includes(overlapText)) {
 return (
 <p className="text-sm text-text whitespace-pre-wrap break-words leading-relaxed">
 {displayContent}
 {truncated && <span className="text-text-mute">...</span>}
 </p>
 );
 }

 const idx = displayContent.indexOf(overlapText);
 const before = displayContent.slice(0, idx);
 const overlap = displayContent.slice(idx, idx + overlapText.length);
 const after = displayContent.slice(idx + overlapText.length);

 return (
 <p className="text-sm text-text whitespace-pre-wrap break-words leading-relaxed">
 {before}
 <mark className="bg-volt/20 text-void px-0.5">
 {overlap}
 </mark>
 {after}
 {truncated && <span className="text-text-mute">...</span>}
 </p>
 );
}

function SummaryBar({
 totalChunks,
 avgTokens,
 totalTokens,
}: {
 totalChunks: number;
 avgTokens: number;
 totalTokens: number;
}) {
 return (
 <div className="flex items-center gap-4 border border-border bg-void px-4 py-3">
 <div className="flex items-center gap-1.5 text-sm text-text-dim">
 <Layers size={14} className="shrink-0" />
 <span className="font-medium text-text">{totalChunks}</span>
 <span>chunks</span>
 </div>
 <div className="h-4 w-px bg-surface" />
 <div className="flex items-center gap-1.5 text-sm text-text-dim">
 <BarChart3 size={14} className="shrink-0" />
 <span className="font-medium text-text">{avgTokens}</span>
 <span>avg tokens</span>
 </div>
 <div className="h-4 w-px bg-surface" />
 <div className="flex items-center gap-1.5 text-sm text-text-dim">
 <Sigma size={14} className="shrink-0" />
 <span className="font-medium text-text">{totalTokens.toLocaleString()}</span>
 <span>total</span>
 </div>
 </div>
 );
}

export default function ChunkingPreview({ chunks }: ChunkingPreviewProps) {
 const stats = useMemo(() => {
 if (chunks.length === 0) return { totalChunks: 0, avgTokens: 0, totalTokens: 0 };
 const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0);
 return {
 totalChunks: chunks.length,
 avgTokens: Math.round(totalTokens / chunks.length),
 totalTokens,
 };
 }, [chunks]);

 const overlaps = useMemo(() => {
 const map = new Map<number, string | null>();
 for (let i = 0; i < chunks.length; i++) {
 const next = chunks[i + 1];
 map.set(chunks[i].chunk_number, next ? detectOverlap(chunks[i], next) : null);
 }
 return map;
 }, [chunks]);

 if (chunks.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
 <div className="mb-4 text-text-mute" aria-hidden="true">
 <Layers size={40} />
 </div>
 <h3 className="text-base font-semibold text-text">No chunks yet</h3>
 <p className="mt-1.5 text-sm text-text-dim max-w-sm">
 Run the chunking preview to see how your content will be split into chunks.
 </p>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-4">
 <SummaryBar
 totalChunks={stats.totalChunks}
 avgTokens={stats.avgTokens}
 totalTokens={stats.totalTokens}
 />

 <div className="overflow-y-auto max-h-[600px] space-y-3 pr-1">
 {chunks.map((chunk) => {
 const color = getChunkColor(chunk.token_count);
 return (
 <div
 key={chunk.chunk_number}
 className={`border ${color.border} bg-surface p-4`}
 >
 <div className="flex items-center justify-between mb-3">
 <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color.badge}`}>
 <Hash size={11} />
 {chunk.chunk_number}
 </span>
 <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${color.badge}`}>
 {chunk.token_count.toLocaleString()} tokens
 </span>
 </div>
 <ChunkContent
 content={chunk.content}
 overlapText={overlaps.get(chunk.chunk_number) ?? null}
 />
 <div className="mt-3 flex items-center gap-2 text-xs text-text-mute tabular-nums">
 <span>offset {chunk.start_offset}–{chunk.end_offset}</span>
 <div className="flex-1 h-1.5 rounded-full bg-abyss overflow-hidden">
 <div
 className={`h-full rounded-full ${color.bar} transition-all`}
 style={{ width: `${Math.min((chunk.token_count / TOKEN_THRESHOLDS.medium) * 100, 100)}%`}}
 />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}
