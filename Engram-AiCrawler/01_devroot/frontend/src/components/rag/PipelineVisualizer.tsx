import { Fragment } from'react';
import { ArrowRight, CheckCircle, Cpu, Database, FileInput, Scissors, Search } from'lucide-react';

const STAGES = [
 { id:'ingest', label:'Ingest', icon: FileInput },
 { id:'chunk', label:'Chunk', icon: Scissors },
 { id:'embed', label:'Embed', icon: Cpu },
 { id:'store', label:'Store', icon: Database },
 { id:'retrieve', label:'Retrieve', icon: Search },
];

interface PipelineVisualizerProps {
 activeStage: string;
 onStageClick: (stage: string) => void;
}

function getStageStatus(stageId: string, activeStage: string):'active' |'completed' |'pending' {
 const activeIdx = STAGES.findIndex((s) => s.id === activeStage);
 const currentIdx = STAGES.findIndex((s) => s.id === stageId);
 if (currentIdx === activeIdx) return'active';
 if (currentIdx < activeIdx) return'completed';
 return'pending';
}

export default function PipelineVisualizer({ activeStage, onStageClick }: PipelineVisualizerProps) {
 return (
 <div className="bg-surface p-6 border border-border">
 <div className="flex items-center justify-center gap-2">
 {STAGES.map((stage, index) => {
 const Icon = stage.icon;
 const status = getStageStatus(stage.id, activeStage);

 return (
 <Fragment key={stage.id}>
 <button
 type="button"
 onClick={() => onStageClick(stage.id)}
 className={[
'flex flex-col items-center gap-2 p-4 border-2 transition-all cursor-pointer min-w-[100px]',
 status ==='active'
 ?'border-cyan bg-cyan/10'
 : status ==='completed'
 ?'border-plasma bg-plasma/10'
 :'border-border bg-void hover:border-border',
 ].join('')}
 >
 <div
 className={[
'p-2 rounded-full',
 status ==='active'
 ?'bg-cyan/20'
 : status ==='completed'
 ?'bg-plasma/20'
 :'bg-abyss',
 ].join('')}
 >
 {status ==='completed' ? (
 <CheckCircle size={20} className="text-plasma" />
 ) : (
 <Icon
 size={20}
 className={
 status ==='active'
 ?'text-cyan'
 :'text-text-mute'
 }
 />
 )}
 </div>
 <span
 className={[
'text-sm font-medium',
 status ==='active'
 ?'text-cyan'
 : status ==='completed'
 ?'text-plasma'
 :'text-text-dim',
 ].join('')}
 >
 {stage.label}
 </span>
 </button>
 {index < STAGES.length - 1 && (
 <ArrowRight size={20} className="text-text-mute shrink-0" />
 )}
 </Fragment>
 );
 })}
 </div>
 </div>
 );
}
