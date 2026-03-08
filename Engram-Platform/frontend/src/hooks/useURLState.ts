'use client';

import { useQueryStates } from 'nuqs';

/**
 * Shared URL state for filter and pagination across all dashboards
 */
export interface DashboardURLState {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  filter?: string;
}

/**
 * Hook to manage URL query state with defaults
 */
export function useDashboardURLState() {
  return useQueryStates(
    {
      page: { parse: (s) => Number(s) || 1 },
      limit: { parse: (s) => Number(s) || 20 },
      search: { parse: (s) => s },
      sort: { parse: (s) => s },
      filter: { parse: (s) => s },
    },
    {
      history: 'push',
    }
  );
}

/**
 * Helper to create pagination state from URL
 */
export function usePaginationState() {
  const [params, setParams] = useQueryStates({
    page: { parse: (s) => Number(s) || 1 },
    limit: { parse: (s) => Number(s) || 20 },
  });

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  const setPage = (page: number) => setParams({ page });
  const setLimit = (limit: number) => setParams({ limit });

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    setPage,
    setLimit,
  };
}

/**
 * Helper for search and filter state
 */
export function useSearchFilterState() {
  const [params, setParams] = useQueryStates({
    search: { parse: (s) => s },
    filter: { parse: (s) => s },
    sort: { parse: (s) => s },
  });

  const setSearch = (search: string) => setParams({ search: search || undefined });
  const setFilter = (filter: string) => setParams({ filter: filter || undefined });
  const setSort = (sort: string) => setParams({ sort });

  return {
    search: params.search ?? '',
    filter: params.filter ?? '',
    sort: params.sort ?? '',
    setSearch,
    setFilter,
    setSort,
  };
}
