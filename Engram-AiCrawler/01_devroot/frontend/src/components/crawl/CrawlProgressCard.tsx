import { Loader2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Alert } from '../ui/Alert';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrawlStatus =
 |'queued'
 |'running'
 |'completed'
 |'failed'
 |'cancelled';

export interface CrawlProgressData {
 crawl_id: string;
 url: string;
 status: CrawlStatus;
 strategy: string;
 started_at: string | null;
 progress: number | null;
 current_url: string | null;
 error_message: string | null;
}

interface CrawlProgressCardProps {
 data: CrawlProgressData;
 elapsedSeconds: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<CrawlStatus, 'default' | 'cyan' | 'success' | 'danger' | 'volt'> = {
  queued:    'default',
  running:   'cyan',
  completed: 'success',
  failed:    'danger',
  cancelled: 'volt',
};

const PROGRESS_VARIANT: Record<CrawlStatus, 'cyan' | 'success' | 'danger' | 'default'> = {
  queued:    'default',
  running:   'cyan',
  completed: 'success',
  failed:    'danger',
  cancelled: 'default',
};

function formatElapsed(totalSeconds: number): string {
 const h = Math.floor(totalSeconds / 3600);
 const m = Math.floor((totalSeconds % 3600) / 60);
 const s = totalSeconds % 60;
 return [h, m, s].map((v) => String(v).padStart(2,'0')).join(':');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrawlProgressCard({
 data,
 elapsedSeconds,
}: CrawlProgressCardProps) {
  const pct = data.progress ?? 0;

 return (
 <div className="bg-surface border border-border p-6 space-y-5">
 <div className="flex items-center justify-between">
          <Badge variant={STATUS_VARIANT[data.status]} dot>
            {data.status}
          </Badge>

 <span className="text-sm font-mono text-text-dim">
 {formatElapsed(elapsedSeconds)}
 </span>
 </div>

 <div className="space-y-1">
 <p className="text-sm text-text-dim">
 URL
 </p>
 <p className="text-sm font-medium text-text truncate">
 {data.current_url ?? data.url}
 </p>

 <p className="text-sm text-text-dim mt-2">
 Strategy
 </p>
 <p className="text-sm font-medium text-text">
 {data.strategy}
 </p>
 </div>

          <Progress
            value={pct}
            variant={PROGRESS_VARIANT[data.status]}
            showValue
            label="Progress"
          />

          {data.status === 'failed' && data.error_message && (
            <Alert variant="danger">{data.error_message}</Alert>
          )}

 {data.status ==='running' && (
 <div className="flex items-center gap-2 text-xs text-text-mute">
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 <span>Crawling in progress…</span>
 </div>
 )}
 </div>
 );
}
