import { describe, it, expect, beforeEach } from 'vitest'
import { useCrawlStore } from '@/stores/crawlStore'
import type { CrawlJob } from '@/stores/crawlStore'

const makeJob = (overrides: Partial<CrawlJob> = {}): CrawlJob => ({
  crawl_id: 'job-1',
  url: 'https://example.com',
  status: 'pending',
  created_at: '2026-01-01T00:00:00Z',
  completed_at: null,
  markdown: null,
  error_message: null,
  metadata: null,
  ...overrides,
})

describe('crawlStore', () => {
  beforeEach(() => {
    useCrawlStore.setState({ jobs: {}, activeCrawlIds: [] })
  })

  describe('setJob', () => {
    it('adds a new job to the jobs record', () => {
      const job = makeJob({ crawl_id: 'job-1', status: 'pending' })
      useCrawlStore.getState().setJob(job)

      const state = useCrawlStore.getState()
      expect(state.jobs['job-1']).toBeDefined()
      expect(state.jobs['job-1'].url).toBe('https://example.com')
    })

    it('tracks pending job in activeCrawlIds', () => {
      const job = makeJob({ crawl_id: 'job-1', status: 'pending' })
      useCrawlStore.getState().setJob(job)

      expect(useCrawlStore.getState().activeCrawlIds).toContain('job-1')
    })

    it('tracks running job in activeCrawlIds', () => {
      const job = makeJob({ crawl_id: 'job-2', status: 'running' })
      useCrawlStore.getState().setJob(job)

      expect(useCrawlStore.getState().activeCrawlIds).toContain('job-2')
    })

    it('does not add completed job to activeCrawlIds', () => {
      const job = makeJob({ crawl_id: 'job-3', status: 'completed' })
      useCrawlStore.getState().setJob(job)

      expect(useCrawlStore.getState().activeCrawlIds).not.toContain('job-3')
    })

    it('does not add failed job to activeCrawlIds', () => {
      const job = makeJob({ crawl_id: 'job-4', status: 'failed' })
      useCrawlStore.getState().setJob(job)

      expect(useCrawlStore.getState().activeCrawlIds).not.toContain('job-4')
    })

    it('overwrites an existing job with the same crawl_id', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', url: 'https://old.com' }))
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', url: 'https://new.com' }))

      expect(useCrawlStore.getState().jobs['job-1'].url).toBe('https://new.com')
    })
  })

  describe('updateJobStatus', () => {
    it('changes the job status in the jobs record', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', status: 'pending' }))
      useCrawlStore.getState().updateJobStatus('job-1', 'running')

      expect(useCrawlStore.getState().jobs['job-1'].status).toBe('running')
    })

    it('adds job to activeCrawlIds when status becomes running', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', status: 'completed' }))
      expect(useCrawlStore.getState().activeCrawlIds).not.toContain('job-1')

      useCrawlStore.getState().updateJobStatus('job-1', 'running')
      expect(useCrawlStore.getState().activeCrawlIds).toContain('job-1')
    })

    it('removes job from activeCrawlIds when status becomes completed', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', status: 'running' }))
      expect(useCrawlStore.getState().activeCrawlIds).toContain('job-1')

      useCrawlStore.getState().updateJobStatus('job-1', 'completed')
      expect(useCrawlStore.getState().activeCrawlIds).not.toContain('job-1')
    })

    it('removes job from activeCrawlIds when status becomes failed', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', status: 'pending' }))
      useCrawlStore.getState().updateJobStatus('job-1', 'failed')

      expect(useCrawlStore.getState().activeCrawlIds).not.toContain('job-1')
    })

    it('does nothing when job id does not exist', () => {
      useCrawlStore.getState().updateJobStatus('nonexistent', 'running')
      expect(useCrawlStore.getState().jobs).toEqual({})
    })
  })

  describe('removeJob', () => {
    it('removes the job from the jobs record', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1' }))
      useCrawlStore.getState().removeJob('job-1')

      expect(useCrawlStore.getState().jobs['job-1']).toBeUndefined()
    })

    it('removes the job from activeCrawlIds', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', status: 'running' }))
      expect(useCrawlStore.getState().activeCrawlIds).toContain('job-1')

      useCrawlStore.getState().removeJob('job-1')
      expect(useCrawlStore.getState().activeCrawlIds).not.toContain('job-1')
    })

    it('leaves other jobs intact', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1' }))
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-2' }))
      useCrawlStore.getState().removeJob('job-1')

      expect(useCrawlStore.getState().jobs['job-2']).toBeDefined()
    })
  })

  describe('clearJobs', () => {
    it('resets jobs to an empty record', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1' }))
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-2' }))
      useCrawlStore.getState().clearJobs()

      expect(useCrawlStore.getState().jobs).toEqual({})
    })

    it('resets activeCrawlIds to an empty array', () => {
      useCrawlStore.getState().setJob(makeJob({ crawl_id: 'job-1', status: 'running' }))
      useCrawlStore.getState().clearJobs()

      expect(useCrawlStore.getState().activeCrawlIds).toEqual([])
    })
  })
})
