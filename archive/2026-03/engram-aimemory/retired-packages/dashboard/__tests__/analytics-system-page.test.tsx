import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/analytics-system-page.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAnalytics", () => ({
  useSystemMetrics: vi.fn(() => ({
    data: {
      weaviate_latency_ms: 45,
      redis_latency_ms: 1.2,
      api_uptime_seconds: 3600,
      requests_per_minute: 0,
      error_rate: 0,
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

import SystemAnalyticsPage from "@/app/dashboard/analytics/system/page";

describe("SystemAnalyticsPage", () => {
  it("renders without crashing", () => {
    render(<SystemAnalyticsPage />);
    expect(screen.getByText(/system health/i)).toBeDefined();
  });
});
