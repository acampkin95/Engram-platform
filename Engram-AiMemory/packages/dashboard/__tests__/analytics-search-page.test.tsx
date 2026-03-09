import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/analytics-search-page.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAnalytics", () => ({
  useSearchStats: vi.fn(() => ({
    data: { total_searches: 10, avg_score: 0.7, top_queries: [], score_distribution: [] },
    isLoading: false,
  })),
  useKnowledgeGraphStats: vi.fn(() => ({
    data: { entities_by_type: {}, total_entities: 0, total_relations: 0 },
    isLoading: false,
  })),
}));
vi.mock("@/hooks/useEcharts", () => ({
  useEcharts: vi.fn(() => ({ ref: { current: null }, chart: { current: null } })),
}));
vi.mock("next-themes", () => ({ useTheme: vi.fn(() => ({ resolvedTheme: "dark" })) }));
vi.mock("@/components/tenant-project-selector", () => ({
  TenantProjectSelector: () => <div>Selector</div>,
  defaultTenantProjectContext: vi.fn(() => ({ tenantId: "default", projectId: "default" })),
}));

import SearchAnalyticsPage from "@/app/dashboard/analytics/search/page";

describe("SearchAnalyticsPage", () => {
  it("renders without crashing", () => {
    render(<SearchAnalyticsPage />);
    expect(screen.getByText(/search analytics/i)).toBeDefined();
  });
});
