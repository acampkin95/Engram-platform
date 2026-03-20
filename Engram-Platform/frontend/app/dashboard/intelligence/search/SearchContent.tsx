'use client';

import { AlertCircle, ArrowRight, Brain, ExternalLink, Loader2, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge } from '@/src/design-system/components/Badge';
import { SearchInput } from '@/src/design-system/components/SearchInput';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { type SearchResult as CrawlerSearchResult, crawlerClient } from '@/src/lib/crawler-client';
import { type SearchResult as MemorySearchResult, memoryClient } from '@/src/lib/memory-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'crawler' | 'memory';
type TypeFilter = 'all' | 'pages' | 'entities' | 'memories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _statusToVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

// ─── CrawlToMemoryButton ──────────────────────────────────────────────────────

interface CrawlToMemoryButtonProps {
  crawlId: string;
}

function CrawlToMemoryButton({ crawlId }: CrawlToMemoryButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSend = async () => {
    setStatus('loading');
    const { error } = await crawlerClient.sendToMemory({ crawl_result_id: crawlId });
    if (error) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('success');
    }
  };

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#2EC4C4] font-medium">
        <Brain className="w-3.5 h-3.5" />
        Sent to Memory
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#FF6B6B]">
        <AlertCircle className="w-3.5 h-3.5" />
        Failed — retry
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleSend();
      }}
      disabled={status === 'loading'}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-150 bg-[rgba(46,196,196,0.06)] border-[rgba(46,196,196,0.2)] text-[#2EC4C4] hover:bg-[rgba(46,196,196,0.12)] hover:border-[rgba(46,196,196,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Brain className="w-3.5 h-3.5" />
      )}
      {status === 'loading' ? 'Sending…' : 'Send to Memory'}
    </button>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-2.5 animate-pulse">
      <div className="h-3.5 w-2/3 rounded bg-white/[0.06]" />
      <div className="h-2.5 w-full rounded bg-white/[0.04]" />
      <div className="h-2.5 w-4/5 rounded bg-white/[0.04]" />
      <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
    </div>
  );
}

// ─── Crawler result card ──────────────────────────────────────────────────────

interface CrawlerCardProps {
  result: CrawlerSearchResult;
}

