import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import { useNotificationStore } from '../../stores/notificationStore';

const { crawlCompleteRef, crawlErrorRef, crawlUpdateRef, scanCompleteRef } = vi.hoisted(() => ({
  crawlCompleteRef: { current: null as unknown },
  crawlErrorRef: { current: null as unknown },
  crawlUpdateRef: { current: null as unknown },
  scanCompleteRef: { current: null as unknown },
}));

vi.mock('../useWebSocketSubscription', () => ({
  useWebSocketSubscription: (topic: string) => {
    if (topic === 'crawl:complete') return { data: crawlCompleteRef.current, isConnected: true, error: null };
    if (topic === 'crawl:error') return { data: crawlErrorRef.current, isConnected: true, error: null };
    if (topic === 'crawl:update') return { data: crawlUpdateRef.current, isConnected: true, error: null };
    if (topic === 'scan:complete') return { data: scanCompleteRef.current, isConnected: true, error: null };
    return { data: null, isConnected: true, error: null };
  },
}));

function resetStore() {
  useNotificationStore.getState().clearAll();
}

describe('useNotifications', () => {
  beforeEach(() => {
    resetStore();
    crawlCompleteRef.current = null;
    crawlErrorRef.current = null;
    crawlUpdateRef.current = null;
    scanCompleteRef.current = null;
  });

  it('returns empty notifications and zero unread count initially', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markAsRead marks the specified notification as read', () => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      title: 'Test',
      message: 'hello',
    });

    const { result } = renderHook(() => useNotifications());
    const notifId = result.current.notifications[0].id;
    expect(result.current.notifications[0].read).toBe(false);

    act(() => {
      result.current.markAsRead(notifId);
    });

    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markAllAsRead sets all notifications to read', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'A', message: '' });
    useNotificationStore.getState().addNotification({ type: 'warning', title: 'B', message: '' });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('clearAll empties the notification list', () => {
    useNotificationStore.getState().addNotification({ type: 'error', title: 'Err', message: '' });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('maps error store type to "error" notification type', () => {
    useNotificationStore.getState().addNotification({ type: 'error', title: 'Err', message: '' });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0].type).toBe('error');
  });

  it('error and persistent notifications have urgent=true', () => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'Err',
      message: '',
      persistent: true,
    });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0].urgent).toBe(true);
  });

  it('notification timestamp is a Date object', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'T', message: '' });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0].timestamp).toBeInstanceOf(Date);
  });

  it('adds a success notification when crawl:complete event fires', async () => {
    crawlCompleteRef.current = { url: 'https://example.com' };

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications.length).toBeGreaterThanOrEqual(1);
    const titles = result.current.notifications.map((n) => n.title);
    expect(titles).toContain('Crawl complete');
  });

  it('adds an error notification when crawl:error event fires', async () => {
    crawlErrorRef.current = { error: 'Connection refused' };

    const { result } = renderHook(() => useNotifications());

    const errorNotifs = result.current.notifications.filter((n) => n.type === 'error');
    expect(errorNotifs.length).toBeGreaterThanOrEqual(1);
  });
});
