import { useState } from 'react';
import { useNavigate } from'react-router-dom';
import { Eye, RefreshCw, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { CrawlHistoryEntry } from '../../pages/CrawlHistoryPage';
import { Badge } from '../ui';

type SortField ='url' |'extraction_type' |'status' |'created_at' |'duration';
type SortDirection ='asc' |'desc';

interface CrawlHistoryTableProps {
 entries: CrawlHistoryEntry[];
 selectedIds: Set<string>;
 onSelectionChange: (ids: Set<string>) => void;
 onDelete: (id: string) => void;
 onRerun: (id: string) => void;
}



function formatDuration(createdAt: string, completedAt: string | null): string {
 if (!completedAt) return'—';
 const start = parseISO(createdAt).getTime();
 const end = parseISO(completedAt).getTime();
 const ms = end - start;
 if (ms < 1000) return `${ms}ms`;
 const seconds = ms / 1000;
 if (seconds < 60) return `${seconds.toFixed(1)}s`;
 const minutes = Math.floor(seconds / 60);
 const secs = Math.round(seconds % 60);
 return `${minutes}m ${secs}s`;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDirection }) {
 if (field !== sortField) return <ChevronsUpDown size={13} className="text-text-mute" />;
 return sortDir ==='asc' ? <ChevronUp size={13} className="text-cyan" /> : <ChevronDown size={13} className="text-cyan" />;
}

