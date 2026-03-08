import { useEffect, useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Archive,
  FolderX,
  Loader2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Alert,
} from '../components/ui';
import { casesApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Case {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'closed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  subject_name?: string;
  created_at: string;
  updated_at?: string;
}

interface CreateCaseForm {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  subject_name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusBadgeVariant(status: Case['status']) {
  switch (status) {
    case 'closed':
      return 'success' as const;
    case 'in_progress':
      return 'warning' as const;
    case 'open':
      return 'info' as const;
    case 'archived':
    default:
      return 'ghost' as const;
  }
}

function priorityBadgeVariant(priority: Case['priority']) {
  switch (priority) {
    case 'critical':
    case 'high':
      return 'danger' as const;
    case 'medium':
      return 'warning' as const;
    case 'low':
    default:
      return 'ghost' as const;
  }
}

const PRIORITY_OPTIONS: { value: CreateCaseForm['priority']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const DEFAULT_FORM: CreateCaseForm = {
  title: '',
  description: '',
  priority: 'medium',
  subject_name: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateCaseForm>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await casesApi.list(statusFilter || undefined);
      const data = res.data;
      setCases(Array.isArray(data) ? data : (data?.items ?? data?.cases ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const stats = {
    total: cases.length,
    open: cases.filter((c) => c.status === 'open').length,
    in_progress: cases.filter((c) => c.status === 'in_progress').length,
    closed: cases.filter((c) => c.status === 'closed').length,
  };

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filtered = cases.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.subject_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOpenModal = () => {
    setForm(DEFAULT_FORM);
    setCreateError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      setCreateError('Title is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        priority: form.priority,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.subject_name.trim()) payload.subject_name = form.subject_name.trim();

      await casesApi.create(payload);
      setModalOpen(false);
      void fetchCases();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      await casesApi.update(id, { status: 'archived' });
      setCases((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'archived' as const } : c))
      );
    } catch {
      // silently ignore; could add toast here
    } finally {
      setArchivingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Briefcase size={24} className="text-cyan" />
            Cases
            {loading && cases.length > 0 && (
              <Loader2 size={18} className="animate-spin text-cyan" aria-label="Refreshing" />
            )}
          </h1>
          <p className="mt-1 text-sm text-text-dim">
            Manage and track your case files
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenModal}
          leftIcon={<Plus size={16} />}
        >
          New Case
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Open', value: stats.open },
          { label: 'In Progress', value: stats.in_progress },
          { label: 'Closed', value: stats.closed },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs text-text-mute uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-text">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            aria-label="Search cases"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan"
          aria-label="Filter by status"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / Empty / Loading */}
      {loading && cases.length === 0 ? (
        <Card className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-cyan" />
        </Card>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderX size={48} className="text-text-mute mb-4" />
          {cases.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-text mb-1">No cases yet</p>
              <p className="text-sm text-text-dim mb-4 max-w-xs">
                Create your first case to start tracking.
              </p>
              <Button
                variant="primary"
                onClick={handleOpenModal}
                leftIcon={<Plus size={16} />}
              >
                Create your first case
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-text mb-1">No results</p>
              <p className="text-sm text-text-dim">Try a different search term or status filter.</p>
            </>
          )}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-void">
                  {['Title', 'Status', 'Priority', 'Created', 'Actions'].map((col, i) => (
                    <th
                      key={col}
                      className={`px-4 py-3 text-xs font-semibold text-text-dim uppercase tracking-wider ${
                        i === 4 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-void transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{c.title}</div>
                      {c.subject_name && (
                        <div className="text-xs text-text-dim truncate max-w-xs">
                          Subject: {c.subject_name}
                        </div>
                      )}
                      {c.description && (
                        <div className="text-xs text-text-mute truncate max-w-xs">
                          {c.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(c.status)} dot>
                        {c.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityBadgeVariant(c.priority)}>
                        {c.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-dim whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {c.status !== 'archived' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={archivingId === c.id}
                            onClick={() => void handleArchive(c.id)}
                            leftIcon={<Archive size={13} />}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Case Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal} size="md">
        <ModalHeader>
          <span className="flex-1 text-[13px] font-mono uppercase tracking-widest text-text">New Case</span>
          <button
            type="button"
            aria-label="Close"
            onClick={handleCloseModal}
            className="ml-4 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <span className="text-text-dim text-lg leading-none">&times;</span>
          </button>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {createError && (
              <Alert variant="danger">{createError}</Alert>
            )}

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Title <span className="text-neon-r">*</span>
              </label>
              <Input
                type="text"
                placeholder="Enter case title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Description
              </label>
              <Input
                type="text"
                placeholder="Brief description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as CreateCaseForm['priority'] }))
                }
                className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Subject Name
              </label>
              <Input
                type="text"
                placeholder="Person or entity under investigation (optional)"
                value={form.subject_name}
                onChange={(e) => setForm((f) => ({ ...f, subject_name: e.target.value }))}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={handleCloseModal} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            loading={creating}
          >
            Create Case
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
