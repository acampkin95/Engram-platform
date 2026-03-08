import { ChevronDown, Download, GripVertical, Play, Plus, Trash2 } from'lucide-react';
import { useCallback } from'react';

export type FieldType ='text' |'attribute' |'html' |'number' |'url' |'image';

export interface SchemaField {
 id: string;
 name: string;
 selector: string;
 type: FieldType;
 attribute?: string;
 multiple?: boolean;
}

export interface ExtractionSchema {
 name: string;
 baseSelector: string;
 fields: SchemaField[];
}

interface SchemaDesignerProps {
 schema: ExtractionSchema;
 selectedSelector: string | null;
 isTestLoading: boolean;
 onChange: (schema: ExtractionSchema) => void;
 onExport: () => void;
 onTest: () => void;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
 { value:'text', label:'Text' },
 { value:'attribute', label:'Attribute' },
 { value:'html', label:'HTML' },
 { value:'number', label:'Number' },
 { value:'url', label:'URL' },
 { value:'image', label:'Image' },
];

function generateId(): string {
 return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface FieldRowProps {
 field: SchemaField;
 selectedSelector: string | null;
 onChange: (updated: SchemaField) => void;
 onRemove: () => void;
 onApplySelected: () => void;
}

function FieldRow({ field, selectedSelector, onChange, onRemove, onApplySelected }: FieldRowProps) {
 const update = useCallback(
 <K extends keyof SchemaField>(key: K, value: SchemaField[K]) => {
 onChange({ ...field, [key]: value });
 },
 [field, onChange]
 );

 return (
 <div className="group border border-border bg-surface p-3 space-y-2">
 <div className="flex items-center gap-2">
 <GripVertical size={14} className="text-text-mute shrink-0 cursor-grab" />

 <input
 type="text"
 value={field.name}
 onChange={(e) => update('name', e.target.value)}
 placeholder="Field name"
 className="flex-1 border border-border bg-void px-2 py-1 text-xs text-text placeholder-text-mute focus:outline-none focus:ring-1 focus:ring-cyan"
 />

 <div className="relative shrink-0">
 <select
 value={field.type}
 onChange={(e) => update('type', e.target.value as FieldType)}
 className="appearance-none border border-border bg-void pl-2 pr-6 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-cyan cursor-pointer"
 >
 {FIELD_TYPES.map((ft) => (
 <option key={ft.value} value={ft.value}>{ft.label}</option>
 ))}
 </select>
 <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-mute" />
 </div>

 <button
 type="button"
 onClick={onRemove}
 className="p-1 text-text-mute hover:text-neon-r transition-colors shrink-0"
 title="Remove field"
 >
 <Trash2 size={13} />
 </button>
 </div>

 <div className="flex items-center gap-2">
 <input
 type="text"
 value={field.selector}
 onChange={(e) => update('selector', e.target.value)}
 placeholder="CSS selector, e.g. h1.title"
 className="flex-1 border border-border bg-void px-2 py-1 font-mono text-xs text-text placeholder-text-mute focus:outline-none focus:ring-1 focus:ring-cyan"
 />
 {selectedSelector && (
 <button
 type="button"
 onClick={onApplySelected}
 className="shrink-0 px-2 py-1 text-xs font-medium bg-cyan/10 text-cyan hover:bg-cyan/20 border border-cyan/30 transition-colors"
 title="Use currently selected element"
 >
 Use selected
 </button>
 )}
 </div>

 {field.type ==='attribute' && (
 <input
 type="text"
 value={field.attribute ??''}
 onChange={(e) => update('attribute', e.target.value)}
 placeholder="Attribute name, e.g. href, src"
 className="w-full border border-border bg-void px-2 py-1 font-mono text-xs text-text placeholder-text-mute focus:outline-none focus:ring-1 focus:ring-cyan"
 />
 )}

 <label className="flex items-center gap-2 cursor-pointer select-none">
 <input
 type="checkbox"
 checked={field.multiple ?? false}
 onChange={(e) => update('multiple', e.target.checked)}
 className="border-border text-cyan focus:ring-cyan"
 />
 <span className="text-xs text-text-dim">Extract multiple</span>
 </label>
 </div>
 );
}

export default function SchemaDesigner({
 schema,
 selectedSelector,
 isTestLoading,
 onChange,
 onExport,
 onTest,
}: SchemaDesignerProps) {
 const addField = useCallback(() => {
 const newField: SchemaField = {
 id: generateId(),
 name:'',
 selector:'',
 type:'text',
 multiple: false,
 };
 onChange({ ...schema, fields: [...schema.fields, newField] });
 }, [schema, onChange]);

 const updateField = useCallback(
 (id: string, updated: SchemaField) => {
 onChange({
 ...schema,
 fields: schema.fields.map((f) => (f.id === id ? updated : f)),
 });
 },
 [schema, onChange]
 );

 const removeField = useCallback(
 (id: string) => {
 onChange({ ...schema, fields: schema.fields.filter((f) => f.id !== id) });
 },
 [schema, onChange]
 );

 const applySelectedToField = useCallback(
 (id: string) => {
 if (!selectedSelector) return;
 onChange({
 ...schema,
 fields: schema.fields.map((f) =>
 f.id === id ? { ...f, selector: selectedSelector } : f
 ),
 });
 },
 [schema, selectedSelector, onChange]
 );

 return (
 <div className="flex flex-col h-full">
 <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
 <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">
 Schema Designer
 </span>
 <span className="text-xs text-text-mute tabular-nums">
 {schema.fields.length} field{schema.fields.length !== 1 ?'s' :''}
 </span>
 </div>

 <div className="flex-1 overflow-auto min-h-0 p-3 space-y-3">
 <div className="space-y-2">
 <div>
 <label htmlFor="schema-name" className="block text-xs font-medium text-text-dim mb-1">
 Schema Name
 </label>
 <input
 id="schema-name"
 type="text"
 value={schema.name}
 onChange={(e) => onChange({ ...schema, name: e.target.value })}
 placeholder="e.g. Product List"
 className="w-full border border-border bg-void px-2 py-1.5 text-sm text-text placeholder-text-mute focus:outline-none focus:ring-1 focus:ring-cyan"
 />
 </div>
 <div>
 <label htmlFor="schema-base-selector" className="block text-xs font-medium text-text-dim mb-1">
 Base Selector
 </label>
 <div className="flex items-center gap-2">
 <input
 id="schema-base-selector"
 type="text"
 value={schema.baseSelector}
 onChange={(e) => onChange({ ...schema, baseSelector: e.target.value })}
 placeholder="e.g. div.product-card"
 className="flex-1 border border-border bg-void px-2 py-1.5 font-mono text-sm text-text placeholder-text-mute focus:outline-none focus:ring-1 focus:ring-cyan"
 />
 {selectedSelector && (
 <button
 type="button"
 onClick={() => onChange({ ...schema, baseSelector: selectedSelector })}
 className="shrink-0 px-2 py-1.5 text-xs font-medium bg-cyan/10 text-cyan hover:bg-cyan/20 border border-cyan/30 transition-colors"
 >
 Use selected
 </button>
 )}
 </div>
 </div>
 </div>

 <div className="border-t border-border" />

 <div className="space-y-2">
 {schema.fields.length === 0 ? (
 <div className="border border-dashed border-border px-4 py-6 text-center">
 <p className="text-xs text-text-mute">
 No fields yet. Click <strong>Add Field</strong> to start.
 </p>
 </div>
 ) : (
 schema.fields.map((field) => (
 <FieldRow
 key={field.id}
 field={field}
 selectedSelector={selectedSelector}
 onChange={(updated) => updateField(field.id, updated)}
 onRemove={() => removeField(field.id)}
 onApplySelected={() => applySelectedToField(field.id)}
 />
 ))
 )}
 </div>
 </div>

 <div className="px-3 py-3 border-t border-border space-y-2 shrink-0">
 <button
 type="button"
 onClick={addField}
 className="w-full flex items-center justify-center gap-2 border border-dashed border-cyan px-3 py-2 text-xs font-medium text-cyan hover:bg-cyan/10 transition-colors"
 >
 <Plus size={13} />
 Add Field
 </button>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={onExport}
 disabled={schema.fields.length === 0}
 className="flex-1 inline-flex items-center justify-center gap-1.5 border border-border bg-surface px-3 py-2 text-xs font-medium text-text hover:bg-void disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 <Download size={13} />
 Export JSON
 </button>

 <button
 type="button"
 onClick={onTest}
 disabled={schema.fields.length === 0 || isTestLoading}
 className="flex-1 inline-flex items-center justify-center gap-1.5 bg-cyan px-3 py-2 text-xs font-medium text-text hover:bg-cyan-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 <Play size={13} />
 {isTestLoading ?'Testing…' :'Test Extraction'}
 </button>
 </div>
 </div>
 </div>
 );
}
