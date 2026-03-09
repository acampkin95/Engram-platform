import type { HealthStatus, Memory, MemoryTier, Stats } from "@/types";
// packages/dashboard/__tests__/types.test.ts
import { describe, expect, it } from "vitest";

describe("Shared types", () => {
  it("Memory type has required fields", () => {
    const mem: Memory = {
      memory_id: "abc",
      content: "test",
      summary: null,
      tier: 1,
      memory_type: "fact",
      source: "agent",
      project_id: null,
      user_id: null,
      tenant_id: "default",
      importance: 0.5,
      confidence: 1.0,
      tags: [],
      created_at: new Date().toISOString(),
      score: 0,
      distance: null,
    };
    expect(mem.memory_id).toBe("abc");
    expect(mem.tier).toBe(1);
  });

  it("Stats type has tier counts", () => {
    const stats: Stats = {
      total_memories: 10,
      tier1_count: 5,
      tier2_count: 3,
      tier3_count: 2,
      by_type: { fact: 8, procedure: 2 },
      oldest_memory: null,
      newest_memory: null,
      avg_importance: 0.6,
    };
    expect(stats.total_memories).toBe(10);
  });

  it("MemoryTier is 1, 2, or 3", () => {
    const tier: MemoryTier = 1;
    expect([1, 2, 3]).toContain(tier);
  });
});
