import { useCallback, useEffect, useRef } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useWebSocketSubscription } from './useWebSocketSubscription';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NotificationEventType =
  | 'crawl_complete'
  | 'crawl_error'
  | 'scan_complete'
  | 'system'
  | 'error';

export interface Notification {
  id: string;
  type: NotificationEventType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  urgent: boolean;
}

// ---------------------------------------------------------------------------
// Internal shapes of WebSocket payloads
// ---------------------------------------------------------------------------

interface CrawlEventPayload {
  crawl_id?: string;
  url?: string;
  status?: string;
  error?: string;
  message?: string;
}

interface ScanEventPayload {
  scan_id?: string;
  target?: string;
  result?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(): {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
} {
  const store = useNotificationStore();

  // ------------------------------------------------------------------
  // WebSocket subscriptions for crawl:* and scan:* events
  // ------------------------------------------------------------------
  const { data: crawlEvent } = useWebSocketSubscription<CrawlEventPayload>('crawl:update');
  const { data: crawlComplete } = useWebSocketSubscription<CrawlEventPayload>('crawl:complete');
  const { data: crawlError } = useWebSocketSubscription<CrawlEventPayload>('crawl:error');
  const { data: scanComplete } = useWebSocketSubscription<ScanEventPayload>('scan:complete');

  // We use refs to avoid re-running effects when store actions change
  const addNotification = useRef(store.addNotification);
  addNotification.current = store.addNotification;

  // ------------------------------------------------------------------
  // React to crawl:update
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!crawlEvent) return;

    if (crawlEvent.status === 'completed') {
      addNotification.current({
        type: 'success',
        title: 'Crawl complete',
        message: crawlEvent.url
          ? `Finished crawling ${crawlEvent.url}`
          : (crawlEvent.message ?? 'A crawl completed successfully'),
        persistent: false,
      });
    } else if (crawlEvent.status === 'failed') {
      addNotification.current({
        type: 'error',
        title: 'Crawl failed',
        message: crawlEvent.error ?? crawlEvent.message ?? 'An error occurred during crawl',
        persistent: true,
      });
    }
  }, [crawlEvent]);

  // ------------------------------------------------------------------
  // React to crawl:complete
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!crawlComplete) return;

    addNotification.current({
      type: 'success',
      title: 'Crawl complete',
      message: crawlComplete.url
        ? `Finished crawling ${crawlComplete.url}`
        : (crawlComplete.message ?? 'A crawl completed successfully'),
      persistent: false,
    });
  }, [crawlComplete]);

  // ------------------------------------------------------------------
  // React to crawl:error
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!crawlError) return;

    addNotification.current({
      type: 'error',
      title: 'Crawl error',
      message: crawlError.error ?? crawlError.message ?? 'An error occurred during crawl',
      persistent: true,
    });
  }, [crawlError]);

  // ------------------------------------------------------------------
  // React to scan:complete
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!scanComplete) return;

    addNotification.current({
      type: 'success',
      title: 'Scan complete',
      message: scanComplete.target
        ? `Scan of ${scanComplete.target} finished`
        : (scanComplete.message ?? 'A scan completed'),
      persistent: false,
    });
  }, [scanComplete]);

  // ------------------------------------------------------------------
  // Adapt store notifications → public Notification shape
  // ------------------------------------------------------------------
  const notifications: Notification[] = store.notifications.map((n) => ({
    id: n.id,
    type: mapStoreType(n.type),
    title: n.title,
    message: n.message ?? '',
    timestamp: new Date(n.timestamp),
    read: n.read,
    urgent: n.persistent === true || n.type === 'error',
  }));

  const markAsRead = useCallback(
    (id: string) => store.markAsRead(id),
    [store]
  );

  const markAllAsRead = useCallback(() => store.markAllAsRead(), [store]);

  const clearAll = useCallback(() => store.clearAll(), [store]);

  return {
    notifications,
    unreadCount: store.unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapStoreType(
  type: 'info' | 'success' | 'warning' | 'error'
): NotificationEventType {
  switch (type) {
    case 'success':
      return 'crawl_complete';
    case 'error':
      return 'error';
    case 'warning':
      return 'system';
    case 'info':
    default:
      return 'system';
  }
}
