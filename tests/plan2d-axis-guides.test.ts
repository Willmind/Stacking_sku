import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking } from "../src/core/packing";
import { getPlan2DAxisGuideMetrics, getPlan2DVerticalGuideLabelLayout } from "../src/renderers/plan2d";

describe("2D plan axis guide metrics", () => {
  it("summarizes top-view occupied length and width from the visible footprints", () => {
    const result = calculatePacking("20GP", { length: 480, width: 320, height: 260 });

    const metrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "top");

    assert.deepEqual(metrics.x, {
      count: 12,
      countLabel: "列",
      axisLabel: "柜长",
      occupied: 5760,
      remaining: 138,
    });
    assert.deepEqual(metrics.y, {
      count: 7,
      countLabel: "排",
      axisLabel: "柜宽",
      occupied: 2240,
      remaining: 112,
    });
  });

  it("summarizes side-view occupied length and stacked height from the visible boxes", () => {
    const result = calculatePacking("20GP", { length: 480, width: 320, height: 260 });

    const metrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "side");

    assert.deepEqual(metrics.x, {
      count: 12,
      countLabel: "列",
      axisLabel: "柜长",
      occupied: 5760,
      remaining: 138,
    });
    assert.deepEqual(metrics.y, {
      count: 9,
      countLabel: "层",
      axisLabel: "柜高",
      occupied: 2340,
      remaining: 53,
    });
  });

  it("places the vertical guide label outside the left guide and centers it on the occupied span", () => {
    const layout = getPlan2DVerticalGuideLabelLayout({
      lines: ["7排", "占宽 2,240mm", "余量 112mm"],
      yGuideX: 180,
      yStart: 120,
      yEnd: 420,
      canvasWidth: 1200,
      canvasHeight: 640,
      measureText: (text) => text.length * 8,
    });

    assert.equal(layout.x + layout.width, 168);
    assert.equal(layout.y + layout.height / 2, 270);
  });
});
