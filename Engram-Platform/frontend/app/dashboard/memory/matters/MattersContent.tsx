'use client';

import { format } from 'date-fns';
import {
  Brain,
  Calendar,
  Download,
  Edit2,
  FolderOpen,
  InfoIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  SectionHeader,
  Tooltip,
} from '@/src/design-system/components';
import { type Matter, memoryClient } from '@/src/lib/memory-client';
import { swrKeys } from '@/src/lib/swr-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatterWithMemories extends Matter {
  memoryCount?: number;
}

// ─── New Matter Modal ─────────────────────────────────────────────────────────

interface NewMatterModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

function NewMatterModal({ isOpen, onClose, onCreated }: NewMatterModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim()) return;

      setLoading(true);
      setError(null);

      try {
        const { error: apiError } = await memoryClient.createMatter({
          title: name.trim(),
          description: description.trim() || undefined,
        });
        if (apiError) throw new Error(apiError);

        setName('');
        setDescription('');
        onCreated();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create matter');
      } finally {
        setLoading(false);
      }
    },
    [name, description, onCreated, onClose],
  );

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Matter" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Project Alpha Investigation"
          tooltip="A unique name to identify this matter"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="matter-desc"
              className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono"
            >
              Description{' '}
              <span className="ml-1 text-[#5c5878] font-normal normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <Tooltip content="Detailed context or objectives for this matter" side="right">
              <InfoIcon className="w-3.5 h-3.5 text-[#5c5878] hover:text-[#a09bb8] transition-colors cursor-help" />
            </Tooltip>
          </div>
          <textarea
            id="matter-desc"
            className="w-full bg-white/4 border border-white/8 rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] px-4 py-2 focus:outline-none focus:ring-1 focus:border-[rgba(46,196,196,0.4)] focus:ring-[rgba(46,196,196,0.2)] transition-all duration-150 resize-none"
            rows={3}
            placeholder="Optional description of this matter..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            disabled={!name.trim()}
            className="bg-[rgba(46,196,196,0.12)] border border-[rgba(46,196,196,0.2)] text-[#2EC4C4] hover:bg-[rgba(46,196,196,0.2)] focus:ring-[#2EC4C4]"
          >
            Create Matter
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteMatterModalProps {
  readonly matter: Matter | null;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}

