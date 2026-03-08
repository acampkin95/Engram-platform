import { useState, useEffect, useCallback, useRef } from'react';
import { ChevronDown, Plus, Loader2, Database } from'lucide-react';
import { useToast } from'../Toast';
import { api } from'../../lib/api';

export interface StorageConfigData {
 collectionName: string;
 similarityThreshold: number;
 metadataFields: {
 source_url: boolean;
 crawl_date: boolean;
 chunk_number: boolean;
 content_hash: boolean;
 };
}

interface StorageConfigProps {
 config: StorageConfigData;
 onChange: (config: StorageConfigData) => void;
}

type MetadataKey = keyof StorageConfigData['metadataFields'];

const METADATA_KEYS: MetadataKey[] = ['source_url','crawl_date','chunk_number','content_hash'];

const METADATA_LABELS: Record<MetadataKey, string> = {
 source_url:'Source URL',
 crawl_date:'Crawl Date',
 chunk_number:'Chunk Number',
 content_hash:'Content Hash',
};

export function StorageConfig({ config, onChange }: StorageConfigProps) {
 const toast = useToast();
 const [collections, setCollections] = useState<string[]>([]);
 const [isLoadingCollections, setIsLoadingCollections] = useState(false);
 const [showCreateInput, setShowCreateInput] = useState(false);
 const [newCollectionName, setNewCollectionName] = useState('');
 const [isCreating, setIsCreating] = useState(false);
 const createInputRef = useRef<HTMLInputElement>(null);

 const fetchCollections = useCallback(async () => {
 setIsLoadingCollections(true);
 try {
 const response = await api.get<{ collections: string[] }>('/storage/collections');
 setCollections(response.data.collections ?? []);
 } catch {
 toast.error('Failed to load collections');
 } finally {
 setIsLoadingCollections(false);
 }
 }, [toast]);

 useEffect(() => {
 void fetchCollections();
 }, [fetchCollections]);

 useEffect(() => {
 if (showCreateInput) {
 createInputRef.current?.focus();
 }
 }, [showCreateInput]);

 const handleCreateCollection = async () => {
 const name = newCollectionName.trim();
 if (!name) {
 toast.warning('Enter a collection name');
 return;
 }
 setIsCreating(true);
 try {
 await api.post('/storage/collections', { name });
 toast.success(`Collection"${name}" created`);
 setNewCollectionName('');
 setShowCreateInput(false);
 await fetchCollections();
 onChange({ ...config, collectionName: name });
 } catch {
 toast.error('Failed to create collection');
 } finally {
 setIsCreating(false);
 }
 };

 const handleCollectionSelect = (value: string) => {
 if (value ==='__create__') {
 setShowCreateInput(true);
 } else {
 onChange({ ...config, collectionName: value });
 }
 };

 const handleMetadataToggle = (key: MetadataKey) => {
 onChange({
 ...config,
 metadataFields: {
 ...config.metadataFields,
 [key]: !config.metadataFields[key],
 },
 });
 };

 return (
 <div className="space-y-6">
 <div className="space-y-2">
 <label
 htmlFor="storage-collection-select"
 className="block text-sm font-medium text-text"
 >
 Collection
 </label>
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <select
 id="storage-collection-select"
 value={config.collectionName}
 onChange={(e) => handleCollectionSelect(e.target.value)}
 className="w-full appearance-none px-4 py-2 pr-10 bg-void border border-border text-text focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent"
 >
 <option value="">Select collection…</option>
 {collections.map((name) => (
 <option key={name} value={name}>
 {name}
 </option>
 ))}
 <option value="__create__">+ Create New</option>
 </select>
 <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-mute" />
 </div>
 {isLoadingCollections && (
 <Loader2 className="w-5 h-5 animate-spin text-text-mute flex-shrink-0" />
 )}
 </div>

 {showCreateInput && (
 <div className="flex gap-2 mt-2">
 <input
 ref={createInputRef}
 type="text"
 placeholder="New collection name…"
 value={newCollectionName}
 onChange={(e) => setNewCollectionName(e.target.value)}
 onKeyDown={(e) => {
 if (e.key ==='Enter') void handleCreateCollection();
 if (e.key ==='Escape') {
 setShowCreateInput(false);
 setNewCollectionName('');
 }
 }}
 className="flex-1 px-4 py-2 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent"
 />
 <button
 type="button"
 onClick={() => void handleCreateCollection()}
 disabled={isCreating || !newCollectionName.trim()}
 className="flex items-center gap-1.5 px-4 py-2 bg-cyan hover:bg-cyan-dim disabled:bg-border disabled:cursor-not-allowed text-text transition-colors"
 >
 {isCreating ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Plus className="w-4 h-4" />
 )}
 Create
 </button>
 <button
 type="button"
 onClick={() => {
 setShowCreateInput(false);
 setNewCollectionName('');
 }}
 className="px-4 py-2 bg-surface hover:bg-raised text-text transition-colors"
 >
 Cancel
 </button>
 </div>
 )}
 </div>

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <label
 htmlFor="storage-threshold-input"
 className="text-sm font-medium text-text"
 >
 Similarity Threshold
 </label>
 <span className="text-sm font-mono font-semibold text-cyan">
 {config.similarityThreshold.toFixed(2)}
 </span>
 </div>
 <input
 id="storage-threshold-input"
 type="range"
 min={0}
 max={1}
 step={0.05}
 value={config.similarityThreshold}
 onChange={(e) =>
 onChange({ ...config, similarityThreshold: parseFloat(e.target.value) })
 }
 className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer accent-cyan"
 />
 <div className="flex justify-between text-xs text-text-mute">
 <span>0.00</span>
 <span>0.50</span>
 <span>1.00</span>
 </div>
 </div>

 <div className="space-y-3">
 <p className="text-sm font-medium text-text">
 Metadata Fields
 </p>
 <div className="grid grid-cols-2 gap-3">
 {METADATA_KEYS.map((key) => (
 <label
 key={key}
 htmlFor={`meta-${key}`}
 className="flex items-center gap-3 p-3 bg-void border border-border cursor-pointer hover:bg-raised transition-colors"
 >
 <input
 id={`meta-${key}`}
 type="checkbox"
 checked={config.metadataFields[key]}
 onChange={() => handleMetadataToggle(key)}
 className="w-4 h-4 accent-cyan"
 />
 <span className="text-sm text-text">
 {METADATA_LABELS[key]}
 </span>
 </label>
 ))}
 </div>
 </div>

 {config.collectionName && (
 <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan/10 border border-cyan/30">
 <Database className="w-4 h-4 text-cyan flex-shrink-0" />
 <span className="text-sm text-cyan">
 Using collection:{''}
 <span className="font-medium">{config.collectionName}</span>
 </span>
 </div>
 )}
 </div>
 );
}
