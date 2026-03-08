import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Database, Trash2, Download, Search, Calendar, Archive, HardDrive, RefreshCw, BarChart2, Server, Filter, FolderOpen, Layers, Shield } from'lucide-react';
import { Button, Card, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { api } from'../lib/api';
import { useToast } from'../components/Toast';
import { ConfirmDialog } from'../components/ConfirmDialog';
import { SkeletonCard } from'../components/SkeletonCard';
import { EmptyState } from'../components/EmptyState';
import { TierMigrationPanel } from'../components/data/TierMigrationPanel';
import { AutoArchiveRules } from'../components/data/AutoArchiveRules';

interface DataSet {
 id: string;
 name: string;
 description: string;
 size: number;
 created_at: string;
 updated_at: string;
 storage_tier:'hot' |'warm' |'cold' |'archive';
 crawl_count: number;
 record_count: number;
}

interface StorageStats {
 hot: number;
 warm: number;
 cold: number;
 archive: number;
 total: number;
}

type TabId ='datasets' |'migration' |'archive-rules';

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
 { id:'datasets', label:'Datasets', icon: <Database className="w-4 h-4" /> },
 { id:'migration', label:'Tier Migration', icon: <Layers className="w-4 h-4" /> },
 { id:'archive-rules', label:'Archive Rules', icon: <Shield className="w-4 h-4" /> },
];

