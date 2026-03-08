import { useState, useRef } from'react';
import { X, Plus, Trash2, Loader2, Database } from'lucide-react';
import { api } from'../../lib/api';
import { useToast } from'../Toast';

interface MetadataField {
 id: number;
 key: string;
 value: string;
}

interface AddDocumentDialogProps {
 open: boolean;
 collectionName: string;
 onClose: () => void;
 onAdded: () => void;
}

export function AddDocumentDialog({ open, collectionName, onClose, onAdded }: AddDocumentDialogProps) {
 const toast = useToast();
 const [content, setContent] = useState('');
 const [fields, setFields] = useState<MetadataField[]>([]);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const nextId = useRef(0);

 if (!open) return null;

 const addField = () => {
 const id = nextId.current++;
 setFields((prev) => [...prev, { id, key:'', value:'' }]);
 };

 const removeField = (id: number) => {
 setFields((prev) => prev.filter((f) => f.id !== id));
 };

 const updateField = (id: number, part:'key' |'value', val: string) => {
 setFields((prev) => prev.map((f) => (f.id === id ? { ...f, [part]: val } : f)));
 };

 const handleSubmit = async () => {
 if (!content.trim()) {
 toast.warning('Document content cannot be empty');
 return;
 }
 const metadata: Record<string, string> = {};
 for (const f of fields) {
 if (f.key.trim()) {
 metadata[f.key.trim()] = f.value;
 }
 }
 setIsSubmitting(true);
 try {
 await api.post('/storage/documents', {
 collection_name: collectionName,
 documents: [content.trim()],
 metadatas: [metadata],
 });
 toast.success('Document added successfully');
 setContent('');
 setFields([]);
 onAdded();
 onClose();
 } catch {
 toast.error('Failed to add document');
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div
 className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="add-doc-title"
 >
 <button
 type="button"
 aria-label="Close dialog"
 className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default w-full"
 onClick={isSubmitting ? undefined : onClose}
 />

 <div className="relative z-10 w-full max-w-2xl bg-surface ring-1 ring-black/5 flex flex-col max-h-[90vh]">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
 <h2
 id="add-doc-title"
 className="text-base font-semibold text-text flex items-center gap-2"
 >
 <Plus className="w-5 h-5 text-cyan" />
 Add Document
 </h2>
 <button
 type="button"
 onClick={onClose}
 disabled={isSubmitting}
 className="p-2 hover:bg-raised transition-colors disabled:opacity-50"
 aria-label="Close dialog"
 >
 <X className="w-5 h-5 text-text-dim" />
 </button>
 </div>

 <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
 <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan/10 border border-cyan/30">
 <Database className="w-4 h-4 text-cyan shrink-0" />
 <span className="text-sm text-cyan font-medium">
 Collection:
 </span>
 <span className="text-sm text-cyan font-mono">{collectionName}</span>
 </div>

 <div>
 <label
 htmlFor="doc-content"
 className="block text-sm font-medium text-text mb-2"
 >
 Content <span className="text-neon-r">*</span>
 </label>
 <textarea
 id="doc-content"
 rows={10}
 value={content}
 onChange={(e) => setContent(e.target.value)}
 placeholder="Enter document text..."
 className="w-full px-4 py-3 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:border-cyan resize-y font-mono text-sm"
 />
 </div>

 <div>
 <div className="flex items-center justify-between mb-3">
 <span className="text-sm font-medium text-text">Metadata</span>
 <button
 type="button"
 onClick={addField}
 className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-abyss hover:bg-border text-text transition-colors"
 >
 <Plus className="w-3.5 h-3.5" /> Add field
 </button>
 </div>

 {fields.length === 0 && (
 <p className="text-sm text-text-mute text-center py-3 bg-void border border-dashed border-border">
 No metadata fields. Click"Add field" to add key-value pairs.
 </p>
 )}

 {fields.length > 0 && (
 <div className="space-y-2">
 {fields.map((field) => (
 <div key={field.id} className="flex gap-2 items-center">
 <input
 type="text"
 placeholder="Key"
 value={field.key}
 onChange={(e) => updateField(field.id,'key', e.target.value)}
 className="flex-1 px-3 py-2 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:border-cyan text-sm"
 />
 <input
 type="text"
 placeholder="Value"
 value={field.value}
 onChange={(e) => updateField(field.id,'value', e.target.value)}
 className="flex-1 px-3 py-2 bg-void border border-border text-text placeholder-text-mute focus:outline-none focus:border-cyan text-sm"
 />
 <button
 type="button"
 onClick={() => removeField(field.id)}
 className="p-2 hover:bg-neon-r/20 transition-colors"
 aria-label="Remove field"
 >
 <Trash2 className="w-4 h-4 text-text-mute hover:text-neon-r" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
 <button
 type="button"
 onClick={onClose}
 disabled={isSubmitting}
 className="px-4 py-2 text-sm font-medium text-text bg-abyss hover:bg-border disabled:opacity-50 transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleSubmit}
 disabled={isSubmitting || !content.trim()}
 className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-cyan hover:bg-cyan-dim disabled:bg-border disabled:cursor-not-allowed text-text transition-colors"
 >
 {isSubmitting ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Plus className="w-4 h-4" />
 )}
 Add Document
 </button>
 </div>
 </div>
 </div>
 );
}
