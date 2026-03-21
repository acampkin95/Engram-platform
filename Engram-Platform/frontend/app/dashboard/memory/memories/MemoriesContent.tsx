'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { FilterValues } from '@/src/components/FilterBar';
import { FilterBar } from '@/src/components/FilterBar';
import { SkeletonDataTable, SkeletonFilterBar } from '@/src/components/Skeletons';
import { Badge } from '@/src/design-system/components/Badge';
import { Button } from '@/src/design-system/components/Button';
import type { Column } from '@/src/design-system/components/DataTable';
import { DataTable } from '@/src/design-system/components/DataTable';
import { EmptyState } from '@/src/design-system/components/EmptyState';
import { ErrorState } from '@/src/design-system/components/ErrorState';
import { Modal } from '@/src/design-system/components/Modal';
import { SectionHeader } from '@/src/design-system/components/SectionHeader';
import { Tag } from '@/src/design-system/components/Tag';
import { addToast } from '@/src/design-system/components/Toast';
import { useSearchFilterState } from '@/src/hooks/useURLState';
import {
  type AddMemoryRequest,
  type ListMemoriesResponse,
  type MatterListResponse,
  memoryClient,
  type SearchResponse,
  type SearchResult,
} from '@/src/lib/memory-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

type MemoryRow = SearchResult & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Add Memory Modal ─────────────────────────────────────────────────────────

interface AddMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  matterOptions: Array<{ matter_id: string; title: string }>;
}

