import { Code2, Hash, Layers, Loader2, Play, Type } from'lucide-react';
import type { RAGChunkingConfig } from'../../lib/schemas';

const STRATEGY_OPTIONS = [
 { value:'fixed_token' as const, label:'Fixed Token', description:'Split by token count', icon: Hash },
 { value:'sentence' as const, label:'Sentence', description:'Sentence boundaries', icon: Type },
 { value:'regex' as const, label:'Regex', description:'Pattern-based split', icon: Code2 },
 { value:'topic' as const, label:'Topic', description:'Semantic topics', icon: Layers },
];

interface ChunkingConfigProps {
 config: RAGChunkingConfig;
 onChange: (config: RAGChunkingConfig) => void;
 onPreview: () => void;
 isLoading?: boolean;
}

export default function ChunkingConfig({ config, onChange, onPreview, isLoading }: ChunkingConfigProps) {
 return (
 <div className="space-y-6">
 <div>
 <span className="block text-sm font-medium text-text mb-3">
 Chunking Strategy
 </span>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {STRATEGY_OPTIONS.map((option) => {
 const Icon = option.icon;
 const isSelected = config.strategy === option.value;
 return (
 <button
 key={option.value}
 type="button"
 onClick={() => onChange({ ...config, strategy: option.value })}
 className={[
'flex flex-col items-center gap-2 p-4 border-2 transition-all',
 isSelected
 ?'border-cyan bg-cyan/10'
 :'border-border hover:border-border',
 ].join('')}
 >
 <Icon
 size={20}
 className={
 isSelected
 ?'text-cyan'
 :'text-text-mute'
 }
 />
 <span
 className={[
'text-sm font-medium',
 isSelected
 ?'text-cyan'
 :'text-text',
 ].join('')}
 >
 {option.label}
 </span>
 <span className="text-xs text-text-dim text-center">
 {option.description}
 </span>
 </button>
 );
 })}
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-2">
 <label htmlFor="chunk-size" className="text-sm font-medium text-text">
 Chunk Size
 </label>
 <span className="text-sm font-mono text-cyan">
 {config.chunk_size} tokens
 </span>
 </div>
 <input
 id="chunk-size"
 type="range"
 min={256}
 max={4096}
 step={128}
 value={config.chunk_size}
 onChange={(e) => onChange({ ...config, chunk_size: parseInt(e.target.value, 10) })}
 className="w-full h-2 bg-surface appearance-none cursor-pointer accent-cyan"
 />
 <div className="flex justify-between text-xs text-text-mute mt-1">
 <span>256</span>
 <span>4096</span>
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-2">
 <label htmlFor="overlap-rate" className="text-sm font-medium text-text">
 Overlap
 </label>
 <span className="text-sm font-mono text-cyan">
 {Math.round(config.overlap_rate * 100)}%
 </span>
 </div>
 <input
 id="overlap-rate"
 type="range"
 min={0}
 max={50}
 step={5}
 value={Math.round(config.overlap_rate * 100)}
 onChange={(e) => onChange({ ...config, overlap_rate: parseInt(e.target.value, 10) / 100 })}
 className="w-full h-2 bg-surface appearance-none cursor-pointer accent-cyan"
 />
 <div className="flex justify-between text-xs text-text-mute mt-1">
 <span>0%</span>
 <span>50%</span>
 </div>
 </div>

 <div>
 <label htmlFor="word-threshold" className="block text-sm font-medium text-text mb-2">
 Word Count Threshold
 </label>
 <input
 id="word-threshold"
 type="number"
 min={0}
 value={config.word_count_threshold}
 onChange={(e) => onChange({ ...config, word_count_threshold: Math.max(0, parseInt(e.target.value, 10) || 0) })}
 className="w-full border border-border bg-void px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-cyan"
 />
 </div>

 <button
 type="button"
 onClick={onPreview}
 disabled={isLoading}
 className="flex items-center gap-2 px-4 py-2 bg-cyan hover:bg-cyan-dim text-text text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isLoading ? (
 <Loader2 size={16} className="animate-spin" />
 ) : (
 <Play size={16} />
 )}
 Preview Chunking
 </button>
 </div>
 );
}
