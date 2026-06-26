import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking, generateBoxPositions } from "../src/core/packing";
import { createPlan2DSceneModel, getTopViewFootprintProgress } from "../src/renderers/plan2d";

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

  it("keeps top-view visible cargo synchronized with 3D visible cargo", () => {
    const result = calculatePacking("40HQ", { length: 488, width: 380, height: 291 });
    const visibleCount = 150;
    const model = createPlan2DSceneModel({
      result,
      visibleCount,
      viewMode: "top",
      width: 980,
      height: 620,
      showLabels: false,
    });

    assert.equal(generateBoxPositions(result, visibleCount).length, 150);
    assert.equal(model.boxes.filter((box) => box.visible).length, 150);
  });
});