function AddMemoryModal({ isOpen, onClose, onSuccess, matterOptions }: AddMemoryModalProps) {
  const [content, setContent] = useState('');
  const [matterId, setMatterId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setContent('');
    setMatterId('');
    setTagsInput('');
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      addToast({ type: 'error', message: 'Content is required' });
      return;
    }

    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: AddMemoryRequest = {
        content: content.trim(),
        ...(matterId ? { project_id: matterId } : {}),
        ...(tags.length > 0 ? { tags } : {}),
      };

      const result = await memoryClient.createMemory(payload);
      if (result.error) {
        addToast({ type: 'error', message: `Failed to create memory: ${result.error}` });
        return;
      }

      addToast({ type: 'success', message: 'Memory created successfully' });
      onSuccess();
      handleClose();
    } finally {
      setSubmitting(false);
    }
  }, [content, matterId, tagsInput, onSuccess, handleClose]);

  const textareaClass =
    'w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:border-[rgba(46,196,196,0.4)] focus:ring-1 focus:ring-[rgba(46,196,196,0.2)] transition-all resize-none font-mono';

  const selectClass =
    'w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] focus:outline-none focus:border-[rgba(46,196,196,0.4)] focus:ring-1 focus:ring-[rgba(46,196,196,0.2)] transition-all font-mono';

  const inputClass =
    'w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:border-[rgba(46,196,196,0.4)] focus:ring-1 focus:ring-[rgba(46,196,196,0.2)] transition-all font-mono';

  const labelClass = 'block text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-1.5';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Memory" size="lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="add-memory-content">
            Content <span className="text-[#FF6B6B]">*</span>
          </label>
          <textarea
            id="add-memory-content"
            className={textareaClass}
            rows={5}
            placeholder="Enter memory content…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={10000}
          />
          <p className="text-xs text-[#5c5878] mt-1">{content.length}/10000 characters</p>
        </div>

        {matterOptions.length > 0 && (
          <div>
            <label className={labelClass} htmlFor="add-memory-matter">
              Matter
            </label>
            <select
              id="add-memory-matter"
              className={selectClass}
              value={matterId}
              onChange={(e) => setMatterId(e.target.value)}
            >
              <option value="">— None —</option>
              {matterOptions.map((m) => (
                <option key={m.matter_id} value={m.matter_id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="add-memory-tags">
            Tags (comma-separated)
          </label>
          <input
            id="add-memory-tags"
            type="text"
            className={inputClass}
            placeholder="e.g. important, review, osint"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-[#5c5878] mt-1">{tagsInput.length}/500 characters</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            Create Memory
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  memory: SearchResult | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (memory: SearchResult) => void;
}

function DetailModal({ memory, onClose, onDelete, onEdit }: DetailModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!memory) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(memory.memory_id ?? memory.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const metaEntries = Object.entries(
    (memory as unknown as { metadata?: Record<string, unknown> }).metadata ?? {},
  ).filter(([, v]) => v !== null && v !== undefined);

  return (
    <Modal isOpen={!!memory} onClose={onClose} title="Memory Detail" size="xl">
      <div className="space-y-5">
        {/* Content */}
        <div>
          <p className="text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-2">Content</p>
          <p className="text-sm text-[#f0eef8] leading-relaxed whitespace-pre-wrap bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
            {memory.content}
          </p>
        </div>

        {/* Matter */}
        {memory.project_id && (
          <div>
            <p className="text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-2">Matter</p>
            <Badge variant="memory">{memory.project_id}</Badge>
          </div>
        )}

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div>
            <p className="text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {memory.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {metaEntries.length > 0 && (
          <div>
            <p className="text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-2">
              Metadata
            </p>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
              {metaEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between px-3 py-2 text-xs">
                  <span className="text-[#5c5878] font-mono">{key}</span>
                  <span className="text-[#a09bb8] font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2">
            <p className="text-xs text-[#5c5878] font-mono">Importance</p>
            <p className="text-sm font-semibold text-[#2EC4C4] mt-0.5">
              {String(memory.importance ?? '—')}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2">
            <p className="text-xs text-[#5c5878] font-mono">Confidence</p>
            <p className="text-sm font-semibold text-[#2EC4C4] mt-0.5">
              {String(memory.confidence ?? '—')}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2">
            <p className="text-xs text-[#5c5878] font-mono">Tier</p>
            <p className="text-sm font-semibold text-[#2EC4C4] mt-0.5">
              {String(memory.tier ?? '—')}
            </p>
          </div>
        </div>

        {/* Created date */}
        <p className="text-xs text-[#5c5878] font-mono">
          Created: {memory.created_at ? formatDate(memory.created_at) : '—'}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(memory)}>
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  memory: SearchResult | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditModal({ memory, onClose, onSuccess }: EditModalProps) {
  const [content, setContent] = useState(memory?.content ?? '');
  const [tagsInput, setTagsInput] = useState(memory?.tags?.join(', ') ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!memory) return;
    if (!content.trim()) {
      addToast({ type: 'error', message: 'Content is required' });
      return;
    }

    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await memoryClient.updateMemory(memory.memory_id ?? memory.id, {
        content: content.trim(),
        tags,
      });

      if (result.error) {
        addToast({ type: 'error', message: `Failed to update memory: ${result.error}` });
        return;
      }

      addToast({ type: 'success', message: 'Memory updated successfully' });
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [memory, content, tagsInput, onSuccess, onClose]);

  const textareaClass =
    'w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:border-[rgba(46,196,196,0.4)] focus:ring-1 focus:ring-[rgba(46,196,196,0.2)] transition-all resize-none font-mono';

  const inputClass =
    'w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:border-[rgba(46,196,196,0.4)] focus:ring-1 focus:ring-[rgba(46,196,196,0.2)] transition-all font-mono';

  const labelClass = 'block text-xs font-mono text-[#5c5878] uppercase tracking-wider mb-1.5';

  return (
    <Modal isOpen={!!memory} onClose={onClose} title="Edit Memory" size="lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="edit-memory-content">
            Content <span className="text-[#FF6B6B]">*</span>
          </label>
          <textarea
            id="edit-memory-content"
            className={textareaClass}
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={10000}
          />
          <p className="text-xs text-[#5c5878] mt-1">{content.length}/10000 characters</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="edit-memory-tags">
            Tags (comma-separated)
          </label>
          <input
            id="edit-memory-tags"
            type="text"
            className={inputClass}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-[#5c5878] mt-1">{tagsInput.length}/500 characters</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemoriesContent() {
  const { search: urlSearch, filter: urlFilter, setSearch, setFilter } = useSearchFilterState();
  const [_filters, setFilters] = useState<FilterValues>({
    search: urlSearch,
    status: urlFilter,
  });
  const [selectedMemory, setSelectedMemory] = useState<SearchResult | null>(null);
  const [editMemory, setEditMemory] = useState<SearchResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [_showImportModal, _setShowImportModal] = useState(false);
  const [_scope, _setScope] = useState<'global' | 'personal'>('global');
  const [_showAnomalies, _setShowAnomalies] = useState(false);
  const [_showSecrets, _setShowSecrets] = useState(false);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      search: urlSearch,
      status: urlFilter,
    }));
  }, [urlSearch, urlFilter]);

  const handleFiltersChange = useCallback(
    (nextFilters: FilterValues) => {
      setFilters(nextFilters);
      setSearch(nextFilters.search ?? '');
      setFilter(nextFilters.status ?? '');
    },
    [setFilter, setSearch],
  );

  // Derive search query and matter filter from FilterValues
  const searchQuery = urlSearch;
  const selectedMatter = urlFilter || null;

  // SWR key changes when search/filter changes
  const swrKey = swrKeys.memory.memories({
    search: searchQuery,
    matterId: selectedMatter ?? undefined,
  });

  const {
    data: memoriesRes,
    error,
    isLoading,
    mutate,
  } = useSWR<
    | { data: ListMemoriesResponse | null; error: string | null }
    | { data: SearchResponse | null; error: string | null }
  >(swrKey, () =>
    searchQuery
      ? memoryClient.searchMemories(
          searchQuery,
          selectedMatter ? { project_id: selectedMatter } : undefined,
        )
      : memoryClient.getMemories(selectedMatter ? { project_id: selectedMatter } : undefined),
  );

  const { data: mattersRes, isLoading: mattersLoading } = useSWR<{
    data: MatterListResponse | null;
    error: string | null;
  }>(swrKeys.memory.matters(), () => memoryClient.getMatters());

  const matters = mattersRes?.data?.matters ?? [];

  const matterStatusOptions = useMemo(
    () => matters.map((m) => ({ value: m.matter_id, label: m.title ?? 'Untitled' })),
    [matters],
  );

  const matterAddOptions = useMemo(
    () => matters.map((m) => ({ matter_id: m.matter_id, title: m.title ?? 'Untitled' })),
    [matters],
  );

  // Normalise memories from either list or search response
  const memories: SearchResult[] = (() => {
    if (!memoriesRes?.data) return [];
    const d = memoriesRes.data;
    if ('memories' in d && Array.isArray(d.memories)) return d.memories;
    if ('results' in d && Array.isArray(d.results)) return d.results;
    return [];
  })();

  // Cast to MemoryRow for DataTable
  const tableData: MemoryRow[] = memories as MemoryRow[];

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await memoryClient.deleteMemory(id);
      if (result.error) {
        addToast({ type: 'error', message: `Failed to delete memory: ${result.error}` });
        return;
      }
      addToast({ type: 'success', message: 'Memory deleted' });
      await mutate();
    },
    [mutate],
  );

  const columns: Column<MemoryRow>[] = useMemo(
    () => [
      {
        key: 'content',
        header: 'Content',
        render: (row) => (
          <span className="text-[#f0eef8]">{truncate(row.content as string, 80)}</span>
        ),
      },
      {
        key: 'project_id',
        header: 'Matter',
        render: (row) =>
          row.project_id ? (
            <Badge variant="memory">{row.project_id as string}</Badge>
          ) : (
            <span className="text-[#5c5878]">—</span>
          ),
      },
      {
        key: 'tags',
        header: 'Tags',
        render: (row) => {
          const tags = (row.tags as string[]) ?? [];
          if (tags.length === 0) return <span className="text-[#5c5878]">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-[#5c5878] font-mono">+{tags.length - 3}</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'overall_confidence',
        header: 'Integrity',
        render: (row) => {
          const conf = row.overall_confidence as number | undefined;
          if (conf === undefined) return <span className="text-[#5c5878]">—</span>;
          const percentage = Math.round(conf * 100);
          const color = percentage >= 70 ? '#2EC4C4' : percentage <= 40 ? '#FF6B6B' : '#F2A93B';
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-[#1b1829] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
              <span className="font-mono text-[10px]" style={{ color }}>
                {percentage}%
              </span>
              {(row.contradictions as string[] | undefined)?.length ? (
                <span title="Contains Contradictions" className="text-[#FF6B6B] text-[10px] ml-1">
                  ⚠️
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        render: (row) => (
          <span className="font-mono text-xs">{formatDate(row.created_at as string)}</span>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMemory(row as unknown as SearchResult);
              }}
              title="View"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditMemory(row as unknown as SearchResult);
              }}
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(row.memory_id as string);
              }}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#FF6B6B]" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete],
  );

  return (
    <div className="space-y-6 animate-page-enter">
      <SectionHeader
        title="Memories"
        breadcrumb={['MEMORY', 'MEMORIES']}
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await memoryClient.runDecay();
                  addToast({ type: 'success', message: 'Memory decay process started' });
                } catch (_e) {
                  addToast({ type: 'error', message: 'Failed to start decay process' });
                }
              }}
            >
              Run Decay
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await memoryClient.consolidateMemories();
                  addToast({ type: 'success', message: 'Memory consolidation started' });
                } catch (_e) {
                  addToast({ type: 'error', message: 'Failed to start consolidation' });
                }
              }}
            >
              Consolidate
            </Button>
            <Button onClick={() => setShowAddModal(true)}>Add Memory</Button>
          </div>
        }
      />

      {/* ── Filters ── */}
      {mattersLoading ? (
        <SkeletonFilterBar />
      ) : (
        <FilterBar
          showSearch
          showStatus={matters.length > 0}
          statusOptions={matterStatusOptions}
          placeholder="Search memories…"
          onFiltersChange={handleFiltersChange}
        />
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <SkeletonDataTable rows={8} />
      ) : error ? (
        <ErrorState message="Failed to load memories" onRetry={() => void mutate()} />
      ) : memories.length === 0 ? (
        <EmptyState
          title="No memories found"
          description={
            searchQuery ? `No results for "${searchQuery}"` : 'Add your first memory to get started'
          }
          context="memory"
          action={
            <Button onClick={() => setShowAddModal(true)} size="sm">
              Add Memory
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={tableData}
          pageSize={20}
          emptyMessage="No memories found"
        />
      )}

      {/* ── Modals ── */}
      <AddMemoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => void mutate()}
        matterOptions={matterAddOptions}
      />

      <DetailModal
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
        onDelete={handleDelete}
        onEdit={(mem) => {
          setSelectedMemory(null);
          setEditMemory(mem);
        }}
      />

      <EditModal
        memory={editMemory}
        onClose={() => setEditMemory(null)}
        onSuccess={() => void mutate()}
      />
    </div>
  );
}
