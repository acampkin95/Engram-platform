import { useState, useCallback } from'react';
import { Network, Loader2, RefreshCw, AlertCircle, GitMerge } from'lucide-react';
import { useToast } from'../components/Toast';
import { api } from'../lib/api';
import GraphCanvas, { type GraphEntity, type GraphRelationship } from'../components/graph/GraphCanvas';
import EntityDetailPanel from'../components/graph/EntityDetailPanel';
import GraphControls from'../components/graph/GraphControls';
import GraphLegend from'../components/graph/GraphLegend';
import GraphMergePanel from'../components/graph/GraphMergePanel';
import { Skeleton } from'../components/Skeleton';
import { Button, Input } from'@/components/ui';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KnowledgeGraphData {
 scan_id: string;
 entities: GraphEntity[];
 relationships: GraphRelationship[];
 created_at: string;
 updated_at: string;
}

interface ExpandResponse {
 entity: GraphEntity;
 connected: GraphEntity[];
 relationships: GraphRelationship[];
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeGraphPage() {
 const toast = useToast();

 // ── Load state ───────────────────────────────────────────────────────────────
 const [scanId, setScanId] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [loadError, setLoadError] = useState<string | null>(null);

 // ── Graph data ───────────────────────────────────────────────────────────────
 const [entities, setEntities] = useState<GraphEntity[]>([]);
 const [relationships, setRelationships] = useState<GraphRelationship[]>([]);
 const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});


 // ── Interaction state ────────────────────────────────────────────────────────
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
 const [isExpanding, setIsExpanding] = useState(false);

 // ── Merge state ──────────────────────────────────────────────────────────────
 const [mergeMode, setMergeMode] = useState(false);
 const [isMerging, setIsMerging] = useState(false);
 const [overlapCount, setOverlapCount] = useState<number | null>(null);
 const [mergedScanIds, setMergedScanIds] = useState<string[]>([]);

 // ── View state ───────────────────────────────────────────────────────────────
 const [zoom, setZoom] = useState(1);
 const [searchQuery, setSearchQuery] = useState('');
 const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
 new Set(['person','organisation','platform','url','email','username'])
 );

 const hasGraph = entities.length > 0;

 // ── Load graph ───────────────────────────────────────────────────────────────
 const handleLoadGraph = useCallback(async () => {
 const id = scanId.trim();
 if (!id) {
 toast.warning('Enter a scan ID first');
 return;
 }
 setIsLoading(true);
 setLoadError(null);
 setEntities([]);
 setRelationships([]);
 setSelectedId(null);
 setHiddenIds(new Set());
 try {
 const [graphRes, typesRes] = await Promise.all([
 api.get<KnowledgeGraphData>(`/knowledge-graph/${encodeURIComponent(id)}`),
 api
 .get<Record<string, number>>(`/knowledge-graph/${encodeURIComponent(id)}/types`)
 .catch(() => ({ data: {} })),
 ]);

 const data = graphRes.data;
 setEntities(data.entities);
 setRelationships(data.relationships);
 setEntityCounts(typesRes.data ?? {});

 toast.success(
 `Loaded ${data.entities.length} entities, ${data.relationships.length} relationships`
 );
 } catch {
 const msg ='Failed to load knowledge graph — check the scan ID';
 setLoadError(msg);
 toast.error(msg);
 } finally {
 setIsLoading(false);
 }
 }, [scanId, toast]);

 const handleMergeComplete = useCallback(
 (mergedEntities: GraphEntity[], mergedRels: GraphRelationship[], overlap: number, scanIds: string[]) => {
 setEntities(mergedEntities);
 setRelationships(mergedRels);
 setOverlapCount(overlap);
 setMergedScanIds(scanIds);
 setSelectedId(null);
 setHiddenIds(new Set());
 setIsMerging(false);
 toast.success(
 `Merged ${mergedEntities.length} entities, ${mergedRels.length} relationships (${overlap} overlapping)`
 );
 },
 [toast]
 );

 const handleToggleMergeMode = useCallback(() => {
 setMergeMode((prev) => !prev);
 setEntities([]);
 setRelationships([]);
 setSelectedId(null);
 setHiddenIds(new Set());
 setOverlapCount(null);
 setMergedScanIds([]);
 setLoadError(null);
 }, []);

 // ── Expand node ──────────────────────────────────────────────────────────────
 const handleExpand = useCallback(
 async (entityId: string) => {
 const id = scanId.trim();
 if (!id) return;
 setIsExpanding(true);
 try {
 const res = await api.get<ExpandResponse>(
 `/knowledge-graph/${encodeURIComponent(id)}/expand/${encodeURIComponent(entityId)}?depth=1`
 );
 const { connected, relationships: newRels } = res.data;

 setEntities((prev) => {
 const existingIds = new Set(prev.map((e) => e.id));
 const added = connected.filter((e) => !existingIds.has(e.id));
 return added.length > 0 ? [...prev, ...added] : prev;
 });

 setRelationships((prev) => {
 const existingKeys = new Set(
 prev.map((r) => `${r.source_id}:${r.target_id}:${r.relation_type}`)
 );
 const added = newRels.filter(
 (r) =>
 !existingKeys.has(`${r.source_id}:${r.target_id}:${r.relation_type}`)
 );
 return added.length > 0 ? [...prev, ...added] : prev;
 });

 const newCount = connected.filter(
 (e) => !entities.some((ex) => ex.id === e.id)
 ).length;

 if (newCount > 0) {
 toast.success(`Expanded: added ${newCount} new entities`);
 } else {
 toast.info('No new entities found for this node');
 }
 } catch {
 toast.error('Failed to expand entity');
 } finally {
 setIsExpanding(false);
 }
 },
 [scanId, entities, toast]
 );

 // ── Hide node ────────────────────────────────────────────────────────────────
 const handleHide = useCallback(
 (entityId: string) => {
 setHiddenIds((prev) => new Set([...prev, entityId]));
 if (selectedId === entityId) setSelectedId(null);
 toast.info('Node hidden — reload to restore');
 },
 [selectedId, toast]
 );

 // ── Type filter helpers ──────────────────────────────────────────────────────
 const handleToggleType = useCallback((type: string) => {
 setVisibleTypes((prev) => {
 const next = new Set(prev);
 if (next.has(type)) next.delete(type);
 else next.add(type);
 return next;
 });
 }, []);

 const handleToggleAllTypes = useCallback((show: boolean) => {
 setVisibleTypes(
 show
 ? new Set(['person','organisation','platform','url','email','username'])
 : new Set()
 );
 }, []);

 // ── Zoom helpers ─────────────────────────────────────────────────────────────
 const handleZoomIn = useCallback(() => {
 setZoom((z) => Math.min(4, z * 1.25));
 }, []);

 const handleZoomOut = useCallback(() => {
 setZoom((z) => Math.max(0.2, z / 1.25));
 }, []);

 const handleResetView = useCallback(() => {
 setZoom(1);
 }, []);

 // ── Visible entities (exclude hidden) ────────────────────────────────────────
 const visibleEntities = entities.filter((e) => !hiddenIds.has(e.id));

 // ── Selected entity object ───────────────────────────────────────────────────
 const selectedEntity = selectedId
 ? visibleEntities.find((e) => e.id === selectedId) ?? null
 : null;

 // ── Submit on Enter ──────────────────────────────────────────────────────────
 const handleScanIdKey = useCallback(
 (e: React.KeyboardEvent) => {
 if (e.key ==='Enter') handleLoadGraph();
 },
 [handleLoadGraph]
 );

 return (
 <div className="flex flex-col h-screen bg-void text-text overflow-hidden">
 {/* ── Top bar ───────────────────────────────────────────────────────────── */}
 <header className="flex flex-wrap items-center gap-3 px-4 py-3 bg-void border-b border-border shrink-0">
 <div className="flex items-center gap-2">
 <Network className="w-5 h-5 text-cyan" />
 <h1 className="text-base font-semibold">Knowledge Graph</h1>
 </div>

 {!mergeMode && (
  <div className="flex items-center gap-2 flex-1 max-w-xl">
   <div className="flex-1 min-w-0">
    <Input
    type="text"
    placeholder="Scan ID (UUID)…"
    value={scanId}
    onChange={(e) => setScanId(e.target.value)}
    onKeyDown={handleScanIdKey}
    aria-label="Scan ID"
    />
   </div>
   <Button
  variant="primary"
  size="sm"
  loading={isLoading}
  leftIcon={isLoading ? undefined : <RefreshCw className="w-3.5 h-3.5" />}
  disabled={!scanId.trim()}
  onClick={handleLoadGraph}
  >
  Load
  </Button>
 </div>
 )}

 {mergeMode && hasGraph && (
 <div className="flex items-center gap-3 text-xs text-text-dim flex-1">
 <span className="text-fuchsia font-medium">
 {mergedScanIds.length} scans merged
 </span>
 {overlapCount !== null && overlapCount > 0 && (
 <span className="px-2 py-0.5 bg-fuchsia/10 text-fuchsia border border-fuchsia/20">
 {overlapCount} overlapping {overlapCount === 1 ?'entity' :'entities'}
 </span>
 )}
 </div>
 )}

 <div className="flex items-center gap-2 ml-auto">
  <Button
  variant={mergeMode ? "primary" : "secondary"}
  size="sm"
  leftIcon={<GitMerge className="w-3.5 h-3.5" />}
  onClick={handleToggleMergeMode}
  >
  {mergeMode ? 'Single Scan' : 'Merge Scans'}
  </Button>

 {hasGraph && (
 <div className="hidden lg:flex items-center gap-4 text-xs text-text-dim">
 <span>
 <span className="text-text-mute">{entities.length}</span> entities
 </span>
 <span>
 <span className="text-text-mute">{relationships.length}</span> relationships
 </span>
 {hiddenIds.size > 0 && (
  <Button
  variant="link"
  size="sm"
  onClick={() => setHiddenIds(new Set())}
  >
  Show {hiddenIds.size} hidden
  </Button>
 )}
 </div>
 )}
 </div>
 </header>

 {/* ── Loading overlay ────────────────────────────────────────────────────── */}
 {isLoading && (
 <div className="flex-1 flex flex-col gap-3 p-6 overflow-hidden">
 <div className="flex gap-4 mb-2">
 <Skeleton className="h-8 w-32 bg-surface" />
 <Skeleton className="h-8 w-48 bg-surface" />
 <Skeleton className="h-8 w-24 ml-auto bg-surface" />
 </div>
 <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-3">
 {(['n1','n2','n3','n4','n5','n6','n7','n8','n9'] as const).map((k) => (
 <Skeleton key={k} className="rounded-full bg-surface" />
 ))}
 </div>
 <div className="flex items-center justify-center gap-2 mt-2">
 <Loader2 className="w-4 h-4 animate-spin text-cyan" />
 <span className="text-sm text-text-dim">Loading knowledge graph…</span>
 </div>
 </div>
 )}

 {/* ── Error state ───────────────────────────────────────────────────────── */}
 {!isLoading && loadError && (
 <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-mute">
 <AlertCircle className="w-10 h-10 text-neon-r" />
 <p className="text-sm">{loadError}</p>
  <Button
  variant="secondary"
  size="sm"
  onClick={handleLoadGraph}
  >
  Try again
  </Button>
 </div>
 )}

 {/* ── Merge panel (shown when merge mode active and no graph yet) ─────── */}
 {mergeMode && !hasGraph && !isLoading && (
 <div className="flex flex-col flex-1 min-h-0">
 <GraphMergePanel
 onMergeComplete={handleMergeComplete}
 isMerging={isMerging}
 onMergingChange={setIsMerging}
 />
 {!isMerging && (
 <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-dim select-none">
 <GitMerge className="w-16 h-16 opacity-20" />
 <p className="text-sm text-text-dim">Select scans above and merge to visualise a unified graph</p>
 </div>
 )}
 {isMerging && (
 <div className="flex-1 flex items-center justify-center gap-2">
 <Loader2 className="w-4 h-4 animate-spin text-fuchsia" />
 <span className="text-sm text-text-dim">Merging knowledge graphs…</span>
 </div>
 )}
 </div>
 )}

 {/* ── Empty / welcome state (single-scan mode) ─────────────────────────── */}
 {!mergeMode && !isLoading && !loadError && !hasGraph && (
 <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-dim select-none">
 <Network className="w-20 h-20 opacity-20" />
 <div className="text-center space-y-1">
 <p className="text-base text-text-dim">Enter a scan ID to visualise the knowledge graph</p>
 <p className="text-sm">Run an OSINT scan first to generate entity relationships</p>
 </div>
 </div>
 )}

 {/* ── Graph workspace ───────────────────────────────────────────────────── */}
 {!isLoading && !loadError && hasGraph && (
 <div className="flex flex-col flex-1 min-h-0">
 {/* Controls bar */}
 <GraphControls
 searchQuery={searchQuery}
 zoom={zoom}
 visibleTypes={visibleTypes}
 onSearchChange={setSearchQuery}
 onZoomIn={handleZoomIn}
 onZoomOut={handleZoomOut}
 onResetView={handleResetView}
 onToggleType={handleToggleType}
 onToggleAllTypes={handleToggleAllTypes}
 />

 {/* Main content: canvas + detail panel */}
  <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
  <GraphCanvas
 entities={visibleEntities}
 relationships={relationships}
 selectedId={selectedId}
 visibleTypes={visibleTypes}
 searchQuery={searchQuery}
 zoom={zoom}
 onSelectEntity={setSelectedId}
 onDoubleClickEntity={handleExpand}
 onZoomChange={setZoom}
 />

 {/* Detail panel — shown when a node is selected */}
 {selectedEntity && (
 <EntityDetailPanel
 entity={selectedEntity}
 allEntities={visibleEntities}
 relationships={relationships}
 isExpanding={isExpanding}
 onClose={() => setSelectedId(null)}
 onExpand={handleExpand}
 onHide={handleHide}
 onSelectEntity={(id) => {
 setSelectedId(id);
 }}
 />
 )}
 </div>

 {/* Legend */}
 <GraphLegend entityCounts={entityCounts} />
 </div>
 )}
 </div>
 );
}
