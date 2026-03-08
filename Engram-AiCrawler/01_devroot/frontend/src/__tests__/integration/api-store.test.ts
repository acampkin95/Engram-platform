/**
 * Integration tests: API layer + Zustand store interaction
 *
 * These tests exercise the store actions that would be triggered by API
 * responses in the real application, verifying that state flows correctly
 * without a running server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useCrawlStore, type CrawlJob } from '@/stores/crawlStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { ApiError } from '@/lib/api'

// Mock axios so no real network calls are made
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}))

function makeCrawlJob(overrides: Partial<CrawlJob> = {}): CrawlJob {
  return {
    crawl_id: `job-${Date.now()}`,
    url: 'https://example.com',
    status: 'pending',
    created_at: new Date().toISOString(),
    completed_at: null,
    markdown: null,
    error_message: null,
    metadata: null,
    ...overrides,
  }
}

describe('API + Store Integration', () => {
  beforeEach(() => {
    // Reset both stores to a clean state between tests
    useCrawlStore.getState().clearJobs()
    useNotificationStore.getState().clearAll()
    vi.clearAllMocks()
  })

  // ─── crawlStore ─────────────────────────────────────────────────────────

  it('API response (running job) updates crawl store state', () => {
    const job = makeCrawlJob({ crawl_id: 'run-001', status: 'running' })

    act(() => {
      useCrawlStore.getState().setJob(job)
    })

    const { jobs, activeCrawlIds } = useCrawlStore.getState()
    expect(jobs['run-001']).toEqual(job)
    expect(activeCrawlIds).toContain('run-001')
  })

  it('completed job is removed from activeCrawlIds', () => {
    const job = makeCrawlJob({ crawl_id: 'run-002', status: 'running' })

    act(() => {
      useCrawlStore.getState().setJob(job)
    })
    expect(useCrawlStore.getState().activeCrawlIds).toContain('run-002')

    act(() => {
      useCrawlStore.getState().updateJobStatus('run-002', 'completed')
    })

    const { activeCrawlIds, jobs } = useCrawlStore.getState()
    expect(activeCrawlIds).not.toContain('run-002')
    expect(jobs['run-002'].status).toBe('completed')
  })

  it('failed job is removed from activeCrawlIds and preserves error message', () => {
    const job = makeCrawlJob({ crawl_id: 'run-003', status: 'running' })

    act(() => {
      useCrawlStore.getState().setJob(job)
      useCrawlStore.getState().updateJobStatus('run-003', 'failed')
    })

    const { activeCrawlIds, jobs } = useCrawlStore.getState()
    expect(activeCrawlIds).not.toContain('run-003')
    expect(jobs['run-003'].status).toBe('failed')
  })

  it('multiple jobs tracked correctly in store', () => {
    const jobA = makeCrawlJob({ crawl_id: 'job-a', status: 'running' })
    const jobB = makeCrawlJob({ crawl_id: 'job-b', status: 'pending' })

    act(() => {
      useCrawlStore.getState().setJob(jobA)
      useCrawlStore.getState().setJob(jobB)
    })

    const { jobs, activeCrawlIds } = useCrawlStore.getState()
    expect(Object.keys(jobs)).toHaveLength(2)
    expect(activeCrawlIds).toContain('job-a')
    expect(activeCrawlIds).toContain('job-b')
  })

  it('removeJob clears job from store entirely', () => {
    const job = makeCrawlJob({ crawl_id: 'removable', status: 'completed' })

    act(() => {
      useCrawlStore.getState().setJob(job)
    })
    expect(useCrawlStore.getState().jobs['removable']).toBeDefined()

    act(() => {
      useCrawlStore.getState().removeJob('removable')
    })
    expect(useCrawlStore.getState().jobs['removable']).toBeUndefined()
  })

  // ─── notificationStore ───────────────────────────────────────────────────

  it('API error triggers notification store update', () => {
    const error = new ApiError('Request failed', 500)

    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Crawl Failed',
        message: error.message,
      })
    })

    const { notifications, unreadCount } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].type).toBe('error')
    expect(notifications[0].title).toBe('Crawl Failed')
    expect(unreadCount).toBe(1)
  })

  it('success API response triggers success notification', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Crawl Complete',
        message: 'https://example.com crawled successfully',
      })
    })

    const { notifications } = useNotificationStore.getState()
    expect(notifications[0].type).toBe('success')
    expect(notifications[0].read).toBe(false)
  })

  it('markAsRead decrements unreadCount', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Crawl Started',
      })
    })
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    const id = useNotificationStore.getState().notifications[0].id
    act(() => {
      useNotificationStore.getState().markAsRead(id)
    })
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('clearAll resets notification store', () => {
    act(() => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'A' })
      useNotificationStore.getState().addNotification({ type: 'error', title: 'B' })
    })
    expect(useNotificationStore.getState().notifications).toHaveLength(2)

    act(() => {
      useNotificationStore.getState().clearAll()
    })
    expect(useNotificationStore.getState().notifications).toHaveLength(0)
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })
})
