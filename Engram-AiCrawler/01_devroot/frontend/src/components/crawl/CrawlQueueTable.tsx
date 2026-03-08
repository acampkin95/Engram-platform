import { useState } from'react';
import { Check, X, Loader2, Circle, ChevronDown, ChevronRight } from'lucide-react';
import type { CrawlStatus } from'./CrawlProgressCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueItem {
 url: string;
 status: CrawlStatus;
 duration_seconds: number | null;
 error_message: string | null;
}

interface CrawlQueueTableProps {
 items: QueueItem[];
 onCancel?: (url: string) => void;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<CrawlStatus, React.ReactNode> = {
 completed: <Check className="w-4 h-4 text-plasma" />,
 running: <Loader2 className="w-4 h-4 text-cyan animate-spin" />,
 queued: <Circle className="w-4 h-4 text-text-mute" />,
 failed: <X className="w-4 h-4 text-neon-r" />,
 cancelled: <X className="w-4 h-4 text-volt" />,
};

const STATUS_LABEL: Record<CrawlStatus, string> = {
 completed:'Done',
 running:'Running',
 queued:'Queued',
 failed:'Failed',
 cancelled:'Cancelled',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrawlQueueTable({ items, onCancel }: CrawlQueueTableProps) {
 const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

 const counts = items.reduce<Record<string, number>>(
 (acc, item) => {
 acc[item.status] = (acc[item.status] ?? 0) + 1;
 return acc;
 },
 {},
 );

 const summaryParts = [
 counts['completed'] && `${counts['completed']} completed`,
 counts['running'] && `${counts['running']} running`,
 counts['failed'] && `${counts['failed']} failed`,
 counts['queued'] && `${counts['queued']} queued`,
 counts['cancelled'] && `${counts['cancelled']} cancelled`,
 ].filter(Boolean);

 const formatDuration = (seconds: number | null) => {
 if (seconds === null) return'—';
 return seconds < 60
 ? `${seconds.toFixed(1)}s`
 : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
 };

 const canCancelItem = (status: CrawlStatus) =>
 status ==='running' || status ==='queued';

 return (
 <div className="bg-surface border border-border overflow-hidden">
 <div className="px-4 py-3 border-b border-border">
 <p className="text-sm font-semibold text-text">
 Queue:{''}
 <span className="font-normal text-text-dim">
 {summaryParts.join(',') ||'empty'}
 </span>
 </p>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border text-left text-xs font-medium text-text-mute uppercase tracking-wider">
 <th className="px-4 py-2 w-8" />
 <th className="px-4 py-2">URL</th>
 <th className="px-4 py-2 w-28">Status</th>
 <th className="px-4 py-2 w-20 text-right">Time</th>
 <th className="px-4 py-2 w-16 text-center">Act</th>
 </tr>
 </thead>
 <tbody>
 {items.map((item) => {
 const isExpanded = expandedUrl === item.url;
 return (
 <TableRow
 key={item.url}
 item={item}
 isExpanded={isExpanded}
 onToggle={() =>
 setExpandedUrl(isExpanded ? null : item.url)
 }
 onCancel={
 onCancel && canCancelItem(item.status)
 ? () => onCancel(item.url)
 : undefined
 }
 formatDuration={formatDuration}
 />
 );
 })}
 </tbody>
 </table>

 {items.length === 0 && (
 <p className="text-center text-sm text-text-dim py-8">
 No items in queue.
 </p>
 )}
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Row subcomponent
// ---------------------------------------------------------------------------

interface TableRowProps {
 item: QueueItem;
 isExpanded: boolean;
 onToggle: () => void;
 onCancel?: () => void;
 formatDuration: (s: number | null) => string;
}

function TableRow({
 item,
 isExpanded,
 onToggle,
 onCancel,
 formatDuration,
}: TableRowProps) {
 return (
 <>
 <tr
 onClick={onToggle}
  className="border-b border-border cursor-pointer hover:bg-raised transition-colors"
 >
 <td className="px-4 py-2.5 text-text-mute">
 {isExpanded ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 </td>
 <td className="px-4 py-2.5 font-mono text-xs text-text truncate max-w-xs">
 {item.url}
 </td>
 <td className="px-4 py-2.5">
 <span className="inline-flex items-center gap-1.5 text-xs font-medium">
 {STATUS_ICON[item.status]}
 {STATUS_LABEL[item.status]}
 </span>
 </td>
 <td className="px-4 py-2.5 text-right font-mono text-xs text-text-dim">
 {formatDuration(item.duration_seconds)}
 </td>
 <td className="px-4 py-2.5 text-center">
 {onCancel ? (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onCancel();
 }}
 className="p-1 hover:bg-neon-r/20 text-neon-r transition-colors"
 title="Cancel"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 ) : null}
 </td>
 </tr>

 {isExpanded && (
 <tr className="bg-void">
 <td colSpan={5} className="px-8 py-3 text-xs text-text-dim space-y-1">
 <p>
 <span className="font-medium text-text">URL:</span>{''}
 {item.url}
 </p>
 <p>
 <span className="font-medium text-text">Status:</span>{''}
 {STATUS_LABEL[item.status]}
 </p>
 {item.duration_seconds !== null && (
 <p>
 <span className="font-medium text-text">Duration:</span>{''}
 {formatDuration(item.duration_seconds)}
 </p>
 )}
 {item.error_message && (
 <p className="text-neon-r">
 <span className="font-medium">Error:</span> {item.error_message}
 </p>
 )}
 </td>
 </tr>
 )}
 </>
 );
}
