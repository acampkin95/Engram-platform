'use client';

import { AlertCircle, Clock, FolderSearch, Globe, InfoIcon, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SectionHeader,
  Tooltip,
} from '@/src/design-system/components';
import { type Column, DataTable } from '@/src/design-system/components/DataTable';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { Spinner } from '@/src/design-system/components/Spinner';
import { crawlerClient, type Investigation } from '@/src/lib/crawler-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrawlRow extends Record<string, unknown> {
  crawl_id: string;
  type: string;
  status: string;
  created_at: string;
}

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

function priorityVariant(priority: string): 'error' | 'warning' | 'neutral' {
  switch (priority.toLowerCase()) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    default:
      return 'neutral';
  }
}

// ─── New Investigation Modal ──────────────────────────────────────────────────

interface NewInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (inv: Investigation) => void;
}

type InvestigationPriority = 'low' | 'medium' | 'high';

function getPriorityButtonClass(
  priority: InvestigationPriority,
  option: InvestigationPriority,
): string {
  const baseClass =
    'flex-1 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all duration-150';

  if (priority !== option) {
    return [
      baseClass,
      'bg-white/[0.02] border-white/[0.06] text-[#5c5878] hover:text-[#a09bb8]',
    ].join(' ');
  }

  if (option === 'high') {
    return [
      baseClass,
      'bg-[rgba(255,107,107,0.12)] border-[rgba(255,107,107,0.3)] text-[#FF6B6B]',
    ].join(' ');
  }

  if (option === 'medium') {
    return [
      baseClass,
      'bg-[rgba(242,169,59,0.12)] border-[rgba(242,169,59,0.3)] text-[#F2A93B]',
    ].join(' ');
  }

  return [baseClass, 'bg-white/[0.04] border-white/[0.12] text-[#a09bb8]'].join(' ');
}

