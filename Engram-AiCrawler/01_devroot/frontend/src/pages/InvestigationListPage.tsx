import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Archive, Search, AlertCircle, FolderX, Loader2 } from 'lucide-react';
import { useInvestigationStore } from'../stores/investigationStore';
import { Badge, Button, Card, Input } from '../components/ui';
import type { Investigation } from'../stores/investigationStore';


import { SkeletonTable } from'../components/SkeletonTable';
import CreateInvestigationDialog from'../components/investigations/CreateInvestigationDialog';



function formatDate(iso: string) {
 return new Date(iso).toLocaleDateString('en-US', {
 year:'numeric',
 month:'short',
 day:'numeric',
 });
}

export default function InvestigationListPage() {
 const navigate = useNavigate();
 const {
 investigations,
 loading,
 error,
 fetchInvestigations,
 archiveInvestigation,
 setActiveInvestigation,
 clearError,
 } = useInvestigationStore();

 const [dialogOpen, setDialogOpen] = useState(false);
 const [search, setSearch] = useState('');
 const [archivingId, setArchivingId] = useState<string | null>(null);

 useEffect(() => {
 fetchInvestigations();
 }, [fetchInvestigations]);

 const filtered = investigations.filter((inv) =>
 inv.name.toLowerCase().includes(search.toLowerCase())
 );

 const handleOpen = (inv: Investigation) => {
 setActiveInvestigation(inv);
 navigate(`/investigations/${inv.id}`);
 };

 const handleArchive = async (inv: Investigation) => {
 setArchivingId(inv.id);
 try {
 await archiveInvestigation(inv.id);
 } finally {
 setArchivingId(null);
 }
 };

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
 <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
 <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              Investigations
              {loading && investigations.length > 0 && (
                <Loader2 size={18} className="animate-spin text-cyan" aria-label="Refreshing" />
              )}
            </h1>
 <p className="mt-1 text-sm text-text-dim">
 Manage and track your OSINT investigation cases
 </p>
 </div>
  <Button
  variant="primary"
  onClick={() => setDialogOpen(true)}
  leftIcon={<Plus size={16} />}
  >
  New Investigation
  </Button>
 </div>

  <div className="mb-4">
   <Input
   type="text"
   placeholder="Search investigations..."
   value={search}
   onChange={(e) => setSearch(e.target.value)}
   leftIcon={<Search size={16} />}
   aria-label="Search investigations"
   />
  </div>

 {error && (
  <div role="alert" className="mb-4 flex items-start gap-2 px-4 py-3 bg-neon-r/10 border border-neon-r/30 text-sm text-neon-r">
 <AlertCircle size={16} className="shrink-0 mt-0.5" />
 <span>{error}</span>
  <Button
  variant="ghost"
  size="sm"
  onClick={clearError}
  className="ml-auto text-neon-r hover:text-neon-r"
  >
  Dismiss
  </Button>
 </div>
 )}

 {loading && investigations.length === 0 ? (
  <Card>
  <SkeletonTable rows={5} columns={5} />
  </Card>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <FolderX size={48} className="text-text-mute mb-4" />
 {investigations.length === 0 ? (
 <>
  <p className="text-lg font-semibold text-text mb-1">
  No investigations yet
  </p>
 <p className="text-sm text-text-dim mb-4 max-w-xs">
 Start tracking your first OSINT case by creating an investigation.
 </p>
  <Button
  variant="primary"
  onClick={() => setDialogOpen(true)}
  leftIcon={<Plus size={16} />}
  >
  Create your first investigation
  </Button>
 </>
 ) : (
 <>
  <p className="text-lg font-semibold text-text mb-1">
  No results for &ldquo;{search}&rdquo;
  </p>
 <p className="text-sm text-text-dim">Try a different search term.</p>
 </>
 )}
 </div>
 ) : (
  <Card>
  <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border bg-void">
 <th className="px-4 py-3 text-left text-xs font-semibold text-text-dim uppercase tracking-wider">
 Name
 </th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-text-dim uppercase tracking-wider">
 Status
 </th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-text-dim uppercase tracking-wider">
 Crawls
 </th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-text-dim uppercase tracking-wider">
 Created
 </th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-text-dim uppercase tracking-wider">
 Actions
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {filtered.map((inv) => (
 <tr
 key={inv.id}
 className="hover:bg-void transition-colors"
 >
 <td className="px-4 py-3">
 <div className="font-medium text-text">{inv.name}</div>
 {inv.description && (
 <div className="text-xs text-text-dim truncate max-w-xs">
 {inv.description}
 </div>
 )}
 {inv.tags.length > 0 && (
 <div className="mt-1 flex gap-1 flex-wrap">
 {inv.tags.slice(0, 3).map((tag) => (
 <span
 key={tag}
 className="px-1.5 py-0.5 text-xs bg-cyan/10 text-cyan"
 >
 {tag}
 </span>
 ))}
 {inv.tags.length > 3 && (
 <span className="px-1.5 py-0.5 text-xs text-text-mute">
 +{inv.tags.length - 3}
 </span>
 )}
 </div>
 )}
 </td>
 <td className="px-4 py-3">
          <Badge variant={inv.status === 'active' ? 'success' : 'ghost'} dot>
            {inv.status === 'active' ? 'Active' : 'Archived'}
          </Badge>
 </td>
 <td className="px-4 py-3 text-text-dim">
 {inv.associated_crawl_ids.length}
 </td>
 <td className="px-4 py-3 text-text-dim whitespace-nowrap">
 {formatDate(inv.created_at)}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-end gap-2">
  <Button
  variant="ghost"
  size="sm"
  onClick={() => handleOpen(inv)}
  leftIcon={<FolderOpen size={13} />}
  className="text-cyan border border-cyan/30 hover:bg-cyan/10"
  >
  Open
  </Button>
  {inv.status ==='active' && (
  <Button
  variant="secondary"
  size="sm"
  loading={archivingId === inv.id}
  onClick={() => handleArchive(inv)}
  leftIcon={<Archive size={13} />}
  >
  Archive
  </Button>
  )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
  </div>
  </Card>
  )}

  <CreateInvestigationDialog
 open={dialogOpen}
 onClose={() => setDialogOpen(false)}
 onCreated={(id) => navigate(`/investigations/${id}`)}
 />
 </div>
 );
}
