import { useNavigate } from'react-router-dom';
import { RotateCcw, Play } from'lucide-react';
import { Button, Card, CardHeader, CardBody } from'@/components/ui';
import { useCrawlConfig } from'../hooks/useCrawlConfig';
import { useToast } from'../components/Toast';
import URLInput from'../components/crawl/URLInput';
import ExtractionStrategySelector from'../components/crawl/ExtractionStrategySelector';
import BrowserConfigPanel from'../components/crawl/BrowserConfigPanel';
import WaitConditionBuilder from'../components/crawl/WaitConditionBuilder';
import CrawlOptionsPanel from'../components/crawl/CrawlOptionsPanel';

export default function CrawlConfigPage() {
 const navigate = useNavigate();
 const toast = useToast();
 const { isSubmitting, resetConfig, submitCrawl } = useCrawlConfig();

 async function handleSubmit() {
 const ok = await submitCrawl();
 if (ok) {
 toast.success('Crawl started successfully!');
 navigate('/data');
 } else {
 toast.error('Failed to start crawl. Check the form for errors.');
 }
 }

 return (
 <div className="min-h-screen bg-void py-8 px-4 sm:px-6 lg:px-8">
 <div className="max-w-3xl mx-auto">
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
 <h1 className="text-2xl font-bold text-text">New Crawl</h1>
 <div className="flex items-center gap-3">
  <Button variant="secondary" size="md" leftIcon={<RotateCcw size={16} />} onClick={resetConfig}>Reset</Button>
  <Button variant="primary" size="md" loading={isSubmitting} leftIcon={<Play size={16} />} onClick={handleSubmit}>{isSubmitting ? 'Starting…' : 'Start Crawl'}</Button>
 </div>
 </div>

 <div className="flex flex-col gap-6">
 <Card>
  <CardHeader>
   <h2 className="text-sm font-semibold uppercase tracking-wide text-text-dim">URL(s)</h2>
  </CardHeader>
  <CardBody>
   <URLInput />
  </CardBody>
 </Card>

 <Card>
  <CardHeader>
   <h2 className="text-sm font-semibold uppercase tracking-wide text-text-dim">Extraction Strategy</h2>
  </CardHeader>
  <CardBody>
   <ExtractionStrategySelector />
  </CardBody>
 </Card>

 <BrowserConfigPanel />
 <WaitConditionBuilder />
 <CrawlOptionsPanel />
 </div>
 </div>
 </div>
 );
}
