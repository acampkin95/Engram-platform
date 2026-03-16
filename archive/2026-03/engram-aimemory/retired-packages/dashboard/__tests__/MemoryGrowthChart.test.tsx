// packages/dashboard/__tests__/MemoryGrowthChart.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useEcharts", () => ({
  useEcharts: vi.fn(() => ({ ref: { current: null }, chart: { current: null } })),
}));
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

import { MemoryGrowthChart } from "@/components/charts/MemoryGrowthChart";

const mockData = [
  { date: "2025-01-01", total: 5, tier1: 2, tier2: 2, tier3: 1 },
  { date: "2025-01-02", total: 10, tier1: 4, tier2: 4, tier3: 2 },
];

describe("MemoryGrowthChart", () => {
  it("renders with aria label", () => {
    render(<MemoryGrowthChart data={mockData} />);
    expect(screen.getByRole("figure", { name: /memory growth over time/i })).toBeDefined();
  });

  it("renders loading state when data is undefined", () => {
    render(<MemoryGrowthChart data={undefined} loading />);
    const fig = screen.getByRole("figure");
    expect(fig).toBeDefined();
    expect(screen.getByText(/0 data points/i)).toBeDefined();
  });
});
