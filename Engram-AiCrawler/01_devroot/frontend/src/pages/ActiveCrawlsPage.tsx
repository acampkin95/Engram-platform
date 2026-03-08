import { useEffect } from'react';
import { useNavigate } from'react-router-dom';
import { Activity } from'lucide-react';
import { useCrawlStore } from'../stores/crawlStore';
import { Button, Card, CardBody } from '@/components/ui';

export default function ActiveCrawlsPage() {
 const navigate = useNavigate();
 const { jobs, activeCrawlIds } = useCrawlStore();

 const activeJobs = activeCrawlIds.map((id) => jobs[id]).filter(Boolean);

 useEffect(() => {
 if (activeJobs.length === 1) {
 navigate(`/crawl/${activeJobs[0].crawl_id}/results`, { replace: true });
 }
 }, [activeJobs, navigate]);

  if (activeJobs.length === 0) {
  return (
  <div className="min-h-screen bg-void text-text flex items-center justify-center px-4">
  <Card className="max-w-md w-full">
  <CardBody className="text-center py-12">
  <div className="w-16 h-16 bg-abyss rounded-full flex items-center justify-center mx-auto mb-4">
  <Activity size={28} className="text-text-mute" />
  </div>
  <h2 className="text-lg font-semibold text-text mb-2">No Active Crawls</h2>
  <p className="text-sm text-text-dim mb-4">
  No crawls are currently running or queued.
  </p>
  <Button onClick={() => navigate('/crawl/new')}>
  Start a New Crawl
  </Button>
  </CardBody>
  </Card>
  </div>
  );
  }

  return (
  <div className="min-h-screen bg-void text-text">
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <h1 className="text-2xl font-bold text-text mb-6">Active Crawls</h1>
  <div className="space-y-3">
  {activeJobs.map((job) => (
  <Card key={job.crawl_id}>
  <CardBody className="flex items-center justify-between">
  <div className="flex items-center gap-3 min-w-0">
  <div className="flex-shrink-0 w-2 h-2 bg-cyan rounded-full animate-pulse" />
  <div className="min-w-0">
  <p className="text-sm font-medium text-text truncate">
  {job.url}
  </p>
  <p className="text-xs text-text-dim capitalize mt-0.5">
  {job.status}
  </p>
  </div>
  </div>
  <Button
  variant="ghost"
  size="sm"
  className="flex-shrink-0 ml-4"
  onClick={() => navigate(`/crawl/${job.crawl_id}/results`)}
  >
  View
  </Button>
  </CardBody>
  </Card>
  ))}
  </div>
  </div>
  </div>
  );
}
