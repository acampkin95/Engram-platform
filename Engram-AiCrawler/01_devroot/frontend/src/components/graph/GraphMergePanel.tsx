import { useState, useEffect, useCallback } from'react';
import { Loader2, GitMerge, CheckSquare, Square, AlertCircle, Layers } from'lucide-react';
import { api } from'../../lib/api';
import type { GraphEntity, GraphRelationship } from'./GraphCanvas';

interface ScanEntry {
 scan_id: string;
 username: string;
 stage: string;
 started_at: string;
 completed_at: string;
}

interface MergeResult {
 scan_ids: string[];
 entities: GraphEntity[];
 relationships: GraphRelationship[];
 entity_count: number;
 relationship_count: number;
 overlap_count: number;
}

interface GraphMergePanelProps {
 onMergeComplete: (entities: GraphEntity[], relationships: GraphRelationship[], overlapCount: number, scanIds: string[]) => void;
 isMerging: boolean;
 onMergingChange: (merging: boolean) => void;
}

export default function GraphMergePanel({
 onMergeComplete,
 isMerging,
 onMergingChange,
}: GraphMergePanelProps) {
 const [scans, setScans] = useState<ScanEntry[]>([]);
 const [isLoadingScans, setIsLoadingScans] = useState(false);
 const [loadError, setLoadError] = useState<string | null>(null);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

 const fetchScans = useCallback(async () => {
 setIsLoadingScans(true);
 setLoadError(null);
 try {
 const res = await api.get<{ scans: ScanEntry[]; count: number }>('/osint/scan/list');
 setScans(res.data.scans);
 } catch {
 setLoadError('Failed to load scan list');
 } finally {
 setIsLoadingScans(false);
 }
 }, []);

 useEffect(() => {
 fetchScans();
 }, [fetchScans]);

 const toggleScan = useCallback((scanId: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(scanId)) next.delete(scanId);
 else next.add(scanId);
 return next;
 });
 }, []);

 const toggleAll = useCallback(() => {
 setSelectedIds((prev) => {
 if (prev.size === scans.length) return new Set();
 return new Set(scans.map((s) => s.scan_id));
 });
 }, [scans]);

 const handleMerge = useCallback(async () => {
 if (selectedIds.size < 2) return;
 onMergingChange(true);
 try {
 const res = await api.post<MergeResult>('/knowledge-graph/merge-scans', {
 scan_ids: Array.from(selectedIds),
 });
 const { entities, relationships, overlap_count, scan_ids } = res.data;
 onMergeComplete(entities, relationships, overlap_count, scan_ids);
 } catch {
 onMergingChange(false);
 }
 }, [selectedIds, onMergeComplete, onMergingChange]);

 const canMerge = selectedIds.size >= 2 && !isMerging;

 return (
 <div className="flex flex-col gap-3 p-4 bg-void border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Layers className="w-4 h-4 text-fuchsia" />
 <span className="text-sm font-medium text-text">Select scans to merge</span>
 </div>
 <button
 type="button"
 onClick={toggleAll}
 className="text-xs text-text-dim hover:text-text-mute transition-colors"
 >
 {selectedIds.size === scans.length ?'Deselect all' :'Select all'}
 </button>
 </div>

 {isLoadingScans && (
 <div className="flex items-center gap-2 py-4 justify-center">
 <Loader2 className="w-4 h-4 animate-spin text-text-dim" />
 <span className="text-sm text-text-dim">Loading scans…</span>
 </div>
 )}

 {loadError && (
 <div className="flex items-center gap-2 py-2 text-neon-r">
 <AlertCircle className="w-4 h-4" />
 <span className="text-sm">{loadError}</span>
 <button
 type="button"
 onClick={fetchScans}
 className="ml-auto text-xs text-text-dim hover:text-text-mute transition-colors"
 >
 Retry
 </button>
 </div>
 )}

 {!isLoadingScans && !loadError && scans.length === 0 && (
 <p className="text-sm text-text-dim py-2">No scans found — run an OSINT scan first</p>
 )}

 {!isLoadingScans && !loadError && scans.length > 0 && (
 <div className="flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
 {scans.map((scan) => {
 const checked = selectedIds.has(scan.scan_id);
 return (
 <button
 key={scan.scan_id}
 type="button"
 onClick={() => toggleScan(scan.scan_id)}
 className={`flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
 checked
 ?'bg-fuchsia/10 border border-fuchsia/30'
 :'bg-surface/50 border border-transparent hover:bg-surface'
 }`}
 >
 {checked ? (
 <CheckSquare className="w-4 h-4 text-fuchsia shrink-0" />
 ) : (
 <Square className="w-4 h-4 text-text-dim shrink-0" />
 )}
 <div className="flex flex-col min-w-0 flex-1">
 <span className="text-sm text-text truncate font-mono">
 {scan.username}
 </span>
 <span className="text-xs text-text-dim truncate">
 {scan.scan_id.slice(0, 8)}… · {scan.stage}
 </span>
 </div>
 <span className="text-xs text-text-dim shrink-0">
 {new Date(scan.completed_at).toLocaleDateString()}
 </span>
 </button>
 );
 })}
 </div>
 )}

 <button
 type="button"
 onClick={handleMerge}
 disabled={!canMerge}
 className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-fuchsia hover:bg-fuchsia/80 disabled:bg-surface disabled:text-text-dim disabled:cursor-not-allowed transition-colors"
 >
 {isMerging ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <GitMerge className="w-4 h-4" />
 )}
 {isMerging ?'Merging…' : `Merge ${selectedIds.size} scans`}
 </button>

 {selectedIds.size === 1 && (
 <p className="text-xs text-volt/80">Select at least 2 scans to merge</p>
 )}
 </div>
 );
}
