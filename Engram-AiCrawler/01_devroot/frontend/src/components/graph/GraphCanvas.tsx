import {
 useRef,
 useState,
 useEffect,
 useCallback,
 useMemo,
} from'react';
import { useForceSimulation, type SimNode } from'../../hooks/useForceSimulation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphEntity {
 id: string;
 name: string;
 entity_type: string;
 attributes: Record<string, unknown>;
}

export interface GraphRelationship {
 source_id: string;
 target_id: string;
 relation_type: string;
 confidence: number;
 evidence: string;
}

interface GraphCanvasProps {
 entities: GraphEntity[];
 relationships: GraphRelationship[];
 selectedId: string | null;
 visibleTypes: Set<string>;
 searchQuery: string;
 zoom: number;
 onSelectEntity: (id: string | null) => void;
 onDoubleClickEntity: (id: string) => void;
 onZoomChange: (zoom: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_RADIUS = 22;
const SELECTED_RING_COLOR ='#50ffff'; // yellow-400

// eslint-disable-next-line react-refresh/only-export-components -- shared palette used by sibling graph components
export const ENTITY_COLORS: Record<string, string> = {
 person:'#50ffff', // blue-500
 organisation:'#f380f5', // purple-500
 platform:'#0fbbaa', // green-500
 url:'#636e7e', // gray-500
 email:'#ff2d6b', // red-500
 username:'#d4ff00', // orange-500
};

function entityColor(type: string): string {
 return ENTITY_COLORS[type] ??'#636e7e';
}

function entityInitials(name: string): string {
 return name
 .split(/[\s@_.]+/)
 .slice(0, 2)
 .map((w) => w[0]?.toUpperCase() ??'')
 .join('');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphCanvas({
 entities,
 relationships,
 selectedId,
 visibleTypes,
 searchQuery,
 zoom,
 onSelectEntity,
 onDoubleClickEntity,
 onZoomChange,
}: GraphCanvasProps) {
 const svgRef = useRef<SVGSVGElement>(null);
 const containerRef = useRef<HTMLDivElement>(null);

 const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
 const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
 const [pan, setPan] = useState({ x: 0, y: 0 });

 // Drag state refs (avoid re-render on every mouse-move)
 const dragRef = useRef<{
 nodeId: string | null;
 startX: number;
 startY: number;
 originX: number;
 originY: number;
 } | null>(null);

 const panRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number } | null>(null);

 // ── Resize observer ─────────────────────────────────────────────────────────
 useEffect(() => {
 const el = containerRef.current;
 if (!el) return;
 const ro = new ResizeObserver((entries) => {
 const { width, height } = entries[0].contentRect;
 if (width > 0 && height > 0) {
 setDimensions({ width, height });
 }
 });
 ro.observe(el);
 return () => ro.disconnect();
 }, []);

 // ── Filtered entities ────────────────────────────────────────────────────────
 const visibleEntities = useMemo(() => {
 const q = searchQuery.toLowerCase();
 return entities.filter(
 (e) =>
 visibleTypes.has(e.entity_type) &&
 (q ==='' || e.name.toLowerCase().includes(q) || e.id.includes(q))
 );
 }, [entities, visibleTypes, searchQuery]);

 const visibleIds = useMemo(
 () => new Set(visibleEntities.map((e) => e.id)),
 [visibleEntities]
 );

 const visibleRelationships = useMemo(
 () =>
 relationships.filter(
 (r) => visibleIds.has(r.source_id) && visibleIds.has(r.target_id)
 ),
 [relationships, visibleIds]
 );

 // ── Force simulation ─────────────────────────────────────────────────────────
 const handleTick = useCallback((nodes: SimNode[]) => {
 const positions: Record<string, { x: number; y: number }> = {};
 for (const n of nodes) {
 positions[n.id] = { x: n.x, y: n.y };
 }
 setNodePositions(positions);
 }, []);

 const sim = useForceSimulation({
 width: dimensions.width,
 height: dimensions.height,
 onTick: handleTick,
 });

 // Reinitialise when entities / dimensions change
 useEffect(() => {
 if (visibleEntities.length === 0) {
 setNodePositions({});
 return;
 }

 const { width, height } = dimensions;
 const cx = width / 2;
 const cy = height / 2;
 const spread = Math.min(width, height) * 0.35;

 const nodes: SimNode[] = visibleEntities.map((e, i) => {
 const existing = nodePositions[e.id];
 const angle = (i / visibleEntities.length) * Math.PI * 2;
 return {
 id: e.id,
 x: existing?.x ?? cx + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
 y: existing?.y ?? cy + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5),
 vx: 0,
 vy: 0,
 radius: ENTITY_RADIUS,
 };
 });

 sim.setNodes(nodes);
 sim.setEdges(
 visibleRelationships.map((r) => ({
 source: r.source_id,
 target: r.target_id,
 }))
 );
 sim.start();

 // Let physics settle for 3 s then stop
 const timer = setTimeout(() => sim.stop(), 3000);
 return () => {
 clearTimeout(timer);
 sim.stop();
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [visibleEntities, visibleRelationships, dimensions]);

 // ── Transform string (zoom + pan) ────────────────────────────────────────────
 const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

 // ── Drag handlers ─────────────────────────────────────────────────────────────
 const handleNodePointerDown = useCallback(
 (e: React.PointerEvent, nodeId: string) => {
 e.stopPropagation();
 const pos = nodePositions[nodeId];
 if (!pos) return;
 dragRef.current = {
 nodeId,
 startX: e.clientX,
 startY: e.clientY,
 originX: pos.x,
 originY: pos.y,
 };
 (e.target as Element).setPointerCapture(e.pointerId);
 sim.start(); // wake up sim while dragging
 },
 [nodePositions, sim]
 );

 const handlePointerMove = useCallback(
 (e: React.PointerEvent) => {
 if (dragRef.current?.nodeId) {
 const { nodeId, startX, startY, originX, originY } = dragRef.current;
 const dx = (e.clientX - startX) / zoom;
 const dy = (e.clientY - startY) / zoom;
 sim.updateNodePosition(nodeId, originX + dx, originY + dy, true);
 return;
 }
 if (panRef.current?.active) {
 const dx = e.clientX - panRef.current.startX;
 const dy = e.clientY - panRef.current.startY;
 setPan({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
 }
 },
 [zoom, sim]
 );

 const handlePointerUp = useCallback(
 (_e: React.PointerEvent) => {
 if (dragRef.current?.nodeId) {
 sim.updateNodePosition(
 dragRef.current.nodeId,
 nodePositions[dragRef.current.nodeId]?.x ?? 0,
 nodePositions[dragRef.current.nodeId]?.y ?? 0,
 false
 );
 dragRef.current = null;
 return;
 }
 if (panRef.current) {
 panRef.current = null;
 }
 },
 [sim, nodePositions]
 );

 const handleSvgPointerDown = useCallback((e: React.PointerEvent) => {
 if (dragRef.current) return;
 panRef.current = {
 active: true,
 startX: e.clientX,
 startY: e.clientY,
 originX: pan.x,
 originY: pan.y,
 };
 (e.target as Element).setPointerCapture(e.pointerId);
 }, [pan]);

 // ── Wheel zoom ────────────────────────────────────────────────────────────────
 const handleWheel = useCallback(
 (e: React.WheelEvent) => {
 e.preventDefault();
 const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
 onZoomChange(Math.min(4, Math.max(0.2, zoom * factor)));
 },
 [zoom, onZoomChange]
 );

 // ── Render helpers ────────────────────────────────────────────────────────────
 function midPoint(
 sx: number, sy: number, tx: number, ty: number
 ): { x: number; y: number } {
 return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
 }

 // ── Render ────────────────────────────────────────────────────────────────────
 if (entities.length === 0) {
 return (
 <div className="flex-1 flex items-center justify-center text-text-dim">
 <p className="text-sm">No entities to display</p>
 </div>
 );
 }

 if (visibleEntities.length === 0) {
 return (
 <div className="flex-1 flex items-center justify-center text-text-dim">
 <p className="text-sm">No entities match current filters</p>
 </div>
 );
 }

 return (
 <div
 ref={containerRef}
 className="flex-1 relative overflow-hidden bg-void border border-border"
 >
 <svg
 ref={svgRef}
 width="100%"
 height="100%"
 className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
 onPointerDown={handleSvgPointerDown}
 onPointerMove={handlePointerMove}
 onPointerUp={handlePointerUp}
 onWheel={handleWheel}
 >
 {/* Definitions: arrowhead marker */}
 <defs>
 <marker
 id="arrow"
 markerWidth="8"
 markerHeight="8"
 refX="6"
 refY="3"
 orient="auto"
 >
 <path d="M0,0 L0,6 L8,3 z" fill="#636e7e" />
 </marker>
 <marker
 id="arrow-highlight"
 markerWidth="8"
 markerHeight="8"
 refX="6"
 refY="3"
 orient="auto"
 >
 <path d="M0,0 L0,6 L8,3 z" fill="#50ffff" />
 </marker>
 {/* Subtle grid */}
 <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
 <path
 d="M 40 0 L 0 0 0 40"
 fill="none"
 stroke="rgba(255,255,255,0.03)"
 strokeWidth="1"
 />
 </pattern>
 </defs>

 {/* Background grid */}
 <rect width="100%" height="100%" fill="url(#grid)" />

 {/* Main transform group */}
 <g style={{ transform, transformOrigin:'0 0', transition:'transform 0.05s linear' }}>
 {/* Edges */}
 {visibleRelationships.map((rel, i) => {
 const sp = nodePositions[rel.source_id];
 const tp = nodePositions[rel.target_id];
 if (!sp || !tp) return null;

 const isSelected =
 selectedId === rel.source_id || selectedId === rel.target_id;

 const dx = tp.x - sp.x;
 const dy = tp.y - sp.y;
 const dist = Math.sqrt(dx * dx + dy * dy) || 1;
 const r = ENTITY_RADIUS + 4;
 const x1 = sp.x + (dx / dist) * r;
 const y1 = sp.y + (dy / dist) * r;
 const x2 = tp.x - (dx / dist) * (r + 8);
 const y2 = tp.y - (dy / dist) * (r + 8);

 const mid = midPoint(x1, y1, x2, y2);

 return (
 <g key={`edge-${i}`}>
 <line
 x1={x1}
 y1={y1}
 x2={x2}
 y2={y2}
 stroke={isSelected ?'#50ffff' :'#374151'}
 strokeWidth={isSelected ? 2 : 1.5}
 strokeOpacity={isSelected ? 1 : 0.7}
 markerEnd={isSelected ?'url(#arrow-highlight)' :'url(#arrow)'}
 className="transition-all duration-150"
 />
 <text
 x={mid.x}
 y={mid.y - 5}
 textAnchor="middle"
 fontSize="9"
 fill={isSelected ?'#50ffff' :'#636e7e'}
 className="pointer-events-none"
 >
 {rel.relation_type}
 </text>
 </g>
 );
 })}

 {/* Nodes */}
 {visibleEntities.map((entity) => {
 const pos = nodePositions[entity.id];
 if (!pos) return null;

 const isSelected = selectedId === entity.id;
 const color = entityColor(entity.entity_type);
 const dimmed = searchQuery !=='' && !entity.name.toLowerCase().includes(searchQuery.toLowerCase());

 return (
 <g
 key={entity.id}
 transform={`translate(${pos.x}, ${pos.y})`}
 style={{ opacity: dimmed ? 0.3 : 1, transition:'opacity 0.2s' }}
 onPointerDown={(e) => handleNodePointerDown(e, entity.id)}
 onClick={(e) => {
 e.stopPropagation();
 onSelectEntity(isSelected ? null : entity.id);
 }}
 onDoubleClick={(e) => {
 e.stopPropagation();
 onDoubleClickEntity(entity.id);
 }}
 className="cursor-pointer"
 >
 {isSelected && (
 <circle
 r={ENTITY_RADIUS + 6}
 fill="none"
 stroke={SELECTED_RING_COLOR}
 strokeWidth="2.5"
 strokeDasharray="4 2"
 className="animate-spin"
 style={{ animationDuration:'8s' }}
 />
 )}

 <circle
 r={ENTITY_RADIUS + 3}
 fill={color}
 fillOpacity="0.15"
 />

 <circle
 r={ENTITY_RADIUS}
 fill={color}
 stroke={isSelected ? SELECTED_RING_COLOR :'rgba(255,255,255,0.15)'}
 strokeWidth={isSelected ? 2 : 1}
 className="transition-all duration-150"
 />

 <text
 textAnchor="middle"
 dominantBaseline="central"
 fontSize="10"
 fontWeight="600"
 fill="white"
 className="pointer-events-none"
 >
 {entityInitials(entity.name)}
 </text>

 <text
 y={ENTITY_RADIUS + 14}
 textAnchor="middle"
 fontSize="10"
 fill={isSelected ?'#50ffff' :'#d1d5db'}
 fontWeight={isSelected ?'600' :'400'}
 className="pointer-events-none"
 style={{ textShadow:'0 1px 3px rgba(0,0,0,0.9)' }}
 >
 {entity.name.length > 18
 ? entity.name.slice(0, 16) +'…'
 : entity.name}
 </text>
 </g>
 );
 })}
 </g>
 </svg>
 </div>
 );
}
