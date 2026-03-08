import { Download, FolderOpen, Loader2, Trash2, Upload, X } from'lucide-react';
import { useCallback, useEffect, useRef, useState } from'react';
import { api } from'../../lib/api';
import type { ExtractionTemplate, StrategyType } from'../../lib/schemas';
import { ConfirmDialog } from'../ConfirmDialog';

interface TemplateLoadDialogProps {
 open: boolean;
 onClose: () => void;
 onLoad: (template: ExtractionTemplate) => void;
}

const STRATEGY_COLORS: Record<StrategyType, string> = {
 css:'bg-plasma/10 text-plasma ring-plasma/30',
 regex:'bg-volt/10 text-volt ring-volt/30',
 llm:'bg-fuchsia/10 text-fuchsia ring-fuchsia/30',
 cosine:'bg-sky-50 text-sky-700 ring-sky-200',
};

function formatDate(iso: string): string {
 try {
 return new Date(iso).toLocaleDateString(undefined, {
 month:'short',
 day:'numeric',
 year:'numeric',
 hour:'2-digit',
 minute:'2-digit',
 });
 } catch {
 return iso;
 }
}

export default function TemplateLoadDialog({
 open,
 onClose,
 onLoad,
}: TemplateLoadDialogProps) {
 const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<ExtractionTemplate | null>(null);
 const [deleting, setDeleting] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const fetchTemplates = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const res = await api.get<ExtractionTemplate[]>('/extraction/templates');
 setTemplates(res.data);
 } catch (err) {
 setError(err instanceof Error ? err.message :'Failed to load templates');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 if (open) fetchTemplates();
 }, [open, fetchTemplates]);

 const handleDelete = useCallback(async () => {
 if (!deleteTarget) return;
 setDeleting(true);
 try {
 await api.delete(`/extraction/templates/${deleteTarget.id}`);
 setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
 setDeleteTarget(null);
 } catch (err) {
 setError(err instanceof Error ? err.message :'Failed to delete template');
 } finally {
 setDeleting(false);
 }
 }, [deleteTarget]);

 const handleExport = useCallback((template: ExtractionTemplate) => {
 const json = JSON.stringify(template, null, 2);
 const blob = new Blob([json], { type:'application/json' });
 const href = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = href;
 link.download = `${template.name.replace(/\s+/g,'_').toLowerCase()}.json`;
 link.click();
 URL.revokeObjectURL(href);
 }, []);

 const handleImport = useCallback(
 async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 try {
 const text = await file.text();
 const parsed = JSON.parse(text) as Record<string, unknown>;
 await api.post('/extraction/templates', {
 name: typeof parsed.name ==='string' ? parsed.name : file.name.replace('.json',''),
 description: typeof parsed.description ==='string' ? parsed.description :'',
 strategy_type: parsed.strategy_type ??'css',
 config: typeof parsed.config ==='object' && parsed.config !== null ? parsed.config : {},
 });
 await fetchTemplates();
 } catch (err) {
 setError(err instanceof Error ? err.message :'Failed to import template');
 } finally {
 if (fileInputRef.current) fileInputRef.current.value ='';
 }
 },
 [fetchTemplates]
 );

 const handleSelect = useCallback(
 (template: ExtractionTemplate) => {
 onLoad(template);
 onClose();
 },
 [onLoad, onClose]
 );

 if (!open) return null;

 return (
 <>
 <div
 className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
 role="dialog"
 aria-modal="true"
 >
 <button
 type="button"
 className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
 onClick={onClose}
 tabIndex={-1}
 aria-label="Close dialog"
 />

 <div className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col bg-surface ring-1 ring-black/5">
 <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
 <div className="flex items-center gap-2">
 <FolderOpen size={18} className="text-cyan" />
 <h3 className="text-base font-semibold text-text">
 Load Template
 </h3>
 </div>
 <div className="flex items-center gap-2">
  <input
  ref={fileInputRef}
  type="file"
  accept=".json"
  onChange={handleImport}
  className="hidden"
  aria-hidden="true"
  tabIndex={-1}
  />
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-dim bg-abyss hover:bg-border transition-colors"
 >
 <Upload size={14} />
 Import
 </button>
 <button
 type="button"
 onClick={onClose}
 className="p-1 text-text-mute hover:text-text-dim transition-colors"
 >
 <X size={18} />
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-4 min-h-0">
 {loading && (
 <div className="flex items-center justify-center py-12">
 <Loader2 size={24} className="animate-spin text-text-mute" />
 </div>
 )}

 {!loading && error && (
 <p className="text-sm text-neon-r text-center py-8">{error}</p>
 )}

 {!loading && !error && templates.length === 0 && (
 <div className="text-center py-12">
 <FolderOpen size={32} className="mx-auto text-text-mute mb-3" />
 <p className="text-sm text-text-dim">No saved templates</p>
 <p className="text-xs text-text-mute mt-1">
 Save a template from the extraction builder or import a JSON file
 </p>
 </div>
 )}

 {!loading && templates.length > 0 && (
 <div className="grid gap-2">
 {templates.map((t) => (
 <div
 key={t.id}
 className="group flex items-center gap-3 border border-border bg-void px-4 py-3 hover:border-cyan hover:bg-cyan/10 transition-colors"
 >
 <button
 type="button"
 onClick={() => handleSelect(t)}
 className="flex-1 min-w-0 text-left"
 >
 <div className="flex items-center gap-2 mb-0.5">
 <span className="text-sm font-medium text-text truncate">
 {t.name}
 </span>
 <span
 className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold ring-1 shrink-0 ${STRATEGY_COLORS[t.strategy_type]}`}
 >
 {t.strategy_type.toUpperCase()}
 </span>
 </div>
 {t.description && (
 <p className="text-xs text-text-dim truncate">
 {t.description}
 </p>
 )}
 <p className="text-[10px] text-text-mute mt-1">
 {formatDate(t.updated_at)}
 </p>
 </button>

 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 handleExport(t);
 }}
 className="p-1.5 text-text-mute hover:text-text-dim hover:bg-border transition-colors"
 title="Export as JSON"
 >
 <Download size={14} />
 </button>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setDeleteTarget(t);
 }}
 className="p-1.5 text-text-mute hover:text-neon-r hover:bg-neon-r/10 transition-colors"
 title="Delete template"
 >
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>

 <ConfirmDialog
 open={deleteTarget !== null}
 title="Delete Template"
 message={`Are you sure you want to delete"${deleteTarget?.name}"? This cannot be undone.`}
 confirmLabel="Delete"
 variant="danger"
 loading={deleting}
 onConfirm={handleDelete}
 onCancel={() => setDeleteTarget(null)}
 />
 </>
 );
}
