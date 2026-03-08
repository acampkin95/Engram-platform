import { useState, useEffect, useCallback, useRef } from'react';
import {
 Bot,
 ChevronDown,
 Loader2,
 AlertCircle,
 PlayCircle,
 Hash,
} from'lucide-react';

export interface LLMConfig {
 model: string;
 temperature: number;
 prompt: string;
}

interface LLMPromptBuilderProps {
 onConfigChange?: (config: LLMConfig) => void;
 initialConfig?: Partial<LLMConfig>;
}

interface Model {
 id: string;
 name: string;
}

interface PreviewResult {
 preview: unknown;
 tokens_used?: number;
}

const DEFAULT_PROMPT = `Extract the following information from the page:

Page URL: {{url}}
Page Title: {{title}}
Content: {{content}}

Return JSON with fields: title, summary, entities[]`;

const AVAILABLE_VARIABLES = ['{{url}}','{{title}}','{{content}}'];

const DEBOUNCE_MS = 300;

function estimateTokens(text: string): number {
 return Math.ceil(text.length / 4);
}

function buildPromptSegments(
 text: string,
): { text: string; isVar: boolean; id: string }[] {
 const VAR_SPLIT = /(\{\{[^}]+\}\})/g;
 const VAR_TEST = /\{\{[^}]+\}\}/;
 return text.split(VAR_SPLIT).map((part, i) => ({
 text: part,
 isVar: VAR_TEST.test(part),
 id: `seg-${i}`,
 }));
}

function LoadingDots() {
 return (
 <span className="inline-flex items-center gap-0.5">
 <span className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
 <span className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
 <span className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
 </span>
 );
}

