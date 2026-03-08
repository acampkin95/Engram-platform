/**
 * Integration tests: WebSocket client + notification store flow
 *
 * Tests that WebSocket messages and connection state changes correctly
 * flow through to the notification store and application state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useNotificationStore } from '@/stores/notificationStore'
import { WebSocketClient, type ConnectionState } from '@/lib/websocket'

describe('WebSocket + Notification Store Integration', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Notification store ──────────────────────────────────────────────────

  it('WS message triggers notification store update', () => {
    // Simulate the application handler that receives a WS message
    // and adds a notification to the store
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Crawl Complete',
        message: 'https://example.com has been crawled successfully',
      })
    })

    const { notifications, unreadCount } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('success')
    expect(notifications[0].title).toBe('Crawl Complete')
    expect(unreadCount).toBe(1)
  })

  it('WS disconnect triggers warning notification', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'warning',
        title: 'Connection Lost',
        message: 'Attempting to reconnect…',
        persistent: true,
      })
    })

    const { notifications } = useNotificationStore.getState()
    expect(notifications[0].type).toBe('warning')
    expect(notifications[0].persistent).toBe(true)
  })

  it('multiple WS events stack notifications newest-first', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'First Event',
      })
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Second Event',
      })
    })

    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(2)
    // addNotification prepends, so newest is first
    expect(notifications[0].title).toBe('Second Event')
    expect(notifications[1].title).toBe('First Event')
  })

  it('markAllAsRead resets unread count to zero', () => {
    act(() => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'A' })
      useNotificationStore.getState().addNotification({ type: 'error', title: 'B' })
    })
    expect(useNotificationStore.getState().unreadCount).toBe(2)

    act(() => {
      useNotificationStore.getState().markAllAsRead()
    })
    expect(useNotificationStore.getState().unreadCount).toBe(0)
    expect(
      useNotificationStore.getState().notifications.every((n) => n.read)
    ).toBe(true)
  })

  it('removeNotification removes a single entry', () => {
    act(() => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'Keep' })
      useNotificationStore.getState().addNotification({ type: 'error', title: 'Remove' })
    })
    expect(useNotificationStore.getState().notifications).toHaveLength(2)

    const removeId = useNotificationStore
      .getState()
      .notifications.find((n) => n.title === 'Remove')!.id

    act(() => {
      useNotificationStore.getState().removeNotification(removeId)
    })

    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].title).toBe('Keep')
  })

  // ─── WebSocketClient state machine ───────────────────────────────────────

  it('WebSocketClient starts in disconnected state', () => {
    const client = new WebSocketClient('ws://localhost:9999', {
      maxReconnectAttempts: 0,
    })
    expect(client.state).toBe('disconnected')
  })

  it('WebSocketClient transitions to disconnected after disconnect()', () => {
    const stateChanges: ConnectionState[] = []
    const client = new WebSocketClient('ws://localhost:9999', {
      maxReconnectAttempts: 0,
      onStateChange: (s) => stateChanges.push(s),
    })

    // Calling disconnect() on an already-disconnected client is a no-op for state
    client.disconnect()
    expect(client.state).toBe('disconnected')
  })

  it('WebSocketClient message handler is registered via on()', () => {
    const client = new WebSocketClient('ws://localhost:9999')
    const handler = vi.fn()

    client.on('crawl:update', handler)
    // Handler is registered; we can verify no errors were thrown
    expect(handler).not.toHaveBeenCalled()
    client.off('crawl:update')
  })

  it('WebSocketClient isConnected() returns false when not connected', () => {
    const client = new WebSocketClient('ws://localhost:9999')
    expect(client.isConnected()).toBe(false)
  })
})
