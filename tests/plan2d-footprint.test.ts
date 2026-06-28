import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking, generateBoxPositions } from "../src/core/packing";
import { createPlan2DSceneModel, getTopViewFootprintProgress } from "../src/renderers/plan2d";

describe("2D top-view footprint progress", () => {
  it("tracks the face-first loading order for top-view footprint progress", () => {
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

  it("keeps the 40HQ corner endpoint projection packed without internal width gaps", () => {
    const result = calculatePacking("40HQ", { length: 488, width: 380, height: 291 });
    const model = createPlan2DSceneModel({
      result,
      visibleCount: 577,
      viewMode: "front",
      frontViewSide: "corner",
      width: 980,
      height: 620,
      showLabels: false,
    });
    const visibleBoxes = model.boxes.filter((box) => box.visible);
    const intervalsByLayer = new Map<number, number[][]>();

    for (const box of visibleBoxes) {
      const x = Math.round((box.x - model.origin.x) / model.scale);
      const y = Math.round((box.y - model.origin.y) / model.scale);
      const width = Math.round(box.width / model.scale);
      if (!intervalsByLayer.has(y)) intervalsByLayer.set(y, []);
      intervalsByLayer.get(y)?.push([x, x + width]);
    }

    assert.ok(intervalsByLayer.size > 0);
    for (const intervals of intervalsByLayer.values()) {
      const sortedIntervals = intervals.sort((first, second) => first[0] - second[0]);
      const mergedIntervals: number[][] = [];
      for (const interval of sortedIntervals) {
        const previous = mergedIntervals[mergedIntervals.length - 1];
        if (previous && interval[0] <= previous[1]) {
          previous[1] = Math.max(previous[1], interval[1]);
        } else {
          mergedIntervals.push([...interval]);
        }
      }

      assert.deepEqual(mergedIntervals, [[0, 2332]]);
    }
  });
});
