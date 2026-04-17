'use client';

import { Check, Copy, Edit3, Key, Plus, Shield, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/src/design-system/components/Badge';
import { Modal } from '@/src/design-system/components/Modal';
import { addToast } from '@/src/design-system/components/Toast';
import { authClient } from '@/src/lib/auth-client';

// ── Types ────────────────────────────────────────────────────────────────────

// Use a loose type that matches BetterAuth's api-key shape
// biome-ignore lint: flexible shape for BetterAuth compatibility
type ApiKeyRecord = Record<string, any> & {
  id: string;
  name: string | null;
  prefix: string | null;
  enabled: boolean;
  createdAt: Date | string;
  requestCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: Date | string | null | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetcher(): Promise<ApiKeyRecord[]> {
  const result = await authClient.apiKey.list();
  if ('error' in result && result.error) throw new Error(String(result.error));
  // biome-ignore lint: BetterAuth returns { apiKeys: [...] }
  const data = result.data as any;
  return data?.apiKeys ?? [];
}

// ── Create Key Modal ──────────────────────────────────────────────────────────

function CreateKeyModal({
  isOpen,
  onClose,
  onCreated,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}>) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await authClient.apiKey.create({ name: name.trim() });
      if ('error' in result && result.error) {
        addToast({ type: 'error', message: String(result.error) });
        return;
      }
      setCreatedKey((result.data as { key?: string })?.key ?? null);
      onCreated();
      addToast({ type: 'success', message: `API key "${name}" created` });
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create key',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName('');
    setCreatedKey(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create API Key" size="md">
      {createdKey ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#F2A93B]/20 bg-[#F2A93B]/5 p-4">
            <p className="text-xs font-medium text-[#F2A93B] mb-2 font-mono uppercase tracking-wider">
              Copy this key now — it will not be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-[#f0eef8] bg-black/30 rounded px-3 py-2 break-all select-all">
                {createdKey}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-lg hover:bg-white/5 text-[#a09bb8] hover:text-[#f0eef8] transition-colors"
                aria-label="Copy key"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#2EC4C4]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2 rounded-lg bg-white/5 text-sm text-[#f0eef8] hover:bg-white/10 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="key-name" className="block text-xs font-medium text-[#a09bb8] mb-1.5">
              Key Name
            </label>
            <input
              id="key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. production-crawler"
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-[#f0eef8] placeholder-[#5c5878] focus:outline-none focus:ring-2 focus:ring-[#F2A93B]/50 focus:border-[#F2A93B]/50"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm text-[#a09bb8] hover:text-[#f0eef8] hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F2A93B] text-[#03020A] hover:bg-[#F2A93B]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({
  keyToDelete,
  onClose,
  onDeleted,
}: Readonly<{
  keyToDelete: ApiKeyRecord | null;
  onClose: () => void;
  onDeleted: () => void;
}>) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!keyToDelete) return;
    setLoading(true);
    try {
      await authClient.apiKey.delete({ keyId: keyToDelete.id });
      addToast({ type: 'success', message: `Key "${keyToDelete.name}" deleted` });
      onDeleted();
      onClose();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete key',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!keyToDelete} onClose={onClose} title="Delete API Key" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-[#a09bb8]">
          Are you sure you want to delete{' '}
          <span className="text-[#f0eef8] font-medium">{keyToDelete?.name}</span>? This action
          cannot be undone. Any services using this key will lose access immediately.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#a09bb8] hover:text-[#f0eef8] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 hover:bg-[#FF6B6B]/20 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Deleting...' : 'Delete Key'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Inline Rename ─────────────────────────────────────────────────────────────

function EditableName({
  apiKey,
  onRenamed,
}: Readonly<{
  apiKey: ApiKeyRecord;
  onRenamed: () => void;
}>) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(apiKey.name ?? '');

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === apiKey.name) {
      setValue(apiKey.name ?? '');
      setEditing(false);
      return;
    }
    try {
      await authClient.apiKey.update({ keyId: apiKey.id, name: trimmed });
      addToast({ type: 'success', message: 'Key renamed' });
      onRenamed();
    } catch {
      addToast({ type: 'error', message: 'Failed to rename key' });
      setValue(apiKey.name ?? '');
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setValue(apiKey.name ?? '');
            setEditing(false);
          }
        }}
        className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-sm text-[#f0eef8] focus:outline-none focus:ring-1 focus:ring-[#F2A93B]/50 w-48"
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={() => apiKey.enabled && setEditing(true)}
      onClick={() => {}}
      className="flex items-center gap-1.5 group text-left"
      title={apiKey.enabled ? 'Double-click to rename' : undefined}
    >
      <span className="text-sm text-[#f0eef8]">{apiKey.name ?? 'Unnamed'}</span>
      {apiKey.enabled && (
        <Edit3 className="w-3 h-3 text-[#5c5878] opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

// ── Claude Code Config Helper ────────────────────────────────────────────────

function ClaudeCodeConfigSection() {
  const [copied, setCopied] = useState(false);

  const configSnippet = JSON.stringify(
    {
      'engram-memory': {
        command: 'node',
        args: ['/path/to/Engram-MCP/dist/index.js', '--transport', 'stdio'],
        env: {
          ENGRAM_API_URL: 'http://acdev-devnode.icefish-discus.ts.net:8000',
          ENGRAM_API_KEY: '<paste-your-api-key-here>',
        },
      },
    },
    null,
    2,
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#7C5CBF]/10 border border-[#7C5CBF]/20">
          <Shield className="w-5 h-5 text-[#7C5CBF]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#f0eef8] font-display">Claude Code Setup</h2>
          <p className="text-xs text-[#5c5878]">
            Add to ~/.claude/settings.json under &quot;mcpServers&quot;
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-[#5c5878]">
            MCP Config
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-[#a09bb8] hover:text-[#f0eef8] hover:bg-white/5 transition-colors"
            aria-label="Copy config"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#2EC4C4]" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="text-xs font-mono text-[#a09bb8] bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre">
          {configSnippet}
        </pre>
        <p className="text-xs text-[#5c5878]">
          Replace <code className="text-[#a09bb8]">&lt;paste-your-api-key-here&gt;</code> with an
          API key from the table above.
        </p>
      </div>
    </div>
  );
}

// ── Keys Table ────────────────────────────────────────────────────────────────

export default function KeysContent() {
  const { data, error, isLoading, mutate } = useSWR('betterauth-keys', fetcher, {
    refreshInterval: 30000,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRecord | null>(null);

  const handleMutate = useCallback(() => {
    mutate();
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#5c5878] text-sm">
        Loading keys...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-[#FF6B6B] text-sm">
        {error.message || 'Failed to load keys'}
      </div>
    );
  }

  const keys = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#F2A93B]/10 border border-[#F2A93B]/20">
            <Key className="w-5 h-5 text-[#F2A93B]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#f0eef8] font-display">API Keys</h1>
            <p className="text-xs text-[#5c5878]">
              {keys.length} key{keys.length !== 1 ? 's' : ''} total — used for MCP, Memory API, and
              all service authentication
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#F2A93B] text-[#03020A] hover:bg-[#F2A93B]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Name
                </th>
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Key Prefix
                </th>
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Status
                </th>
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Created
                </th>
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Last Used
                </th>
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Requests
                </th>
                <th className="px-4 py-3 text-[10px] font-mono font-medium text-[#5c5878] uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#5c5878]">
                    No API keys yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                keys.map((k: ApiKeyRecord) => (
                  <tr
                    key={k.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <EditableName apiKey={k} onRenamed={handleMutate} />
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-[#a09bb8] bg-black/20 px-2 py-0.5 rounded">
                        {k.prefix ?? '--'}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={k.enabled ? 'success' : 'error'} dot>
                        {k.enabled ? 'active' : 'disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a09bb8]">{formatDate(k.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-[#a09bb8]">{formatDate(k.lastUsedAt)}</td>
                    <td className="px-4 py-3 text-xs text-[#a09bb8] font-mono">
                      {k.requestCount?.toLocaleString() ?? '--'}
                    </td>
                    <td className="px-4 py-3">
                      {k.enabled && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(k)}
                          className="p-1.5 rounded-lg text-[#5c5878] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-colors"
                          aria-label={`Delete key ${k.name}`}
                          title="Delete key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claude Code Integration */}
      <ClaudeCodeConfigSection />

      {/* Modals */}
      <CreateKeyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleMutate}
      />
      <DeleteModal
        keyToDelete={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleMutate}
      />
    </div>
  );
}
