import { useState, useEffect, useRef, useCallback } from'react';
import { useParams, useNavigate } from'react-router-dom';
import { ArrowLeft, ExternalLink, XCircle, WifiOff } from'lucide-react';
import { api } from'../lib/api';
import { Button } from '@/components/ui';
import { useWebSocketSubscription } from'../hooks/useWebSocketSubscription';
import { useToast } from'../components/Toast';
import { LoadingSpinner } from'../components/LoadingSpinner';
import {
 CrawlProgressCard,
 type CrawlProgressData,
 type CrawlStatus,
} from'../components/crawl/CrawlProgressCard';

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface CrawlStatusResponse {
 crawl_id: string;
 url: string;
 status: CrawlStatus;
 strategy: string;
 started_at: string | null;
 progress: number | null;
 current_url: string | null;
 error_message: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CrawlMonitoringPage() {
 const { crawlId } = useParams<{ crawlId: string }>();
 const navigate = useNavigate();
 const toast = useToast();

 const [crawlData, setCrawlData] = useState<CrawlProgressData | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [cancelling, setCancelling] = useState(false);
 const [elapsedSeconds, setElapsedSeconds] = useState(0);

 const startTimeRef = useRef<number | null>(null);

 const { data: wsUpdate, isConnected } = useWebSocketSubscription<
 Partial<CrawlProgressData>
 >(crawlId ? `crawl:${crawlId}`:'');

 const fetchStatus = useCallback(async () => {
 if (!crawlId) return;
 try {
 setLoading(true);
 setError(null);
 const res = await api.get<CrawlStatusResponse>(
 `/crawl/status/${crawlId}`,
 );
 const d = res.data;
 setCrawlData({
 crawl_id: d.crawl_id,
 url: d.url,
 status: d.status,
 strategy: d.strategy,
 started_at: d.started_at,
 progress: d.progress,
 current_url: d.current_url,
 error_message: d.error_message,
 });
 if (d.started_at) {
 startTimeRef.current = new Date(d.started_at).getTime();
 }
 } catch {
 setError('Failed to load crawl status.');
 } finally {
 setLoading(false);
 }
 }, [crawlId]);

 useEffect(() => {
 fetchStatus();
 }, [fetchStatus]);

 useEffect(() => {
 if (!wsUpdate) return;
 setCrawlData((prev) => {
 if (!prev) return prev;
 return { ...prev, ...wsUpdate };
 });
 }, [wsUpdate]);

 useEffect(() => {
 if (!crawlData) return;

 const isActive =
 crawlData.status ==='running' || crawlData.status ==='queued';

 if (!isActive) return;

 const tick = () => {
 if (startTimeRef.current) {
 setElapsedSeconds(
 Math.floor((Date.now() - startTimeRef.current) / 1000),
 );
 }
 };
 tick();
 const id = globalThis.setInterval(tick, 1000);
 return () => globalThis.clearInterval(id);
 }, [crawlData?.status, crawlData]);

 const handleCancel = async () => {
 if (!crawlId) return;
 try {
 setCancelling(true);
 await api.post(`/crawl/cancel/${crawlId}`);
 toast.info('Crawl cancellation requested.');
 setCrawlData((prev) =>
 prev ? { ...prev, status:'cancelled' } : prev,
 );
 } catch {
 toast.error('Failed to cancel crawl.');
 } finally {
 setCancelling(false);
 }
 };

 const isTerminal =
 crawlData?.status ==='completed' ||
 crawlData?.status ==='failed' ||
 crawlData?.status ==='cancelled';

 const canCancel =
 crawlData?.status ==='running' || crawlData?.status ==='queued';

 if (loading) {
 return (
 <div className="flex items-center justify-center py-32">
 <LoadingSpinner message="Loading crawl status…" />
 </div>
 );
 }

 if (error || !crawlData) {
 return (
  <div className="flex flex-col items-center justify-center py-32 gap-4" role="alert">
  <p className="text-neon-r text-sm">{error ??'Crawl not found.'}</p>
 <Button variant="link" onClick={() => navigate(-1)}>
 Go back
 </Button>
 </div>
 );
 }

 return (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-slide-in">
 <div className="flex items-center justify-between">
 <Button
 variant="secondary"
 size="sm"
 onClick={() => navigate(-1)}
 leftIcon={<ArrowLeft className="w-4 h-4" />}
 >
 Back
 </Button>

 <div className="flex items-center gap-3">
 {!isConnected && (
 <span className="flex items-center gap-1.5 text-xs text-volt">
 <WifiOff className="w-3.5 h-3.5" />
 Reconnecting…
 </span>
 )}

  {isTerminal && (
  <Button
  variant="primary"
  onClick={() => navigate(`/crawl/${crawlId}/results`)}
  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
  >
  View Results
  </Button>
  )}
 </div>
 </div>

 <h1 className="text-xl font-display font-bold text-text">
 Crawl Monitoring
 </h1>

 <CrawlProgressCard data={crawlData} elapsedSeconds={elapsedSeconds} />

  {canCancel && (
  <Button
  variant="danger"
  onClick={handleCancel}
  loading={cancelling}
  leftIcon={<XCircle className="w-4 h-4" />}
  >
  Cancel Crawl
  </Button>
  )}
 </div>
 );
}
