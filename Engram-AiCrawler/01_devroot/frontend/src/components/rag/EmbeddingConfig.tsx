import { useId, useMemo } from'react';
import { Cpu, Database, Layers } from'lucide-react';

type EmbeddingModel ='default' |'all-MiniLM-L6-v2' |'text-embedding-ada-002' |'nomic-embed-text-v1.5';

export interface EmbeddingConfigData {
 model: EmbeddingModel;
 batchSize: number;
}

interface EmbeddingConfigProps {
 config: EmbeddingConfigData;
 onChange: (config: EmbeddingConfigData) => void;
 chunkCount?: number;
}

const MODEL_OPTIONS: { value: EmbeddingModel; label: string; dimensions: number }[] = [
 { value:'default', label:'Default', dimensions: 384 },
 { value:'all-MiniLM-L6-v2', label:'all-MiniLM-L6-v2', dimensions: 384 },
 { value:'text-embedding-ada-002', label:'text-embedding-ada-002', dimensions: 1536 },
 { value:'nomic-embed-text-v1.5', label:'nomic-embed-text-v1.5', dimensions: 768 },
];

function getDimensions(model: EmbeddingModel): number {
 return MODEL_OPTIONS.find((m) => m.value === model)?.dimensions ?? 384;
}

export default function EmbeddingConfig({ config, onChange, chunkCount }: EmbeddingConfigProps) {
 const modelId = useId();
 const batchId = useId();

 const dimensions = useMemo(() => getDimensions(config.model), [config.model]);

 function updateModel(model: EmbeddingModel) {
 onChange({ ...config, model });
 }

 function updateBatchSize(raw: string) {
 const parsed = parseInt(raw, 10);
 if (Number.isNaN(parsed)) return;
 const clamped = Math.min(100, Math.max(1, parsed));
 onChange({ ...config, batchSize: clamped });
 }

 return (
 <div className="border border-border bg-surface p-5 space-y-5">
 <div className="flex items-center gap-2">
 <Cpu size={16} className="text-cyan" />
 <h3 className="text-sm font-semibold text-text">
 Embedding Configuration
 </h3>
 </div>

 <div className="flex flex-col gap-1.5">
 <label
 htmlFor={modelId}
 className="text-sm font-medium text-text"
 >
 Model
 </label>
 <select
 id={modelId}
 value={config.model}
 onChange={(e) => updateModel(e.target.value as EmbeddingModel)}
 className="w-full border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-opacity-50 transition-colors"
 >
 {MODEL_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>

 <div className="flex flex-col gap-1.5">
 <span className="text-sm font-medium text-text">
 Dimensions
 </span>
 <div className="flex items-center gap-2 border border-border bg-void px-3 py-2">
 <Database size={14} className="text-text-mute shrink-0" />
 <span className="text-sm font-mono text-text tabular-nums">
 {dimensions}
 </span>
 <span className="text-xs text-text-mute">dimensions</span>
 </div>
 </div>

 <div className="flex flex-col gap-1.5">
 <label
 htmlFor={batchId}
 className="text-sm font-medium text-text"
 >
 Batch Size
 </label>
 <p className="text-xs text-text-dim">
 Number of chunks processed per embedding request (1–100)
 </p>
 <input
 id={batchId}
 type="number"
 min={1}
 max={100}
 value={config.batchSize}
 onChange={(e) => updateBatchSize(e.target.value)}
 className="w-full border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-opacity-50 transition-colors tabular-nums"
 />
 </div>

 {chunkCount !== undefined && chunkCount > 0 && (
 <div className="flex items-center gap-2 border border-cyan/30 bg-cyan/10 px-4 py-3">
 <Layers size={14} className="text-cyan shrink-0" />
 <span className="text-sm text-cyan">
 ~<span className="font-medium tabular-nums">{chunkCount}</span> vectors will be created
 </span>
 </div>
 )}
 </div>
 );
}
