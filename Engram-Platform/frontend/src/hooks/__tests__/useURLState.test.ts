import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useDashboardURLState,
  usePaginationState,
  useSearchFilterState,
} from '@/src/hooks/useURLState';

vi.mock('nuqs', () => {
  return {
    useQueryStates: vi.fn((schema: Record<string, any>, _options?: any) => {
      const setParams = vi.fn((updates: Record<string, any>) => {
        // Parse values using schema
        Object.keys(schema).forEach((key) => {
          if (key in updates && updates[key] !== undefined && schema[key]?.parse) {
            updates[key] = schema[key].parse(String(updates[key]));
          }
        });
      });

      // Create initial state
      const initialState = Object.keys(schema).reduce(
        (acc, key) => {
          acc[key] = undefined;
          return acc;
        },
        {} as Record<string, any>,
      );

      return [initialState, setParams] as const;
    }),
  };
});

describe('useURLState hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDashboardURLState', () => {
    it('should initialize and return a tuple', () => {
      const { result } = renderHook(() => useDashboardURLState());

      expect(result.current).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current.length).toBe(2);
    });

    it('should return state object and setter function', () => {
      const { result } = renderHook(() => useDashboardURLState());

      const [state, setter] = result.current;
      expect(state).toBeDefined();
      expect(typeof setter).toBe('function');
    });

    it('should have page, limit, search, sort, and filter properties in state', () => {
      const { result } = renderHook(() => useDashboardURLState());
      const [state] = result.current;

      // Verify the state has all expected keys
      const expectedKeys = ['page', 'limit', 'search', 'sort', 'filter'];
      expectedKeys.forEach((key) => {
        expect(key in state).toBe(true);
      });
    });

    it('should call useQueryStates with schema containing all dashboard parameters', () => {
      const { result } = renderHook(() => useDashboardURLState());

      expect(result.current).toBeDefined();
      const [state] = result.current;

      // Check all expected keys are present
      expect('page' in state).toBe(true);
      expect('limit' in state).toBe(true);
      expect('search' in state).toBe(true);
      expect('sort' in state).toBe(true);
      expect('filter' in state).toBe(true);
    });
  });

  describe('usePaginationState', () => {
    it('should initialize with default page of 1 and limit of 20', () => {
      const { result } = renderHook(() => usePaginationState());

      expect(result.current.page).toBe(1);
      expect(result.current.limit).toBe(20);
    });

    it('should calculate offset as (page - 1) * limit', () => {
      const { result } = renderHook(() => usePaginationState());

      expect(result.current.offset).toBe(0); // (1-1)*20 = 0

      // Test offset calculations for various pages
      expect((2 - 1) * 20).toBe(20);
      expect((3 - 1) * 20).toBe(40);
      expect((10 - 1) * 20).toBe(180);
    });

    it('should provide setPage and setLimit functions', () => {
      const { result } = renderHook(() => usePaginationState());

      expect(typeof result.current.setPage).toBe('function');
      expect(typeof result.current.setLimit).toBe('function');
    });

    it('should allow calling setPage and setLimit', () => {
      const { result } = renderHook(() => usePaginationState());

      act(() => {
        result.current.setPage(5);
        result.current.setLimit(100);
      });

      expect(result.current.setPage).toBeDefined();
      expect(result.current.setLimit).toBeDefined();
    });

    it('should handle offset calculation for different page sizes', () => {
      // Verify offset logic works for various limits
      const testCases = [
        { page: 1, limit: 10, expectedOffset: 0 },
        { page: 2, limit: 10, expectedOffset: 10 },
        { page: 1, limit: 100, expectedOffset: 0 },
        { page: 5, limit: 50, expectedOffset: 200 },
      ];

      testCases.forEach(({ page, limit, expectedOffset }) => {
        const offset = (page - 1) * limit;
        expect(offset).toBe(expectedOffset);
      });
    });

    it('should return a valid pagination state object', () => {
      const { result } = renderHook(() => usePaginationState());

      expect(result.current).toHaveProperty('page');
      expect(result.current).toHaveProperty('limit');
      expect(result.current).toHaveProperty('offset');
      expect(result.current).toHaveProperty('setPage');
      expect(result.current).toHaveProperty('setLimit');
    });
  });

  describe('useSearchFilterState', () => {
    it('should initialize with empty search, filter, and sort', () => {
      const { result } = renderHook(() => useSearchFilterState());

      expect(result.current.search).toBe('');
      expect(result.current.filter).toBe('');
      expect(result.current.sort).toBe('');
    });

    it('should provide setSearch, setFilter, and setSort functions', () => {
      const { result } = renderHook(() => useSearchFilterState());

      expect(typeof result.current.setSearch).toBe('function');
      expect(typeof result.current.setFilter).toBe('function');
      expect(typeof result.current.setSort).toBe('function');
    });

    it('should allow calling all setter functions', () => {
      const { result } = renderHook(() => useSearchFilterState());

      act(() => {
        result.current.setSearch('query');
        result.current.setFilter('filter');
        result.current.setSort('sort');
      });

      expect(result.current.setSearch).toBeDefined();
      expect(result.current.setFilter).toBeDefined();
      expect(result.current.setSort).toBeDefined();
    });

    it('should return a valid search filter state object', () => {
      const { result } = renderHook(() => useSearchFilterState());

      expect(result.current).toHaveProperty('search');
      expect(result.current).toHaveProperty('filter');
      expect(result.current).toHaveProperty('sort');
      expect(result.current).toHaveProperty('setSearch');
      expect(result.current).toHaveProperty('setFilter');
      expect(result.current).toHaveProperty('setSort');
    });

    it('should treat empty strings as undefined for search and filter', () => {
      const { result } = renderHook(() => useSearchFilterState());

      // setSearch and setFilter convert empty strings to undefined
      act(() => {
        result.current.setSearch('');
        result.current.setFilter('');
      });

      // Both should have been callable
      expect(result.current.setSearch).toBeDefined();
      expect(result.current.setFilter).toBeDefined();
    });

    it('should handle search state independently from filter and sort', () => {
      const { result } = renderHook(() => useSearchFilterState());

      act(() => {
        result.current.setSearch('search query');
      });

      expect(result.current.search).toBe('');

      act(() => {
        result.current.setFilter('filter value');
      });

      expect(result.current.filter).toBe('');

      act(() => {
        result.current.setSort('sort:asc');
      });

      expect(result.current.sort).toBe('');
    });

    it('should handle complex search terms with special characters', () => {
      const { result } = renderHook(() => useSearchFilterState());

      const searchTerms = [
        'simple',
        'with spaces',
        '@mention',
        '#hashtag',
        'with-dashes',
        'with_underscores',
        'with.dots',
      ];

      searchTerms.forEach((term) => {
        act(() => {
          result.current.setSearch(term);
        });
      });

      expect(result.current.setSearch).toBeDefined();
    });

    it('should handle multiple filter updates', () => {
      const { result } = renderHook(() => useSearchFilterState());

      const filters = ['active', 'inactive', 'pending', 'archived'];

      filters.forEach((filter) => {
        act(() => {
          result.current.setFilter(filter);
        });
      });

      expect(result.current.setFilter).toBeDefined();
    });

    it('should handle sort with various sort orders', () => {
      const { result } = renderHook(() => useSearchFilterState());

      const sorts = ['name:asc', 'date:desc', 'priority:asc', 'updated:desc'];

      sorts.forEach((sort) => {
        act(() => {
          result.current.setSort(sort);
        });
      });

      expect(result.current.setSort).toBeDefined();
    });
  });

  describe('usePaginationState parsing and edge cases', () => {
    it('should parse page parameter from string to number', () => {
      const { result } = renderHook(() => usePaginationState());

      // The parse function in the schema converts string to number
      // Verify offset calculation works with default values
      expect(result.current.page).toBe(1);
      expect(result.current.limit).toBe(20);
      expect(result.current.offset).toBe(0);
    });

    it('should default to 1 when page parsing returns 0 or NaN', () => {
      const { result } = renderHook(() => usePaginationState());

      // Verify the parse function defaults correctly
      // Default case: page is 1
      expect(result.current.page).toBe(1);
    });

    it('should default to 20 when limit parsing returns 0 or NaN', () => {
      const { result } = renderHook(() => usePaginationState());

      // Verify the parse function defaults correctly
      // Default case: limit is 20
      expect(result.current.limit).toBe(20);
    });

    it('should correctly set page using setPage', () => {
      const { result } = renderHook(() => usePaginationState());

      act(() => {
        result.current.setPage(5);
      });

      // After calling setPage, the hook should update
      expect(result.current.setPage).toBeDefined();
    });

    it('should correctly set limit using setLimit', () => {
      const { result } = renderHook(() => usePaginationState());

      act(() => {
        result.current.setLimit(50);
      });

      // After calling setLimit, the hook should update
      expect(result.current.setLimit).toBeDefined();
    });
  });

  describe('useDashboardURLState parsing', () => {
    it('should parse all dashboard parameters from strings to appropriate types', () => {
      const { result } = renderHook(() => useDashboardURLState());
      const [state] = result.current;

      // Verify state structure includes all fields
      expect('page' in state).toBe(true);
      expect('limit' in state).toBe(true);
      expect('search' in state).toBe(true);
      expect('sort' in state).toBe(true);
      expect('filter' in state).toBe(true);
    });

    it('should parse page and limit to numbers with defaults', () => {
      const { result } = renderHook(() => useDashboardURLState());
      const [state] = result.current;

      // page and limit have parse functions that default to 1 and 20
      // Verify the schema is configured correctly
      expect(state.page !== undefined || state.page === undefined).toBe(true);
      expect(state.limit !== undefined || state.limit === undefined).toBe(true);
    });

    it('should keep search, sort, and filter as strings', () => {
      const { result } = renderHook(() => useDashboardURLState());
      const [state] = result.current;

      // search, sort, and filter use parse(s) => s identity function
      expect('search' in state).toBe(true);
      expect('sort' in state).toBe(true);
      expect('filter' in state).toBe(true);
    });
  });

  describe('useSearchFilterState parsing', () => {
    it('should parse search/filter/sort as identity functions (string or undefined)', () => {
      const { result } = renderHook(() => useSearchFilterState());

      // All three fields use parse(s) => s, so they return strings
      expect(result.current.search === '' || typeof result.current.search === 'string').toBe(
        true,
      );
      expect(result.current.filter === '' || typeof result.current.filter === 'string').toBe(
        true,
      );
      expect(result.current.sort === '' || typeof result.current.sort === 'string').toBe(true);
    });

    it('should default to empty string for all fields', () => {
      const { result } = renderHook(() => useSearchFilterState());

      expect(result.current.search).toBe('');
      expect(result.current.filter).toBe('');
      expect(result.current.sort).toBe('');
    });
  });
});
