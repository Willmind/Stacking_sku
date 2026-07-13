import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking } from "../src/core/packing";
import {
  createPlan2DSceneModel,
  formatPlan2DAxisGuideLines,
  formatPlan2DAxisGuideText,
  getPlan2DAxisGuideMetrics,
  getPlan2DVerticalGuideLabelLayout,
} from "../src/renderers/plan2d";

describe("2D plan axis guide metrics", () => {
  it("builds the Konva scene model from packing results", () => {
    const result = calculatePacking("20GP", { length: 480, width: 320, height: 260 });

    const model = createPlan2DSceneModel({
      result,
      visibleCount: result.totalBoxes,
      viewMode: "top",
      width: 980,
      height: 620,
      showLabels: false,
    });

    assert.equal(model.backend, "plan2d-scene-model");
    assert.equal(model.emptyMessage, undefined);
    assert.equal(model.viewMode, "top");
    assert.ok(model.container.width > 0);
    assert.ok(model.container.height > 0);
    assert.ok(model.boxes.length > 0);
    assert.ok(model.boxes.every((box) => box.kind === "carton"));
    assert.ok(model.boxes.some((box) => box.visible));
    assert.ok(model.boxes.every((box) => box.fillStyle?.startsWith("rgba(")));
    assert.equal(model.containerOutline.strokeStyle, "rgba(255,255,255,0.78)");
  });

  it("summarizes top-view occupied length and width from visible footprints", () => {
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

  it("formats mixed-orientation top-view labels from shared metrics", () => {
    const result = calculatePacking("40HQ", { length: 488, width: 380, height: 291 });
    const metrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "top");

    assert.equal(result.pattern?.occupiedWidth, 2332);
    assert.equal(formatPlan2DAxisGuideText(metrics.x, "x"), "横向 29列 / 竖向 26列 · 占长 11,996mm · 余量 36mm");
    assert.deepEqual(formatPlan2DAxisGuideLines(metrics.y, "y"), ["竖向 10排", "占宽 2,332mm", "余量 20mm"]);
  });

  it("summarizes side-view occupied length and stacked height", () => {
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

  it("hides misleading counts on mixed-orientation elevation guides", () => {
    const result = calculatePacking("20GP", { length: 120, width: 320, height: 260 });
    const sideMetrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "side");
    const frontMetrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "front");

    assert.equal(sideMetrics.x.count, 67);
    assert.equal(sideMetrics.x.countLabel, "");
    assert.ok(frontMetrics.x.count < 35);
    assert.equal(frontMetrics.x.countLabel, "");
    assert.equal(formatPlan2DAxisGuideText(sideMetrics.x, "x"), "占长 5,880mm · 余量 18mm");
    assert.deepEqual(formatPlan2DAxisGuideLines(frontMetrics.x, "x"), ["占宽 2,320mm", "余量 32mm"]);
  }, 12_000);

  it("builds endpoint-specific front-view scene models", () => {
    const result = calculatePacking("20GP", { length: 120, width: 320, height: 260 });
    const createFrontModel = (frontViewSide: "corner" | "door") =>
      createPlan2DSceneModel({
        result,
        visibleCount: result.totalBoxes,
        viewMode: "front",
        frontViewSide,
        width: 980,
        height: 620,
        showLabels: false,
      });

    const corner = createFrontModel("corner");
    const door = createFrontModel("door");

    assert.ok(corner.boxes.length < 500);
    assert.ok(door.boxes.length < 500);
    assert.notEqual(corner.boxes.length, door.boxes.length);
    assert.equal(corner.plane?.directionLabel, "角件端视角");
    assert.equal(door.plane?.directionLabel, "柜门视角");
  }, 12_000);

  it("places the vertical guide label outside the left guide and centers it", () => {
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