function NewInvestigationModal({
  isOpen,
  onClose,
  onCreated,
}: Readonly<NewInvestigationModalProps>) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<InvestigationPriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setError(null);
    onClose();
  };

  const submitInvestigation = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: apiError } = await crawlerClient.createInvestigation({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      });

      if (apiError) {
        setError(apiError);
        return;
      }

      if (data) {
        onCreated(data);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create investigation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Investigation" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitInvestigation().catch(() => {
            // Errors are already surfaced in submitInvestigation.
          });
        }}
        className="space-y-4"
      >
        <Input
          label="Title"
          placeholder="e.g. Domain Threat Analysis"
          tooltip="A short, descriptive name for this investigation"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="investigation-desc"
              className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono"
            >
              Description{' '}
              <span className="text-[#5c5878] font-normal normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <Tooltip
              content="Detailed objectives, scope, or notes for this investigation"
              side="right"
            >
              <InfoIcon className="w-3.5 h-3.5 text-[#5c5878] hover:text-[#a09bb8] transition-colors cursor-help" />
            </Tooltip>
          </div>
          <textarea
            id="investigation-desc"
            placeholder="Describe the scope and objectives of this investigation..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] px-4 py-2 focus:outline-none focus:ring-1 focus:border-[rgba(242,169,59,0.4)] focus:ring-[rgba(242,169,59,0.2)] transition-all duration-150 resize-none"
          />
        </div>

        <fieldset>
          <legend className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono block mb-2">
            Priority
          </legend>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={getPriorityButtonClass(priority, p)}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <div className="flex items-center gap-2 text-sm text-[#FF6B6B] bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className={[
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-150',
              'bg-[#0d0d1a] border-[#1e1e3a] text-[#9B7DE0]',
              'hover:bg-[#141428] hover:border-[#2a2a50]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {isSubmitting && <Spinner size="xs" />}
            {isSubmitting ? 'Creating…' : 'Create Investigation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Investigation List Item ──────────────────────────────────────────────────

interface InvestigationCardProps {
  investigation: Investigation;
  isSelected: boolean;
  onClick: () => void;
}

function InvestigationCard({
  investigation,
  isSelected,
  onClick,
}: Readonly<InvestigationCardProps>) {
  const crawlCount = investigation.crawls?.length ?? 0;
  const crawlLabel = crawlCount === 1 ? 'crawl' : 'crawls';

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left p-4 rounded-xl border transition-all duration-150',
        isSelected
          ? 'border-[rgba(155,125,224,0.3)] bg-[rgba(155,125,224,0.05)]'
          : 'border-white/[0.06] bg-[#090818] hover:border-[rgba(155,125,224,0.15)] hover:bg-[rgba(155,125,224,0.02)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className={[
            'text-sm font-semibold truncate',
            isSelected ? 'text-[#9B7DE0]' : 'text-[#f0eef8]',
          ].join(' ')}
        >
          {investigation.title}
        </span>
        <Badge variant={statusVariant(investigation.status)} className="flex-shrink-0">
          {investigation.status}
        </Badge>
      </div>

      {investigation.description && (
        <p className="text-xs text-[#5c5878] line-clamp-2 mb-2">{investigation.description}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-[#5c5878] font-mono">
        <span className="flex items-center gap-1">
          <Globe className="w-3 h-3" />
          {crawlCount} {crawlLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(investigation.created_at)}
        </span>
        {investigation.priority && (
          <Badge variant={priorityVariant(investigation.priority)} className="text-[10px]">
            {investigation.priority}
          </Badge>
        )}
      </div>
    </button>
  );
}

// ─── Investigation Detail Panel ───────────────────────────────────────────────

interface DetailPanelProps {
  investigation: Investigation | null;
}

function DetailPanel({ investigation }: Readonly<DetailPanelProps>) {
  if (!investigation) {
    return (
      <EmptyState
        icon={<FolderSearch className="w-6 h-6" />}
        title="Select an investigation to view details"
        description="Click any investigation from the list on the left to view its associated crawl jobs and details."
        className="h-full"
      />
    );
  }

  const crawlIds = investigation.crawls ?? [];
  const scanIds = investigation.scans ?? [];

  const crawlRows: CrawlRow[] = [
    ...crawlIds.map((id) => ({
      crawl_id: id,
      type: 'crawl',
      status: 'completed',
      created_at: investigation.created_at,
    })),
    ...scanIds.map((id) => ({
      crawl_id: id,
      type: 'scan',
      status: 'completed',
      created_at: investigation.created_at,
    })),
  ];

  const columns: Column<CrawlRow>[] = [
    {
      key: 'crawl_id',
      header: 'ID',
      render: (row) => (
        <span className="font-mono text-xs text-[#a09bb8] truncate max-w-[180px] block">
          {row.crawl_id}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge variant={row.type === 'scan' ? 'info' : 'crawler'}>{row.type}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => (
        <span className="text-xs text-[#5c5878] font-mono">{formatDate(row.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Investigation header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#f0eef8] truncate">{investigation.title}</h2>
          {investigation.description && (
            <p className="text-sm text-[#a09bb8] mt-1 leading-relaxed">
              {investigation.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={statusVariant(investigation.status)}>{investigation.status}</Badge>
          {investigation.priority && (
            <Badge variant={priorityVariant(investigation.priority)}>
              {investigation.priority}
            </Badge>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-[rgba(155,125,224,0.04)] border border-[rgba(155,125,224,0.1)] rounded-lg p-3">
          <div className="text-[#5c5878] font-mono mb-1">Created</div>
          <div className="text-[#a09bb8]">{formatDate(investigation.created_at)}</div>
        </div>
        <div className="bg-[rgba(155,125,224,0.04)] border border-[rgba(155,125,224,0.1)] rounded-lg p-3">
          <div className="text-[#5c5878] font-mono mb-1">Updated</div>
          <div className="text-[#a09bb8]">{formatDate(investigation.updated_at)}</div>
        </div>
      </div>

      {/* Associated crawl jobs */}
      <div>
        <h3 className="text-xs font-semibold text-[#5c5878] uppercase tracking-wider font-mono mb-3">
          Associated Jobs ({crawlRows.length})
        </h3>

        {crawlRows.length === 0 ? (
          <EmptyState
            icon={<Globe className="w-5 h-5" />}
            title="No jobs linked"
            description="Crawl jobs associated with this investigation will appear here."
          />
        ) : (
          <DataTable<CrawlRow>
            columns={columns}
            data={crawlRows}
            pageSize={10}
            emptyMessage="No jobs found"
          />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestigationsContent() {
  const {
    data: investigationsData,
    error: investigationsError,
    isLoading: loading,
    mutate,
  } = useSWR(
    swrKeys.crawler.investigations(),
    () => crawlerClient.getInvestigations({ limit: 100 }),
    {
      revalidateOnFocus: false,
    },
  );
  const investigations = investigationsData?.data?.investigations ?? [];
  const error = investigationsError?.message ?? investigationsData?.error ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const selectedInvestigation =
    investigations.find((inv) => inv.investigation_id === selectedId) ?? null;

  const handleCreated = useCallback(
    (inv: Investigation) => {
      void mutate();
      setSelectedId(inv.investigation_id);
    },
    [mutate],
  );

  let investigationsListContent: React.ReactNode;

  if (loading) {
    investigationsListContent = (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  } else if (investigations.length === 0) {
    investigationsListContent = (
      <EmptyState
        icon={<FolderSearch className="w-6 h-6" />}
        title="No investigations yet"
        description="Create your first investigation to start tracking OSINT cases."
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-150',
              'bg-[#0d0d1a] border-[#1e1e3a] text-[#9B7DE0]',
              'hover:bg-[#141428] hover:border-[#2a2a50]',
            ].join(' ')}
          >
            <Plus className="w-4 h-4" />
            Create first investigation
          </button>
        }
      />
    );
  } else {
    investigationsListContent = investigations.map((inv) => (
      <InvestigationCard
        key={inv.investigation_id}
        investigation={inv}
        isSelected={selectedId === inv.investigation_id}
        onClick={() => setSelectedId(inv.investigation_id)}
      />
    ));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <SectionHeader
        title="Investigations"
        breadcrumb={['CRAWLER', 'INVESTIGATIONS']}
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-150',
              'bg-[#0d0d1a] border-[#1e1e3a] text-[#9B7DE0]',
              'hover:bg-[#141428] hover:border-[#2a2a50]',
            ].join(' ')}
          >
            <Plus className="w-4 h-4" />
            New Investigation
          </button>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] rounded-lg text-sm text-[#FF6B6B]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              void mutate();
            }}
            className="text-[#FF6B6B]/60 hover:text-[#FF6B6B] text-xs underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex gap-4 min-h-[600px]">
        {/* Left panel — investigation list */}
        <div className="w-1/3 flex-shrink-0 flex flex-col gap-3">{investigationsListContent}</div>

        {/* Right panel — detail */}
        <div className="flex-1 min-w-0">
          <Card className="h-full">
            <DetailPanel investigation={selectedInvestigation} />
          </Card>
        </div>
      </div>

      {/* New Investigation Modal */}
      <NewInvestigationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