export default function DataManagement() {
 const toast = useToast();
 const [activeTab, setActiveTab] = useState<TabId>('datasets');
 const [dataSets, setDataSets] = useState<DataSet[]>([]);
 const [stats, setStats] = useState<StorageStats | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [filterTier, setFilterTier] = useState<string>('all');
 const [isLoading, setIsLoading] = useState(true);
 const [deleteTarget, setDeleteTarget] = useState<DataSet | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

 const fetchDataSets = useCallback(async () => {
 try {
 const response = await api.get('/data/sets');
 setDataSets(response.data || []);
 } catch {
 toast.error('Failed to load datasets');
 } finally {
 setIsLoading(false);
 }
 }, [toast]);

 const fetchStats = useCallback(async () => {
 try {
 const response = await api.get('/data/stats');
 setStats(response.data);
 } catch {
  if (import.meta.env.DEV) {
  console.warn('Failed to load storage statistics');
  }
  }
 }, []);

 useEffect(() => {
 fetchDataSets();
 fetchStats();
 }, [fetchDataSets, fetchStats]);

 const confirmDelete = (dataSet: DataSet) => setDeleteTarget(dataSet);

 const executeDelete = async () => {
 if (!deleteTarget) return;
 setIsDeleting(true);
 try {
 await api.delete(`/data/sets/${deleteTarget.id}`);
 setDataSets((prev) => prev.filter((ds) => ds.id !== deleteTarget.id));
 toast.success(`"${deleteTarget.name}" deleted`);
 fetchStats();
 } catch {
 toast.error('Failed to delete dataset');
 } finally {
 setIsDeleting(false);
 setDeleteTarget(null);
 }
 };

 const handleExport = async (id: string, format:'json' |'csv' |'tar.gz') => {
 try {
 const response = await api.get(`/data/sets/${id}/export?format=${format}`, {
 responseType:'blob',
 });
 const blob = new Blob([response.data]);
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `dataset-${id}.${format}`;
 a.click();
 URL.revokeObjectURL(url);
 toast.success('Export downloaded');
 } catch {
 toast.error('Export failed');
 }
 };

 const formatSize = (bytes: number) => {
 if (bytes === 0) return'0 B';
 const k = 1024;
 const sizes = ['B','KB','MB','GB','TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
 };

 const formatDate = (dateString: string) => {
 const d = new Date(dateString);
 return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(d);
 };

 const TierConfig: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
 hot: { color:'text-plasma', bg:'bg-plasma/10', icon: <Database className="w-3.5 h-3.5" /> },
 warm: { color:'text-volt', bg:'bg-volt/10', icon: <Server className="w-3.5 h-3.5" /> },
 cold: { color:'text-cyan', bg:'bg-cyan/10', icon: <HardDrive className="w-3.5 h-3.5" /> },
 archive: { color:'text-text-dim', bg:'bg-ghost/10', icon: <Archive className="w-3.5 h-3.5" /> },
 };

 const filteredDataSets = dataSets.filter(
 (ds) =>
 (filterTier ==='all' || ds.storage_tier === filterTier) &&
 (ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 ds.description.toLowerCase().includes(searchQuery.toLowerCase()))
 );

  return (
  <ErrorBoundary fallback={<div className="p-8 text-neon-r text-center">Failed to load data management</div>}>
 <div className="space-y-8 animate-slide-in">
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h1 className="text-2xl font-display font-bold text-text">Data Management</h1>
 <p className="text-sm text-text-dim mt-1">Manage collected datasets and storage tiers.</p>
 </div>
   <Button
   variant="secondary"
   onClick={() => {
   fetchDataSets();
   fetchStats();
   }}
   disabled={isLoading}
   leftIcon={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
   >
   Refresh Data
   </Button>
 </div>

  <div className="flex gap-1 bg-abyss p-1 overflow-x-auto max-w-full">
 {TABS.map((tab) => (
 <button
 key={tab.id}
 type="button"
 onClick={() => setActiveTab(tab.id)}
 className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
 activeTab === tab.id
 ?'bg-surface text-text'
 :'text-text-dim hover:text-text'
 }`}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>

 {activeTab ==='migration' && <TierMigrationPanel />}
 {activeTab ==='archive-rules' && <AutoArchiveRules />}

 {activeTab ==='datasets' && stats && (
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
 <div className="bg-gradient-to-br from-cyan to-cyan-dim p-5 text-text shadow-cyan/20">
 <p className="text-cyan text-sm font-medium mb-1 flex items-center gap-2"><HardDrive className="w-4 h-4" /> Total Storage</p>
 <p className="text-3xl font-display font-bold">{formatSize(stats.total)}</p>
 </div>
 <div className="bg-surface p-5 border border-border relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-16 h-16 bg-plasma/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150"></div>
 <p className="text-text-dim text-sm font-medium mb-1">Hot Tier</p>
 <p className="text-2xl font-display font-bold text-text">{formatSize(stats.hot)}</p>
 <div className="mt-2 text-xs text-plasma font-medium">Fastest Access</div>
 </div>
 <div className="bg-surface p-5 border border-border relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-16 h-16 bg-volt/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150"></div>
 <p className="text-text-dim text-sm font-medium mb-1">Warm Tier</p>
 <p className="text-2xl font-display font-bold text-text">{formatSize(stats.warm)}</p>
 <div className="mt-2 text-xs text-volt font-medium">Standard Access</div>
 </div>
 <div className="bg-surface p-5 border border-border relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-16 h-16 bg-cyan/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150"></div>
 <p className="text-text-dim text-sm font-medium mb-1">Cold Tier</p>
 <p className="text-2xl font-display font-bold text-text">{formatSize(stats.cold)}</p>
 <div className="mt-2 text-xs text-cyan font-medium">Infrequent Access</div>
 </div>
 <div className="bg-surface p-5 border border-border relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-16 h-16 bg-ghost/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150"></div>
 <p className="text-text-dim text-sm font-medium mb-1">Archive</p>
 <p className="text-2xl font-display font-bold text-text">{formatSize(stats.archive)}</p>
 <div className="mt-2 text-xs text-text-dim font-medium">Long-term Storage</div>
 </div>
 </div>
 )}

 {activeTab ==='datasets' && <Card>
 <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center gap-4 bg-void/50">
	 <div className="flex-1">
	 <Input
	 type="text"
	 placeholder="Search data sets..."
	 value={searchQuery}
	 onChange={(e) => setSearchQuery(e.target.value)}
	 leftIcon={<Search className="w-4 h-4" />}
	 aria-label="Search datasets"
	 />
	 </div>

 <div className="flex items-center gap-3">
 <Filter className="w-4 h-4 text-text-mute" />
  <Select
  value={filterTier}
  onChange={(e) => setFilterTier(e.target.value)}
  options={[
  { value: 'all', label: 'All Tiers' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
  { value: 'archive', label: 'Archive' },
  ]}
  className="w-auto"
  />
 </div>
 </div>

 {isLoading ? (
 <div className="p-5 space-y-4">
 {(['sk-1','sk-2','sk-3'] as const).map((k) => (
 <SkeletonCard key={k} rows={4} className="-none border-0 border-b border-border last:border-0" />
 ))}
 </div>
 ) : filteredDataSets.length === 0 ? (
 dataSets.length === 0 ? (
 <EmptyState
 icon={<Database size={48} />}
 title="No datasets yet"
 description="Run a crawl operation to start collecting and managing datasets."
 />
 ) : (
 <EmptyState
 icon={<FolderOpen size={48} />}
 title="No matching datasets"
 description="Try adjusting your search query or tier filter."
 action={{ label:'Clear filters', onClick: () => { setSearchQuery(''); setFilterTier('all'); } }}
 />
 )
 ) : (
 <div className="divide-y divide-border">
 {filteredDataSets.map((dataSet) => (
 <div key={dataSet.id} className="p-5 hover:bg-void transition-colors group">
 <div className="flex items-start justify-between">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-2">
  <p className="font-semibold text-lg text-text group-hover:text-cyan transition-colors">{dataSet.name}</p>
 <div
 className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent ${TierConfig[dataSet.storage_tier].bg} ${TierConfig[dataSet.storage_tier].color}`}
 >
 {TierConfig[dataSet.storage_tier].icon}
 <span className="capitalize">{dataSet.storage_tier}</span>
 </div>
 </div>

 <p className="text-sm text-text-dim mb-4 line-clamp-1">{dataSet.description}</p>

 <div className="flex flex-wrap gap-6 text-xs text-text-dim font-medium">
 <div className="flex items-center gap-1.5">
 <Calendar className="w-3.5 h-3.5" />
 <span>{formatDate(dataSet.created_at)}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <RefreshCw className="w-3.5 h-3.5" />
 <span>{dataSet.crawl_count} crawls</span>
 </div>
 <div className="flex items-center gap-1.5">
 <HardDrive className="w-3.5 h-3.5" />
 <span>{formatSize(dataSet.size)}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <BarChart2 className="w-3.5 h-3.5" />
 <span>{dataSet.record_count.toLocaleString()} records</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
    <Button
    variant="secondary"
    size="sm"
    className="p-2"
    onClick={() => handleExport(dataSet.id,'json')}
    aria-label={`Export dataset ${dataSet.name} as JSON`}
    >
    <Download className="w-4 h-4" />
    </Button>
    <Button
    variant="danger"
    size="sm"
    className="p-2"
    onClick={() => confirmDelete(dataSet)}
    aria-label={`Delete dataset ${dataSet.name}`}
    >
    <Trash2 className="w-4 h-4" />
    </Button>
 </div>
 </div>
 </div>
 ))}
 </div>
	 )}
	 </Card>}

	 <ConfirmDialog
 open={deleteTarget !== null}
 title="Delete Dataset"
 message={
 deleteTarget
 ? `Delete"${deleteTarget.name}"? This action cannot be undone.`
 :''
 }
 confirmLabel="Delete"
 variant="danger"
 loading={isDeleting}
 onConfirm={executeDelete}
 onCancel={() => setDeleteTarget(null)}
 />
  </div>
  </ErrorBoundary>
  );
}
