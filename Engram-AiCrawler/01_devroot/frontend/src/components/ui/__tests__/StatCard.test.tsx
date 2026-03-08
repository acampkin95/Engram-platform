import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useMotionValue: () => ({ set: vi.fn(), get: vi.fn() }),
  useTransform: (_: unknown, fn: (v: number) => unknown) => fn(0),
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));

describe("StatCard", () => {
  it("renders label", () => {
    render(<StatCard label="Total Scans" value={42} animate={false} />);
    expect(screen.getByText("Total Scans")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard label="Status" value="Active" animate={false} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders numeric value with animate=false", () => {
    render(<StatCard label="Count" value={1234} animate={false} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("renders suffix", () => {
    render(<StatCard label="Rate" value={99} suffix="%" animate={false} />);
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("renders sub label", () => {
    render(<StatCard label="Score" value={10} sub="out of 100" animate={false} />);
    expect(screen.getByText("out of 100")).toBeInTheDocument();
  });

  it("renders icon via data-testid", () => {
    const Icon = () => <svg data-testid="stat-icon" />;
    render(<StatCard label="Items" value={5} icon={<Icon />} animate={false} />);
    expect(screen.getByTestId("stat-icon")).toBeInTheDocument();
  });

  it("applies accent color class", () => {
    const { container } = render(
      <StatCard label="Risk" value={7} accent="neon-r" animate={false} />
    );
    expect(container.innerHTML).toContain("text-neon-r");
  });

  it("does not render suffix when not provided", () => {
    render(<StatCard label="X" value={1} animate={false} />);
    // No suffix span with 'text-sm' class should appear for suffix
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });

  it("does not render sub when not provided", () => {
    render(<StatCard label="X" value={1} animate={false} />);
    // No sub text
    expect(screen.queryByText("out of 100")).not.toBeInTheDocument();
  });

  it("renders numeric value 0 correctly", () => {
    render(<StatCard label="Zero" value={0} animate={false} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
