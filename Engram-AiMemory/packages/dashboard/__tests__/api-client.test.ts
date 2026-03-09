// packages/dashboard/__tests__/api-client.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock localStorage (auth token)
vi.stubGlobal("localStorage", {
  getItem: vi.fn().mockReturnValue("test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

import { apiClient, swrFetcher } from "@/lib/api-client";

describe("apiClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("GET request includes auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_memories: 5 }),
    });

    await apiClient.get("/stats");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/stats"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: "Forbidden" }),
    });

    await expect(apiClient.get("/stats")).rejects.toThrow("Forbidden");
  });

  it("builds URL with query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await apiClient.get("/stats", { tenant_id: "acme", period: "daily" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("tenant_id=acme"),
      expect.anything()
    );
  });
  it("swrFetcher delegates to apiClient.get", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) });
    const result = await swrFetcher<{ status: string }>(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/health`);
    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.anything()
    );
  });
});
