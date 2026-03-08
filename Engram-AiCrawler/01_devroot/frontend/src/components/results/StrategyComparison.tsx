import { useState, useRef, useEffect } from'react';
import { ChevronDown, ArrowRight } from'lucide-react';

interface CrawlEntry {
 crawl_id: string;
 url: string;
 extraction_type: string;
 extracted_content: string | null;
 markdown: string | null;
}

interface StrategyComparisonProps {
 entries: CrawlEntry[];
 onUseStrategy?: (crawlId: string) => void;
}

function ContentPanel({
 entry,
 label,
 onUseStrategy,
}: {
 entry: CrawlEntry | null;
 label: string;
 onUseStrategy?: (crawlId: string) => void;
}) {
 const renderContent = () => {
 if (!entry) {
 return (
 <div className="flex items-center justify-center h-full text-text-mute text-sm">
 Select a strategy
 </div>
 );
 }

 const content = entry.extracted_content || entry.markdown ||'';
 if (!content) {
 return (
 <div className="flex items-center justify-center h-full text-text-mute text-sm">
 No content available
 </div>
 );
 }

 let parsed: unknown = null;
 if (entry.extracted_content) {
 try {
 parsed = JSON.parse(entry.extracted_content);
 } catch {
 parsed = null;
 }
 }

 if (parsed !== null && typeof parsed ==='object') {
 return (
 <pre className="text-xs font-mono text-text whitespace-pre-wrap">
 {JSON.stringify(parsed, null, 2)}
 </pre>
 );
 }

 return (
 <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
 {content}
 </div>
 );
 };

 return (
 <div className="flex flex-col h-full">
 <div className="flex items-center justify-between px-4 py-3 bg-void border-b border-border flex-shrink-0">
 <div className="text-xs font-medium text-text-dim uppercase tracking-wide">
 {label}
 </div>
 {entry && onUseStrategy && (
 <button
 type="button"
 onClick={() => onUseStrategy(entry.crawl_id)}
 className="flex items-center gap-1 text-xs text-cyan hover:text-cyan transition-colors"
 >
 Use this strategy
 <ArrowRight size={12} />
 </button>
 )}
 </div>
 {entry && (
 <div className="px-4 py-2 bg-cyan/10 border-b border-border flex-shrink-0">
 <span className="text-xs font-medium text-cyan capitalize">
 {entry.extraction_type}
 </span>
 <span className="text-xs text-text-dim ml-2">
 ID: {entry.crawl_id.slice(0, 8)}...
 </span>
 </div>
 )}
 <div className="flex-1 overflow-auto p-4">
 {renderContent()}
 </div>
 </div>
 );
}

function StrategySelector({
 entries,
 selected,
 onChange,
 label,
}: {
 entries: CrawlEntry[];
 selected: CrawlEntry | null;
 onChange: (entry: CrawlEntry | null) => void;
 label: string;
}) {
 return (
 <div className="relative">
 <div className="flex items-center gap-2 mb-2">
 <label className="text-sm font-medium text-text">{label}</label>
 </div>
 <div className="relative">
 <select
 value={selected?.crawl_id ??''}
 onChange={(e) => {
 const entry = entries.find((en) => en.crawl_id === e.target.value) ?? null;
 onChange(entry);
 }}
  className="w-full appearance-none pl-3 pr-8 py-2 text-sm bg-void border border-border text-text focus:outline-none focus:ring-2 focus:ring-cyan"
 >
 <option value="">Select strategy...</option>
 {entries.map((entry) => (
 <option key={entry.crawl_id} value={entry.crawl_id}>
 {entry.extraction_type} — {entry.crawl_id.slice(0, 8)}
 </option>
 ))}
 </select>
 <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-mute pointer-events-none" />
 </div>
 </div>
 );
}

export default function StrategyComparison({ entries, onUseStrategy }: StrategyComparisonProps) {
 const [leftEntry, setLeftEntry] = useState<CrawlEntry | null>(entries[0] ?? null);
 const [rightEntry, setRightEntry] = useState<CrawlEntry | null>(entries[1] ?? null);
 const [syncScroll, setSyncScroll] = useState(true);
 const leftRef = useRef<HTMLDivElement>(null);
 const rightRef = useRef<HTMLDivElement>(null);
 const scrollingRef = useRef<'left' |'right' | null>(null);

 useEffect(() => {
 const leftEl = leftRef.current;
 const rightEl = rightRef.current;
 if (!leftEl || !rightEl || !syncScroll) return;

 const handleLeft = () => {
 if (scrollingRef.current ==='right') return;
 scrollingRef.current ='left';
 rightEl.scrollTop = leftEl.scrollTop;
 requestAnimationFrame(() => { scrollingRef.current = null; });
 };

 const handleRight = () => {
 if (scrollingRef.current ==='left') return;
 scrollingRef.current ='right';
 leftEl.scrollTop = rightEl.scrollTop;
 requestAnimationFrame(() => { scrollingRef.current = null; });
 };

 leftEl.addEventListener('scroll', handleLeft);
 rightEl.addEventListener('scroll', handleRight);
 return () => {
 leftEl.removeEventListener('scroll', handleLeft);
 rightEl.removeEventListener('scroll', handleRight);
 };
 }, [syncScroll]);

 if (entries.length < 2) {
 return (
 <div className="flex items-center justify-center h-48 text-text-dim text-sm">
 Crawl this URL with at least two different strategies to compare results.
 </div>
 );
 }

 return (
 <div className="flex flex-col h-full gap-4">
 <div className="grid grid-cols-2 gap-4 flex-shrink-0">
 <StrategySelector
 entries={entries}
 selected={leftEntry}
 onChange={setLeftEntry}
 label="Left Panel"
 />
 <StrategySelector
 entries={entries}
 selected={rightEntry}
 onChange={setRightEntry}
 label="Right Panel"
 />
 </div>

 <div className="flex items-center gap-2 flex-shrink-0">
 <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer select-none">
 <input
 type="checkbox"
 checked={syncScroll}
 onChange={(e) => setSyncScroll(e.target.checked)}
 className="border-border text-cyan focus:ring-cyan"
 />
 Sync scroll
 </label>
 </div>

 <div className="flex-1 grid grid-cols-2 gap-0 border border-border overflow-hidden min-h-0">
 <div ref={leftRef} className="flex flex-col border-r border-border overflow-auto">
 <ContentPanel entry={leftEntry} label="Left" onUseStrategy={onUseStrategy} />
 </div>
 <div ref={rightRef} className="flex flex-col overflow-auto">
 <ContentPanel entry={rightEntry} label="Right" onUseStrategy={onUseStrategy} />
 </div>
 </div>
 </div>
 );
}