export default function LLMPromptBuilder({
 onConfigChange,
 initialConfig,
}: LLMPromptBuilderProps) {
 const [models, setModels] = useState<Model[]>([]);
 const [modelsLoading, setModelsLoading] = useState(true);
 const [modelsError, setModelsError] = useState<string | null>(null);

 const [selectedModel, setSelectedModel] = useState<string>(
 initialConfig?.model ??'',
 );
 const [temperature, setTemperature] = useState<number>(
 initialConfig?.temperature ?? 0.7,
 );
 const [prompt, setPrompt] = useState<string>(
 initialConfig?.prompt ?? DEFAULT_PROMPT,
 );
 const [debouncedPrompt, setDebouncedPrompt] = useState<string>(
 initialConfig?.prompt ?? DEFAULT_PROMPT,
 );

 const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
 const [previewLoading, setPreviewLoading] = useState(false);
 const [previewError, setPreviewError] = useState<string | null>(null);

 const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const hasSetDefaultModel = useRef(false);

 const tokenEstimate = estimateTokens(debouncedPrompt);
 const promptSegments = buildPromptSegments(prompt);

 useEffect(() => {
 let cancelled = false;
 setModelsLoading(true);
 setModelsError(null);

 const FALLBACK: Model[] = [{ id:'lm-studio-default', name:'LM Studio Default' }];

 fetch('/api/lm-studio/models')
 .then((res) => {
 if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
 return res.json() as Promise<{ models: Model[] }>;
 })
 .then((data) => {
 if (cancelled) return;
 const list = data.models?.length ? data.models : FALLBACK;
 setModels(list);
 if (!hasSetDefaultModel.current) {
 hasSetDefaultModel.current = true;
 setSelectedModel((prev) => prev || list[0].id);
 }
 })
 .catch((err: unknown) => {
 if (cancelled) return;
 setModelsError(err instanceof Error ? err.message :'Failed to load models');
 setModels(FALLBACK);
 if (!hasSetDefaultModel.current) {
 hasSetDefaultModel.current = true;
 setSelectedModel((prev) => prev || FALLBACK[0].id);
 }
 })
 .finally(() => {
 if (!cancelled) setModelsLoading(false);
 });

 return () => { cancelled = true; };
 }, []);

 useEffect(() => {
 if (debounceTimer.current) clearTimeout(debounceTimer.current);
 debounceTimer.current = setTimeout(() => setDebouncedPrompt(prompt), DEBOUNCE_MS);
 return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
 }, [prompt]);

 useEffect(() => {
 if (!onConfigChange) return;
 onConfigChange({ model: selectedModel, temperature, prompt: debouncedPrompt });
 }, [selectedModel, temperature, debouncedPrompt, onConfigChange]);

 const handleVariableInsert = useCallback((variable: string) => {
 setPrompt((prev) => `${prev}${variable}`);
 }, []);

 const handlePreview = useCallback(async () => {
 setPreviewLoading(true);
 setPreviewError(null);
 setPreviewResult(null);

 try {
 const res = await fetch('/api/extraction/preview', {
 method:'POST',
 headers: {'Content-Type':'application/json' },
 body: JSON.stringify({ model: selectedModel, temperature, prompt: debouncedPrompt }),
 });

 if (!res.ok) {
 const text = await res.text();
 throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
 }

 setPreviewResult((await res.json()) as PreviewResult);
 } catch (err: unknown) {
 setPreviewError(err instanceof Error ? err.message :'Preview request failed');
 } finally {
 setPreviewLoading(false);
 }
 }, [selectedModel, temperature, debouncedPrompt]);

 return (
 <div className="border border-border bg-surface">
 <div className="flex items-center gap-2 border-b border-border px-4 py-3">
 <Bot className="h-4 w-4 text-cyan" />
 <h2 className="text-sm font-semibold text-text">
 LLM Prompt Builder
 </h2>
 </div>

 <div className="space-y-5 p-4">
 <div className="flex flex-wrap items-end gap-4">
 <div className="min-w-[180px] flex-1">
 <label
 htmlFor="llm-model"
 className="mb-1.5 block text-xs font-medium text-text-dim"
 >
 Model
 </label>
 <div className="relative">
 <select
 id="llm-model"
 value={selectedModel}
 onChange={(e) => setSelectedModel(e.target.value)}
 disabled={modelsLoading}
 className={[
'w-full appearance-none border px-3 py-2 pr-8 text-sm',
'bg-void text-text',
'focus:outline-none focus:ring-2 focus:ring-cyan',
'',
'border-border',
'disabled:cursor-not-allowed disabled:opacity-60',
 ].join('')}
 >
 {modelsLoading && <option value="">Loading models…</option>}
 {!modelsLoading &&
 models.map((m) => (
 <option key={m.id} value={m.id}>
 {m.name || m.id}
 </option>
 ))}
 </select>
 <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-mute" />
 </div>

 {modelsError && (
 <div className="mt-1.5 flex items-center gap-1 text-xs text-volt">
 <AlertCircle className="h-3 w-3 shrink-0" />
 <span>Using fallback model ({modelsError})</span>
 </div>
 )}
 </div>

 <div className="min-w-[200px] flex-1">
 <div className="mb-1.5 flex items-center justify-between">
 <label
 htmlFor="llm-temperature"
 className="text-xs font-medium text-text-dim"
 >
 Temperature
 </label>
 <span className="tabular-nums text-xs font-semibold text-cyan">
 {temperature.toFixed(1)}
 </span>
 </div>
 <input
 id="llm-temperature"
 type="range"
 min={0}
 max={2}
 step={0.1}
 value={temperature}
 onChange={(e) => setTemperature(parseFloat(e.target.value))}
 className={[
'h-2 w-full cursor-pointer appearance-none rounded-full',
'bg-surface accent-cyan',
'',
 ].join('')}
 />
 <div className="mt-0.5 flex justify-between text-[10px] text-text-mute">
 <span>0.0</span>
 <span>1.0</span>
 <span>2.0</span>
 </div>
 </div>
 </div>

 <div>
 <label
 htmlFor="llm-prompt"
 className="mb-1.5 block text-xs font-medium text-text-dim"
 >
 Prompt Template
 </label>

 <textarea
 id="llm-prompt"
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 rows={8}
 spellCheck={false}
 placeholder="Write your extraction prompt…"
 className={[
'w-full resize-y border px-3 py-2 font-mono text-sm leading-relaxed',
'bg-void text-text placeholder-text-mute',
'focus:outline-none focus:ring-2 focus:ring-cyan',
'border-border',
'',
 ].join('')}
 />

 {promptSegments.some((s) => s.isVar) && (
 <div
 aria-hidden="true"
 className={[
'mt-2 whitespace-pre-wrap break-words border px-3 py-2 font-mono text-xs leading-relaxed',
'border-border bg-void/50',
'',
'text-text',
 ].join('')}
 >
 <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-mute">
 Variable Preview
 </span>
 {promptSegments.map((seg) =>
 seg.isVar ? (
 <mark
 key={seg.id}
 className="bg-cyan/20 px-0.5 font-semibold text-cyan"
 >
 {seg.text}
 </mark>
 ) : (
 <span key={seg.id}>{seg.text}</span>
 ),
 )}
 </div>
 )}

 <div className="mt-2 flex flex-wrap items-center gap-2">
 <span className="text-xs text-text-dim">
 Available variables:
 </span>
 {AVAILABLE_VARIABLES.map((v) => (
 <button
 key={v}
 type="button"
 onClick={() => handleVariableInsert(v)}
 title={`Insert ${v} at end of prompt`}
 className={[
' border px-2 py-0.5 font-mono text-xs transition-colors',
'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan',
'border-cyan/30 bg-cyan/10 text-cyan hover:bg-cyan/20',
'',
 ].join('')}
 >
 {v}
 </button>
 ))}
 </div>
 </div>

 <button
 type="button"
 onClick={handlePreview}
 disabled={previewLoading || !selectedModel || !debouncedPrompt.trim()}
 className={[
'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2',
'bg-cyan text-text hover:bg-cyan-dim',
'',
'',
'disabled:cursor-not-allowed disabled:opacity-50',
 ].join('')}
 >
 {previewLoading ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin" />
 Previewing
 <LoadingDots />
 </>
 ) : (
 <>
 <PlayCircle className="h-4 w-4" />
 Preview Extraction
 </>
 )}
 </button>

 {(previewResult || previewError) && (
 <div>
 <p className="mb-1.5 text-xs font-medium text-text-dim">
 Preview Results
 </p>

 {previewError ? (
 <div
 className={[
'flex items-start gap-2 border px-3 py-2.5 text-sm',
'border-neon-r/30 bg-neon-r/10 text-neon-r',
'',
 ].join('')}
 >
 <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
 <span>{previewError}</span>
 </div>
 ) : (
 <pre
 className={[
'max-h-64 overflow-auto border px-3 py-2.5 font-mono text-xs leading-relaxed',
'border-border bg-void text-text',
'',
 ].join('')}
 >
 {JSON.stringify(previewResult?.preview, null, 2)}
 </pre>
 )}
 </div>
 )}

 <div className="flex items-center gap-1.5 border-t border-border pt-3">
 <Hash className="h-3.5 w-3.5 text-text-mute" />
 <span className="text-xs text-text-dim">
 Token estimate:{''}
 <span className="font-semibold text-text">
 ~{tokenEstimate.toLocaleString()} tokens
 </span>
 </span>
 </div>
 </div>
 </div>
 );
}
