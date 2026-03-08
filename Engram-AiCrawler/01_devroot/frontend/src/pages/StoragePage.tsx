import { useState, useEffect, useCallback } from'react';
import { Database, Trash2, Search, Plus, RefreshCw, Hash, PackageOpen } from'lucide-react';
import { useToast } from'../components/Toast';
import { ConfirmDialog } from'../components/ConfirmDialog';
import { api } from'../lib/api';
import { SkeletonList } from'../components/SkeletonList';
import { EmptyState } from'../components/EmptyState';
import { DocumentDetailPanel } from'../components/storage/DocumentDetailPanel';
import { AddDocumentDialog } from'../components/storage/AddDocumentDialog';
import { Button, Card, Input } from '../components/ui';

interface Collection {
 name: string;
 count?: number;
}

interface SearchResult {
  documents: string[][];
  ids: string[][];
  metadatas: Record<string, string>[][];
  distances?: number[][];
}

interface SearchResponse {
  collection: string;
  results: SearchResult;
}

export default function StoragePage() {
 const toast = useToast();
 const [collections, setCollections] = useState<Collection[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [newCollectionName, setNewCollectionName] = useState('');
 const [isCreating, setIsCreating] = useState(false);
 const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

 const [searchCollection, setSearchCollection] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
 const [isSearching, setIsSearching] = useState(false);

 const [selectedDocument, setSelectedDocument] = useState<{
 id: string;
 content: string;
 metadata: Record<string, string>;
 } | null>(null);
 const [addDocCollection, setAddDocCollection] = useState<string | null>(null);

 const fetchCollections = useCallback(async () => {
 setIsLoading(true);
 try {
 const response = await api.get<{ collections: string[]; count: number }>('/storage/collections');
 const names = response.data.collections || [];

 // Fetch counts in parallel
 const withCounts = await Promise.all(
 names.map(async (name: string) => {
 try {
 const countRes = await api.get<{ collection: string; count: number }>(
 `/storage/collections/${encodeURIComponent(name)}/count`
 );
 return { name, count: countRes.data.count };
 } catch {
 return { name, count: undefined };
 }
 })
 );
 setCollections(withCounts);
 } catch {
 toast.error('Failed to load collections');
 } finally {
 setIsLoading(false);
 }
 }, [toast]);

 useEffect(() => {
 fetchCollections();
 }, [fetchCollections]);

 const handleCreate = async () => {
 if (!newCollectionName.trim()) {
 toast.warning('Enter a collection name');
 return;
 }
 setIsCreating(true);
 try {
 await api.post('/storage/collections', { name: newCollectionName.trim() });
 toast.success(`Collection"${newCollectionName}" created`);
 setNewCollectionName('');
 fetchCollections();
 } catch {
 toast.error('Failed to create collection');
 } finally {
 setIsCreating(false);
 }
 };

 const executeDelete = async () => {
 if (!deleteTarget) return;
 setIsDeleting(true);
 try {
 await api.delete(`/storage/collections/${encodeURIComponent(deleteTarget)}`);
 toast.success(`Collection"${deleteTarget}" deleted`);
 setCollections((prev) => prev.filter((c) => c.name !== deleteTarget));
 } catch {
 toast.error('Failed to delete collection');
 } finally {
 setIsDeleting(false);
 setDeleteTarget(null);
 }
 };

 const handleSearch = async () => {
 if (!searchCollection || !searchQuery.trim()) {
 toast.warning('Select a collection and enter a search query');
 return;
 }
 setIsSearching(true);
 setSearchResults(null);
 try {
    const response = await api.post<SearchResponse>('/storage/search', {
      collection_name: searchCollection,
      query_texts: [searchQuery.trim()],
 n_results: 10,
 });
    setSearchResults(response.data.results);
    const docCount = response.data.results.documents?.[0]?.length ?? 0;
 toast.success(`Found ${docCount} result${docCount !== 1 ?'s' :''}`);
 } catch {
 toast.error('Search failed');
 } finally {
 setIsSearching(false);
 }
 };

 return (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
 <div className="flex justify-between items-center">
 <h1 className="text-2xl font-bold text-text">Vector Storage</h1>
  <Button
  variant="secondary"
  onClick={fetchCollections}
  loading={isLoading}
  leftIcon={<RefreshCw className="w-4 h-4" />}
  >
  Refresh
  </Button>
 </div>

  {/* Create Collection */}
  <Card className="p-6">
 <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-text">
 <Plus className="w-5 h-5" />
 Create Collection
 </h2>
 <div className="flex gap-4">
  <div className="flex-1">
   <Input
   type="text"
   placeholder="Collection name"
   value={newCollectionName}
   onChange={(e) => setNewCollectionName(e.target.value)}
   onKeyDown={(e) => e.key ==='Enter' && handleCreate()}
   aria-label="New collection name"
   />
  </div>
  <Button
  variant="primary"
  onClick={handleCreate}
  disabled={!newCollectionName.trim()}
  loading={isCreating}
  leftIcon={<Plus className="w-4 h-4" />}
  >
  Create
  </Button>
  </div>
  </Card>

  {/* Collections List */}
  <Card className="p-6">
 <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-text">
 <Database className="w-5 h-5" />
 Collections ({collections.length})
 </h2>

 {isLoading ? (
 <SkeletonList rows={4} showAvatar showAction />
 ) : collections.length === 0 ? (
 <EmptyState
 icon={<PackageOpen size={48} />}
 title="No collections yet"
 description="Create a collection above to start storing vector embeddings."
 />
 ) : (
 <div className="space-y-2">
 {collections.map((col) => (
 <div
 key={col.name}
 className="flex items-center justify-between bg-void p-4 border border-border hover:bg-raised transition-colors"
 >
 <div className="flex items-center gap-3">
 <Database className="w-5 h-5 text-cyan" />
 <span className="font-medium text-text">{col.name}</span>
 {col.count !== undefined && (
 <span className="flex items-center gap-1 text-xs text-text-dim bg-surface px-2 py-0.5 rounded-full">
 <Hash className="w-3 h-3" />
 {col.count} docs
 </span>
 )}
 </div>
   <Button
   variant="danger"
   size="sm"
   onClick={() => setDeleteTarget(col.name)}
   aria-label={`Delete collection ${col.name}`}
   className="p-2"
   >
   <Trash2 className="w-4 h-4" />
   </Button>
 </div>
 ))}
 </div>
  )}
  </Card>

  {/* Semantic Search */}
  <Card className="p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold flex items-center gap-2 text-text">
 <Search className="w-5 h-5" />
 Semantic Search
 </h2>
 {searchCollection && (
  <Button
  variant="primary"
  size="sm"
  onClick={() => setAddDocCollection(searchCollection)}
  leftIcon={<Plus className="w-4 h-4" />}
  >
  Add Document
  </Button>
 )}
 </div>
  <div className="flex flex-col sm:flex-row gap-4 mb-4">
  <select
  value={searchCollection}
  onChange={(e) => setSearchCollection(e.target.value)}
  aria-label="Select collection for search"
  className="px-4 py-2 bg-void border border-border text-text focus:outline-none focus:border-cyan"
  >
 <option value="">Select collection...</option>
 {collections.map((col) => (
 <option key={col.name} value={col.name}>
 {col.name}
 </option>
 ))}
 </select>
  <div className="flex-1">
   <Input
   type="text"
   placeholder="Search query..."
   value={searchQuery}
   onChange={(e) => setSearchQuery(e.target.value)}
   onKeyDown={(e) => e.key ==='Enter' && handleSearch()}
   aria-label="Semantic search query"
   />
  </div>
  <Button
  variant="primary"
  onClick={handleSearch}
  disabled={!searchCollection || !searchQuery.trim()}
  loading={isSearching}
  leftIcon={<Search className="w-4 h-4" />}
  >
  Search
  </Button>
 </div>

 {searchResults && (
 <div className="space-y-3">
 {(searchResults.documents?.[0] || []).length === 0 ? (
 <p className="text-text-dim text-center py-4">No results found</p>
 ) : (
 (searchResults.documents?.[0] || []).map((doc, idx) => {
 const docId = searchResults.ids?.[0]?.[idx] ?? String(idx);
 const docMeta = searchResults.metadatas?.[0]?.[idx] ?? {};
 return (
 <button
 key={docId}
 type="button"
 onClick={() =>
 setSelectedDocument({ id: docId, content: doc, metadata: docMeta })
 }
 className="w-full text-left bg-void p-4 border border-border hover:border-cyan hover:bg-cyan/10 transition-colors"
 >
 <div className="flex items-center gap-2 mb-2 text-xs text-text-dim">
 <span className="font-mono text-cyan hover:underline">{docId}</span>
 {searchResults.distances?.[0]?.[idx] !== undefined && (
 <span className="bg-surface px-2 py-0.5 rounded-full">
 dist: {searchResults.distances[0][idx].toFixed(4)}
 </span>
 )}
 </div>
 <p className="text-sm text-text line-clamp-4">{doc}</p>
 {Object.keys(docMeta).length > 0 && (
 <div className="mt-2 flex flex-wrap gap-2">
 {Object.entries(docMeta).map(([key, val]) => (
 <span key={key} className="text-xs bg-surface text-text-dim px-2 py-0.5">
 {key}: {val}
 </span>
 ))}
 </div>
 )}
 </button>
 );
 })
 )}
  </div>
  )}
  </Card>

  <ConfirmDialog
 open={deleteTarget !== null}
 title="Delete Collection"
 message={deleteTarget ? `Delete"${deleteTarget}"? This action cannot be undone.`:''}
 confirmLabel="Delete"
 variant="danger"
 loading={isDeleting}
 onConfirm={executeDelete}
 onCancel={() => setDeleteTarget(null)}
 />

 {selectedDocument && (
 <DocumentDetailPanel
 document={selectedDocument}
 collectionName={searchCollection}
 onClose={() => setSelectedDocument(null)}
 />
 )}

 {addDocCollection && (
 <AddDocumentDialog
 open={addDocCollection !== null}
 collectionName={addDocCollection}
 onClose={() => setAddDocCollection(null)}
 onAdded={fetchCollections}
 />
 )}
 </div>
 );
}
