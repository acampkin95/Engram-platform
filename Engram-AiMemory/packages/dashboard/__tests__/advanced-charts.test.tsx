import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/advanced-charts.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useEcharts", () => ({
  useEcharts: vi.fn(() => ({ ref: { current: null }, chart: { current: null } })),
}));
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { KnowledgeGraphTreemap } from "@/components/charts/KnowledgeGraphTreemap";
import { SearchScatterChart } from "@/components/charts/SearchScatterChart";
import { SystemGaugeChart } from "@/components/charts/SystemGaugeChart";

describe("ActivityHeatmap", () => {
  it("renders", () => {
    render(<ActivityHeatmap data={[{ date: "2025-06-15", count: 5 }]} year={2025} />);
    expect(screen.getByRole("figure", { name: /activity heatmap/i })).toBeDefined();
  });
});

describe("SearchScatterChart", () => {
  it("renders", () => {
    render(
      <SearchScatterChart
        stats={{ total_searches: 10, avg_score: 0.7, top_queries: [], score_distribution: [] }}
      />
    );
    expect(screen.getByRole("figure", { name: /search query analytics/i })).toBeDefined();
  });
});

describe("KnowledgeGraphTreemap", () => {
  it("renders", () => {
    render(
      <KnowledgeGraphTreemap
        data={{
          entities_by_type: { Person: 5, Concept: 3 },
          total_entities: 8,
          total_relations: 4,
        }}
      />
    );
    expect(screen.getByRole("figure", { name: /knowledge graph/i })).toBeDefined();
  });
});

describe("SystemGaugeChart", () => {
  it("renders", () => {
    render(<SystemGaugeChart value={45} label="Weaviate Latency" unit="ms" max={200} />);
    expect(screen.getByRole("figure", { name: /weaviate latency gauge/i })).toBeDefined();
  });
});