export default function CrawlHistoryTable({
 entries,
 selectedIds,
 onSelectionChange,
 onDelete,
 onRerun,
}: CrawlHistoryTableProps) {
 const navigate = useNavigate();
 const [sortField, setSortField] = useState<SortField>('created_at');
 const [sortDir, setSortDir] = useState<SortDirection>('desc');
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

 const handleSort = (field: SortField) => {
 if (field === sortField) {
 setSortDir((d) => (d ==='asc' ?'desc' :'asc'));
 } else {
 setSortField(field);
 setSortDir('asc');
 }
 };

 const sorted = [...entries].sort((a, b) => {
 let aVal: string | number ='';
 let bVal: string | number ='';

 switch (sortField) {
 case'url': aVal = a.url; bVal = b.url; break;
 case'extraction_type': aVal = a.extraction_type; bVal = b.extraction_type; break;
 case'status': aVal = a.status; bVal = b.status; break;
 case'created_at': aVal = a.created_at; bVal = b.created_at; break;
 case'duration': {
 const getDur = (e: CrawlHistoryEntry) =>
 e.completed_at ? parseISO(e.completed_at).getTime() - parseISO(e.created_at).getTime() : -1;
 aVal = getDur(a);
 bVal = getDur(b);
 break;
 }
 }

 if (aVal < bVal) return sortDir ==='asc' ? -1 : 1;
 if (aVal > bVal) return sortDir ==='asc' ? 1 : -1;
 return 0;
 });

 const allSelected = sorted.length > 0 && sorted.every((e) => selectedIds.has(e.id));
 const someSelected = sorted.some((e) => selectedIds.has(e.id)) && !allSelected;

 const toggleAll = () => {
 if (allSelected) {
 const next = new Set(selectedIds);
 sorted.forEach((e) => next.delete(e.id));
 onSelectionChange(next);
 } else {
 const next = new Set(selectedIds);
 sorted.forEach((e) => next.add(e.id));
 onSelectionChange(next);
 }
 };

 const toggleRow = (id: string) => {
 const next = new Set(selectedIds);
 if (next.has(id)) {
 next.delete(id);
 } else {
 next.add(id);
 }
 onSelectionChange(next);
 };

 const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
 <th
 onClick={() => handleSort(field)}
  className="px-4 py-3 text-left text-xs font-medium text-text-mute uppercase tracking-wider cursor-pointer select-none hover:text-text transition-colors"
 >
 <div className="flex items-center gap-1.5">
 {label}
 <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
 </div>
 </th>
 );

 if (sorted.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="w-16 h-16 bg-abyss rounded-full flex items-center justify-center mb-4">
 <RefreshCw size={24} className="text-text-mute" />
 </div>
 <p className="text-text-dim font-medium">No crawls found</p>
 <p className="text-text-mute text-sm mt-1">
 No crawls yet. Start your first crawl!
 </p>
 </div>
 );
 }

 return (
 <>
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-border">
 <thead className="bg-void">
 <tr>
 <th className="px-4 py-3 w-10">
 <input
 type="checkbox"
 checked={allSelected}
 ref={(el) => { if (el) el.indeterminate = someSelected; }}
 onChange={toggleAll}
 className="border-border text-cyan focus:ring-cyan"
 />
 </th>
 <SortHeader field="url" label="URL" />
 <SortHeader field="extraction_type" label="Strategy" />
 <SortHeader field="status" label="Status" />
 <SortHeader field="created_at" label="Date" />
 <SortHeader field="duration" label="Duration" />
  <th className="px-4 py-3 text-right text-xs font-medium text-text-mute uppercase tracking-wider">
 Actions
 </th>
 </tr>
 </thead>
  <tbody className="bg-surface divide-y divide-border">
 {sorted.map((entry) => (
 <tr
 key={entry.id}
  className={`hover:bg-raised transition-colors ${
 selectedIds.has(entry.id) ?'bg-cyan/10' :''
 }`}
 >
 <td className="px-4 py-3">
 <input
 type="checkbox"
 checked={selectedIds.has(entry.id)}
 onChange={() => toggleRow(entry.id)}
 className="border-border text-cyan focus:ring-cyan"
 />
 </td>
 <td className="px-4 py-3">
 <a
 href={entry.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-sm text-cyan hover:underline truncate max-w-xs block"
 title={entry.url}
 >
 {entry.url.length > 60 ? `${entry.url.slice(0, 57)}...`: entry.url}
 </a>
 </td>
 <td className="px-4 py-3">
 <span className="text-sm text-text capitalize">
 {entry.extraction_type}
 </span>
 </td>
 <td className="px-4 py-3">
          <Badge
            variant={
              entry.status === 'completed' ? 'success' :
              entry.status === 'failed' ? 'danger' :
              entry.status === 'running' ? 'cyan' :
              entry.status === 'cancelled' ? 'volt' :
              'default'
            }
            dot
          >
            {entry.status}
          </Badge>
 </td>
 <td className="px-4 py-3">
 <span
 className="text-sm text-text-dim"
 title={entry.created_at}
 >
 {formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true })}
 </span>
 </td>
 <td className="px-4 py-3">
 <span className="text-sm text-text-dim font-mono">
 {formatDuration(entry.created_at, entry.completed_at ?? null)}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-end gap-1">
 <button
 type="button"
 onClick={() => navigate(`/crawl/${entry.id}/results`)}
 className="p-1.5 text-text-dim hover:text-cyan hover:bg-raised transition-colors"
 title="View Results"
 >
 <Eye size={16} />
 </button>
 <button
 type="button"
 onClick={() => onRerun(entry.id)}
 className="p-1.5 text-text-dim hover:text-plasma hover:bg-raised transition-colors"
 title="Re-run"
 >
 <RefreshCw size={16} />
 </button>
 <button
 type="button"
 onClick={() => setConfirmDeleteId(entry.id)}
 className="p-1.5 text-text-dim hover:text-neon-r hover:bg-raised transition-colors"
 title="Delete"
 >
 <Trash2 size={16} />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {confirmDeleteId && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
 <div className="bg-surface p-6 max-w-sm w-full mx-4">
 <h3 className="text-lg font-semibold text-text mb-2">
 Delete Crawl
 </h3>
 <p className="text-sm text-text-dim mb-6">
 Are you sure you want to delete this crawl? This action cannot be undone.
 </p>
 <div className="flex gap-3 justify-end">
 <button
 type="button"
 onClick={() => setConfirmDeleteId(null)}
 className="px-4 py-2 text-sm text-text bg-abyss hover:bg-border transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={() => {
 onDelete(confirmDeleteId);
 setConfirmDeleteId(null);
 }}
  className="px-4 py-2 text-sm text-void bg-neon-r hover:bg-neon-r transition-colors"
 >
 Delete
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
}
