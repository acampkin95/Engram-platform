'use client';

import { AlertCircle, ExternalLink, Globe, Loader2, Play, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/src/design-system/components/Badge';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';
import { type Column, DataTable } from '@/src/design-system/components/DataTable';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { SearchInput } from '@/src/design-system/components/SearchInput';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { Spinner } from '@/src/design-system/components/Spinner';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import { crawlerClient, type JobResponse } from '@/src/lib/crawler-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type CrawlDepth = 1 | 2 | 3;
type CrawlMode = 'Standard' | 'Deep' | 'Stealth';
type StatusFilter = 'all' | 'completed' | 'running' | 'failed' | 'pending';

interface OsintResult extends Record<string, unknown> {
  crawl_id: string;
  title: string;
  url: string;
  status: string;
  extracted_count: number;
  markdown?: string;
  created_at?: string;
}

interface ActiveJob {
  job_id: string;
  url: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusToVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'failed':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

function statusToDot(status: string): 'online' | 'loading' | 'offline' | 'degraded' {
  switch (status) {
    case 'running':
      return 'loading';
    case 'completed':
      return 'online';
    case 'failed':
      return 'offline';
    default:
      return 'degraded';
  }
}

// ─── Result detail modal (inline) ────────────────────────────────────────────

function ResultDetailPanel({ result, onClose }: { result: OsintResult; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail for ${result.title || result.url}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close detail panel"
      />
      <div className="relative w-full max-w-2xl bg-[#090818] border border-white/[0.08] rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#f0eef8] truncate">
              {result.title || result.url}
            </h2>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#9B7DE0] hover:text-[#b89fe8] flex items-center gap-1 mt-0.5 truncate"
            >
              {result.url}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="p-1 rounded hover:bg-white/[0.06] text-[#5c5878] hover:text-[#a09bb8] transition-colors ml-4 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {result.markdown ? (
            <pre className="text-xs text-[#a09bb8] font-mono whitespace-pre-wrap leading-relaxed">
              {result.markdown.slice(0, 4000)}
              {result.markdown.length > 4000 && '\n\n[truncated...]'}
            </pre>
          ) : (
            <p className="text-sm text-[#5c5878] text-center py-8">
              No extracted content available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OsintContent() {
  // ── Form state ──
  const [target, setTarget] = useState('');
  const [depth, setDepth] = useState<CrawlDepth>(1);
  const [mode, setMode] = useState<CrawlMode>('Standard');
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // ── Results state ──
  const [results, setResults] = useState<OsintResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedResult, setSelectedResult] = useState<OsintResult | null>(null);

  // ── Active jobs ticker ──
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);

  // ─── Fetch existing results ───────────────────────────────────────────────

  const fetchResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const { data } = await crawlerClient.getJobs({ limit: 50 });
      if (data?.jobs) {
        const mapped: OsintResult[] = data.jobs.map((job: JobResponse) => ({
          crawl_id: job.job_id,
          title: (job.metadata?.title as string) || (job.metadata?.url as string) || job.job_id,
          url: (job.metadata?.url as string) || '—',
          status: job.status,
          extracted_count: (job.metadata?.word_count as number) ?? 0,
          created_at: job.created_at,
        }));
        setResults(mapped);

        const running = data.jobs
          .filter((j) => j.status === 'running' || j.status === 'pending')
          .slice(0, 5)
          .map((j) => ({
            job_id: j.job_id,
            url: (j.metadata?.url as string) || j.job_id,
            status: j.status,
          }));
        setActiveJobs(running);
      }
    } catch {
      // silently fail — results are optional
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  // ─── Launch crawl ─────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    const trimmed = target.trim();
    if (!trimmed) {
      setLaunchError('Target URL is required');
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      setLaunchError('Invalid URL. Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsLaunching(true);
    setLaunchError(null);

    try {
      // Build crawl options based on mode
      const wordCountThreshold = mode === 'Deep' ? 50 : mode === 'Stealth' ? 200 : 100;
      const excludeExternal = mode === 'Stealth';

      const { data, error } = await crawlerClient.startCrawl({
        url: trimmed,
        word_count_threshold: wordCountThreshold,
        exclude_external_links: excludeExternal,
        screenshot: false,
      });

      if (error) {
        setLaunchError(error);
        return;
      }

      if (data) {
        // Add optimistic result
        const newResult: OsintResult = {
          crawl_id: data.crawl_id,
          title: data.metadata?.title || trimmed,
          url: data.url,
          status: data.status,
          extracted_count: data.metadata?.word_count ?? 0,
          markdown: data.markdown,
        };
        setResults((prev) => [newResult, ...prev]);
        setActiveJobs((prev) => [
          { job_id: data.crawl_id, url: data.url, status: data.status },
          ...prev,
        ]);
      }

      // Refresh after short delay to pick up job status
      setTimeout(() => {
        void fetchResults();
      }, 2000);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to launch crawl');
    } finally {
      setIsLaunching(false);
    }
  };

  // ─── Filtered results ─────────────────────────────────────────────────────

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const q = searchFilter.toLowerCase();
      const matchesSearch =
        !q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [results, statusFilter, searchFilter]);

  // ─── Table columns ────────────────────────────────────────────────────────

  const columns: Column<OsintResult>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <span className="text-[#f0eef8] font-medium truncate max-w-[200px] block">{row.title}</span>
      ),
    },
    {
      key: 'url',
      header: 'URL',
      render: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#9B7DE0] hover:text-[#b89fe8] flex items-center gap-1 text-xs font-mono truncate max-w-[240px]"
        >
          {row.url}
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <Badge variant={statusToVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'extracted_count',
      header: 'Extracted Data',
      sortable: true,
      render: (row) => (
        <span className="text-[#a09bb8] font-mono text-xs">
          {row.extracted_count > 0 ? `${row.extracted_count.toLocaleString()} words` : '—'}
        </span>
      ),
    },
    {
      key: 'crawl_id',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedResult(row)}
          disabled={row.status !== 'completed'}
        >
          View
        </Button>
      ),
    },
  ];

  // ─── Status filter pills ──────────────────────────────────────────────────

  const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Completed', value: 'completed' },
    { label: 'Running', value: 'running' },
    { label: 'Failed', value: 'failed' },
    { label: 'Pending', value: 'pending' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-page-enter">
      <h1 className="sr-only">OSINT Scanner</h1>
      {/* Header */}
      <SectionHeader title="OSINT" breadcrumb={['CRAWLER', 'OSINT']} />

      {/* Search bar */}
      <div>
        <SearchInput
          placeholder="Enter target URL, domain, or keyword..."
          value={target}
          onChange={setTarget}
          onSearch={setTarget}
          debounceMs={0}
          className="w-full"
        />
        <p className="text-xs text-[#5c5878] mt-1.5">
          Examples: https://example.com, example.com, or keywords for domain discovery
        </p>
      </div>

      {/* Crawl configuration */}
      <Card>
        <div className="space-y-5">
          <h2 className="text-xs font-semibold text-[#5c5878] uppercase tracking-wider font-mono">
            Crawl Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Depth selector */}
            <div>
              <span className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono block mb-2">
                Depth
              </span>
              <div className="flex gap-2">
                {([1, 2, 3] as CrawlDepth[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepth(d)}
                    aria-pressed={depth === d}
                    aria-label={`Depth ${d}`}
                    className={[
                      'flex-1 py-2 text-sm font-medium rounded-lg border transition-all duration-150',
                      depth === d
                        ? 'bg-[rgba(155,125,224,0.12)] border-[rgba(155,125,224,0.3)] text-[#9B7DE0]'
                        : 'bg-[#0d0d1a] border-[#1e1e3a] text-[#5c5878] hover:text-[#a09bb8] hover:border-[#2a2a50]',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#5c5878] mt-1.5">
                {depth === 1
                  ? 'Single page only'
                  : depth === 2
                    ? 'Page + direct links'
                    : 'Deep recursive crawl'}
              </p>
            </div>

            {/* Mode selector */}
            <div>
              <span className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono block mb-2">
                Mode
              </span>
              <div className="flex gap-2">
                {(['Standard', 'Deep', 'Stealth'] as CrawlMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    aria-label={`Mode ${m}`}
                    className={[
                      'flex-1 py-2 text-sm font-medium rounded-lg border transition-all duration-150',
                      mode === m
                        ? 'bg-[rgba(155,125,224,0.12)] border-[rgba(155,125,224,0.3)] text-[#9B7DE0]'
                        : 'bg-[#0d0d1a] border-[#1e1e3a] text-[#5c5878] hover:text-[#a09bb8] hover:border-[#2a2a50]',
                    ].join(' ')}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#5c5878] mt-1.5">
                {mode === 'Standard'
                  ? 'Balanced extraction'
                  : mode === 'Deep'
                    ? 'Low threshold, maximum content'
                    : 'Exclude external links, high threshold'}
              </p>
            </div>
          </div>

          {/* Launch button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleLaunch();
              }}
              disabled={!target.trim() || isLaunching}
              className={[
                'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg border transition-all duration-150',
                'bg-[rgba(155,125,224,0.12)] border-[rgba(155,125,224,0.3)] text-[#9B7DE0]',
                'hover:bg-[rgba(155,125,224,0.2)] hover:border-[rgba(155,125,224,0.5)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {isLaunching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isLaunching ? 'Launching…' : 'Launch OSINT Crawl'}
            </button>

            {launchError && (
              <div className="flex items-center gap-2 text-sm text-[#FF6B6B]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{launchError}</span>
                <button
                  type="button"
                  onClick={() => setLaunchError(null)}
                  className="text-[#FF6B6B]/60 hover:text-[#FF6B6B] ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Active jobs ticker */}
      {activeJobs.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[rgba(155,125,224,0.05)] border border-[rgba(155,125,224,0.12)]">
          <StatusDot variant="loading" label="Active Jobs" />
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            {activeJobs.map((job) => (
              <div
                key={job.job_id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(155,125,224,0.08)] border border-[rgba(155,125,224,0.15)] text-xs text-[#9B7DE0] whitespace-nowrap flex-shrink-0"
              >
                <StatusDot variant={statusToDot(job.status)} />
                <span className="font-mono truncate max-w-[160px]">{job.url}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results section */}
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                aria-pressed={statusFilter === f.value}
                aria-label={`Filter by ${f.label}`}
                className={[
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                  statusFilter === f.value
                    ? 'bg-[#9B7DE0]/10 border-[#9B7DE0]/30 text-[#9B7DE0]'
                    : 'bg-[#0d0d1a] border-[#1e1e3a] text-[#5c5878] hover:text-[#a09bb8]',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="sm:ml-auto w-full sm:w-64">
            <SearchInput
              placeholder="Filter results..."
              onChange={setSearchFilter}
              debounceMs={200}
            />
          </div>
        </div>

        {/* Table */}
        {resultsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="md" />
            <p className="text-sm text-[#5c5878] font-mono">Loading crawl results...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <EmptyState
            icon={<Globe className="w-6 h-6" />}
            title={results.length === 0 ? 'No crawl results yet' : 'No results match your filter'}
            description={
              results.length === 0
                ? 'Enter a target URL and launch an OSINT crawl to get started.'
                : 'Try changing the status filter or search query.'
            }
            context="crawler"
          />
        ) : (
          <DataTable<OsintResult>
            columns={columns}
            data={filteredResults}
            pageSize={20}
            emptyMessage="No results match your filter"
          />
        )}
      </div>

      {/* Result detail panel */}
      {selectedResult && (
        <ResultDetailPanel result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  );
}
