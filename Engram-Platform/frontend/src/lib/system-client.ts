type Result<T> = { data: T | null; error: string | null };

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
  sendNotification(payload: { to?: string[]; subject: string; text: string }) {
    return request('/api/system/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
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
};
