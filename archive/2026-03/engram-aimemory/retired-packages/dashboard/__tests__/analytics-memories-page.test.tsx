import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/analytics-memories-page.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useStats", () => ({
  useStats: vi.fn(() => ({
    data: {
      total_memories: 50,
      tier1_count: 20,
      tier2_count: 20,
      tier3_count: 10,
      by_type: { fact: 30 },
      avg_importance: 0.6,
      oldest_memory: null,
      newest_memory: null,
    },
    isLoading: false,
  })),
}));
vi.mock("@/hooks/useAnalytics", () => ({
  useMemoryGrowth: vi.fn(() => ({ data: [], isLoading: false })),
  useActivityTimeline: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock("@/hooks/useEcharts", () => ({
  useEcharts: vi.fn(() => ({ ref: { current: null }, chart: { current: null } })),
}));
vi.mock("next-themes", () => ({ useTheme: vi.fn(() => ({ resolvedTheme: "dark" })) }));
vi.mock("@/components/tenant-project-selector", () => ({
  TenantProjectSelector: () => <div>Selector</div>,
  defaultTenantProjectContext: vi.fn(() => ({ tenantId: "default", projectId: "default" })),
}));

import MemoriesAnalyticsPage from "@/app/dashboard/analytics/memories/page";

describe("MemoriesAnalyticsPage", () => {
  it("renders without crashing", () => {
    render(<MemoriesAnalyticsPage />);
    expect(screen.getByText(/memory analytics/i)).toBeDefined();
  });
});
