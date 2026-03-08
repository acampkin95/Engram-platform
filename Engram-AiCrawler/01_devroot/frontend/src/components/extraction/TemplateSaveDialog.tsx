import { Loader2, Save, X } from'lucide-react';
import { useCallback, useState } from'react';
import { api } from'../../lib/api';
import type { StrategyType } from'../../lib/schemas';

interface TemplateSaveDialogProps {
 open: boolean;
 strategyType: StrategyType;
 config: Record<string, unknown>;
 onClose: () => void;
 onSaved: () => void;
}

export default function TemplateSaveDialog({
 open,
 strategyType,
 config,
 onClose,
 onSaved,
}: TemplateSaveDialogProps) {
 const [name, setName] = useState('');
 const [description, setDescription] = useState('');
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSave = useCallback(async () => {
 if (!name.trim()) return;
 setSaving(true);
 setError(null);
 try {
 await api.post('/extraction/templates', {
 name: name.trim(),
 description: description.trim(),
 strategy_type: strategyType,
 config,
 });
 setName('');
 setDescription('');
 onSaved();
 onClose();
 } catch (err) {
 setError(err instanceof Error ? err.message :'Failed to save template');
 } finally {
 setSaving(false);
 }
 }, [name, description, strategyType, config, onSaved, onClose]);

 const handleKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 if (e.key ==='Enter' && !e.shiftKey && name.trim()) {
 e.preventDefault();
 handleSave();
 }
 },
 [handleSave, name]
 );

 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
 role="dialog"
 aria-modal="true"
 >
 <button
 type="button"
 className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
 disabled={saving}
 onClick={onClose}
 tabIndex={-1}
 aria-label="Close dialog"
 />

 <div className="relative z-10 w-full max-w-md bg-surface ring-1 ring-black/5">
 <div className="flex items-center justify-between border-b border-border px-5 py-4">
 <div className="flex items-center gap-2">
 <Save size={18} className="text-cyan" />
 <h3 className="text-base font-semibold text-text">
 Save Template
 </h3>
 </div>
 <button
 type="button"
 onClick={onClose}
 disabled={saving}
 className="p-1 text-text-mute hover:text-text-dim transition-colors"
 >
 <X size={18} />
 </button>
 </div>

 <fieldset className="p-5 space-y-4 border-0" onKeyDown={handleKeyDown}>
 <div>
 <label
 htmlFor="template-name"
 className="block text-sm font-medium text-text mb-1"
 >
 Name
 </label>
 <input
 id="template-name"
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="My extraction template"
 maxLength={100}
 className="w-full border border-border bg-void px-3 py-2 text-sm text-text placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-cyan"
 />
 </div>

 <div>
 <label
 htmlFor="template-description"
 className="block text-sm font-medium text-text mb-1"
 >
 Description
 </label>
 <textarea
 id="template-description"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Optional description..."
 maxLength={500}
 rows={3}
 className="w-full border border-border bg-void px-3 py-2 text-sm text-text placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-cyan resize-none"
 />
 </div>

 <div className="flex items-center gap-2 text-xs text-text-dim">
 <span className="inline-flex items-center bg-cyan/10 px-2 py-0.5 font-medium text-cyan ring-1 ring-cyan/30">
 {strategyType.toUpperCase()}
 </span>
 <span>strategy will be saved</span>
 </div>

 {error && (
 <p className="text-xs text-neon-r">{error}</p>
 )}
 </fieldset>

 <div className="flex gap-3 justify-end border-t border-border px-5 py-4">
 <button
 type="button"
 onClick={onClose}
 disabled={saving}
 className="px-4 py-2 text-sm font-medium text-text bg-abyss hover:bg-border disabled:opacity-50 transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleSave}
 disabled={saving || !name.trim()}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan text-text hover:bg-cyan-dim disabled:opacity-50 transition-colors"
 >
 {saving && <Loader2 size={14} className="animate-spin" />}
 Save Template
 </button>
 </div>
 </div>
 </div>
 );
}
