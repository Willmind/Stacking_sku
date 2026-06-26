import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking } from "../src/core/packing";
import {
  createPlan2DSceneModel,
  getPlan2DAxisGuideMetrics,
  getPlan2DVerticalGuideLabelLayout,
  renderPlan2D,
} from "../src/renderers/plan2d";

function createRecordingCanvas(width = 980, height = 620) {
  const drawnText: string[] = [];
  const filledRects: Array<{ fillStyle: string; x: number; y: number; width: number; height: number }> = [];
  const context = {
    fillStyle: "",
    beginPath() {},
    clearRect() {},
    closePath() {},
    fill() {},
    fillRect(x: number, y: number, rectWidth: number, rectHeight: number) {
      filledRects.push({
        fillStyle: this.fillStyle,
        x,
        y,
        width: rectWidth,
        height: rectHeight,
      });
    },
    fillText(text: string) {
      drawnText.push(text);
    },
    lineTo() {},
    measureText(text: string) {
      return { width: text.length * 7 };
    },
    moveTo() {},
    quadraticCurveTo() {},
    restore() {},
    rotate() {},
    save() {},
    setLineDash() {},
    setTransform() {},
    stroke() {},
    strokeRect() {},
    translate() {},
  };
  const canvas = {
    width,
    height,
    getBoundingClientRect() {
      return { width, height };
    },
    getContext(type: string) {
      return type === "2d" ? context : null;
    },
  } as unknown as HTMLCanvasElement;

  return { canvas, drawnText, filledRects };
}

describe("2D plan axis guide metrics", () => {
  it("builds an objectized scene model for the next 2D renderer", () => {
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
    assert.equal(model.container.width > 0, true);
    assert.equal(model.container.height > 0, true);
    assert.ok(model.boxes.length > 0);
    assert.ok(model.boxes.every((box) => box.kind === "carton"));
    assert.ok(model.boxes.some((box) => box.visible));
    assert.ok(model.boxes.every((box) => box.fillStyle.startsWith("rgba(")));
    assert.equal(model.containerOutline.strokeStyle, "rgba(255,255,255,0.78)");
  });

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

  it("keeps top-view width labels aligned with the actual occupied width", () => {
    const result = calculatePacking("40HQ", { length: 488, width: 380, height: 291 });
    const metrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "top");

    assert.equal(result.pattern?.occupiedWidth, 2332);
    assert.deepEqual(metrics.x, {
      count: 55,
      countLabel: "列",
      countText: "横放 24列 / 竖放 29列",
      axisLabel: "柜长",
      occupied: 11996,
      remaining: 36,
    });
    assert.deepEqual(metrics.y, {
      count: 10,
      countLabel: "排",
      axisLabel: "柜宽",
      occupied: 2332,
      remaining: 20,
    });

    const recording = createRecordingCanvas();
    renderPlan2D({
      canvas: recording.canvas,
      result,
      visibleCount: result.totalBoxes,
      viewMode: "top",
      devicePixelRatio: 1,
    });

    assert.ok(recording.drawnText.includes("横放 24列 / 竖放 29列 · 占长 11,996mm · 余量 36mm"));
    assert.ok(!recording.drawnText.includes("横向 55列 · 占长 11,996mm · 余量 36mm"));
    assert.ok(recording.drawnText.includes("占宽 2,332mm"));
    assert.ok(recording.drawnText.includes("余量 20mm"));
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

  it("hides misleading projection counts on mixed-orientation elevation guides", () => {
    const result = calculatePacking("20GP", { length: 120, width: 320, height: 260 });
    const sideMetrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "side");
    const frontMetrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, "front");

    assert.equal(sideMetrics.x.count, 67);
    assert.equal(sideMetrics.x.countLabel, "");
    assert.ok(frontMetrics.x.count < 35);
    assert.equal(frontMetrics.x.countLabel, "");

    const side = createRecordingCanvas();
    renderPlan2D({
      canvas: side.canvas,
      result,
      visibleCount: result.totalBoxes,
      viewMode: "side",
      devicePixelRatio: 1,
    });

    assert.ok(!side.drawnText.some((text) => text.includes("67列")));
    assert.ok(side.drawnText.includes("占长 5,880mm · 余量 18mm"));

    const front = createRecordingCanvas();
    renderPlan2D({
      canvas: front.canvas,
      result,
      visibleCount: result.totalBoxes,
      viewMode: "front",
      devicePixelRatio: 1,
    });

    assert.ok(!front.drawnText.some((text) => text.includes("35排")));
    assert.ok(front.drawnText.includes("占宽 2,352mm · 余量 0mm"));
  }, 12_000);

  it("renders front views from the selected endpoint instead of flattening the full container length", () => {
    const result = calculatePacking("20GP", { length: 120, width: 320, height: 260 });
    const renderFront = (frontViewSide: "corner" | "door") => {
      const recording = createRecordingCanvas();
      renderPlan2D({
        canvas: recording.canvas,
        result,
        visibleCount: result.totalBoxes,
        viewMode: "front",
        frontViewSide,
        devicePixelRatio: 1,
      });
      return {
        ...recording,
        cargoRects: recording.filledRects.filter((rect) => rect.fillStyle.includes("0.82")),
      };
    };

    const corner = renderFront("corner");
    const door = renderFront("door");

    assert.ok(corner.cargoRects.length < 500);
    assert.ok(door.cargoRects.length < 500);
    assert.notEqual(corner.cargoRects.length, door.cargoRects.length);
    assert.ok(corner.drawnText.includes("角件端视角"));
    assert.ok(door.drawnText.includes("柜门视角"));
  }, 12_000);

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
