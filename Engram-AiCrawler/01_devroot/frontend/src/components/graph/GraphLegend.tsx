import { ENTITY_COLORS } from'./GraphCanvas';

const RELATION_TYPES = [
 { type:'alias_of', color:'#22d3ee', dash: undefined },
 { type:'member_of', color:'#c084fc', dash:'4 2' },
 { type:'owns', color:'#4ade80', dash: undefined },
 { type:'associated_with', color:'#50ffff', dash:'6 3' },
 { type:'linked_to', color:'#60a5fa', dash: undefined },
];

interface GraphLegendProps {
 entityCounts?: Record<string, number>;
}

export default function GraphLegend({ entityCounts = {} }: GraphLegendProps) {
 return (
 <div className="flex flex-col gap-3 p-3 bg-void border-t border-border text-xs">
 <div className="flex flex-wrap gap-x-6 gap-y-3">
 {/* Entity types */}
 <div>
 <p className="text-text-dim uppercase tracking-wider mb-2 font-medium text-[10px]">
 Entity Types
 </p>
 <div className="flex flex-wrap gap-x-4 gap-y-1.5">
 {Object.entries(ENTITY_COLORS).map(([type, color]) => {
 const count = entityCounts[type];
 return (
 <div key={type} className="flex items-center gap-1.5">
 <span
 className="w-3 h-3 rounded-full shrink-0"
 style={{ backgroundColor: color }}
 />
 <span className="text-text-mute capitalize">{type}</span>
 {count !== undefined && (
 <span className="text-text-dim text-[10px]">({count})</span>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* Relationship types */}
 <div>
 <p className="text-text-dim uppercase tracking-wider mb-2 font-medium text-[10px]">
 Relationships
 </p>
 <div className="flex flex-wrap gap-x-4 gap-y-1.5">
 {RELATION_TYPES.map(({ type, color, dash }) => (
 <div key={type} className="flex items-center gap-1.5">
 <svg width="20" height="10" className="shrink-0">
 <line
 x1="0"
 y1="5"
 x2="16"
 y2="5"
 stroke={color}
 strokeWidth="1.5"
 strokeDasharray={dash}
 />
 <path d="M14,2 L20,5 L14,8 Z" fill={color} />
 </svg>
 <span className="text-text-mute">{type.replace(/_/g,'')}</span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Interaction hints */}
 <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-dim">
 <span>Click node → select</span>
 <span>Double-click → expand</span>
 <span>Drag node → reposition</span>
 <span>Drag background → pan</span>
 <span>Scroll → zoom</span>
 </div>
 </div>
 );
}
