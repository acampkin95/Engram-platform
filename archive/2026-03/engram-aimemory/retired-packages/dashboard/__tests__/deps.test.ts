import { describe, expect, it } from "vitest";

describe("Dependency contract", () => {
  it("echarts can be imported", async () => {
    // Dynamic import because echarts is ESM-heavy
    const mod = await import("echarts/core");
    expect(typeof mod.init).toBe("function");
    expect(typeof mod.use).toBe("function");
  });
});
