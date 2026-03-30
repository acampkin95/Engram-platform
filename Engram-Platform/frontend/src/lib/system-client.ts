type Result<T> = { data: T | null; error: string | null };

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: 'active' | 'revoked';
  created_at: string;
  last_used?: string | null;
  request_count?: number;
}

export interface ApiKeyCreateResponse extends ApiKey {
  key: string;
}

export interface AuditLogParams {
  key_id?: string;
  path?: string;
  method?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogEntry {
  timestamp: string;
  key_id: string;
  key_name: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  ip: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  has_more: boolean;
}

export interface AuditSummary {
  total_requests: number;
  error_count: number;
  error_rate: number;
  top_endpoints: Array<{ path: string; count: number }>;
  top_keys: Array<{ key_name: string; count: number }>;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<Result<T>> {
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: (data as { error?: string } | null)?.error ?? 'Request failed' };
    }

    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export const systemClient = {
  getSnapshot() {
    return request('/api/system/health');
  },
  getHistory() {
    return request('/api/system/history');
  },
  getLogs(service = 'all', lines = 200) {
    return request(`/api/system/logs?service=${encodeURIComponent(service)}&lines=${lines}`);
  },
  runControl(payload: { target: string; action: string }) {
    return request('/api/system/control', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  runMaintenance(payload: { action: string }) {
    return request('/api/system/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  sendNotification(payload: {
    to?: string[];
    subject: string;
    text: string;
    channels?: ('email' | 'ntfy')[];
    priority?: 'low' | 'default' | 'high' | 'urgent';
    tags?: string[];
  }) {
    return request('/api/system/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getNotificationSettings() {
    return request('/api/system/notifications/settings');
  },
  getNotificationLog() {
    return request('/api/system/notifications/log');
  },
  testNotificationChannel(channel: 'email' | 'ntfy') {
    return request('/api/system/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify({ channel }),
    });
  },
  subscribeLogs(
    service: string,
    handlers: {
      onMessage?: (event: MessageEvent<string>) => void;
      onError?: (event: Event) => void;
    },
  ) {
    const source = new EventSource(
      `/api/system/logs/stream?service=${encodeURIComponent(service)}`,
    );
    if (handlers.onMessage) source.onmessage = handlers.onMessage;
    if (handlers.onError) source.onerror = handlers.onError;
    return source;
  },
  triggerHealthAlert() {
    return request('/api/system/health/alert', { method: 'POST' });
  },

  // ── API Key Management ──────────────────────────────────────────────────────
  listKeys() {
    return request<{ keys: ApiKey[]; total: number }>('/api/system/keys');
  },
  createKey(name: string) {
    return request<ApiKeyCreateResponse>('/api/system/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  updateKey(id: string, data: { name?: string; status?: string }) {
    return request<ApiKey>(`/api/system/keys/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  revokeKey(id: string) {
    return request<{ status: string; key_id: string }>(
      `/api/system/keys/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  // ── Audit Log ───────────────────────────────────────────────────────────────
  getAuditLog(params?: AuditLogParams) {
    const search = new URLSearchParams();
    if (params?.key_id) search.set('key_id', params.key_id);
    if (params?.path) search.set('path', params.path);
    if (params?.method) search.set('method', params.method);
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.offset != null) search.set('offset', String(params.offset));
    const qs = search.toString();
    return request<AuditLogResponse>(`/api/system/audit${qs ? `?${qs}` : ''}`);
  },
  getAuditSummary(hours = 24) {
    return request<AuditSummary>(`/api/system/audit?summary=true&hours=${hours}`);
  },
};
