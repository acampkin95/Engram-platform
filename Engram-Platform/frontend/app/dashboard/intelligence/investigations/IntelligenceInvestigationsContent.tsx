'use client';

import {
  AlertCircle,
  Brain,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  FolderSearch,
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/src/design-system/components/Badge';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { LoadingState } from '@/src/design-system/components/LoadingState';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { StatCard } from '@/src/design-system/components/StatCard';
import { Tabs } from '@/src/design-system/components/Tabs';
import { crawlerClient, type Investigation } from '@/src/lib/crawler-client';
import { type AnalyticsResponse, type Matter, memoryClient } from '@/src/lib/memory-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (status.toLowerCase()) {
    case 'active':
    case 'open':
      return 'success';
    case 'running':
      return 'info';
    case 'closed':
    case 'archived':
      return 'neutral';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
}

// ─── Tabs config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'crawler', label: 'Crawler' },
  { id: 'memory', label: 'Memory' },
];

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] rounded-lg text-sm text-[#FF6B6B]">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="text-[#FF6B6B]/60 hover:text-[#FF6B6B] text-xs underline"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Section Header Strip ─────────────────────────────────────────────────────

function SectionStrip({
  label,
  accent,
  count,
  linkHref,
  linkLabel,
}: {
  label: string;
  accent: 'purple' | 'teal';
  count: number;
  linkHref: string;
  linkLabel: string;
}) {
  const colors =
    accent === 'purple'
      ? {
          text: 'text-[#9B7DE0]',
          bg: 'bg-[rgba(155,125,224,0.08)]',
          border: 'border-[rgba(155,125,224,0.2)]',
        }
      : {
          text: 'text-[#2EC4C4]',
          bg: 'bg-[rgba(46,196,196,0.08)]',
          border: 'border-[rgba(46,196,196,0.2)]',
        };

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-lg border ${colors.bg} ${colors.border} mb-3`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold font-mono uppercase tracking-wider ${colors.text}`}>
          {label}
        </span>
        <span className="text-xs font-mono text-[#5c5878]">({count})</span>
      </div>
      <a
        href={linkHref}
        className={`flex items-center gap-1 text-xs font-mono ${colors.text} hover:opacity-80 transition-opacity`}
      >
        {linkLabel}
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

// ─── Crawler Investigation Card ───────────────────────────────────────────────

function CrawlerInvestigationCard({ investigation }: { investigation: Investigation }) {
  const [expanded, setExpanded] = useState(false);
  const crawlCount = investigation.crawls?.length ?? 0;
  const scanCount = investigation.scans?.length ?? 0;
  const jobCount = crawlCount + scanCount;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden transition-all duration-150 hover:border-[rgba(155,125,224,0.2)]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[rgba(155,125,224,0.12)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <FolderSearch className="w-4 h-4 text-[#9B7DE0]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f0eef8] truncate">{investigation.title}</p>
              {investigation.description && (
                <p className="text-xs text-[#5c5878] line-clamp-1 mt-0.5">
                  {investigation.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusVariant(investigation.status)}>{investigation.status}</Badge>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-[#5c5878]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#5c5878]" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-[11px] text-[#5c5878] font-mono">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {jobCount} job{jobCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(investigation.created_at)}
          </span>
          {investigation.priority && (
            <Badge
              variant={
                investigation.priority === 'high'
                  ? 'error'
                  : investigation.priority === 'medium'
                    ? 'warning'
                    : 'neutral'
              }
              className="text-[10px]"
            >
              {investigation.priority}
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 bg-[rgba(155,125,224,0.03)]">
          <p className="text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-2">
            Associated Jobs
          </p>
          {jobCount === 0 ? (
            <p className="text-xs text-[#5c5878] italic">No jobs linked to this investigation.</p>
          ) : (
            <div className="space-y-1">
              {(investigation.crawls ?? []).map((id) => (
                <div key={id} className="flex items-center gap-2 text-xs font-mono text-[#a09bb8]">
                  <Badge variant="crawler">crawl</Badge>
                  <span className="truncate text-[#5c5878]">{id}</span>
                </div>
              ))}
              {(investigation.scans ?? []).map((id) => (
                <div key={id} className="flex items-center gap-2 text-xs font-mono text-[#a09bb8]">
                  <Badge variant="info">scan</Badge>
                  <span className="truncate text-[#5c5878]">{id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Memory Matter Card ───────────────────────────────────────────────────────

function MemoryMatterCard({ matter }: { matter: Matter }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden transition-all duration-150 hover:border-[rgba(46,196,196,0.2)]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[rgba(46,196,196,0.12)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <FolderOpen className="w-4 h-4 text-[#2EC4C4]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f0eef8] truncate">{matter.title}</p>
              {matter.description && (
                <p className="text-xs text-[#5c5878] line-clamp-1 mt-0.5">{matter.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {matter.status && <Badge variant={statusVariant(matter.status)}>{matter.status}</Badge>}
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-[#5c5878]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#5c5878]" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-[11px] text-[#5c5878] font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(matter.created_at ?? '')}
          </span>
          {matter.lead_investigator && (
            <span className="truncate max-w-[160px]">{matter.lead_investigator}</span>
          )}
          {matter.tags && matter.tags.length > 0 && (
            <span className="flex items-center gap-1">
              {matter.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.04] border border-white/[0.06]"
                >
                  {tag}
                </span>
              ))}
              {matter.tags.length > 2 && <span>+{matter.tags.length - 2}</span>}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 bg-[rgba(46,196,196,0.03)]">
          {matter.description && (
            <p className="text-xs text-[#a09bb8] leading-relaxed mb-3">{matter.description}</p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-[#2EC4C4]" />
              <span className="text-xs font-mono text-[#a09bb8]">
                Memories stored in this matter
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Crawler Section ─────────────────────────────────────────────────────────

function CrawlerSection() {
  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.crawler.investigations(),
    () => crawlerClient.getInvestigations({ limit: 100 }),
    { revalidateOnFocus: false },
  );

  const investigations = data?.data?.investigations ?? [];

  if (isLoading) {
    return <LoadingState variant="skeleton" rows={3} />;
  }

  if (error || data?.error) {
    return (
      <ErrorBanner
        message={data?.error ?? 'Failed to load crawler investigations'}
        onRetry={() => void mutate()}
      />
    );
  }

  if (investigations.length === 0) {
    return (
      <EmptyState
        icon={<FolderSearch className="w-5 h-5" />}
        title="No crawler investigations"
        description="Investigations created in the Crawler system will appear here."
        context="investigation"
      />
    );
  }

  return (
    <div className="space-y-2">
      {investigations.map((inv) => (
        <CrawlerInvestigationCard key={inv.investigation_id} investigation={inv} />
      ))}
    </div>
  );
}

// ─── Memory Section ───────────────────────────────────────────────────────────

function MemorySection() {
  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.memory.matters(),
    () => memoryClient.getMatters(),
    { revalidateOnFocus: false },
  );

  const matters = data?.data?.matters ?? [];

  if (isLoading) {
    return <LoadingState variant="skeleton" rows={3} />;
  }

  if (error || data?.error) {
    return (
      <ErrorBanner
        message={data?.error ?? 'Failed to load memory matters'}
        onRetry={() => void mutate()}
      />
    );
  }

  if (matters.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="w-5 h-5" />}
        title="No memory matters"
        description="Matters created in the Memory system will appear here."
        context="investigation"
      />
    );
  }

  return (
    <div className="space-y-2">
      {matters.map((matter) => (
        <MemoryMatterCard key={matter.matter_id} matter={matter} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntelligenceInvestigationsContent() {
  const [activeTab, setActiveTab] = useState('all');

  // Prefetch both data sets for the stats bar (SWR deduplicates)
  const { data: crawlerData } = useSWR(
    swrKeys.crawler.investigations(),
    () => crawlerClient.getInvestigations({ limit: 100 }),
    { revalidateOnFocus: false },
  );

  const { data: memoryData } = useSWR(swrKeys.memory.matters(), () => memoryClient.getMatters(), {
    revalidateOnFocus: false,
  });

  const { data: analyticsData } = useSWR<{ data: AnalyticsResponse | null; error: string | null }>(
    swrKeys.memory.analytics(),
    () => memoryClient.getAnalytics(),
    { revalidateOnFocus: false },
  );

  const investigations = crawlerData?.data?.investigations ?? [];
  const matters = memoryData?.data?.matters ?? [];

  const totalJobs = investigations.reduce((acc, inv) => {
    return acc + (inv.crawls?.length ?? 0) + (inv.scans?.length ?? 0);
  }, 0);

  return (
    <div className="space-y-6 animate-page-enter">
      <SectionHeader title="Investigations" breadcrumb={['INTELLIGENCE', 'INVESTIGATIONS']} />

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Crawler Investigations"
          value={crawlerData ? investigations.length : '—'}
          accent="purple"
        />
        <StatCard label="Memory Matters" value={memoryData ? matters.length : '—'} accent="teal" />
        <StatCard label="Total Crawl Jobs" value={crawlerData ? totalJobs : '—'} accent="amber" />
        <StatCard label="Total Memories" value={analyticsData?.data?.total_memories ?? '—'} accent="amber" />
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <div className="space-y-8">
        {(activeTab === 'all' || activeTab === 'crawler') && (
          <div>
            <SectionStrip
              label="Crawler Investigations"
              accent="purple"
              count={investigations.length}
              linkHref="/dashboard/crawler/investigations"
              linkLabel="Open in Crawler →"
            />
            <CrawlerSection />
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'memory') && (
          <div>
            <SectionStrip
              label="Memory Matters"
              accent="teal"
              count={matters.length}
              linkHref="/dashboard/memory/matters"
              linkLabel="Open in Memory →"
            />
            <MemorySection />
          </div>
        )}
      </div>
    </div>
  );
}
