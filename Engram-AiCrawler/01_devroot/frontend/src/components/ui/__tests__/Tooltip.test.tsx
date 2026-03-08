import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Tooltip, HelpTooltip } from "../Tooltip";

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

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children", () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
  });

  it("tooltip is not visible initially", () => {
    render(
      <Tooltip content="Hidden tooltip">
        <button>Trigger</button>
      </Tooltip>
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("tooltip becomes visible after mouseenter and delay", () => {
    render(
      <Tooltip content="Visible tooltip">
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByText("Trigger").closest("span")!;
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Visible tooltip");
  });

  it("tooltip hides after mouseleave", () => {
    render(
      <Tooltip content="Disappearing tooltip">
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByText("Trigger").closest("span")!;
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("disabled tooltip does not show on hover", () => {
    render(
      <Tooltip content="Should not appear" disabled>
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByText("Trigger").closest("span")!;
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("HelpTooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an SVG icon", () => {
    const { container } = render(<HelpTooltip content="Help text" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows tooltip content on hover", () => {
    const { container } = render(<HelpTooltip content="Help text" />);
    const trigger = container.querySelector("span")!;
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Help text");
  });
});
