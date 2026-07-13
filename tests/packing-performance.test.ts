import { describe, expect, it } from "vitest";
import { CONTAINERS, calculatePacking } from "../src/core/packing";

describe("packing performance benchmark", () => {
  it("在宽松性能预算内完成两组实际基准且结果不回退", () => {
    const startedAt = performance.now();
    const first = calculatePacking(CONTAINERS["40HQ"], { length: 488, width: 380, height: 291 });
    const second = calculatePacking(CONTAINERS["40HQ"], { length: 488, width: 360, height: 291 });
    const elapsed = performance.now() - startedAt;

    expect(first.totalBoxes).toBe(1_349);
    expect(second.totalBoxes).toBe(1_403);
    expect(elapsed).toBeLessThan(4_000);
  });
});
