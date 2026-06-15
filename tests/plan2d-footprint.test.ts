import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking } from "../src/core/packing";
import { getTopViewFootprintProgress } from "../src/renderers/plan2d";

describe("2D top-view footprint progress", () => {
  it("uses loading-order footprint projection instead of layer-major progress", () => {
    const result = calculatePacking("20GP", { length: 480, width: 320, height: 260 });

    assert.equal(getTopViewFootprintProgress(result, 188).visibleFootprints, 21);
    assert.equal(getTopViewFootprintProgress(result, 189).visibleFootprints, 22);
  });

  it("keeps the final top-view footprint count aligned to the base floor slots", () => {
    const result = calculatePacking("20GP", { length: 480, width: 320, height: 260 });

    assert.equal(getTopViewFootprintProgress(result, result.totalBoxes).visibleFootprints, 84);
    assert.equal(getTopViewFootprintProgress(result, result.totalBoxes).totalFootprints, 84);
  });
});
