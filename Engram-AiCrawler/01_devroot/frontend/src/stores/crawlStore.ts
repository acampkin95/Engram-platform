import { create } from 'zustand';

export interface CrawlJob {
  crawl_id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  markdown: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

interface CrawlState {
  jobs: Record<string, CrawlJob>;
  activeCrawlIds: string[];
  setJob: (job: CrawlJob) => void;
  updateJobStatus: (crawlId: string, status: CrawlJob['status']) => void;
  removeJob: (crawlId: string) => void;
  clearJobs: () => void;
}

export const useCrawlStore = create<CrawlState>((set) => ({
  jobs: {},
  activeCrawlIds: [],
  setJob: (job) =>
    set((state) => ({
      jobs: { ...state.jobs, [job.crawl_id]: job },
      activeCrawlIds:
        job.status === 'running' || job.status === 'pending'
          ? [...new Set([...state.activeCrawlIds, job.crawl_id])]
          : state.activeCrawlIds.filter((id) => id !== job.crawl_id),
    })),
  updateJobStatus: (crawlId, status) =>
    set((state) => {
      const job = state.jobs[crawlId];
      if (!job) return state;
      return {
        jobs: { ...state.jobs, [crawlId]: { ...job, status } },
        activeCrawlIds:
          status === 'running' || status === 'pending'
            ? [...new Set([...state.activeCrawlIds, crawlId])]
            : state.activeCrawlIds.filter((id) => id !== crawlId),
      };
    }),
  removeJob: (crawlId) =>
    set((state) => {
      const { [crawlId]: _, ...rest } = state.jobs;
      return {
        jobs: rest,
        activeCrawlIds: state.activeCrawlIds.filter((id) => id !== crawlId),
      };
    }),
  clearJobs: () => set({ jobs: {}, activeCrawlIds: [] }),
}));
