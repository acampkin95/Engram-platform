import { X, ExternalLink, ChevronRight, Maximize2, EyeOff, Loader2 } from'lucide-react';
import { ENTITY_COLORS, type GraphEntity, type GraphRelationship } from'./GraphCanvas';

interface EntityDetailPanelProps {
 entity: GraphEntity;
 allEntities: GraphEntity[];
 relationships: GraphRelationship[];
 isExpanding: boolean;
 onClose: () => void;
 onExpand: (entityId: string) => void;
 onHide: (entityId: string) => void;
 onSelectEntity: (entityId: string) => void;
}

const RELATION_COLORS: Record<string, string> = {
 alias_of:'text-cyan',
 member_of:'text-fuchsia',
 owns:'text-plasma',
 associated_with:'text-volt',
 linked_to:'text-cyan',
};

function AttributeRow({ label, value }: { label: string; value: unknown }) {
 const display =
 typeof value ==='object' ? JSON.stringify(value) : String(value);
 const isUrl =
 typeof value ==='string' &&
 (value.startsWith('http://') || value.startsWith('https://'));

 return (
 <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
 <span className="text-xs text-text-dim w-28 shrink-0 pt-0.5 capitalize">
 {label.replace(/_/g,'')}
 </span>
 {isUrl ? (
 <a
 href={value as string}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs text-cyan hover:text-cyan flex items-center gap-1 break-all"
 >
 {display.length > 40 ? display.slice(0, 38) +'…' : display}
 <ExternalLink className="w-3 h-3 shrink-0" />
 </a>
 ) : (
 <span className="text-xs text-text break-all">{display}</span>
 )}
 </div>
 );
}

export default function EntityDetailPanel({
 entity,
 allEntities,
 relationships,
 isExpanding,
 onClose,
 onExpand,
 onHide,
 onSelectEntity,
}: EntityDetailPanelProps) {
 const color = ENTITY_COLORS[entity.entity_type] ??'#636e7e';

 const outgoing = relationships.filter((r) => r.source_id === entity.id);
 const incoming = relationships.filter((r) => r.target_id === entity.id);

 const entityName = (id: string) =>
 allEntities.find((e) => e.id === id)?.name ?? id;

 const attrEntries = Object.entries(entity.attributes).filter(
 ([, v]) => v !== null && v !== undefined && v !==''
 );

 return (
 <aside className="w-72 shrink-0 flex flex-col bg-void border-l border-border overflow-hidden">
 {/* Header */}
 <div
 className="flex items-center justify-between px-4 py-3 border-b border-border"
 style={{ borderLeftColor: color, borderLeftWidth: 3 }}
 >
 <div className="flex items-center gap-2 min-w-0">
 <span
 className="w-2.5 h-2.5 rounded-full shrink-0"
 style={{ backgroundColor: color }}
 />
 <span className="text-xs uppercase tracking-wider text-text-mute shrink-0">
 {entity.entity_type}
 </span>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="p-1 hover:bg-raised text-text-mute hover:text-text transition-colors"
 aria-label="Close panel"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Entity name */}
 <div className="px-4 py-3 border-b border-border">
 <p className="font-semibold text-sm text-text break-words leading-snug">
 {entity.name}
 </p>
 <p className="text-xs text-text-dim font-mono mt-0.5 truncate">{entity.id}</p>
 </div>

 {/* Scrollable content */}
 <div className="flex-1 overflow-y-auto">
 {/* Attributes */}
 {attrEntries.length > 0 && (
 <div className="px-4 py-3 border-b border-border">
 <h3 className="text-xs uppercase tracking-wider text-text-dim mb-2 font-medium">
 Attributes
 </h3>
 <div>
 {attrEntries.map(([k, v]) => (
 <AttributeRow key={k} label={k} value={v} />
 ))}
 </div>
 </div>
 )}

 {/* Outgoing relationships */}
 {outgoing.length > 0 && (
 <div className="px-4 py-3 border-b border-border">
 <h3 className="text-xs uppercase tracking-wider text-text-dim mb-2 font-medium">
 Outgoing ({outgoing.length})
 </h3>
 <div className="space-y-1">
 {outgoing.map((rel, i) => (
 <button
 key={i}
 type="button"
 onClick={() => onSelectEntity(rel.target_id)}
 className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-raised text-left group transition-colors"
 >
 <ChevronRight className="w-3 h-3 text-text-dim shrink-0" />
 <span
 className={`text-xs font-medium shrink-0 ${RELATION_COLORS[rel.relation_type] ??'text-text-mute'}`}
 >
 {rel.relation_type}
 </span>
 <span className="text-xs text-text-mute truncate group-hover:text-text">
 {entityName(rel.target_id)}
 </span>
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Incoming relationships */}
 {incoming.length > 0 && (
 <div className="px-4 py-3 border-b border-border">
 <h3 className="text-xs uppercase tracking-wider text-text-dim mb-2 font-medium">
 Incoming ({incoming.length})
 </h3>
 <div className="space-y-1">
 {incoming.map((rel, i) => (
 <button
 key={i}
 type="button"
 onClick={() => onSelectEntity(rel.source_id)}
 className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-raised text-left group transition-colors"
 >
 <ChevronRight className="w-3 h-3 text-text-dim rotate-180 shrink-0" />
 <span className="text-xs text-text-mute truncate group-hover:text-text">
 {entityName(rel.source_id)}
 </span>
 <span
 className={`text-xs font-medium shrink-0 ml-auto ${RELATION_COLORS[rel.relation_type] ??'text-text-mute'}`}
 >
 {rel.relation_type}
 </span>
 </button>
 ))}
 </div>
 </div>
 )}

 {outgoing.length === 0 && incoming.length === 0 && (
 <div className="px-4 py-3 text-xs text-text-dim italic">
 No relationships found
 </div>
 )}
 </div>

 {/* Action buttons */}
 <div className="px-4 py-3 border-t border-border flex gap-2">
 <button
 type="button"
 onClick={() => onExpand(entity.id)}
 disabled={isExpanding}
 className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan hover:bg-cyan/80 disabled:bg-surface disabled:cursor-not-allowed text-xs font-medium transition-colors"
 >
 {isExpanding ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : (
 <Maximize2 className="w-3.5 h-3.5" />
 )}
 Expand
 </button>
 <button
 type="button"
 onClick={() => onHide(entity.id)}
 className="flex items-center justify-center gap-1.5 px-3 py-2 bg-raised hover:bg-raised text-xs font-medium transition-colors"
 title="Hide this node from the graph"
 >
 <EyeOff className="w-3.5 h-3.5" />
 Hide
 </button>
 </div>
 </aside>
 );
}
