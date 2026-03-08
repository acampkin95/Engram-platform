import { useState, useRef, useEffect } from'react';
import { X, FolderPlus, Loader2 } from'lucide-react';
import { useInvestigationStore } from'../../stores/investigationStore';

interface CreateInvestigationDialogProps {
 open: boolean;
 onClose: () => void;
 onCreated?: (id: string) => void;
}

export default function CreateInvestigationDialog({
 open,
 onClose,
 onCreated,
}: CreateInvestigationDialogProps) {
 const { createInvestigation, loading, error, clearError } = useInvestigationStore();
 const [name, setName] = useState('');
 const [description, setDescription] = useState('');
 const [tagsRaw, setTagsRaw] = useState('');
 const [fieldError, setFieldError] = useState<string | null>(null);
 const nameRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (open) {
 setName('');
 setDescription('');
 setTagsRaw('');
 setFieldError(null);
 clearError();
 setTimeout(() => nameRef.current?.focus(), 50);
 }
 }, [open, clearError]);

 const parseTags = (raw: string) =>
 raw
 .split(',')
 .map((t) => t.trim())
 .filter(Boolean);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!name.trim()) {
 setFieldError('Name is required.');
 return;
 }
 setFieldError(null);
 try {
 const inv = await createInvestigation({
 name: name.trim(),
 description: description.trim() || undefined,
 tags: parseTags(tagsRaw),
 });
 onCreated?.(inv.id);
 onClose();
 } catch (_err) {
 void _err;
 }
 };

 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
 role="dialog"
 aria-modal="true"
 aria-labelledby="create-inv-title"
 onClick={(e) => e.target === e.currentTarget && onClose()}
 onKeyDown={(e) => e.key ==='Escape' && onClose()}
 >
 <div className="w-full max-w-md mx-4 bg-surface border border-border">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border">
 <div className="flex items-center gap-2">
 <FolderPlus size={20} className="text-cyan" />
 <h2 id="create-inv-title" className="text-lg font-semibold text-text">
 New Investigation
 </h2>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="p-1.5 text-text-mute hover:text-text-dim hover:bg-raised transition-colors"
 aria-label="Close dialog"
 >
 <X size={18} />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
 {(fieldError || error) && (
 <div className="px-3 py-2 bg-neon-r/10 border border-neon-r/30 text-sm text-neon-r">
 {fieldError ?? error}
 </div>
 )}

 <div>
 <label
 htmlFor="inv-name"
 className="block text-sm font-medium text-text mb-1"
 >
 Name <span className="text-neon-r">*</span>
 </label>
 <input
 ref={nameRef}
 id="inv-name"
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="e.g. Twitter Bot Network Analysis"
 className="w-full px-3 py-2 border border-border bg-surface text-text placeholder-text-mute text-sm focus:outline-none focus:ring-2 focus:ring-cyan transition-shadow"
 />
 </div>

 <div>
 <label
 htmlFor="inv-description"
 className="block text-sm font-medium text-text mb-1"
 >
 Description
 </label>
 <textarea
 id="inv-description"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Optional: describe the scope and goals of this investigation..."
 rows={3}
 className="w-full px-3 py-2 border border-border bg-surface text-text placeholder-text-mute text-sm focus:outline-none focus:ring-2 focus:ring-cyan transition-shadow resize-none"
 />
 </div>

 <div>
 <label
 htmlFor="inv-tags"
 className="block text-sm font-medium text-text mb-1"
 >
 Tags
 </label>
 <input
 id="inv-tags"
 type="text"
 value={tagsRaw}
 onChange={(e) => setTagsRaw(e.target.value)}
 placeholder="e.g. osint, social-media, bot-detection"
 className="w-full px-3 py-2 border border-border bg-surface text-text placeholder-text-mute text-sm focus:outline-none focus:ring-2 focus:ring-cyan transition-shadow"
 />
 <p className="mt-1 text-xs text-text-dim">Separate tags with commas</p>
 </div>

 <div className="flex items-center justify-end gap-3 pt-2">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-text hover:bg-raised transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={loading}
 className="px-4 py-2 text-sm font-medium text-text bg-cyan hover:bg-cyan-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
 >
 {loading && <Loader2 size={14} className="animate-spin" />}
 Create Investigation
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
