import { Sparkles, Code, Search, GitBranch, Check, type LucideIcon } from'lucide-react';
import type { ExtractionStrategy } from'../../hooks/useCrawlConfig';
import { useCrawlConfig } from'../../hooks/useCrawlConfig';

interface StrategyOption {
 id: ExtractionStrategy;
 label: string;
 description: string;
 Icon: LucideIcon;
}

const STRATEGIES: StrategyOption[] = [
 { id:'llm', label:'LLM-based', description:'AI-powered extraction', Icon: Sparkles },
 { id:'css', label:'CSS/JSON', description:'Selector-based extraction', Icon: Code },
 { id:'regex', label:'Regex', description:'Pattern-based extraction', Icon: Search },
 { id:'cosine', label:'Cosine', description:'Semantic similarity extraction', Icon: GitBranch },
];

export default function ExtractionStrategySelector() {
 const { crawlConfig, updateTopLevel } = useCrawlConfig();
 const selected = crawlConfig.extractionStrategy;

 return (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {STRATEGIES.map(({ id, label, description, Icon }) => {
 const isSelected = selected === id;
 return (
 <button
 key={id}
 type="button"
 onClick={() => updateTopLevel('extractionStrategy', id)}
 className={`relative flex flex-col items-center gap-2 border-2 p-4 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan
 ${isSelected
 ?'border-cyan bg-cyan/10'
 :'border-border bg-surface hover:border-cyan hover:bg-raised'
 }`}
 >
 {isSelected && (
 <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-cyan">
  <Check size={12} className="text-void" />
 </span>
 )}
 <Icon
 size={24}
 className={isSelected
 ?'text-cyan'
 :'text-text-mute'
 }
 />
 <span className={`text-sm font-semibold ${isSelected ?'text-cyan' :'text-text'}`}>
 {label}
 </span>
 <span className="text-xs text-text-dim leading-tight">
 {description}
 </span>
 </button>
 );
 })}
 </div>
 );
}