function DeleteMatterModal({ matter, onClose, onDeleted }: DeleteMatterModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (!matter) return;
    setLoading(true);
    setError(null);

    try {
      const { error: apiError } = await memoryClient.deleteMatter(matter.matter_id);
      if (apiError) throw new Error(apiError);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete matter');
    } finally {
      setLoading(false);
    }
  }, [matter, onDeleted, onClose]);

  return (
    <Modal isOpen={!!matter} onClose={onClose} title="Delete Matter" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-[#a09bb8]">
          Are you sure you want to delete{' '}
          <span className="text-[#f0eef8] font-medium">{matter?.title}</span>? This action cannot be
          undone.
        </p>
        {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" size="sm" loading={loading} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Matter Card ──────────────────────────────────────────────────────────────

interface MatterCardProps {
  readonly matter: MatterWithMemories;
  readonly isSelected: boolean;
  readonly onSelect: (matter: Matter) => void;
  readonly onEdit: (matter: Matter) => void;
  readonly onDelete: (matter: Matter) => void;
}

function MatterCard({ matter, isSelected, onSelect, onEdit, onDelete }: MatterCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(matter)}
      className={`group relative w-full text-left rounded-xl border p-4 transition-all duration-150 cursor-pointer focus:outline-none ${isSelected ? 'bg-teal/6 border-teal/40' : 'bg-white/2 border-white/6'}`}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(46,196,196,0.25)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(46,196,196,0.03)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
        }
      }}
    >
      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(matter);
          }}
          className="p-1.5 rounded-lg bg-white/4 border border-white/6 text-[#5c5878] hover:text-[#a09bb8] hover:bg-white/8 transition-colors"
          title="Edit matter"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(matter);
          }}
          className="p-1.5 rounded-lg bg-white/4 border border-white/6 text-[#5c5878] hover:text-[#FF6B6B] hover:bg-[rgba(255,107,107,0.08)] transition-colors"
          title="Delete matter"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3 pr-16">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-teal/12">
          <FolderOpen className="w-4 h-4 text-[#2EC4C4]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#f0eef8] truncate">{matter.title}</h3>
          {matter.status && (
            <Badge variant="memory" className="mt-0.5">
              {matter.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      {matter.description && (
        <p className="text-xs text-[#5c5878] line-clamp-2 mb-3 leading-relaxed">
          {matter.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[#5c5878]">
          <Calendar className="w-3 h-3" />
          <span className="font-mono">
            {matter.created_at ? format(new Date(matter.created_at), 'MMM d, yyyy') : '—'}
          </span>
        </div>
        {matter.lead_investigator && (
          <span className="text-xs text-[#5c5878] font-mono truncate max-w-[120px]">
            {matter.lead_investigator}
          </span>
        )}
      </div>

      {/* Tags */}
      {matter.tags && matter.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {matter.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/4 text-[#5c5878] border border-white/6"
            >
              {tag}
            </span>
          ))}
          {matter.tags.length > 3 && (
            <span className="text-[10px] font-mono text-[#5c5878]">+{matter.tags.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Edit Matter Modal ────────────────────────────────────────────────────────

interface EditMatterModalProps {
  readonly matter: Matter | null;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

function EditMatterModal({ matter, onClose, onUpdated }: EditMatterModalProps) {
  const [title, setTitle] = useState(matter?.title ?? '');
  const [description, setDescription] = useState(matter?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State initialised from props; component is keyed by matter_id in parent
  // so useState runs fresh for each matter (no useEffect sync needed).

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!matter || !title.trim()) return;
      setLoading(true);
      setError(null);

      try {
        const { error: apiError } = await memoryClient.updateMatter(matter.matter_id, {
          title: title.trim(),
          description: description.trim() || undefined,
        });
        if (apiError) throw new Error(apiError);
        onUpdated();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update matter');
      } finally {
        setLoading(false);
      }
    },
    [matter, title, description, onUpdated, onClose],
  );

  return (
    <Modal isOpen={!!matter} onClose={onClose} title="Edit Matter" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edit-matter-desc"
            className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono"
          >
            Description
          </label>
          <textarea
            id="edit-matter-desc"
            className="w-full bg-white/4 border border-white/8 rounded-lg text-sm text-[#f0eef8] placeholder-[#5c5878] px-4 py-2 focus:outline-none focus:ring-1 focus:border-[rgba(46,196,196,0.4)] focus:ring-[rgba(46,196,196,0.2)] transition-all duration-150 resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            disabled={!title.trim()}
            className="bg-[rgba(46,196,196,0.12)] border border-[rgba(46,196,196,0.2)] text-[#2EC4C4] hover:bg-[rgba(46,196,196,0.2)] focus:ring-[#2EC4C4]"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Matter Detail Panel ──────────────────────────────────────────────────────

interface MatterDetailPanelProps {
  readonly matter: Matter;
  readonly onClose: () => void;
}

const MEMORY_COLUMNS = [
  {
    key: 'content',
    header: 'Content',
    render: (row: Record<string, unknown>) => (
      <span className="text-[#a09bb8] text-xs line-clamp-2 max-w-xs">
        {typeof row.content === 'string' ? row.content : ''}
      </span>
    ),
  },
  {
    key: 'memory_type',
    header: 'Type',
    render: (row: Record<string, unknown>) => (
      <Badge variant="memory">{typeof row.memory_type === 'string' ? row.memory_type : ''}</Badge>
    ),
  },
  {
    key: 'created_at',
    header: 'Created',
    render: (row: Record<string, unknown>) => (
      <span className="text-xs font-mono text-[#5c5878]">
        {typeof row.created_at === 'string' || typeof row.created_at === 'number'
          ? format(new Date(row.created_at), 'MMM d')
          : '—'}
      </span>
    ),
  },
];

function MatterDetailPanel({ matter, onClose }: MatterDetailPanelProps) {
  const { data: memoriesData, isLoading } = useSWR(
    swrKeys.memory.memories({ matterId: matter.matter_id }),
    () => memoryClient.getMemories({ project_id: matter.matter_id, limit: 50 }),
    { revalidateOnFocus: false },
  );

  const memories = memoriesData?.data?.memories ?? [];

  return (
    <div className="rounded-xl border border-[rgba(46,196,196,0.2)] bg-[rgba(46,196,196,0.03)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#2EC4C4]" />
          <h2 className="text-sm font-semibold text-[#f0eef8]">{matter.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close detail panel"
          className="p-1 rounded hover:bg-white/6 text-[#5c5878] hover:text-[#a09bb8] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Description */}
        {matter.description && (
          <p className="text-sm text-[#a09bb8] leading-relaxed">{matter.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-[#2EC4C4]" />
            <span className="text-xs font-mono text-[#a09bb8]">
              {isLoading ? '...' : memories.length} memories
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#5c5878]" />
            <span className="text-xs font-mono text-[#5c5878]">
              {matter.created_at ? format(new Date(matter.created_at), 'MMM d, yyyy') : '—'}
            </span>
          </div>
          {matter.status && <Badge variant="memory">{matter.status}</Badge>}
        </div>

        {/* Memories list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono text-[#5c5878] uppercase tracking-wider">
              Associated Memories
            </h3>
            <a
              href={`/dashboard/memory/memories?matter=${matter.matter_id}`}
              className="text-xs text-[#2EC4C4] hover:text-[#4dd8d8] font-mono transition-colors"
            >
              View All →
            </a>
          </div>

          {(() => {
            if (isLoading) {
              return <LoadingState variant="skeleton" rows={3} />;
            }
            if (memories.length === 0) {
              return (
                <EmptyState
                  title="No memories yet"
                  description="Memories associated with this matter will appear here."
                  context="matter"
                />
              );
            }
            return (
              <DataTable<Record<string, unknown>>
                columns={MEMORY_COLUMNS}
                data={memories as unknown as Record<string, unknown>[]}
                pageSize={10}
              />
            );
          })()}
        </div>

        {/* Memory Composition */}
        <div>
          <p className="text-[10px] font-mono text-[#5c5878] uppercase tracking-wider mb-2">
            Memory Composition
          </p>
          <div className="flex w-full h-2 rounded-full overflow-hidden bg-[#1e1e3a] mb-2">
            <div className="bg-[#2EC4C4] w-[45%]" title="Research" />
            <div className="bg-purple-500 w-[30%]" title="Decisions" />
            <div className="bg-orange-500 w-[25%]" title="Tasks" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#5c5878]">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#2EC4C4]" /> Research
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" /> Decisions
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" /> Tasks
            </span>
          </div>
        </div>

        {/* Action Panel */}
        <div className="pt-2 border-t border-[#1e1e3a]">
          <p className="text-[10px] font-mono text-[#5c5878] uppercase tracking-wider mb-2">
            Quick Actions
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 text-xs py-1 h-auto bg-[#1e1e3a] text-[#f0eef8] border border-transparent hover:border-[#2EC4C4]"
            >
              View Graph
            </Button>
            <Button
              variant="secondary"
              className="flex-1 text-xs py-1 h-auto bg-[#1e1e3a] text-[#f0eef8] border border-transparent hover:border-[#2EC4C4]"
            >
              View Timeline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MattersContent() {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [editMatter, setEditMatter] = useState<Matter | null>(null);
  const [deleteMatter, setDeleteMatter] = useState<Matter | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.memory.matters(),
    () => memoryClient.getMatters(),
    { revalidateOnFocus: false },
  );

  const matters = data?.data?.matters ?? [];

  const handleCreated = useCallback(() => {
    void mutate();
  }, [mutate]);
  const handleUpdated = useCallback(() => {
    void mutate();
  }, [mutate]);
  const handleDeleted = useCallback(() => {
    void mutate();
    setSelectedMatter(null);
  }, [mutate]);

  const handleSelect = useCallback((matter: Matter) => {
    setSelectedMatter((prev) => (prev?.matter_id === matter.matter_id ? null : matter));
  }, []);

  if (isLoading) {
    return <LoadingState label="Loading matters..." />;
  }

  if (error || data?.error) {
    return (
      <ErrorState message={data?.error ?? 'Failed to load matters'} onRetry={() => void mutate()} />
    );
  }

  return (
    <div className="space-y-6 animate-page-enter">
      <SectionHeader
        title="Matters"
        breadcrumb={['MEMORY', 'MATTERS']}
        action={
          <div className="flex items-center gap-2">
            <Tooltip content="Import Markdown" side="top">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => alert('Markdown import coming soon')}
              >
                <Upload className="w-3.5 h-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Export Markdown" side="top">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => alert('Markdown export coming soon')}
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </Tooltip>
            <Button
              size="sm"
              onClick={() => setShowNewModal(true)}
              className="bg-[rgba(46,196,196,0.12)] border border-[rgba(46,196,196,0.2)] text-[#2EC4C4] hover:bg-[rgba(46,196,196,0.2)] focus:ring-[#2EC4C4]"
            >
              <Plus className="w-3.5 h-3.5" />
              New Matter
            </Button>
          </div>
        }
      />

      {matters.length === 0 ? (
        <EmptyState
          title="No matters yet"
          description="Create your first matter to organize memories."
          icon={<FolderOpen className="w-6 h-6" />}
          context="matter"
          action={
            <Button
              size="sm"
              onClick={() => setShowNewModal(true)}
              className="bg-[rgba(46,196,196,0.12)] border border-[rgba(46,196,196,0.2)] text-[#2EC4C4] hover:bg-[rgba(46,196,196,0.2)] focus:ring-[#2EC4C4]"
            >
              <Plus className="w-3.5 h-3.5" />
              New Matter
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Matter grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {matters.map((matter) => (
              <MatterCard
                key={matter.matter_id}
                matter={matter}
                isSelected={selectedMatter?.matter_id === matter.matter_id}
                onSelect={handleSelect}
                onEdit={setEditMatter}
                onDelete={setDeleteMatter}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selectedMatter && (
            <MatterDetailPanel matter={selectedMatter} onClose={() => setSelectedMatter(null)} />
          )}
        </div>
      )}

      {/* Modals */}
      <NewMatterModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />
      <EditMatterModal
        key={editMatter?.matter_id}
        matter={editMatter}
        onClose={() => setEditMatter(null)}
        onUpdated={handleUpdated}
      />
      <DeleteMatterModal
        matter={deleteMatter}
        onClose={() => setDeleteMatter(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
