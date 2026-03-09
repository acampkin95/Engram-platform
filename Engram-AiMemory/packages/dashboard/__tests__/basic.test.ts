import { describe, expect, it, vi } from "vitest";

// Simple test to verify vitest setup
describe("Dashboard Tests", () => {
  it("should pass basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle arrays", () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it("should handle objects", () => {
    const obj = { name: "test", value: 42 };
    expect(obj).toHaveProperty("name", "test");
    expect(obj.value).toBeGreaterThan(40);
  });
});
