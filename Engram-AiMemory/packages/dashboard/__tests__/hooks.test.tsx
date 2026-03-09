import { renderHook, waitFor } from "@testing-library/react";
// packages/dashboard/__tests__/hooks.test.tsx
import { describe, expect, it, vi } from "vitest";

// Mock SWR
vi.mock("swr", () => ({
  default: vi.fn((key: string) => {
    if (key?.includes("/stats")) {
      return {
        data: {
          total_memories: 42,
          tier1_count: 10,
          tier2_count: 20,
          tier3_count: 12,
          by_type: {},
          avg_importance: 0.5,
          oldest_memory: null,
          newest_memory: null,
        },
        error: undefined,
        isLoading: false,
      };
    }
    if (key?.includes("/health")) {
      return {
        data: { status: "ok", weaviate: true, redis: true, initialized: true },
        error: undefined,
        isLoading: false,
      };
    }
    return { data: undefined, error: undefined, isLoading: true };
  }),
}));

import { useHealth } from "@/hooks/useHealth";
import { useStats } from "@/hooks/useStats";

describe("useStats", () => {
  it("returns stats data", async () => {
    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.total_memories).toBe(42);
  });
});

describe("useHealth", () => {
  it("returns health data", async () => {
    const { result } = renderHook(() => useHealth());
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.weaviate).toBe(true);
  });
});
