import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Trash2, RefreshCw, Download, X, PlusCircle, History, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from'../components/Toast';
import { ConfirmDialog } from'../components/ConfirmDialog';
import CrawlHistoryTable from'../components/history/CrawlHistoryTable';
import { EmptyState } from'../components/EmptyState';
import { SkeletonTable } from'../components/SkeletonTable';
import { Button, Card, Input } from '../components/ui';

export interface CrawlHistoryEntry {
 id: string;
 url: string;
 extraction_type: string;
 status:'pending' |'running' |'completed' |'failed' |'cancelled';
 created_at: string;
 completed_at?: string;
}

type StatusFilter ='all' |'completed' |'failed' |'running' |'pending';
type DatePreset ='all' |'today' |'week' |'month';

const PAGE_SIZE = 20;

function useDebounce<T>(value: T, delay: number): T {
 const [debounced, setDebounced] = useState(value);
 useEffect(() => {
 const timer = setTimeout(() => setDebounced(value), delay);
 return () => clearTimeout(timer);
 }, [value, delay]);
 return debounced;
}

function isWithinDatePreset(dateStr: string, preset: DatePreset): boolean {
 if (preset ==='all') return true;
 const date = new Date(dateStr);
 const now = new Date();
 if (preset ==='today') {
 return date.toDateString() === now.toDateString();
 }
 if (preset ==='week') {
 const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
 return date >= weekAgo;
 }
 if (preset ==='month') {
 const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
 return date >= monthAgo;
 }
 return true;
}

