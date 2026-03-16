import { render, screen } from "@testing-library/react";
// packages/dashboard/__tests__/analytics-layout.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard/analytics/memories"),
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: { children: React.ReactNode }) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

import AnalyticsLayout from "@/app/dashboard/analytics/layout";

describe("AnalyticsLayout", () => {
  it("renders sub-nav tabs", () => {
    render(
      <AnalyticsLayout>
        <div>content</div>
      </AnalyticsLayout>
    );
    expect(screen.getByText("Memories")).toBeDefined();
    expect(screen.getByText("Search")).toBeDefined();
    expect(screen.getByText("System")).toBeDefined();
  });
});
