import { useState, useEffect, useRef, useCallback, Fragment } from'react';
import { AlertCircle, CheckCircle2, Loader2, Play, XCircle } from'lucide-react';
import { useToast } from'../Toast';
import { api } from'../../lib/api';

export interface RAGPipelineConfig {
 collectionName: string;
 similarityThreshold: number;
 metadataFields: {
 source_url: boolean;
 crawl_date: boolean;
 chunk_number: boolean;
 content_hash: boolean;
 };
}

interface JobStatus {
 job_id: string;
 status:'pending' |'running' |'completed' |'failed';
 progress: number;
 stage: string | null;
 total_chunks: number | null;
 processed_chunks: number | null;
 error_message: string | null;
}

interface ProcessMonitorProps {
 content: string;
 config: RAGPipelineConfig;
}

const STAGE_ORDER = ['chunking','embedding','storing'] as const;
type StageKey = (typeof STAGE_ORDER)[number];

const STAGE_LABELS: Record<StageKey, string> = {
 chunking:'Chunking',
 embedding:'Embedding',
 storing:'Storing',
};

function currentStageIndex(stage: string | null): number {
 if (!stage) return -1;
 return STAGE_ORDER.findIndex((s) => stage.toLowerCase().includes(s));
}

function stageDisplayLabel(stage: string | null): string {
 if (!stage) return'Initializing…';
 const idx = STAGE_ORDER.findIndex((s) => stage.toLowerCase().includes(s));
 return idx >= 0 ? STAGE_LABELS[STAGE_ORDER[idx]] : stage;
}

export function ProcessMonitor({ content, config }: ProcessMonitorProps) {
 const toast = useToast();
 const [isProcessing, setIsProcessing] = useState(false);
 const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
 const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

 const stopPolling = useCallback(() => {
 if (pollRef.current !== null) {
 clearInterval(pollRef.current);
 pollRef.current = null;
 }
 }, []);

 useEffect(() => {
 return () => stopPolling();
 }, [stopPolling]);

 const pollStatus = useCallback(
 async (jobId: string) => {
 try {
 const response = await api.get<JobStatus>(`/rag/status/${jobId}`);
 const status = response.data;
 setJobStatus(status);
 if (status.status ==='completed') {
 stopPolling();
 setIsProcessing(false);
 toast.success('RAG pipeline completed successfully');
 } else if (status.status ==='failed') {
 stopPolling();
 setIsProcessing(false);
 toast.error('Pipeline failed', { detail: status.error_message ?? undefined });
 }
 } catch {
 stopPolling();
 setIsProcessing(false);
 toast.error('Failed to fetch pipeline status');
 }
 },
 [stopPolling, toast],
 );

 const handleProcess = async () => {
 if (!content.trim()) {
 toast.warning('No content to process');
 return;
 }
 if (!config.collectionName) {
 toast.warning('Select a target collection first');
 return;
 }
 setIsProcessing(true);
 setJobStatus(null);
 try {
 const response = await api.post<{ job_id: string }>('/rag/process', {
 content,
 config,
 });
 const jobId = response.data.job_id;
 pollRef.current = setInterval(() => {
 void pollStatus(jobId);
 }, 2000);
 } catch {
 setIsProcessing(false);
 toast.error('Failed to start RAG pipeline');
 }
 };

 const isComplete = jobStatus?.status ==='completed';
 const isFailed = jobStatus?.status ==='failed';
 const progress = jobStatus?.progress ?? 0;
 const stageIdx = currentStageIndex(jobStatus?.stage ?? null);

 return (
 <div className="space-y-4">
 <button
 type="button"
 onClick={() => void handleProcess()}
 disabled={isProcessing || !content.trim() || !config.collectionName}
 className="w-full flex items-center justify-center gap-2.5 px-6 py-3 bg-cyan hover:bg-cyan-dim disabled:bg-border disabled:cursor-not-allowed text-text font-semibold transition-colors"
 >
 {isProcessing ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : isComplete ? (
 <CheckCircle2 className="w-5 h-5" />
 ) : isFailed ? (
 <XCircle className="w-5 h-5" />
 ) : (
 <Play className="w-5 h-5" />
 )}
 {isProcessing
 ?'Processing…'
 : isComplete
 ?'Process Again'
 : isFailed
 ?'Retry'
 :'Process Content'}
 </button>

 {(isProcessing || jobStatus) && (
 <div className="space-y-4 p-4 bg-void border border-border">
 <div className="flex items-center">
 {STAGE_ORDER.map((stage, idx) => {
 const isActive = stageIdx === idx;
 const isDone = isComplete || stageIdx > idx;
 return (
 <Fragment key={stage}>
 <div
 className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
 isDone
 ?'bg-plasma/20 text-plasma'
 : isActive
 ?'bg-cyan/20 text-cyan'
 :'bg-abyss text-text-dim'
 }`}
 >
 {isDone ? (
 <CheckCircle2 className="w-3 h-3" />
 ) : isActive ? (
 <Loader2 className="w-3 h-3 animate-spin" />
 ) : (
 <span className="w-3 h-3 rounded-full border-2 border-current" />
 )}
 {STAGE_LABELS[stage]}
 </div>
 {idx < STAGE_ORDER.length - 1 && (
 <div
 className={`flex-1 h-px mx-1 ${
 isDone
 ?'bg-plasma'
 :'bg-surface'
 }`}
 />
 )}
 </Fragment>
 );
 })}
 </div>

 <div className="space-y-1.5">
 <div className="flex items-center justify-between text-xs text-text-dim">
 <span>{stageDisplayLabel(jobStatus?.stage ?? null)}</span>
 <span className="font-mono font-semibold">{Math.round(progress)}%</span>
 </div>
 <div className="h-2.5 w-full rounded-full bg-surface overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-700 ease-out ${
 isFailed
 ?'bg-neon-r'
 : isComplete
 ?'bg-plasma'
 :'bg-cyan'
 }`}
 style={{ width: `${Math.min(progress, 100)}%`}}
 />
 </div>
 </div>

 {jobStatus !== null &&
 jobStatus.total_chunks !== null &&
 jobStatus.processed_chunks !== null && (
 <p className="text-xs text-text-dim">
 {jobStatus.processed_chunks} / {jobStatus.total_chunks} chunks processed
 </p>
 )}

 {isFailed && jobStatus?.error_message && (
 <div className="flex items-start gap-2 p-3 bg-neon-r/10 border border-neon-r/30">
 <AlertCircle className="w-4 h-4 text-neon-r flex-shrink-0 mt-0.5" />
 <p className="text-sm text-neon-r">{jobStatus.error_message}</p>
 </div>
 )}

 {isComplete && (
 <div className="flex items-center gap-2 p-3 bg-plasma/10 border border-plasma/30">
 <CheckCircle2 className="w-4 h-4 text-plasma flex-shrink-0" />
 <p className="text-sm text-plasma">
 Pipeline completed successfully
 </p>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
