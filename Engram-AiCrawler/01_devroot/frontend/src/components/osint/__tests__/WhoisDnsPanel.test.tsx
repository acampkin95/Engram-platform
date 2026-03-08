import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhoisDnsPanel } from "../WhoisDnsPanel";
import { useWhoisLookup } from "../../../hooks/useOsintServices";

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

const mockLookupDomain = vi.fn();
const mockLookupIp = vi.fn();
const mockClearError = vi.fn();

const defaultMock = {
  whoisResult: null,
  dnsResult: null,
  ipResult: null,
  isLoading: false,
  error: null,
  lookupDomain: mockLookupDomain,
  lookupDns: vi.fn(),
  lookupIp: mockLookupIp,
  clearError: mockClearError,
};

const mockWhoisResult = {
  domain: "example.com",
  registrar: "Test Registrar",
  creation_date: "2000-01-01",
  expiration_date: "2025-01-01",
  updated_date: "2024-01-01",
  name_servers: ["ns1.example.com"],
  status: ["clientTransferProhibited"],
};

const mockDnsResult = {
  records: [
    { type: "A", name: "example.com", value: "93.184.216.34", ttl: 3600 },
  ],
};

const mockIpResult = {
  ip: "93.184.216.34",
  country: "United States",
  region: "MA",
  city: "Norwell",
  isp: "EDGECAST",
  org: "Verizon",
  asn: "AS15133",
};

beforeEach(() => {
  vi.mocked(useWhoisLookup).mockReturnValue(defaultMock as any);
  mockLookupDomain.mockClear();
  mockLookupIp.mockClear();
  mockClearError.mockClear();
});

describe("WhoisDnsPanel", () => {
  it("renders domain input with placeholder", () => {
    render(<WhoisDnsPanel />);
    expect(screen.getByPlaceholderText("e.g. example.com")).toBeInTheDocument();
  });

  it("renders IP input with placeholder", () => {
    render(<WhoisDnsPanel />);
    expect(screen.getByPlaceholderText("e.g. 8.8.8.8")).toBeInTheDocument();
  });

  it("renders WHOIS button", () => {
    render(<WhoisDnsPanel />);
    expect(screen.getByRole("button", { name: "WHOIS" })).toBeInTheDocument();
  });

  it("renders Lookup button for IP", () => {
    render(<WhoisDnsPanel />);
    expect(screen.getByRole("button", { name: "Lookup" })).toBeInTheDocument();
  });

  it("domain example chip fills input and WHOIS button calls lookupDomain", async () => {
    const user = userEvent.setup();
    render(<WhoisDnsPanel />);
    fireEvent.click(screen.getAllByRole("button", { name: "example.com" })[0]);
    await user.click(screen.getByRole("button", { name: "WHOIS" }));
    expect(mockLookupDomain).toHaveBeenCalledWith("example.com");
  });

  it("IP example chip fills input and Lookup button calls lookupIp", async () => {
    const user = userEvent.setup();
    render(<WhoisDnsPanel />);
    fireEvent.click(screen.getAllByRole("button", { name: "8.8.8.8" })[0]);
    await user.click(screen.getByRole("button", { name: "Lookup" }));
    expect(mockLookupIp).toHaveBeenCalledWith("8.8.8.8");
  });

  it("Enter key in domain input calls lookupDomain", async () => {
    const user = userEvent.setup();
    render(<WhoisDnsPanel />);
    const domainInput = screen.getByPlaceholderText("e.g. example.com");
    await user.type(domainInput, "google.com{Enter}");
    expect(mockLookupDomain).toHaveBeenCalledWith("google.com");
  });

  it("shows loading state with 'Querying…' text", () => {
    vi.mocked(useWhoisLookup).mockReturnValue({ ...defaultMock, isLoading: true } as any);
    render(<WhoisDnsPanel />);
    expect(screen.getByText("Querying\u2026")).toBeInTheDocument();
  });

  it("shows error banner with error text and Retry button", () => {
    vi.mocked(useWhoisLookup).mockReturnValue({
      ...defaultMock,
      error: "Network error",
    } as any);
    render(<WhoisDnsPanel />);
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retry button calls clearError", async () => {
    const user = userEvent.setup();
    vi.mocked(useWhoisLookup).mockReturnValue({
      ...defaultMock,
      error: "Timeout",
    } as any);
    render(<WhoisDnsPanel />);
    // Type a domain first so retry can call lookupDomain
    const domainInput = screen.getByPlaceholderText("e.g. example.com");
    await user.type(domainInput, "test.com");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockClearError).toHaveBeenCalled();
  });

  it("renders WHOIS section when whoisResult is present", () => {
    vi.mocked(useWhoisLookup).mockReturnValue({
      ...defaultMock,
      whoisResult: mockWhoisResult,
    } as any);
    render(<WhoisDnsPanel />);
    expect(screen.getByText("WHOIS Registration")).toBeInTheDocument();
  });

  it("renders DNS table row when dnsResult is present", () => {
    vi.mocked(useWhoisLookup).mockReturnValue({
      ...defaultMock,
      dnsResult: mockDnsResult,
    } as any);
    render(<WhoisDnsPanel />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getAllByText("DNS Records")[0]).toBeInTheDocument();
  });

  it("renders IP section when ipResult is present", () => {
    vi.mocked(useWhoisLookup).mockReturnValue({
      ...defaultMock,
      ipResult: mockIpResult,
    } as any);
    render(<WhoisDnsPanel />);
    expect(screen.getAllByText("IP Geolocation")[0]).toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    render(<WhoisDnsPanel />);
    expect(
      screen.getByText("Enter a domain or IP address to begin intelligence gathering")
    ).toBeInTheDocument();
  });
});
