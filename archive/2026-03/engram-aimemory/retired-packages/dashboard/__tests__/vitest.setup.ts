import "@testing-library/jest-dom";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock SWR
vi.mock("swr", () => ({
  default: vi.fn(() => ({ data: null, error: null })),
}));
