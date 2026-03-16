import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/dashboard-page.test.tsx
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
vi.mock("@/hooks/useHealth", () => ({
  useHealth: vi.fn(() => ({
    data: { status: "ok", weaviate: true, redis: true, initialized: true },
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
vi.mock("next/link", () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

import DashboardPage from "@/app/dashboard/page";

describe("DashboardPage", () => {
  it("shows total memories stat", () => {
    render(<DashboardPage />);
    expect(screen.getByText("50")).toBeDefined();
  });

  it("shows tier breakdown", () => {
    render(<DashboardPage />);
    // tier1_count = 20, tier2_count = 20, tier3_count = 10 — there should be multiple 20s
    const twenties = screen.getAllByText("20");
    expect(twenties.length).toBeGreaterThanOrEqual(1);
  });
});
