import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreatIntelPanel } from "../ThreatIntelPanel";
import { useThreatIntel } from "../../../hooks/useOsintServices";

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

const mockSearchShodan = vi.fn();
const mockCheckVirusTotal = vi.fn();
const mockCheckIpReputation = vi.fn();

const defaultMock = {
  shodanResult: null,
  vtResult: null,
  ipRepResult: null,
  isLoading: false,
  error: null,
  searchShodan: mockSearchShodan,
  checkVirusTotal: mockCheckVirusTotal,
  checkIpReputation: mockCheckIpReputation,
  clearError: vi.fn(),
};

const mockIpRepResult = {
  ip: "203.0.113.99",
  threat_score: 5,
  risk_level: "low",
  shodan_data: { ports: [80, 443], vulns: ["CVE-2021-1234"] },
};

const mockShodanResult = {
  total: 1,
  results: [
    {
      ip: "10.20.30.40",
      org: "Test Org",
      ports: [80],
      vulns: [],
      hostnames: [],
      os: "Linux",
    },
  ],
};

const mockVtResult = {
  indicator: "203.0.113.55",
  indicator_type: "ip",
  detection_ratio: "2/72",
  malicious: 2,
  suspicious: 1,
  harmless: 65,
  undetected: 4,
  total_vendors: 72,
  threat_names: ["Trojan.Generic"],
};

beforeEach(() => {
  vi.mocked(useThreatIntel).mockReturnValue(defaultMock as any);
  mockSearchShodan.mockClear();
  mockCheckVirusTotal.mockClear();
  mockCheckIpReputation.mockClear();
});

describe("ThreatIntelPanel", () => {
  it("renders query input with initial reputation placeholder", () => {
    render(<ThreatIntelPanel />);
    expect(screen.getByPlaceholderText("Enter IP address\u2026")).toBeInTheDocument();
  });

  it("renders Scan button", () => {
    render(<ThreatIntelPanel />);
    expect(screen.getByRole("button", { name: "Scan" })).toBeInTheDocument();
  });

  it("switching to Shodan tab changes placeholder", async () => {
    const user = userEvent.setup();
    render(<ThreatIntelPanel />);
    await user.click(screen.getByRole("button", { name: "Shodan" }));
    expect(
      screen.getByPlaceholderText("IP or Shodan query\u2026")
    ).toBeInTheDocument();
  });

  it("switching to VirusTotal tab changes placeholder", async () => {
    const user = userEvent.setup();
    render(<ThreatIntelPanel />);
    await user.click(screen.getByRole("button", { name: "VirusTotal" }));
    expect(
      screen.getByPlaceholderText("IP, domain, or file hash\u2026")
    ).toBeInTheDocument();
  });

  it("Scan calls checkIpReputation on reputation tab", async () => {
    const user = userEvent.setup();
    render(<ThreatIntelPanel />);
    const input = screen.getByPlaceholderText("Enter IP address\u2026");
    await user.type(input, "8.8.8.8");
    await user.click(screen.getByRole("button", { name: "Scan" }));
    expect(mockCheckIpReputation).toHaveBeenCalledWith("8.8.8.8");
  });

  it("Scan calls searchShodan on shodan tab", async () => {
    const user = userEvent.setup();
    render(<ThreatIntelPanel />);
    await user.click(screen.getByRole("button", { name: "Shodan" }));
    const input = screen.getByPlaceholderText("IP or Shodan query\u2026");
    await user.type(input, "apache");
    await user.click(screen.getByRole("button", { name: "Scan" }));
    expect(mockSearchShodan).toHaveBeenCalledWith("apache");
  });

  it("Scan calls checkVirusTotal on vt tab", async () => {
    const user = userEvent.setup();
    render(<ThreatIntelPanel />);
    await user.click(screen.getByRole("button", { name: "VirusTotal" }));
    const input = screen.getByPlaceholderText("IP, domain, or file hash\u2026");
    await user.type(input, "1.2.3.4");
    await user.click(screen.getByRole("button", { name: "Scan" }));
    expect(mockCheckVirusTotal).toHaveBeenCalledWith("1.2.3.4");
  });

  it("shows loading state with 'Scanning…' text", () => {
    vi.mocked(useThreatIntel).mockReturnValue({
      ...defaultMock,
      isLoading: true,
    } as any);
    render(<ThreatIntelPanel />);
    expect(screen.getByText("Scanning\u2026")).toBeInTheDocument();
  });

  it("shows error banner when error is set", () => {
    vi.mocked(useThreatIntel).mockReturnValue({
      ...defaultMock,
      error: "API limit reached",
    } as any);
    render(<ThreatIntelPanel />);
    expect(screen.getByText("API limit reached")).toBeInTheDocument();
  });

  it("renders IP reputation section when ipRepResult is present", () => {
    vi.mocked(useThreatIntel).mockReturnValue({
      ...defaultMock,
      ipRepResult: mockIpRepResult,
    } as any);
    render(<ThreatIntelPanel />);
    expect(screen.getByText("203.0.113.99")).toBeInTheDocument();
  });

  it("renders Shodan section when shodanResult is present and on shodan tab", async () => {
    const user = userEvent.setup();
    vi.mocked(useThreatIntel).mockReturnValue({
      ...defaultMock,
      shodanResult: mockShodanResult,
    } as any);
    render(<ThreatIntelPanel />);
    await user.click(screen.getByRole("button", { name: "Shodan" }));
    expect(screen.getByText(/10\.20\.30\.40/)).toBeInTheDocument();
  });

  it("renders VirusTotal section when vtResult is present and on vt tab", async () => {
    const user = userEvent.setup();
    vi.mocked(useThreatIntel).mockReturnValue({
      ...defaultMock,
      vtResult: mockVtResult,
    } as any);
    render(<ThreatIntelPanel />);
    await user.click(screen.getByRole("button", { name: "VirusTotal" }));
    expect(screen.getByText("203.0.113.55")).toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    render(<ThreatIntelPanel />);
    expect(
      screen.getByText(
        "Enter an IP, domain, or hash to check threat intelligence"
      )
    ).toBeInTheDocument();
  });
});
