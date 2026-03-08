import { useState, useEffect, useRef, useCallback } from'react';
import { Eye, EyeOff } from'lucide-react';
import { useWebSocketSubscription } from'../../hooks/useWebSocketSubscription';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel ='info' |'warn' |'error';

interface LogEntry {
 id: number;
 timestamp: string;
 level: LogLevel;
 message: string;
}

type LogFilter ='all' | LogLevel;

interface LiveLogViewerProps {
 crawlId: string;
}

interface WsLogPayload {
 timestamp?: string;
 level?: string;
 message?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LINES = 1000;

const LEVEL_COLORS: Record<LogLevel, string> = {
 info:'text-text-mute',
 warn:'text-volt',
 error:'text-neon-r',
};

const LEVEL_TAG: Record<LogLevel, string> = {
 info:'[INFO]',
 warn:'[WARN]',
 error:'[ERROR]',
};

const FILTER_OPTIONS: { label: string; value: LogFilter }[] = [
 { label:'All', value:'all' },
 { label:'Info', value:'info' },
 { label:'Warn', value:'warn' },
 { label:'Error', value:'error' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let nextId = 0;

export function LiveLogViewer({ crawlId }: LiveLogViewerProps) {
 const [logs, setLogs] = useState<LogEntry[]>([]);
 const [filter, setFilter] = useState<LogFilter>('all');
 const [autoScroll, setAutoScroll] = useState(true);

 const containerRef = useRef<HTMLDivElement>(null);
 const autoScrollRef = useRef(autoScroll);
 autoScrollRef.current = autoScroll;

 const { data: wsLog } = useWebSocketSubscription<WsLogPayload>(
 `crawl:${crawlId}:logs`,
 );

 const appendLog = useCallback((entry: LogEntry) => {
 setLogs((prev) => {
 const next = [...prev, entry];
 return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
 });
 requestAnimationFrame(() => {
 if (autoScrollRef.current && containerRef.current) {
 containerRef.current.scrollTop = containerRef.current.scrollHeight;
 }
 });
 }, []);

 useEffect(() => {
 if (!wsLog) return;
 const level = normalizeLevel(wsLog.level);
 const entry: LogEntry = {
 id: nextId++,
 timestamp: wsLog.timestamp ?? new Date().toLocaleTimeString('en-AU', { hour12: false }),
 level,
 message: wsLog.message ??'',
 };
 appendLog(entry);
 }, [wsLog, appendLog]);

 const filtered =
 filter ==='all' ? logs : logs.filter((l) => l.level === filter);

 return (
 <div className="bg-surface border border-border flex flex-col overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3 border-b border-border">
 <h3 className="text-sm font-semibold text-text">
 Logs
 </h3>

 <div className="flex items-center gap-2">
 {FILTER_OPTIONS.map((opt) => (
 <button
 key={opt.value}
 type="button"
 onClick={() => setFilter(opt.value)}
 className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
 filter === opt.value
 ?'bg-cyan text-void'
 :'bg-abyss text-text-dim hover:text-text'
 }`}
 >
 {opt.label}
 </button>
 ))}

 <button
 type="button"
 onClick={() => setAutoScroll((s) => !s)}
 title={autoScroll ?'Disable auto-scroll' :'Enable auto-scroll'}
 className="p-1.5 text-text-mute hover:text-text hover:bg-raised transition-colors"
 >
 {autoScroll ? (
 <Eye className="w-4 h-4" />
 ) : (
 <EyeOff className="w-4 h-4" />
 )}
 </button>
 </div>
 </div>

 <div
 ref={containerRef}
 className="h-72 overflow-y-auto overscroll-contain bg-void p-3 font-mono text-xs leading-5"
 >
 {filtered.length === 0 ? (
 <p className="text-text-dim text-center py-8">
 {logs.length === 0
 ?'Waiting for logs…'
 :'No logs match the current filter.'}
 </p>
 ) : (
 filtered.map((entry) => (
 <div key={entry.id} className={LEVEL_COLORS[entry.level]}>
 <span className="text-text-dim">{entry.timestamp}</span>{''}
 <span className="font-semibold">{LEVEL_TAG[entry.level]}</span>{''}
 {entry.message}
 </div>
 ))
 )}
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLevel(raw: string | undefined): LogLevel {
 const lower = (raw ??'info').toLowerCase();
 if (lower ==='warn' || lower ==='warning') return'warn';
 if (lower ==='error' || lower ==='err') return'error';
 return'info';
}
