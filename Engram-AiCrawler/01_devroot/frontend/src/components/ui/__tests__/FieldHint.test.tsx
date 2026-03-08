import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FieldHint } from "../FieldHint";

describe("FieldHint", () => {
  it("returns null when no hint and no examples", () => {
    const { container } = render(<FieldHint />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no hint and empty examples array", () => {
    const { container } = render(<FieldHint examples={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders hint text", () => {
    render(<FieldHint hint="This is a helpful hint" />);
    expect(screen.getByText("This is a helpful hint")).toBeInTheDocument();
  });

  it("renders example chips as buttons", () => {
    render(<FieldHint examples={["example1", "example2"]} />);
    expect(screen.getByRole("button", { name: "example1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "example2" })).toBeInTheDocument();
  });

  it("calls onExampleClick with correct value when chip clicked", () => {
    const onExampleClick = vi.fn();
    render(<FieldHint examples={["click-me"]} onExampleClick={onExampleClick} />);
    fireEvent.click(screen.getByRole("button", { name: "click-me" }));
    expect(onExampleClick).toHaveBeenCalledWith("click-me");
  });

  it("renders error state with error text", () => {
    render(<FieldHint error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders error state with SVG icon", () => {
    const { container } = render(<FieldHint error="An error occurred" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders 'e.g.' prefix when examples provided without hint", () => {
    render(<FieldHint examples={["foo"]} />);
    expect(screen.getByText(/e\.g\./)).toBeInTheDocument();
  });

  it("renders hint alongside examples", () => {
    render(<FieldHint hint="Use one of these" examples={["opt1"]} />);
    expect(screen.getByText("Use one of these")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "opt1" })).toBeInTheDocument();
  });
});
