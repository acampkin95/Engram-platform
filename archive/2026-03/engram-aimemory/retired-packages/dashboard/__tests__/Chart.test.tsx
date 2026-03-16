import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/Chart.test.tsx
import { describe, expect, it, vi } from "vitest";

// Mock useEcharts so we don't need a real DOM canvas
vi.mock("@/hooks/useEcharts", () => ({
  useEcharts: vi.fn(() => ({
    ref: { current: null },
    chart: { current: null },
  })),
}));

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

import { Chart } from "@/components/charts/Chart";

describe("Chart", () => {
  it("renders a container div with aria role", () => {
    render(<Chart option={{}} aria-label="Test chart" style={{ height: 200 }} />);
    const fig = screen.getByRole("figure");
    expect(fig).toBeDefined();
  });

  it("renders sr-only fallback text when provided", () => {
    render(
      <Chart option={{}} aria-label="Memory chart" style={{ height: 200 }}>
        <span className="sr-only">Memory data table</span>
      </Chart>
    );
    expect(screen.getByText("Memory data table")).toBeDefined();
  });
});
