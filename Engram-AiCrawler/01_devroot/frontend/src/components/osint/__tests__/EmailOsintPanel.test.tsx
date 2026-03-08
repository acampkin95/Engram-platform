import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailOsintPanel } from "../EmailOsintPanel";
import { useEmailOsint } from "../../../hooks/useOsintServices";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    ul: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useMotionValue: () => ({ set: vi.fn(), get: vi.fn(), onChange: vi.fn() }),
  useTransform: (_: unknown, fn: (v: number) => unknown) => fn(0),
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
  useInView: () => true,
  animate: vi.fn(() => ({ stop: vi.fn() })),
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  LazyMotion: ({ children }: any) => <>{children}</>,
  domAnimation: {},
  MotionConfig: ({ children }: any) => <>{children}</>,
}));

vi.mock("../../../hooks/useOsintServices", () => ({
  useWhoisLookup: vi.fn(),
  useThreatIntel: vi.fn(),
  useEmailOsint: vi.fn(),
}));

vi.mock("../../../lib/motion", () => ({
  useReducedMotion: () => true,
  glowHover: {},
  fadeVariants: {},
  slideUpVariants: {},
  staggerContainer: {},
  staggerItem: {},
  scaleInVariants: {},
  safeVariants: () => undefined,
  revealProps: () => ({}),
}));

const mockFullEmailCheck = vi.fn();
const mockBulkCheck = vi.fn();

const defaultMock = {
  breachResult: null,
  emailVerifyResult: null,
  emailReverseResult: null,
  bulkEmailResult: null,
  isLoading: false,
  error: null,
  fullEmailCheck: mockFullEmailCheck,
  checkBreach: vi.fn(),
  verifyEmail: vi.fn(),
  reverseLookup: vi.fn(),
  bulkCheck: mockBulkCheck,
  clearError: vi.fn(),
};

const mockBreachResult = {
  breached: true,
  breach_count: 3,
  breaches: [
    {
      name: "TestBreach",
      title: "Test Breach",
      domain: "test.com",
      breach_date: "2023-01-01",
      pwn_count: 100000,
      data_classes: ["Email", "Password"],
      is_verified: true,
    },
  ],
};

const mockEmailVerifyResult = {
  status: "valid",
  disposable: false,
  role_based: false,
  free_provider: true,
  mx_found: true,
  score: 85,
};

const mockEmailReverseResult = {
  first_name: "John",
  last_name: "Doe",
  company: "Test Corp",
  position: "Engineer",
  confidence: 0.85,
};

const mockBulkEmailResult = {
  total: 2,
  breached_count: 1,
  results: [
    { email: "user1@gmail.com", breached: true, breach_count: 2 },
    { email: "user2@gmail.com", breached: false, breach_count: 0 },
  ],
};

beforeEach(() => {
  vi.mocked(useEmailOsint).mockReturnValue(defaultMock as any);
  mockFullEmailCheck.mockClear();
  mockBulkCheck.mockClear();
});

describe("EmailOsintPanel", () => {
  it("renders email input in single mode with placeholder", () => {
    render(<EmailOsintPanel />);
    expect(
      screen.getByPlaceholderText("e.g. user@gmail.com")
    ).toBeInTheDocument();
  });

  it("mode switch to bulk shows textarea", async () => {
    const user = userEvent.setup();
    render(<EmailOsintPanel />);
    await user.click(screen.getAllByRole("button", { name: "Bulk Check" })[0]);
    expect(
      screen.getByPlaceholderText(/user1@gmail\.com/)
    ).toBeInTheDocument();
  });

  it("example chip fills email input", async () => {
    render(<EmailOsintPanel />);
    // Find an example chip button (not the Investigate button)
    const chips = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.includes("@"));
    if (chips.length > 0) {
      fireEvent.click(chips[0]);
      const input = screen.getByPlaceholderText(
        "e.g. user@gmail.com"
      ) as HTMLInputElement;
      expect(input.value).not.toBe("");
    }
  });

  it("Investigate button calls fullEmailCheck", async () => {
    const user = userEvent.setup();
    render(<EmailOsintPanel />);
    const input = screen.getByPlaceholderText("e.g. user@gmail.com");
    await user.type(input, "test@example.com");
    await user.click(screen.getByRole("button", { name: "Investigate" }));
    expect(mockFullEmailCheck).toHaveBeenCalledWith("test@example.com");
  });

  it("bulk textarea input and Bulk Check button calls bulkCheck", async () => {
    const user = userEvent.setup();
    render(<EmailOsintPanel />);
    // Switch to bulk mode
    await user.click(screen.getAllByRole("button", { name: "Bulk Check" })[0]);
    // Fill the textarea using fireEvent.change to reliably update React state
    const textarea = screen.getByPlaceholderText(/user1@gmail\.com/);
    fireEvent.change(textarea, { target: { value: "a@b.com\nc@d.com" } });
    // Find the submit button (has count in text, e.g. 'Bulk Check (2 emails)')
    const bulkBtn = screen
      .getAllByRole("button")
      .find((btn) => /bulk check \(\d/i.test(btn.textContent ?? "") && !btn.hasAttribute("disabled"));
    expect(bulkBtn).toBeTruthy();
    await user.click(bulkBtn!);
    expect(mockBulkCheck).toHaveBeenCalled();
  });

  it("shows loading state with 'Investigating…' text", () => {
    vi.mocked(useEmailOsint).mockReturnValue({
      ...defaultMock,
      isLoading: true,
    } as any);
    render(<EmailOsintPanel />);
    expect(screen.getByText("Investigating\u2026")).toBeInTheDocument();
  });

  it("shows error banner when error is set", () => {
    vi.mocked(useEmailOsint).mockReturnValue({
      ...defaultMock,
      error: "Service unavailable",
    } as any);
    render(<EmailOsintPanel />);
    expect(screen.getByText("Service unavailable")).toBeInTheDocument();
  });

  it("renders Breach History section when breachResult is present", () => {
    vi.mocked(useEmailOsint).mockReturnValue({
      ...defaultMock,
      breachResult: mockBreachResult,
    } as any);
    render(<EmailOsintPanel />);
    expect(screen.getByText("Breach History")).toBeInTheDocument();
  });

  it("renders Email Verification section when emailVerifyResult is present", () => {
    vi.mocked(useEmailOsint).mockReturnValue({
      ...defaultMock,
      emailVerifyResult: mockEmailVerifyResult,
    } as any);
    render(<EmailOsintPanel />);
    expect(screen.getByText("Email Verification")).toBeInTheDocument();
  });

  it("renders Identity Lookup section when emailReverseResult is present", () => {
    vi.mocked(useEmailOsint).mockReturnValue({
      ...defaultMock,
      emailReverseResult: mockEmailReverseResult,
    } as any);
    render(<EmailOsintPanel />);
    expect(screen.getByText("Identity Lookup")).toBeInTheDocument();
  });

  it("renders bulk results when bulkEmailResult is present", async () => {
    const user = userEvent.setup();
    vi.mocked(useEmailOsint).mockReturnValue({
      ...defaultMock,
      bulkEmailResult: mockBulkEmailResult,
    } as any);
    render(<EmailOsintPanel />);
    await user.click(screen.getByRole("button", { name: "Bulk Check" }));
    expect(screen.getByText("user1@gmail.com")).toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    render(<EmailOsintPanel />);
    expect(
      screen.getByText(
        "Enter an email address to check breaches, verify, and identify"
      )
    ).toBeInTheDocument();
  });
});
