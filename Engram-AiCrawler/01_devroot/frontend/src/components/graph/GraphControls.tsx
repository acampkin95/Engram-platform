import { Search, ZoomIn, ZoomOut, RefreshCw, Filter } from'lucide-react';
import { ENTITY_COLORS } from'./GraphCanvas';

const ALL_ENTITY_TYPES = Object.keys(ENTITY_COLORS) as Array<keyof typeof ENTITY_COLORS>;

interface GraphControlsProps {
 searchQuery: string;
 zoom: number;
 visibleTypes: Set<string>;
 onSearchChange: (q: string) => void;
 onZoomIn: () => void;
 onZoomOut: () => void;
 onResetView: () => void;
 onToggleType: (type: string) => void;
 onToggleAllTypes: (show: boolean) => void;
}

export default function GraphControls({
 searchQuery,
 zoom,
 visibleTypes,
 onSearchChange,
 onZoomIn,
 onZoomOut,
 onResetView,
 onToggleType,
 onToggleAllTypes,
}: GraphControlsProps) {
 const allVisible = ALL_ENTITY_TYPES.every((t) => visibleTypes.has(t));
 const noneVisible = ALL_ENTITY_TYPES.every((t) => !visibleTypes.has(t));

 return (
 <div className="flex flex-col gap-3 p-3 bg-void border-b border-border">
 {/* Top row: search + zoom controls */}
 <div className="flex items-center gap-2">
 {/* Search */}
 <div className="relative flex-1">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim pointer-events-none" />
 <input
 type="text"
 placeholder="Filter nodes by name…"
 value={searchQuery}
 onChange={(e) => onSearchChange(e.target.value)}
 className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border focus:outline-none focus:border-cyan placeholder-text-mute text-text transition-colors"
 />
 </div>

 {/* Zoom controls */}
 <div className="flex items-center gap-1 bg-surface border border-border px-1 py-0.5">
 <button
 type="button"
 onClick={onZoomOut}
 className="p-1 hover:bg-raised text-text-mute hover:text-text transition-colors"
 title="Zoom out"
 aria-label="Zoom out"
 >
 <ZoomOut className="w-3.5 h-3.5" />
 </button>
 <span className="text-xs text-text-mute w-9 text-center tabular-nums">
 {Math.round(zoom * 100)}%
 </span>
 <button
 type="button"
 onClick={onZoomIn}
 className="p-1 hover:bg-raised text-text-mute hover:text-text transition-colors"
 title="Zoom in"
 aria-label="Zoom in"
 >
 <ZoomIn className="w-3.5 h-3.5" />
 </button>
 </div>

 <button
 type="button"
 onClick={onResetView}
 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-surface border border-border hover:bg-raised text-text-mute hover:text-text transition-colors"
 title="Reset view (center + reset zoom)"
 >
 <RefreshCw className="w-3.5 h-3.5" />
 Reset
 </button>
 </div>

 {/* Entity type filters */}
 <div className="flex items-center gap-2 flex-wrap">
 <span className="flex items-center gap-1 text-xs text-text-dim shrink-0">
 <Filter className="w-3 h-3" />
 Filter:
 </span>

 {/* Select all / none */}
 <button
 type="button"
 onClick={() => onToggleAllTypes(!allVisible)}
 className="text-xs px-2 py-0.5 border border-border hover:border-text-dim text-text-mute hover:text-text transition-colors"
 >
 {allVisible ?'None' :'All'}
 </button>

 {/* Per-type toggles */}
 {ALL_ENTITY_TYPES.map((type) => {
 const active = visibleTypes.has(type);
 const color = ENTITY_COLORS[type];
 return (
 <button
 key={type}
 type="button"
 onClick={() => onToggleType(type)}
 className="flex items-center gap-1.5 text-xs px-2 py-0.5 border transition-all duration-150"
 style={{
 borderColor: active ? color :'#374151',
 backgroundColor: active ? `${color}22` :'transparent',
 color: active ? color :'#636e7e',
 }}
 >
 <span
 className="w-1.5 h-1.5 rounded-full shrink-0"
 style={{ backgroundColor: active ? color :'#374151' }}
 />
 {type}
 </button>
 );
 })}

 {noneVisible && (
 <span className="text-xs text-volt ml-auto">All types hidden</span>
 )}
 </div>
 </div>
 );
}