export default function CrawlHistoryPage() {
 const navigate = useNavigate();
 const toast = useToast();

 const [allEntries, setAllEntries] = useState<CrawlHistoryEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchRaw, setSearchRaw] = useState('');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [datePreset, setDatePreset] = useState<DatePreset>('all');
 const [currentPage, setCurrentPage] = useState(1);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
 const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
 const [isSingleDeleting, setIsSingleDeleting] = useState(false);

 const searchTerm = useDebounce(searchRaw, 300);

 const fetchHistory = useCallback(async () => {
 try {
 setLoading(true);
    const { data } = await api.get<CrawlHistoryEntry[]>('/crawl/list');
 setAllEntries(Array.isArray(data) ? data : []);
 } catch {
 toast.error('Failed to load crawl history');
 setAllEntries([]);
 } finally {
 setLoading(false);
 }
 }, [toast]);

 useEffect(() => {
 fetchHistory();
 }, [fetchHistory]);

 const prevFiltersRef = useRef({ searchTerm, statusFilter, datePreset });
 if (prevFiltersRef.current.searchTerm !== searchTerm ||
 prevFiltersRef.current.statusFilter !== statusFilter ||
 prevFiltersRef.current.datePreset !== datePreset) {
 prevFiltersRef.current = { searchTerm, statusFilter, datePreset };
 setCurrentPage(1);
 setSelectedIds(new Set());
 }

 const filtered = useMemo(() => {
 return allEntries.filter((entry) => {
 if (searchTerm && !entry.url.toLowerCase().includes(searchTerm.toLowerCase())) return false;
 if (statusFilter !=='all' && entry.status !== statusFilter) return false;
 if (!isWithinDatePreset(entry.created_at, datePreset)) return false;
 return true;
 });
 }, [allEntries, searchTerm, statusFilter, datePreset]);

 const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
 const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

 const handleDelete = (id: string) => setSingleDeleteId(id);

 const executeSingleDelete = async () => {
 if (!singleDeleteId) return;
 setIsSingleDeleting(true);
 try {
      await api.delete(`/crawl/${singleDeleteId}`);
 setAllEntries((prev) => prev.filter((e) => e.id !== singleDeleteId));
 setSelectedIds((prev) => {
 const next = new Set(prev);
 next.delete(singleDeleteId);
 return next;
 });
 toast.success('Crawl deleted');
 } catch {
 toast.error('Failed to delete crawl');
 } finally {
 setIsSingleDeleting(false);
 setSingleDeleteId(null);
 }
 };

 const handleRerun = (id: string) => {
 navigate(`/crawl/new?rerun=${id}`);
 };

 const handleBulkDelete = async () => {
 const ids = Array.from(selectedIds);
 try {
      await Promise.all(ids.map((id) => api.delete(`/crawl/${id}`)));
 setAllEntries((prev) => prev.filter((e) => !selectedIds.has(e.id)));
 setSelectedIds(new Set());
 toast.success(`Deleted ${ids.length} crawl${ids.length !== 1 ?'s' :''}`);
 } catch {
 toast.error('Some deletions failed');
 } finally {
 setBulkDeleteConfirm(false);
 }
 };

 const handleBulkRerun = () => {
 Array.from(selectedIds).forEach((id) => {
 navigate(`/crawl/new?rerun=${id}`);
 });
 toast.success(`Re-running ${selectedIds.size} crawl${selectedIds.size !== 1 ?'s' :''}`);
 setSelectedIds(new Set());
 };

 const handleBulkExport = () => {
 const toExport = allEntries.filter((e) => selectedIds.has(e.id));
 const blob = new Blob([JSON.stringify(toExport, null, 2)], { type:'application/json' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `crawl-history-export-${Date.now()}.json`;
 link.click();
 URL.revokeObjectURL(url);
 toast.success(`Exported ${selectedIds.size} crawls`);
 };



  return (
  <ErrorBoundary fallback={<div className="p-8 text-neon-r text-center">Failed to load crawl history</div>}>
  <div className="min-h-screen bg-void py-6 px-4 sm:px-6 lg:px-8">
 <div className="max-w-7xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-text">Crawl History</h1>
 <p className="text-sm text-text-dim mt-1">
 {allEntries.length} total crawl{allEntries.length !== 1 ?'s' :''}
 </p>
 </div>
  <Button
  variant="primary"
  onClick={() => navigate('/crawl/new')}
  leftIcon={<PlusCircle size={16} />}
  >
  New Crawl
  </Button>
 </div>

 <div className="space-y-3 mb-4">
   <div className="flex flex-col sm:flex-row gap-3">
     <div className="flex-1">
     <Input
     type="text"
     placeholder="Search by URL..."
     value={searchRaw}
     onChange={(e) => setSearchRaw(e.target.value)}
     leftIcon={<Search size={15} />}
     aria-label="Search crawl history by URL"
     />
     </div>

     <select
     value={datePreset}
     onChange={(e) => setDatePreset(e.target.value as DatePreset)}
     aria-label="Filter by date range"
     className="px-3 py-2.5 text-sm bg-surface border border-border text-text focus:outline-none focus:ring-2 focus:ring-cyan appearance-none cursor-pointer"
     >
       <option value="all">All Time</option>
       <option value="today">Today</option>
       <option value="week">This Week</option>
       <option value="month">This Month</option>
     </select>
   </div>

   <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
     {(['all', 'completed', 'running', 'failed', 'pending'] as StatusFilter[]).map((s) => {
       const chipStyles: Record<StatusFilter, string> = {
         all:       'border-border text-text-dim hover:border-border-hi',
         completed: 'border-plasma/40 text-plasma hover:border-plasma/70',
         running:   'border-cyan/40 text-cyan hover:border-cyan/70',
         failed:    'border-neon-r/40 text-neon-r hover:border-neon-r/70',
         pending:   'border-text-mute/40 text-text-mute hover:border-text-mute/70',
       };
       const activeStyles: Record<StatusFilter, string> = {
         all:       'bg-raised border-border-hi text-text',
         completed: 'bg-plasma/10 border-plasma/60 text-plasma',
         running:   'bg-cyan/10 border-cyan/60 text-cyan',
         failed:    'bg-neon-r/10 border-neon-r/60 text-neon-r',
         pending:   'bg-abyss/50 border-text-mute/60 text-text-mute',
       };
       const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
       const count = s === 'all' ? allEntries.length : allEntries.filter((e) => e.status === s).length;
       return (
         <button
           key={s}
           type="button"
           onClick={() => setStatusFilter(s)}
           aria-pressed={statusFilter === s}
           className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition-colors ${ statusFilter === s ? activeStyles[s] : chipStyles[s] }`}
         >
           {label}
           <span className="text-[10px] opacity-70">{count}</span>
         </button>
       );
     })}
   </div>
 </div>

 {selectedIds.size > 0 && (
 <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-cyan/10 border border-cyan/30">
 <span className="text-sm font-medium text-cyan">
 {selectedIds.size} selected
 </span>
 <div className="flex gap-2 ml-auto">
  <Button
  variant="secondary"
  size="sm"
  onClick={handleBulkExport}
  leftIcon={<Download size={13} />}
  >
  Export
  </Button>
  <Button
  variant="secondary"
  size="sm"
  onClick={handleBulkRerun}
  leftIcon={<RefreshCw size={13} />}
  >
  Re-run All
  </Button>
  <Button
  variant="danger"
  size="sm"
  onClick={() => setBulkDeleteConfirm(true)}
  leftIcon={<Trash2 size={13} />}
  >
  Delete
  </Button>
   <Button
   variant="ghost"
   size="sm"
   onClick={() => setSelectedIds(new Set())}
   aria-label="Clear selection"
   leftIcon={<X size={14} />}
   />
 </div>
 </div>
 )}

  <Card>
  {loading ? (
  <SkeletonTable rows={8} columns={5} />
 ) : filtered.length === 0 ? (
 allEntries.length === 0 ? (
 <EmptyState
 icon={<History size={48} />}
 title="No crawl history yet"
 description="Start your first crawl to see results here."
 action={{ label:'New Crawl', onClick: () => navigate('/crawl/new'), icon: <PlusCircle size={15} /> }}
 />
 ) : (
 <EmptyState
 icon={<SearchX size={48} />}
 title="No matching crawls"
 description="Try adjusting your search or filter settings."
 action={{ label:'Clear filters', onClick: () => { setSearchRaw(''); setStatusFilter('all'); setDatePreset('all'); } }}
 />
 )
 ) : (
 <CrawlHistoryTable
 entries={paginated}
 selectedIds={selectedIds}
 onSelectionChange={setSelectedIds}
 onDelete={handleDelete}
 onRerun={handleRerun}
 />
  )}
  </Card>

  {!loading && filtered.length > 0 && (
 <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
 <p className="text-sm text-text-dim">
 Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
 {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} results
 </p>
 <div className="flex items-center gap-2">
  <button
  type="button"
  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
  disabled={currentPage === 1}
  aria-label="Previous page"
  className="p-2 bg-surface border border-border text-text-dim hover:bg-void disabled:opacity-40 transition-colors"
  >
  <ChevronLeft size={16} aria-hidden="true" />
  </button>
 <div className="flex gap-1">
 {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
 let page: number;
 if (totalPages <= 7) {
 page = i + 1;
 } else if (currentPage <= 4) {
 page = i + 1;
 } else if (currentPage >= totalPages - 3) {
 page = totalPages - 6 + i;
 } else {
 page = currentPage - 3 + i;
 }
  return (
  <button
  key={page}
  type="button"
  onClick={() => setCurrentPage(page)}
  aria-label={`Page ${page}`}
  aria-current={page === currentPage ? 'page' : undefined}
  className={`w-9 h-9 text-sm transition-colors ${
  page === currentPage
  ?'bg-cyan text-text'
  :'bg-surface border border-border text-text-dim hover:bg-void'
  }`}
  >
  {page}
  </button>
  );
 })}
 </div>
  <button
  type="button"
  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
  disabled={currentPage === totalPages}
  aria-label="Next page"
  className="p-2 bg-surface border border-border text-text-dim hover:bg-void disabled:opacity-40 transition-colors"
  >
  <ChevronRight size={16} aria-hidden="true" />
  </button>
 </div>
 </div>
 )}
 </div>

 <ConfirmDialog
 open={singleDeleteId !== null}
 title="Delete Crawl"
 message="Delete this crawl record? This cannot be undone."
 confirmLabel="Delete"
 variant="danger"
 loading={isSingleDeleting}
 onConfirm={executeSingleDelete}
 onCancel={() => setSingleDeleteId(null)}
 />

 <ConfirmDialog
 open={bulkDeleteConfirm}
 title={`Delete ${selectedIds.size} Crawl${selectedIds.size !== 1 ?'s' :''}`}
 message={`Are you sure you want to delete ${selectedIds.size} crawl${selectedIds.size !== 1 ?'s' :''}? This cannot be undone.`}
 confirmLabel="Delete All"
 variant="danger"
 onConfirm={handleBulkDelete}
 onCancel={() => setBulkDeleteConfirm(false)}
 />
  </div>
  </ErrorBoundary>
  );
}
