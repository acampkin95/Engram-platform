import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { createLogger } from '../lib/logger';
import { InvestigationSchema } from '../lib/schemas';
import { z } from 'zod';

const log = createLogger('investigationStore');

export interface Investigation {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  tags: string[];
  associated_crawl_ids: string[];
}

export interface CreateInvestigationRequest {
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdateInvestigationRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'archived';
  tags?: string[];
}

interface InvestigationState {
  activeInvestigation: Investigation | null;
  investigations: Investigation[];
  loading: boolean;
  error: string | null;

  setActiveInvestigation: (inv: Investigation | null) => void;
  fetchInvestigations: () => Promise<void>;
  fetchInvestigation: (id: string) => Promise<Investigation>;
  createInvestigation: (data: CreateInvestigationRequest) => Promise<Investigation>;
  updateInvestigation: (id: string, data: UpdateInvestigationRequest) => Promise<Investigation>;
  archiveInvestigation: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useInvestigationStore = create<InvestigationState>()(
  persist(
    (set, get) => ({
      activeInvestigation: null,
      investigations: [],
      loading: false,
      error: null,

      setActiveInvestigation: (inv) => set({ activeInvestigation: inv }),

      fetchInvestigations: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get<Investigation[]>('/investigations');
          const parseResult = z.array(InvestigationSchema).safeParse(response.data);
          const investigations: Investigation[] = parseResult.success
            ? parseResult.data
            : (import.meta.env.DEV
                ? (log.validationWarning(parseResult.error.issues), response.data)
                : response.data);
          set({ investigations, loading: false });

          const { activeInvestigation } = get();
          if (activeInvestigation) {
            const refreshed = investigations.find((i) => i.id === activeInvestigation.id);
            const isGone = !refreshed || refreshed.status === 'archived';
            set({ activeInvestigation: isGone ? null : refreshed });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch investigations';
          set({ error: message, loading: false });
        }
      },

      fetchInvestigation: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get<Investigation>(`/investigations/${id}`);
          const parseResult = InvestigationSchema.safeParse(response.data);
          const investigation: Investigation = parseResult.success
            ? parseResult.data
            : (import.meta.env.DEV
                ? (log.validationWarning(parseResult.error.issues), response.data as Investigation)
                : response.data as Investigation);
          set((state) => ({
            investigations: state.investigations.map((i) =>
              i.id === id ? investigation : i
            ),
            loading: false,
          }));
          return investigation;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch investigation';
          set({ error: message, loading: false });
          throw err;
        }
      },

      createInvestigation: async (data: CreateInvestigationRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post<Investigation>('/investigations', data);
          const parseResult = InvestigationSchema.safeParse(response.data);
          const investigation: Investigation = parseResult.success
            ? parseResult.data
            : (import.meta.env.DEV
                ? (log.validationWarning(parseResult.error.issues), response.data as Investigation)
                : response.data as Investigation);
          set((state) => ({
            investigations: [investigation, ...state.investigations],
            loading: false,
          }));
          return investigation;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create investigation';
          set({ error: message, loading: false });
          throw err;
        }
      },

      updateInvestigation: async (id: string, data: UpdateInvestigationRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await api.put<Investigation>(`/investigations/${id}`, data);
          const parseResult = InvestigationSchema.safeParse(response.data);
          const updated: Investigation = parseResult.success
            ? parseResult.data
            : (import.meta.env.DEV
                ? (log.validationWarning(parseResult.error.issues), response.data as Investigation)
                : response.data as Investigation);
          set((state) => ({
            investigations: state.investigations.map((i) => (i.id === id ? updated : i)),
            activeInvestigation:
              state.activeInvestigation?.id === id ? updated : state.activeInvestigation,
            loading: false,
          }));
          return updated;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update investigation';
          set({ error: message, loading: false });
          throw err;
        }
      },

      archiveInvestigation: async (id: string) => {
        set({ loading: true, error: null });
        try {
          await api.delete(`/investigations/${id}`);
          set((state) => ({
            investigations: state.investigations.map((i) =>
              i.id === id ? { ...i, status: 'archived' as const } : i
            ),
            activeInvestigation:
              state.activeInvestigation?.id === id ? null : state.activeInvestigation,
            loading: false,
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to archive investigation';
          set({ error: message, loading: false });
          throw err;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'investigation-store',
      partialize: (state) => ({
        activeInvestigation: state.activeInvestigation,
      }),
    }
  )
);
