import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationStore } from '@/stores/notificationStore'
import type { NotificationType } from '@/stores/notificationStore'

const makePayload = (overrides: { type?: NotificationType; title?: string; message?: string } = {}) => ({
  type: 'info' as NotificationType,
  title: 'Test notification',
  ...overrides,
})

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  })

  describe('addNotification', () => {
    it('adds a notification to the list', () => {
      useNotificationStore.getState().addNotification(makePayload({ title: 'Hello' }))
      expect(useNotificationStore.getState().notifications).toHaveLength(1)
      expect(useNotificationStore.getState().notifications[0].title).toBe('Hello')
    })

    it('increments unreadCount when adding a notification', () => {
      useNotificationStore.getState().addNotification(makePayload())
      expect(useNotificationStore.getState().unreadCount).toBe(1)

      useNotificationStore.getState().addNotification(makePayload())
      expect(useNotificationStore.getState().unreadCount).toBe(2)
    })

    it('auto-generates unique id for each notification', () => {
      useNotificationStore.getState().addNotification(makePayload())
      useNotificationStore.getState().addNotification(makePayload())

      const [first, second] = useNotificationStore.getState().notifications
      expect(first.id).toBeTruthy()
      expect(second.id).toBeTruthy()
      expect(first.id).not.toBe(second.id)
    })

    it('marks new notifications as unread', () => {
      useNotificationStore.getState().addNotification(makePayload())
      expect(useNotificationStore.getState().notifications[0].read).toBe(false)
    })

    it('prepends new notifications so latest appears first', () => {
      useNotificationStore.getState().addNotification(makePayload({ title: 'First' }))
      useNotificationStore.getState().addNotification(makePayload({ title: 'Second' }))

      expect(useNotificationStore.getState().notifications[0].title).toBe('Second')
      expect(useNotificationStore.getState().notifications[1].title).toBe('First')
    })
  })

  describe('markAsRead', () => {
    it('marks a single notification as read', () => {
      useNotificationStore.getState().addNotification(makePayload({ title: 'N1' }))
      const { id } = useNotificationStore.getState().notifications[0]

      useNotificationStore.getState().markAsRead(id)
      expect(useNotificationStore.getState().notifications.find((n) => n.id === id)?.read).toBe(true)
    })

    it('decrements unreadCount when marking as read', () => {
      useNotificationStore.getState().addNotification(makePayload())
      useNotificationStore.getState().addNotification(makePayload())
      const { id } = useNotificationStore.getState().notifications[0]

      useNotificationStore.getState().markAsRead(id)
      expect(useNotificationStore.getState().unreadCount).toBe(1)
    })

    it('does not change unreadCount when marking an already-read notification', () => {
      useNotificationStore.getState().addNotification(makePayload())
      const { id } = useNotificationStore.getState().notifications[0]
      useNotificationStore.getState().markAsRead(id)

      useNotificationStore.getState().markAsRead(id)
      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })

    it('leaves other notifications unread', () => {
      useNotificationStore.getState().addNotification(makePayload({ title: 'N1' }))
      useNotificationStore.getState().addNotification(makePayload({ title: 'N2' }))
      const [n2, n1] = useNotificationStore.getState().notifications

      useNotificationStore.getState().markAsRead(n2.id)
      expect(useNotificationStore.getState().notifications.find((n) => n.id === n1.id)?.read).toBe(false)
    })
  })

  describe('markAllAsRead', () => {
    it('marks every notification as read', () => {
      useNotificationStore.getState().addNotification(makePayload({ title: 'N1' }))
      useNotificationStore.getState().addNotification(makePayload({ title: 'N2' }))
      useNotificationStore.getState().addNotification(makePayload({ title: 'N3' }))

      useNotificationStore.getState().markAllAsRead()
      const allRead = useNotificationStore.getState().notifications.every((n) => n.read)
      expect(allRead).toBe(true)
    })

    it('sets unreadCount to 0', () => {
      useNotificationStore.getState().addNotification(makePayload())
      useNotificationStore.getState().addNotification(makePayload())

      useNotificationStore.getState().markAllAsRead()
      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })
  })

  describe('removeNotification', () => {
    it('removes the notification from the list', () => {
      useNotificationStore.getState().addNotification(makePayload({ title: 'Remove me' }))
      const { id } = useNotificationStore.getState().notifications[0]

      useNotificationStore.getState().removeNotification(id)
      expect(useNotificationStore.getState().notifications.find((n) => n.id === id)).toBeUndefined()
    })

    it('decrements unreadCount when removing an unread notification', () => {
      useNotificationStore.getState().addNotification(makePayload())
      const { id } = useNotificationStore.getState().notifications[0]

      useNotificationStore.getState().removeNotification(id)
      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })

    it('does not affect unreadCount when removing a read notification', () => {
      useNotificationStore.getState().addNotification(makePayload())
      const { id } = useNotificationStore.getState().notifications[0]
      useNotificationStore.getState().markAsRead(id)

      useNotificationStore.getState().removeNotification(id)
      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })
  })

  describe('clearAll', () => {
    it('empties the notifications array', () => {
      useNotificationStore.getState().addNotification(makePayload())
      useNotificationStore.getState().addNotification(makePayload())
      useNotificationStore.getState().clearAll()

      expect(useNotificationStore.getState().notifications).toHaveLength(0)
    })

    it('resets unreadCount to 0', () => {
      useNotificationStore.getState().addNotification(makePayload())
      useNotificationStore.getState().clearAll()

      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })
  })
})
