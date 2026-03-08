import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Code, Database, Camera, FileArchive, FileQuestion, Check, Copy } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { api } from '../lib/api';
import MarkdownRenderer from '../components/results/MarkdownRenderer';
import { EmptyState } from '../components/EmptyState';
import JSONTreeViewer from '../components/results/JSONTreeViewer';
import ScreenshotViewer from '../components/results/ScreenshotViewer';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface CrawlResult {
 crawl_id: string;
 url: string;
 status: string;
 extraction_type: string;
 markdown: string | null;
 html: string | null;
 extracted_content: string | null;
 screenshot: string | null;
 pdf: string | null;
 error_message: string | null;
 created_at: string;
 completed_at: string | null;
 metadata: Record<string, unknown> | null;
}

type TabId ='markdown' |'html' |'extracted' |'screenshot' |'pdf';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
 { id:'markdown', label:'Markdown', icon: FileText },
 { id:'html', label:'Raw HTML', icon: Code },
 { id:'extracted', label:'Extracted Data', icon: Database },
 { id:'screenshot', label:'Screenshots', icon: Camera },
 { id:'pdf', label:'PDF', icon: FileArchive },
];

function LoadingSkeleton() {
 return (
 <div className="animate-pulse space-y-4">
 <div className="h-8 bg-surface w-1/3" />
 <div className="h-4 bg-surface w-2/3" />
  <div className="flex gap-2 overflow-x-auto">
  {(['t1','t2','t3','t4','t5'] as const).map((k) => (
  <div key={k} className="h-10 w-20 sm:w-24 bg-surface flex-shrink-0" />
  ))}
  </div>
  <div className="h-64 sm:h-96 bg-surface" />
 </div>
 );
}

function HtmlViewer({ html }: { html: string }) {
 const [copied, setCopied] = useState(false);

 const handleCopy = async () => {
 await navigator.clipboard.writeText(html);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 return (
 <div className="h-full flex flex-col">
 <div className="flex justify-end mb-3 flex-shrink-0">
  <Button variant="ghost" size="sm" onClick={handleCopy} leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}>
  {copied ?'Copied!' :'Copy HTML'}
  </Button>
 </div>
 <pre className="flex-1 overflow-auto bg-void p-4 text-xs font-mono text-text leading-relaxed">
 {html}
 </pre>
 </div>
 );
}

function PdfViewer({ pdfBase64, crawlId }: { pdfBase64: string; crawlId: string }) {
 const pdfSrc = pdfBase64.startsWith('data:')
 ? pdfBase64
 : `data:application/pdf;base64,${pdfBase64}`;

 return (
 <div className="h-full flex flex-col gap-3">
 <div className="flex justify-end flex-shrink-0">
  <Button
  variant="primary"
  size="sm"
  onClick={() => {
   const link = document.createElement('a');
   link.href = `/api/crawl/${crawlId}/pdf`;
   link.download = `crawl-${crawlId}.pdf`;
   link.click();
  }}
  >
  Download PDF
  </Button>
 </div>
 <iframe
 src={pdfSrc}
 className="flex-1 border border-border"
 title="PDF Preview"
 />
 </div>
 );
}

