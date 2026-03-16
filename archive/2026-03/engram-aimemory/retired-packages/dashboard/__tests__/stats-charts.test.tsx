import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/stats-charts.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useEcharts", () => ({
  useEcharts: vi.fn(() => ({ ref: { current: null }, chart: { current: null } })),
}));
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

import { ImportanceHistogram } from "@/components/charts/ImportanceHistogram";
import { TierDonutChart } from "@/components/charts/TierDonutChart";
import { TypeBarChart } from "@/components/charts/TypeBarChart";

const mockStats = {
  total_memories: 30,
  tier1_count: 15,
  tier2_count: 10,
  tier3_count: 5,
  by_type: { fact: 20, procedure: 10 },
  oldest_memory: null,
  newest_memory: null,
  avg_importance: 0.65,
};

describe("TierDonutChart", () => {
  it("renders with aria role", () => {
    render(<TierDonutChart stats={mockStats} />);
    expect(screen.getByRole("figure", { name: /tier distribution/i })).toBeDefined();
  });
});

describe("TypeBarChart", () => {
  it("renders with aria role", () => {
    render(<TypeBarChart byType={{ fact: 20, procedure: 10 }} />);
    expect(screen.getByRole("figure", { name: /type breakdown/i })).toBeDefined();
  });
});

describe("ImportanceHistogram", () => {
  it("renders with aria role", () => {
    render(<ImportanceHistogram avgImportance={0.65} />);
    expect(screen.getByRole("figure", { name: /average memory importance/i })).toBeDefined();
  });
});
