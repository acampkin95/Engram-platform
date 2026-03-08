import { useCallback, useEffect, useState } from'react';
import { Cpu, Database, RefreshCw, Save, Search } from'lucide-react';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useToast } from'../components/Toast';
import PipelineVisualizer from'../components/rag/PipelineVisualizer';
import ChunkingConfigPanel from'../components/rag/ChunkingConfig';
import { api } from'../lib/api';
import type { RAGChunkingConfig, ChunkPreview, RAGPipelineConfig } from'../lib/schemas';

const DEFAULT_CHUNKING: RAGChunkingConfig = {
 strategy:'fixed_token',
 chunk_size: 1024,
 overlap_rate: 0.1,
 word_count_threshold: 50,
};

const DEFAULT_CONFIG: RAGPipelineConfig = {
 chunking: DEFAULT_CHUNKING,
 embedding: {
 model_name:'all-MiniLM-L6-v2',
 batch_size: 32,
 dimensions: 384,
 },
 target_collection:'rag_default',
};

export default function RAGPipelinePage() {
 const toast = useToast();
 const [pipelineConfig, setPipelineConfig] = useState<RAGPipelineConfig>(DEFAULT_CONFIG);
 const [activeStage, setActiveStage] = useState('chunk');
 const [previewChunks, setPreviewChunks] = useState<ChunkPreview[]>([]);
 const [isPreviewLoading, setIsPreviewLoading] = useState(false);
 const [isConfigLoading, setIsConfigLoading] = useState(true);

 const fetchConfig = useCallback(async () => {
 setIsConfigLoading(true);
 try {
 const response = await api.get<RAGPipelineConfig>('/rag/config');
 setPipelineConfig(response.data);
 } catch {
 toast.error('Failed to load RAG configuration');
 } finally {
 setIsConfigLoading(false);
 }
 }, [toast]);

 useEffect(() => {
 fetchConfig();
 }, [fetchConfig]);

 const handleStageClick = useCallback((stage: string) => {
 setActiveStage(stage);
 const el = document.getElementById(`rag-section-${stage}`);
 el?.scrollIntoView({ behavior:'smooth', block:'start' });
 }, []);

 const handleChunkingChange = useCallback((chunking: RAGChunkingConfig) => {
 setPipelineConfig((prev) => ({ ...prev, chunking }));
 }, []);

 const handlePreview = useCallback(async () => {
 setIsPreviewLoading(true);
 try {
 const response = await api.post<{ chunks: ChunkPreview[]; total: number }>(
'/rag/preview-chunking',
 {
 content:'Sample content for preview. This is a test paragraph to demonstrate chunking behavior. The content will be split according to the selected strategy and configuration parameters. Each chunk will maintain context through the configured overlap rate, ensuring no information is lost between segments.',
 config: pipelineConfig.chunking,
 }
 );
 setPreviewChunks(response.data.chunks);
 toast.success(`Generated ${response.data.total} chunk${response.data.total !== 1 ?'s' :''}`);
 } catch {
 toast.error('Failed to generate chunk preview');
 } finally {
 setIsPreviewLoading(false);
 }
 }, [pipelineConfig.chunking, toast]);

 const handleSaveConfig = async () => {
 try {
 await api.put('/rag/config', pipelineConfig);
 toast.success('Configuration saved');
 } catch {
 toast.error('Failed to save configuration');
 }
 };

  return (
  <div className="min-h-screen bg-void text-text">
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
  <div className="flex justify-between items-center">
  <h1 className="text-2xl font-bold text-text">
  RAG Pipeline
  </h1>
 <div className="flex items-center gap-3">
   <Button
   variant="secondary"
   onClick={fetchConfig}
   disabled={isConfigLoading}
   leftIcon={<RefreshCw className={cn('w-4 h-4', isConfigLoading && 'animate-spin')} />}
   >
   Refresh
   </Button>
  <Button
  variant="primary"
  onClick={handleSaveConfig}
  leftIcon={<Save className="w-4 h-4" />}
  >
  Save Config
  </Button>
 </div>
 </div>

  <PipelineVisualizer activeStage={activeStage} onStageClick={handleStageClick} />

  {isConfigLoading ? (
    <div className="space-y-4">
      <Card className="animate-pulse">
        <CardBody>
          <div className="h-6 bg-abyss/50 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            <div className="h-10 bg-abyss/50 rounded w-full" />
            <div className="h-10 bg-abyss/50 rounded w-full" />
            <div className="h-10 bg-abyss/50 rounded w-3/4" />
          </div>
        </CardBody>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardBody>
              <div className="h-5 bg-abyss/50 rounded w-1/2 mb-3" />
              <div className="h-4 bg-abyss/50 rounded w-3/4" />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  ) : (
    <>
      <Card id="rag-section-chunk">
        <CardHeader>
          <h2 className="text-lg font-semibold text-text">
            Chunking Configuration
          </h2>
        </CardHeader>
        <CardBody>
          <ChunkingConfigPanel
            config={pipelineConfig.chunking}
            onChange={handleChunkingChange}
            onPreview={handlePreview}
            isLoading={isPreviewLoading}
          />

          {previewChunks.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-text mb-3">
                Chunk Preview ({previewChunks.length} chunks)
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {previewChunks.map((chunk) => (
                  <div
                    key={chunk.chunk_number}
                    className="p-3 border border-border bg-void"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-cyan">
                        Chunk {chunk.chunk_number}
                      </span>
                      <span className="text-xs text-text-dim">
                        {chunk.token_count} tokens
                      </span>
                    </div>
                    <p className="text-sm text-text line-clamp-3">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card id="rag-section-embed">
          <CardHeader>
            <h2 className="text-lg font-semibold text-text flex items-center gap-3">
              <Cpu size={20} className="text-text-mute" />
              Embedding Configuration
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-dim">
              Model: {pipelineConfig.embedding.model_name} · Batch size: {pipelineConfig.embedding.batch_size} · Dimensions: {pipelineConfig.embedding.dimensions}
            </p>
          </CardBody>
        </Card>

        <Card id="rag-section-store">
          <CardHeader>
            <h2 className="text-lg font-semibold text-text flex items-center gap-3">
              <Database size={20} className="text-text-mute" />
              Vector Store
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-dim">
              Target collection: {pipelineConfig.target_collection}
            </p>
          </CardBody>
        </Card>

        <Card id="rag-section-retrieve">
          <CardHeader>
            <h2 className="text-lg font-semibold text-text flex items-center gap-3">
              <Search size={20} className="text-text-mute" />
              Retrieval Configuration
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-dim">
              Retrieval settings will be configured here.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )}
  </div>
  </div>
  );
}