export default function ResultViewerPage() {
  const { crawlId } = useParams<{ crawlId: string }>();
 const [result, setResult] = useState<CrawlResult | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState<TabId>('markdown');

 useEffect(() => {
 if (!crawlId) return;

 const fetch = async () => {
 try {
 setLoading(true);
      const { data } = await api.get<CrawlResult>(`/crawl/status/${crawlId}`);
 setResult(data);

 if (data.markdown) setActiveTab('markdown');
 else if (data.html) setActiveTab('html');
 else if (data.extracted_content) setActiveTab('extracted');
 else if (data.screenshot) setActiveTab('screenshot');
 } catch (err) {
 setError(err instanceof Error ? err.message :'Failed to load results');
 } finally {
 setLoading(false);
 }
 };

 fetch();
 }, [crawlId]);

  if (!crawlId) return null;

  const visibleTabs = TABS.filter((tab) => {
 if (!result) return false;
 switch (tab.id) {
 case'markdown': return !!result.markdown;
 case'html': return !!result.html;
 case'extracted': return !!result.extracted_content;
 case'screenshot': return !!result.screenshot;
 case'pdf': return !!result.pdf;
 default: return false;
 }
 });

 const screenshots = result?.screenshot ? [result.screenshot] : [];
 let extractedData: unknown = null;
 if (result?.extracted_content) {
 try {
 extractedData = JSON.parse(result.extracted_content);
 } catch {
 extractedData = result.extracted_content;
 }
 }

  return (
  <ErrorBoundary fallback={<div className="p-8 text-neon-r text-center">Failed to load crawl results</div>}>
  <div className="min-h-screen bg-void text-text">
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
 <div className="mb-6">
 <Link
 to="/crawl/history"
 className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-text mb-4 transition-colors"
 >
 <ArrowLeft size={16} />
 Back to History
 </Link>

 {result && (
 <div>
 <h1 className="text-2xl font-bold text-text mb-1">
 Crawl Results
 </h1>
  <div className="flex flex-wrap items-center gap-3 text-sm text-text-dim">
 <a
 href={result.url}
 target="_blank"
 rel="noopener noreferrer"
  className="text-cyan hover:underline truncate max-w-[200px] sm:max-w-md"
 >
 {result.url}
 </a>
 <span>•</span>
 <span className="capitalize">{result.extraction_type}</span>
 <span>•</span>
            <Badge
              variant={result.status === 'completed' ? 'success' : result.status === 'failed' ? 'danger' : 'volt'}
              dot
            >
              {result.status}
            </Badge>
 </div>
 </div>
 )}
 </div>

 {loading && <LoadingSkeleton />}

          {error && (
            <Alert variant="danger">{error}</Alert>
          )}

          {result?.status === 'failed' && (
            <Alert variant="danger" title="Crawl Failed">
              {result.error_message ?? 'The crawl did not complete successfully.'}
            </Alert>
          )}

 {result && result.status !=='failed' && !loading && visibleTabs.length === 0 && (
  <Card>
  <CardBody>
   <EmptyState
   icon={<FileQuestion size={48} />}
   title="No content available"
   description="This crawl completed but returned no extractable content (markdown, HTML, screenshots, or PDF)."
   />
  </CardBody>
  </Card>
 )}

          {result && result.status !== 'failed' && !loading && visibleTabs.length > 0 && (
            <Card>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
                <TabsList>
                  {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger key={tab.id} value={tab.id}>
                        <Icon size={15} />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                <CardBody className="min-h-[300px] sm:min-h-[500px] max-h-[70vh] overflow-auto">
                  <TabsContent value="markdown">
                    {result.markdown && <MarkdownRenderer content={result.markdown} />}
                  </TabsContent>
                  <TabsContent value="html">
                    {result.html && <HtmlViewer html={result.html} />}
                  </TabsContent>
                  <TabsContent value="extracted">
                    {extractedData !== null && (
                      typeof extractedData === 'object' ? (
                        <JSONTreeViewer data={extractedData} />
                      ) : (
                        <pre className="text-sm font-mono text-text whitespace-pre-wrap">
                          {String(extractedData)}
                        </pre>
                      )
                    )}
                  </TabsContent>
                  <TabsContent value="screenshot">
                    {screenshots.length > 0 && <ScreenshotViewer screenshots={screenshots} crawlId={crawlId} />}
                  </TabsContent>
                  <TabsContent value="pdf">
                    {result.pdf && crawlId && <PdfViewer pdfBase64={result.pdf} crawlId={crawlId} />}
                  </TabsContent>
                </CardBody>
              </Tabs>
            </Card>
          )}
  </div>
  </div>
  </ErrorBoundary>
  );
}
