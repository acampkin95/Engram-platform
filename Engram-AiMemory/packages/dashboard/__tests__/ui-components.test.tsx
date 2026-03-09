// packages/dashboard/__tests__/ui-components.test.tsx
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <p>Hello</p>
      </Card>
    );
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("CardHeader renders title", () => {
    render(<CardHeader title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeDefined();
  });

  it("CardHeader renders subtitle when provided", () => {
    render(<CardHeader title="Title" subtitle="A subtitle" />);
    expect(screen.getByText("A subtitle")).toBeDefined();
  });

  it("CardHeader renders action slot", () => {
    render(<CardHeader title="Title" action={<button>Action</button>} />);
    expect(screen.getByRole("button", { name: "Action" })).toBeDefined();
  });

  it("CardContent renders children", () => {
    render(
      <CardContent>
        <span>Content</span>
      </CardContent>
    );
    expect(screen.getByText("Content")).toBeDefined();
  });
});

describe("Badge", () => {
  it("renders tier 1 badge with correct label", () => {
    render(<Badge tier={1} />);
    expect(screen.getByText("Project")).toBeDefined();
  });

  it("renders tier 2 badge with correct label", () => {
    render(<Badge tier={2} />);
    expect(screen.getByText("General")).toBeDefined();
  });

  it("renders tier 3 badge with correct label", () => {
    render(<Badge tier={3} />);
    expect(screen.getByText("Global")).toBeDefined();
  });
});

describe("StatCard", () => {
  it("renders value and label", () => {
    render(<StatCard label="Total Memories" value={42} />);
    expect(screen.getByText("Total Memories")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
  });

  it("renders positive delta with emerald color class", () => {
    const { container } = render(
      <StatCard label="Memories" value={42} delta="+5 today" deltaPositive />
    );
    expect(screen.getByText("+5 today")).toBeDefined();
    const deltaEl = container.querySelector(".text-emerald-400");
    expect(deltaEl).toBeTruthy();
  });

  it("renders negative delta with rose color class", () => {
    const { container } = render(
      <StatCard label="Memories" value={42} delta="-2 today" deltaPositive={false} />
    );
    expect(screen.getByText("-2 today")).toBeDefined();
    const deltaEl = container.querySelector(".text-rose-400");
    expect(deltaEl).toBeTruthy();
  });
});
