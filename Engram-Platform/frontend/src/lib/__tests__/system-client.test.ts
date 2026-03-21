import { beforeEach, describe, expect, it, vi } from 'vitest';
import { systemClient } from '../system-client';

describe('systemClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSnapshot', () => {
    it('should make a GET request to /api/system/health', async () => {
      const mockResponse = { status: 'ok', version: '1.0.0' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      const result = await systemClient.getSnapshot();

      expect(fetch).toHaveBeenCalledWith('/api/system/health', expect.any(Object));
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle fetch errors gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

      const result = await systemClient.getSnapshot();

      expect(result.error).toBe('Network error');
      expect(result.data).toBeNull();
    });

    it('should handle invalid JSON response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
        }),
      );

      const result = await systemClient.getSnapshot();

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it('should handle HTTP error status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          json: vi.fn().mockResolvedValueOnce({
            error: 'Service unavailable',
          }),
        }),
      );

      const result = await systemClient.getSnapshot();

      expect(result.error).toBe('Service unavailable');
      expect(result.data).toBeNull();
    });

    it('should use default error message if error property is missing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          json: vi.fn().mockResolvedValueOnce({}),
        }),
      );

      const result = await systemClient.getSnapshot();

      expect(result.error).toBe('Request failed');
      expect(result.data).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should make a GET request to /api/system/history', async () => {
      const mockResponse = { events: [] };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      const result = await systemClient.getHistory();

      expect(fetch).toHaveBeenCalledWith('/api/system/history', expect.any(Object));
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Connection failed')));

      const result = await systemClient.getHistory();

      expect(result.error).toBe('Connection failed');
      expect(result.data).toBeNull();
    });
  });

  describe('getLogs', () => {
    it('should make a GET request with default parameters', async () => {
      const mockResponse = { logs: [] };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      const result = await systemClient.getLogs();

      expect(fetch).toHaveBeenCalledWith(
        '/api/system/logs?service=all&lines=200',
        expect.any(Object),
      );
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse);
    });

    it('should accept custom service parameter', async () => {
      const mockResponse = { logs: [] };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      await systemClient.getLogs('memory-api');

      expect(fetch).toHaveBeenCalledWith(
        '/api/system/logs?service=memory-api&lines=200',
        expect.any(Object),
      );
    });

    it('should accept custom lines parameter', async () => {
      const mockResponse = { logs: [] };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      await systemClient.getLogs('crawler-api', 500);

      expect(fetch).toHaveBeenCalledWith(
        '/api/system/logs?service=crawler-api&lines=500',
        expect.any(Object),
      );
    });

    it('should encode service parameter', async () => {
      const mockResponse = { logs: [] };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      await systemClient.getLogs('service with spaces');

      const callUrl = (fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('service%20with%20spaces');
    });

    it('should handle errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Read timeout')));

      const result = await systemClient.getLogs();

      expect(result.error).toBe('Read timeout');
      expect(result.data).toBeNull();
    });
  });

  describe('runControl', () => {
    it('should make a POST request to /api/system/control', async () => {
      const payload = { target: 'memory-api', action: 'restart' };
      const mockResponse = { ok: true };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      const result = await systemClient.runControl(payload);

      expect(fetch).toHaveBeenCalledWith(
        '/api/system/control',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse);
    });

    it('should serialize payload to JSON', async () => {
      const payload = { target: 'crawler-api', action: 'stop' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({ ok: true }),
        }),
      );

      await systemClient.runControl(payload);

      const callArgs = (fetch as any).mock.calls[0][1];
      expect(callArgs.body).toBe(JSON.stringify(payload));
    });

    it('should handle errors', async () => {
      const payload = { target: 'memory-api', action: 'restart' };
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Connection refused')));

      const result = await systemClient.runControl(payload);

      expect(result.error).toBe('Connection refused');
      expect(result.data).toBeNull();
    });

    it('should handle API error responses', async () => {
      const payload = { target: 'invalid', action: 'restart' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          json: vi.fn().mockResolvedValueOnce({
            error: 'Invalid target',
          }),
        }),
      );

      const result = await systemClient.runControl(payload);

      expect(result.error).toBe('Invalid target');
      expect(result.data).toBeNull();
    });
  });

  describe('runMaintenance', () => {
    it('should make a POST request to /api/system/maintenance', async () => {
      const payload = { action: 'cleanup' };
      const mockResponse = { ok: true };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      const result = await systemClient.runMaintenance(payload);

      expect(fetch).toHaveBeenCalledWith(
        '/api/system/maintenance',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle different maintenance actions', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({ ok: true }),
        }),
      );

      await systemClient.runMaintenance({ action: 'cleanup' });
      await systemClient.runMaintenance({ action: 'optimize' });
      await systemClient.runMaintenance({ action: 'backup' });

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle errors', async () => {
      const payload = { action: 'unknown' };
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Server error')));

      const result = await systemClient.runMaintenance(payload);

      expect(result.error).toBe('Server error');
      expect(result.data).toBeNull();
    });
  });

  describe('sendNotification', () => {
    it('should make a POST request to /api/system/notifications', async () => {
      const payload = { to: ['user@example.com'], subject: 'Test', text: 'Hello' };
      const mockResponse = { ok: true };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        }),
      );

      const result = await systemClient.sendNotification(payload);

      expect(fetch).toHaveBeenCalledWith(
        '/api/system/notifications',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle optional to field', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({ ok: true }),
        }),
      );

      const result = await systemClient.sendNotification({
        subject: 'Alert',
        text: 'System alert',
      });

      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const payload = { to: ['user@example.com'], subject: 'Test', text: 'Hello' };
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('SMTP error')));

      const result = await systemClient.sendNotification(payload);

      expect(result.error).toBe('SMTP error');
      expect(result.data).toBeNull();
    });
  });

  describe('subscribeLogs', () => {
    it('should create an EventSource with correct URL', () => {
      let capturedUrl: string = '';
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        constructor(url: string) {
          this.url = url;
          capturedUrl = url;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      const handlers = { onMessage: vi.fn(), onError: vi.fn() };
      systemClient.subscribeLogs('memory-api', handlers);

      expect(capturedUrl).toBe('/api/system/logs/stream?service=memory-api');
    });

    it('should attach onMessage handler', () => {
      let capturedSource: any = null;
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        constructor(url: string) {
          this.url = url;
          capturedSource = this;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      const onMessage = vi.fn();
      const handlers = { onMessage };
      systemClient.subscribeLogs('crawler-api', handlers);

      expect(capturedSource.onmessage).toBe(onMessage);
    });

    it('should attach onError handler', () => {
      let capturedSource: any = null;
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        constructor(url: string) {
          this.url = url;
          capturedSource = this;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      const onError = vi.fn();
      const handlers = { onError };
      systemClient.subscribeLogs('weaviate', handlers);

      expect(capturedSource.onerror).toBe(onError);
    });

    it('should handle both handlers', () => {
      let capturedSource: any = null;
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        constructor(url: string) {
          this.url = url;
          capturedSource = this;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      const onMessage = vi.fn();
      const onError = vi.fn();
      const handlers = { onMessage, onError };
      systemClient.subscribeLogs('all', handlers);

      expect(capturedSource.onmessage).toBe(onMessage);
      expect(capturedSource.onerror).toBe(onError);
    });

    it('should encode service parameter in URL', () => {
      let capturedUrl: string = '';
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        constructor(url: string) {
          this.url = url;
          capturedUrl = url;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      systemClient.subscribeLogs('service with spaces', {});

      expect(capturedUrl).toContain('service%20with%20spaces');
    });

    it('should return EventSource instance', () => {
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        close = vi.fn();
        constructor(url: string) {
          this.url = url;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      const result = systemClient.subscribeLogs('test', {});

      expect(result).toBeInstanceOf(EventSourceMock);
    });

    it('should handle undefined handlers gracefully', () => {
      class EventSourceMock {
        url: string;
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        constructor(url: string) {
          this.url = url;
        }
      }
      vi.stubGlobal('EventSource', EventSourceMock as any);

      expect(() => {
        systemClient.subscribeLogs('test', {});
      }).not.toThrow();
    });
  });

  describe('request helpers', () => {
    it('should set Content-Type header', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({}),
        }),
      );

      await systemClient.getSnapshot();

      const headers = (fetch as any).mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should merge custom headers', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({}),
        }),
      );

      await systemClient.runControl({ target: 'test', action: 'test' });

      const headers = (fetch as any).mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
