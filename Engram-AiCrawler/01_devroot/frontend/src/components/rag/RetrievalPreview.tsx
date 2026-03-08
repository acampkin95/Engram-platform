import { useState, useCallback } from'react';
import { Search, Loader2, Hash } from'lucide-react';
import { useToast } from'../Toast';
import { api } from'../../lib/api';

interface SearchResult {
 document: string;
 id: string;
 metadata: Record<string, string>;
 similarity: number;
}

interface SearchResponse {
 documents: string[][];
 ids: string[][];
 metadatas: Record<string, string>[][];
 distances?: number[][];
}

const TOP_K_OPTIONS = [5, 10, 20] as const;

interface RetrievalPreviewProps {
 collectionName: string;
}

export function RetrievalPreview({ collectionName }: RetrievalPreviewProps) {
 const toast = useToast();
 const [query, setQuery] = useState('');
 const [topK, setTopK] = useState<number>(10);
 const [results, setResults] = useState<SearchResult[] | null>(null);
 const [isSearching, setIsSearching] = useState(false);

 const handleSearch = useCallback(async () => {
 if (!query.trim()) {
 toast.warning('Enter a search query');
 return;
 }
 if (!collectionName) {
 toast.warning('Select a collection first');
 return;
 }
 setIsSearching(true);
 setResults(null);
 try {
 const response = await api.post<SearchResponse>(
 `/storage/collections/${encodeURIComponent(collectionName)}/search`,
 { query: query.trim(), n_results: topK },
 );
 const docs = response.data.documents?.[0] ?? [];
 const ids = response.data.ids?.[0] ?? [];
 const metas = response.data.metadatas?.[0] ?? [];
 const distances = response.data.distances?.[0] ?? [];

 const parsed: SearchResult[] = docs.map((doc, i) => ({
 document: doc,
 id: ids[i] ?? String(i),
 metadata: metas[i] ?? {},
 similarity: distances[i] !== undefined ? Math.max(0, 1 - distances[i]) : 1,
 }));
 setResults(parsed);
 } catch {
 toast.error('Search failed');
 } finally {
 setIsSearching(false);
 }
 }, [query, collectionName, topK, toast]);

 return (
 <div className="space-y-4">
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-mute pointer-events-none" />
 <input
 type="text"
 placeholder="Enter search query…"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={(e) => {
 if (e.key ==='Enter') void handleSearch();
 }}
 disabled={!collectionName || isSearching}
 className="w-full pl-10 pr-4 py-2 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
 />
 </div>
 <select
 value={topK}
 onChange={(e) => setTopK(parseInt(e.target.value, 10))}
 aria-label="Number of results"
 className="px-3 py-2 bg-void border border-border text-text focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent"
 >
 {TOP_K_OPTIONS.map((k) => (
 <option key={k} value={k}>
 Top {k}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={() => void handleSearch()}
 disabled={!collectionName || !query.trim() || isSearching}
 className="flex items-center gap-2 px-5 py-2 bg-cyan hover:bg-cyan-dim disabled:bg-border disabled:cursor-not-allowed text-text transition-colors font-medium"
 >
 {isSearching ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Search className="w-4 h-4" />
 )}
 Search
 </button>
 </div>

 {!collectionName && (
 <p className="text-sm text-volt bg-volt/10 border border-volt/30 px-4 py-2.5">
 Select a collection in Storage Config to enable search
 </p>
 )}

 {isSearching && (
 <div className="flex items-center justify-center py-12 gap-3">
 <Loader2 className="w-6 h-6 animate-spin text-cyan" />
 <span className="text-sm text-text-dim">Searching…</span>
 </div>
 )}

 {results !== null && !isSearching && (
 results.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <Search className="w-10 h-10 text-text-mute mb-3" />
 <p className="text-sm font-medium text-text-dim">No results found</p>
 <p className="text-xs text-text-mute mt-1">
 Try a different query or lower the similarity threshold
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-xs text-text-dim">
 {results.length} result{results.length !== 1 ?'s' :''} found
 </p>
 {results.map((result, idx) => (
 <div
 key={result.id}
 className="bg-void border border-border p-4 space-y-3"
 >
 <div className="flex items-start gap-3">
 <span className="text-xs font-mono text-text-mute mt-0.5 flex-shrink-0">
 #{idx + 1}
 </span>
 <p className="flex-1 text-sm text-text leading-relaxed">
 {result.document.length > 200
 ? `${result.document.slice(0, 200)}…`
 : result.document}
 </p>
 </div>

 <div className="space-y-1.5">
 <div className="flex items-center justify-between text-xs">
 <span className="text-text-dim">Similarity</span>
 <span className="font-semibold font-mono text-cyan">
 {(result.similarity * 100).toFixed(1)}%
 </span>
 </div>
 <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
 <div
 className="h-full rounded-full bg-cyan transition-all duration-500"
 style={{ width: `${Math.min(result.similarity * 100, 100)}%`}}
 />
 </div>
 </div>

 {Object.keys(result.metadata).length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {Object.entries(result.metadata).map(([key, val]) => (
 <span
 key={key}
 className="inline-flex items-center gap-1 text-xs bg-surface text-text-dim px-2 py-0.5 rounded-full"
 >
 <Hash className="w-2.5 h-2.5" />
 <span className="font-medium">{key}:</span>
 {String(val).slice(0, 50)}
 </span>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 )
 )}
 </div>
 );
}