function CrawlerCard({ result }: CrawlerCardProps) {
  return (
    <div className="p-4 rounded-lg border border-[rgba(155,125,224,0.12)] bg-[rgba(155,125,224,0.04)] hover:border-[rgba(155,125,224,0.2)] hover:bg-[rgba(155,125,224,0.06)] transition-all duration-150 space-y-2.5">
      {/* Title */}
      <h3 className="text-sm font-semibold text-[#f0eef8] leading-snug">
        {result.title || 'Untitled'}
      </h3>

      {/* URL */}
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs font-mono text-[#9B7DE0] hover:text-[#b89fe8] truncate"
      >
        <span className="truncate">{result.url}</span>
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
      </a>

      {/* Snippet */}
      {result.snippet && (
        <p className="text-xs text-[#a09bb8] leading-relaxed line-clamp-3">{result.snippet}</p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Badge variant="info">
            {result.relevance_score != null
              ? `Score: ${result.relevance_score.toFixed(2)}`
              : 'crawler'}
          </Badge>
        </div>
        <CrawlToMemoryButton crawlId={result.crawl_id} />
      </div>
    </div>
  );
}

// ─── Memory result card ───────────────────────────────────────────────────────

interface MemoryCardProps {
  result: MemorySearchResult;
}

function MemoryCard({ result }: MemoryCardProps) {
  const content = result.content || result.snippet || result.title || 'No content';
  const memoryType = (result as unknown as { memory_type?: string }).memory_type || 'Memory';
  const score = (result as unknown as { score?: number }).score ?? result.relevance_score;

  return (
    <div className="p-4 rounded-lg border border-[rgba(46,196,196,0.12)] bg-[rgba(46,196,196,0.04)] hover:border-[rgba(46,196,196,0.2)] hover:bg-[rgba(46,196,196,0.06)] transition-all duration-150 space-y-2.5">
      {/* Content */}
      <p className="text-sm text-[#f0eef8] leading-relaxed">{truncate(content, 120)}</p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="memory">{memoryType}</Badge>
        {result.project_id && <Badge variant="neutral">{result.project_id}</Badge>}
        {score != null && (
          <span className="text-xs text-[#5c5878] font-mono">
            relevance: {(score as number).toFixed(3)}
          </span>
        )}
      </div>

      {/* Tags */}
      {result.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {result.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#5c5878] bg-white/[0.04] border border-white/[0.06]"
            >
              #{tag}
            </span>
          ))}
          {result.tags.length > 4 && (
            <span className="text-[10px] text-[#5c5878]">+{result.tags.length - 4} more</span>
          )}
        </div>
      )}

      {/* View link */}
      <div className="flex items-center justify-end pt-0.5">
        <a
          href={`/dashboard/memory?id=${result.memory_id}`}
          className="inline-flex items-center gap-1 text-xs text-[#2EC4C4] hover:text-[#4dd8d8] transition-colors"
        >
          View in Memory
          <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ─── Column wrapper ───────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  label: string;
  count: number;
  accentColor: string;
  dimColor: string;
  borderColor: string;
}

function ColumnHeader({ label, count, accentColor, dimColor, borderColor }: ColumnHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-t-lg border-b"
      style={{
        background: dimColor,
        borderColor,
        borderBottomColor: borderColor,
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest font-mono"
        style={{ color: accentColor }}
      >
        {label}
      </span>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
        style={{
          color: accentColor,
          background: dimColor,
          borderColor,
        }}
      >
        {count} {count === 1 ? 'result' : 'results'}
      </span>
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  accentColor?: string;
  dimColor?: string;
  borderColor?: string;
}

function FilterPill({
  label,
  active,
  onClick,
  accentColor = '#F2A93B',
  dimColor = 'rgba(242,169,59,0.12)',
  borderColor = 'rgba(242,169,59,0.3)',
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150',
        active
          ? ''
          : 'bg-white/[0.02] border-white/[0.06] text-[#5c5878] hover:text-[#a09bb8] hover:border-white/[0.12]',
      ].join(' ')}
      style={
        active
          ? {
              background: dimColor,
              borderColor,
              color: accentColor,
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchContent() {
  // ── Query state ──
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // ── Filter state ──
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // ── Results state ──
  const [crawlerResults, setCrawlerResults] = useState<CrawlerSearchResult[]>([]);
  const [memoryResults, setMemoryResults] = useState<MemorySearchResult[]>([]);

  // ── Loading/error state ──
  const [isSearching, setIsSearching] = useState(false);
  const [crawlerError, setCrawlerError] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  // ─── Search handler ────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;

    setIsSearching(true);
    setCrawlerError(null);
    setMemoryError(null);
    setHasSearched(true);

    // Run both in parallel — independent error handling
    const [crawlerResult, memoryResult] = await Promise.allSettled([
      crawlerClient.searchResults(q),
      memoryClient.searchMemories(q),
    ]);

    if (crawlerResult.status === 'fulfilled') {
      setCrawlerResults(crawlerResult.value.data?.results ?? []);
    } else {
      setCrawlerError('Crawler search unavailable');
    }

    if (memoryResult.status === 'fulfilled') {
      setMemoryResults(memoryResult.value.data?.results ?? []);
    } else {
      setMemoryError('Memory search unavailable');
    }

    setIsSearching(false);
  }, []);

  // ─── Derived: apply source filter to column visibility ────────────────────

  const showCrawler = sourceFilter === 'all' || sourceFilter === 'crawler';
  const showMemory = sourceFilter === 'all' || sourceFilter === 'memory';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <SectionHeader title="Unified Search" breadcrumb={['INTELLIGENCE', 'SEARCH']} />

      {/* Search input — prominent, full-width */}
      <div className="relative">
        <SearchInput
          placeholder="Search across Crawler and Memory systems…"
          value={query}
          onChange={setQuery}
          onSearch={(q) => {
            void handleSearch(q);
          }}
          debounceMs={0}
          className="w-full"
        />
        <div className="absolute inset-0 -z-10 rounded-xl blur-xl opacity-20 bg-gradient-to-r from-[#9B7DE0] via-[#F2A93B] to-[#2EC4C4]" />
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        {/* Source filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#5c5878] uppercase tracking-wider font-mono mr-1">
            Source:
          </span>
          {(['all', 'crawler', 'memory'] as SourceFilter[]).map((src) => (
            <FilterPill
              key={src}
              label={src === 'all' ? 'All' : src === 'crawler' ? 'Crawler' : 'Memory'}
              active={sourceFilter === src}
              onClick={() => setSourceFilter(src)}
              accentColor={src === 'crawler' ? '#9B7DE0' : src === 'memory' ? '#2EC4C4' : '#F2A93B'}
              dimColor={
                src === 'crawler'
                  ? 'rgba(155,125,224,0.12)'
                  : src === 'memory'
                    ? 'rgba(46,196,196,0.12)'
                    : 'rgba(242,169,59,0.12)'
              }
              borderColor={
                src === 'crawler'
                  ? 'rgba(155,125,224,0.3)'
                  : src === 'memory'
                    ? 'rgba(46,196,196,0.3)'
                    : 'rgba(242,169,59,0.3)'
              }
            />
          ))}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-white/[0.08]" />

        {/* Type filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#5c5878] uppercase tracking-wider font-mono mr-1">
            Type:
          </span>
          {(['all', 'pages', 'entities', 'memories'] as TypeFilter[]).map((t) => (
            <FilterPill
              key={t}
              label={t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            />
          ))}
        </div>
      </div>

      {/* Results area */}
      {!hasSearched && !isSearching ? (
        /* Pre-search state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(242,169,59,0.08)] border border-[rgba(242,169,59,0.15)] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#F2A93B]" />
          </div>
          <p className="text-sm font-medium text-[#a09bb8] mb-1">Search across all systems</p>
          <p className="text-xs text-[#5c5878] max-w-xs">
            Enter a query above to search the Crawler and Memory systems simultaneously.
          </p>
        </div>
      ) : (
        /* Two-column results layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── LEFT: Crawler Results ── */}
          {showCrawler && (
            <div className="flex flex-col rounded-xl border border-[rgba(155,125,224,0.15)] overflow-hidden">
              <ColumnHeader
                label="Crawler Results"
                count={crawlerResults.length}
                accentColor="#9B7DE0"
                dimColor="rgba(155,125,224,0.08)"
                borderColor="rgba(155,125,224,0.15)"
              />

              <div className="flex-1 p-4 space-y-3 bg-[#090818]">
                {isSearching ? (
                  /* Skeleton loaders */
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : crawlerError ? (
                  /* Error state */
                  <div className="flex items-center gap-2.5 px-4 py-5 rounded-lg border border-[rgba(255,107,107,0.15)] bg-[rgba(255,107,107,0.05)]">
                    <AlertCircle className="w-4 h-4 text-[#FF6B6B] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#FF6B6B]">Crawler unavailable</p>
                      <p className="text-xs text-[#a09bb8] mt-0.5">{crawlerError}</p>
                    </div>
                  </div>
                ) : crawlerResults.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(155,125,224,0.08)] border border-[rgba(155,125,224,0.12)] flex items-center justify-center mb-3">
                      <Search className="w-4 h-4 text-[#9B7DE0]" />
                    </div>
                    <p className="text-sm text-[#5c5878]">No crawler results</p>
                    <p className="text-xs text-[#3a3850] mt-1">
                      Try a different query or crawl more pages.
                    </p>
                  </div>
                ) : (
                  /* Results */
                  crawlerResults.map((result) => (
                    <CrawlerCard key={result.crawl_id} result={result} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── RIGHT: Memory Results ── */}
          {showMemory && (
            <div className="flex flex-col rounded-xl border border-[rgba(46,196,196,0.15)] overflow-hidden">
              <ColumnHeader
                label="Memory Results"
                count={memoryResults.length}
                accentColor="#2EC4C4"
                dimColor="rgba(46,196,196,0.08)"
                borderColor="rgba(46,196,196,0.15)"
              />

              <div className="flex-1 p-4 space-y-3 bg-[#090818]">
                {isSearching ? (
                  /* Skeleton loaders */
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : memoryError ? (
                  /* Error state */
                  <div className="flex items-center gap-2.5 px-4 py-5 rounded-lg border border-[rgba(255,107,107,0.15)] bg-[rgba(255,107,107,0.05)]">
                    <AlertCircle className="w-4 h-4 text-[#FF6B6B] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#FF6B6B]">Memory unavailable</p>
                      <p className="text-xs text-[#a09bb8] mt-0.5">{memoryError}</p>
                    </div>
                  </div>
                ) : memoryResults.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(46,196,196,0.08)] border border-[rgba(46,196,196,0.12)] flex items-center justify-center mb-3">
                      <Brain className="w-4 h-4 text-[#2EC4C4]" />
                    </div>
                    <p className="text-sm text-[#5c5878]">No memory results</p>
                    <p className="text-xs text-[#3a3850] mt-1">
                      Try a different query or add memories first.
                    </p>
                  </div>
                ) : (
                  /* Results */
                  memoryResults.map((result) => (
                    <MemoryCard key={result.memory_id} result={result} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Single-source mode: fill empty space with a hint */}
          {!showCrawler && !showMemory && (
            <div className="col-span-2 flex items-center justify-center py-16 text-center">
              <p className="text-sm text-[#5c5878]">Select a source filter to view results.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
