import { useState, useEffect, useRef } from'react';
import { X, FileText, Tag, Cpu, Search, Loader2, ChevronRight } from'lucide-react';
import { api } from'../../lib/api';
import { useToast } from'../Toast';

interface DocumentData {
 id: string;
 content: string;
 metadata: Record<string, string>;
}

interface SimilarDoc {
 id: string;
 content: string;
 metadata: Record<string, string>;
 distance: number;
}

interface SearchResult {
 results: {
 documents: string[][];
 ids: string[][];
 metadatas: Record<string, string>[][];
 distances: number[][];
 };
}

interface DocumentDetailPanelProps {
 document: DocumentData;
 collectionName: string;
 onClose: () => void;
}

export function DocumentDetailPanel({ document, collectionName, onClose }: DocumentDetailPanelProps) {
 const toast = useToast();
 const [similarDocs, setSimilarDocs] = useState<SimilarDoc[]>([]);
 const [isFindingSimilar, setIsFindingSimilar] = useState(false);
 const [hasFetchedSimilar, setHasFetchedSimilar] = useState(false);
 const prevDocIdRef = useRef<string>('');
 if (prevDocIdRef.current !== document.id) {
 prevDocIdRef.current = document.id;
 setSimilarDocs([]);
 setHasFetchedSimilar(false);
 }

 useEffect(() => {
 const handleKey = (e: KeyboardEvent) => {
 if (e.key ==='Escape') onClose();
 };
 window.addEventListener('keydown', handleKey);
 return () => window.removeEventListener('keydown', handleKey);
 }, [onClose]);



 const wordCount = document.content.trim().split(/\s+/).filter(Boolean).length;

 const metadataEntries = Object.entries(document.metadata);

 const embeddingDimensions = document.metadata['embedding_dimensions']
 ?? document.metadata['dimensions']
 ?? null;

 const findSimilar = async () => {
 setIsFindingSimilar(true);
 try {
 const response = await api.post<SearchResult>('/storage/search', {
 collection_name: collectionName,
 query_texts: [document.content.slice(0, 500)],
 n_results: 6,
 });
 const results = response.data.results;
 const docs: SimilarDoc[] = (results.documents?.[0] ?? [])
 .map((content, idx) => ({
 id: results.ids?.[0]?.[idx] ?? String(idx),
 content,
 metadata: results.metadatas?.[0]?.[idx] ?? {},
 distance: results.distances?.[0]?.[idx] ?? 0,
 }))
 .filter((d) => d.id !== document.id);
 setSimilarDocs(docs.slice(0, 5));
 setHasFetchedSimilar(true);
 if (docs.length === 0) {
 toast.info('No similar documents found');
 }
 } catch {
 toast.error('Failed to find similar documents');
 } finally {
 setIsFindingSimilar(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
 <button
 type="button"
 aria-label="Close panel"
 className="absolute inset-0 bg-black/40 cursor-default w-full"
 onClick={onClose}
 />

 <div className="relative z-10 w-full max-w-xl h-full bg-void flex flex-col overflow-hidden animate-slide-in-right">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
 <div className="flex items-center gap-2 min-w-0">
 <FileText className="w-5 h-5 text-cyan shrink-0" />
 <span className="text-sm font-mono text-text-dim truncate">{document.id}</span>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="p-2 hover:bg-raised transition-colors shrink-0"
 aria-label="Close panel"
 >
 <X className="w-5 h-5 text-text-dim" />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
 <section>
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-text uppercase tracking-wide flex items-center gap-1.5">
 <FileText className="w-4 h-4" /> Content
 </h3>
 <span className="text-xs text-text-mute">{wordCount} words</span>
 </div>
 <div className="bg-void p-4 border border-border">
 <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
 {document.content}
 </p>
 </div>
 </section>

 {metadataEntries.length > 0 && (
 <section>
 <h3 className="text-sm font-semibold text-text uppercase tracking-wide flex items-center gap-1.5 mb-3">
 <Tag className="w-4 h-4" /> Metadata
 </h3>
 <div className="border border-border overflow-hidden">
 <table className="w-full text-sm">
 <tbody>
 {metadataEntries.map(([key, val], idx) => (
 <tr
 key={key}
 className={idx % 2 === 0 ?'bg-void' :'bg-void'}
 >
 <td className="px-4 py-2 font-medium text-text-dim w-1/3 border-r border-border">
 {key}
 </td>
 <td className="px-4 py-2 text-text font-mono break-all">
 {val}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>
 )}

 <section>
 <h3 className="text-sm font-semibold text-text uppercase tracking-wide flex items-center gap-1.5 mb-3">
 <Cpu className="w-4 h-4" /> Embedding Info
 </h3>
 <div className="bg-void p-4 border border-border space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-text-dim">Collection</span>
 <span className="font-medium text-text">{collectionName}</span>
 </div>
 {embeddingDimensions && (
 <div className="flex justify-between text-sm">
 <span className="text-text-dim">Dimensions</span>
 <span className="font-medium text-text">{embeddingDimensions}</span>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-text-dim">Content length</span>
 <span className="font-medium text-text">{document.content.length} chars</span>
 </div>
 </div>
 </section>

 <section>
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-text uppercase tracking-wide flex items-center gap-1.5">
 <Search className="w-4 h-4" /> Similar Documents
 </h3>
 <button
 type="button"
 onClick={findSimilar}
 disabled={isFindingSimilar}
 className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-cyan hover:bg-cyan-dim disabled:bg-border disabled:cursor-not-allowed text-text transition-colors"
 >
 {isFindingSimilar ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : (
 <Search className="w-3.5 h-3.5" />
 )}
 Find Similar
 </button>
 </div>

 {hasFetchedSimilar && similarDocs.length === 0 && (
 <p className="text-sm text-text-mute text-center py-4">
 No similar documents found
 </p>
 )}

 {similarDocs.length > 0 && (
 <div className="space-y-2">
 {similarDocs.map((doc) => (
 <div
 key={doc.id}
 className="bg-void p-3 border border-border"
 >
 <div className="flex items-center gap-2 mb-1.5">
 <span className="text-xs font-mono text-text-dim truncate flex-1">
 {doc.id}
 </span>
 <span className="flex items-center gap-0.5 text-xs text-plasma shrink-0">
 <ChevronRight className="w-3 h-3" />
 {(1 - doc.distance).toFixed(3)}
 </span>
 </div>
 <p className="text-xs text-text-dim line-clamp-2">{doc.content}</p>
 </div>
 ))}
 </div>
 )}
 </section>
 </div>
 </div>
 </div>
 );
}
