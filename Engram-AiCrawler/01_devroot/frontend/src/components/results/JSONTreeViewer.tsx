import { useState, useCallback, useMemo } from'react';
import { ChevronRight, ChevronDown, Copy, Check, Search } from'lucide-react';

interface JSONNodeProps {
 data: unknown;
 path: string;
 depth: number;
 searchTerm: string;
 onCopyPath: (path: string) => void;
}

function getValueType(value: unknown): string {
 if (value === null) return'null';
 if (Array.isArray(value)) return'array';
 return typeof value;
}

function getValueColor(type: string): string {
 switch (type) {
 case'string': return'text-plasma';
 case'number': return'text-cyan';
 case'boolean': return'text-fuchsia';
 case'null': return'text-text-dim';
 default: return'text-text';
 }
}

function matchesSearch(value: unknown, term: string): boolean {
 if (!term) return false;
 const lower = term.toLowerCase();
 if (typeof value ==='string') return value.toLowerCase().includes(lower);
 if (typeof value ==='number') return String(value).includes(lower);
 return false;
}

function JSONNode({ data, path, depth, searchTerm, onCopyPath }: JSONNodeProps) {
 const [expanded, setExpanded] = useState(depth < 2);
 const [hoveredPath, setHoveredPath] = useState(false);

 const type = getValueType(data);
 const isExpandable = type ==='object' || type ==='array';

 if (!isExpandable) {
 const valueStr = type ==='null' ?'null' : type ==='string' ? `"${data}"`: String(data);
 const isMatch = searchTerm && matchesSearch(data, searchTerm);

 return (
 <span className={`${getValueColor(type)} ${isMatch ?'bg-volt/20 px-0.5' :''}`}>
 {valueStr}
 </span>
 );
 }

 const entries = type ==='array'
 ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
 : Object.entries(data as Record<string, unknown>);

 const count = entries.length;
 const bracket = type ==='array' ? ['[',']'] : ['{','}'];

 return (
 <span>
 <button
 type="button"
 onClick={() => setExpanded(!expanded)}
 className="inline-flex items-center gap-0.5 text-text-dim hover:text-text transition-colors"
 >
 {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
 </button>
 <span className="text-text-dim">{bracket[0]}</span>
 {!expanded && (
 <span className="text-text-dim text-xs cursor-pointer hover:text-text" onClick={() => setExpanded(true)}>
 {count} {type ==='array' ?'items' :'keys'}
 </span>
 )}
 {!expanded && <span className="text-text-dim">{bracket[1]}</span>}
 {expanded && (
 <>
 <div style={{ paddingLeft: `${(depth + 1) * 16}px`}}>
 {entries.map(([key, value], idx) => {
 const childPath = path ? `${path}.${key}`: key;
 const keyMatchesSearch = searchTerm && key.toLowerCase().includes(searchTerm.toLowerCase());

 return (
 <div key={key} className="flex items-start gap-1 py-0.5 group/entry">
 <span
 className={`text-neon-r cursor-pointer ${keyMatchesSearch ?'bg-volt/20 px-0.5' :''}`}
 onMouseEnter={() => setHoveredPath(true)}
 onMouseLeave={() => setHoveredPath(false)}
 >
 {type ==='array' ? (
 <span className="text-text-dim">{key}</span>
 ) : (
 `"${key}"`
 )}
 </span>
 <span className="text-text-dim">: </span>
 <JSONNode
 data={value}
 path={childPath}
 depth={depth + 1}
 searchTerm={searchTerm}
 onCopyPath={onCopyPath}
 />
 {idx < entries.length - 1 && <span className="text-text-dim">,</span>}
 {hoveredPath && (
 <button
 type="button"
 onClick={() => onCopyPath(childPath)}
 className="ml-2 opacity-0 group-hover/entry:opacity-100 text-xs text-text-mute hover:text-text-dim transition-opacity"
 title="Copy path"
 >
 copy path
 </button>
 )}
 </div>
 );
 })}
 </div>
 <span className="text-text-dim">{bracket[1]}</span>
 </>
 )}
 </span>
 );
}

interface JSONTreeViewerProps {
 data: unknown;
}

export default function JSONTreeViewer({ data }: JSONTreeViewerProps) {
 const [searchTerm, setSearchTerm] = useState('');
 const [copiedPath, setCopiedPath] = useState<string | null>(null);
 const [copiedAll, setCopiedAll] = useState(false);

 const jsonString = useMemo(() => JSON.stringify(data, null, 2), [data]);

 const handleCopyPath = useCallback((path: string) => {
 navigator.clipboard.writeText(path);
 setCopiedPath(path);
 setTimeout(() => setCopiedPath(null), 2000);
 }, []);

 const handleCopyAll = async () => {
 await navigator.clipboard.writeText(jsonString);
 setCopiedAll(true);
 setTimeout(() => setCopiedAll(false), 2000);
 };

 return (
 <div className="h-full flex flex-col">
 <div className="flex items-center gap-3 mb-3 flex-shrink-0">
 <div className="relative flex-1">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mute" />
 <input
 type="text"
 placeholder="Search keys and values..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-cyan"
 />
 </div>
 <button
 type="button"
 onClick={handleCopyAll}
 className="flex items-center gap-1.5 px-3 py-2 text-sm bg-abyss hover:bg-border text-text transition-colors flex-shrink-0"
 >
 {copiedAll ? <Check size={14} /> : <Copy size={14} />}
 {copiedAll ?'Copied!' :'Copy JSON'}
 </button>
 </div>

 {copiedPath && (
 <div className="mb-2 px-3 py-1.5 bg-plasma/10 border border-plasma/30 text-xs text-plasma flex-shrink-0">
 Copied path: <code className="font-mono">{copiedPath}</code>
 </div>
 )}

 <div className="flex-1 overflow-auto bg-void p-4 font-mono text-sm">
 <JSONNode
 data={data}
 path=""
 depth={0}
 searchTerm={searchTerm}
 onCopyPath={handleCopyPath}
 />
 </div>
 </div>
 );
}
