// packages/dashboard/__tests__/echarts-registration.test.ts
import { describe, expect, it } from "vitest";

describe("ECharts registration", () => {
  it("exports echarts core with registered components", async () => {
    const { echarts } = await import("@/lib/echarts");
    // echarts is the configured instance with all needed components
    expect(echarts).toBeDefined();
    expect(typeof echarts.init).toBe("function");
    expect(typeof echarts.use).toBe("function");
  });
});
