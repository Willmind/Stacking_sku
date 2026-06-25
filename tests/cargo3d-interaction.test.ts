import assert from "node:assert/strict";
import { describe, it } from "vitest";

type PointerModeInput = {
  button: number;
  shiftKey: boolean;
};

describe("3D cargo interaction controls", () => {
  it("maps robot coordinate axes from the innermost left bottom origin", async () => {
    const module = (await import("../src/renderers/cargo3d")) as {
      getCargoCoordinateAxes?: (container: { length: number; width: number; height: number }) => Array<{
        label: "X" | "Y" | "Z";
        start: [number, number, number];
        end: [number, number, number];
      }>;
    };

    assert.equal(typeof module.getCargoCoordinateAxes, "function");
    const axes = module.getCargoCoordinateAxes({ length: 12000, width: 2400, height: 2600 });
    const xAxis = axes.find((axis) => axis.label === "X");
    const yAxis = axes.find((axis) => axis.label === "Y");
    const zAxis = axes.find((axis) => axis.label === "Z");

    assert.deepEqual(xAxis?.start, [-6, -1.3, -1.2]);
    assert.deepEqual(yAxis?.start, [-6, -1.3, -1.2]);
    assert.deepEqual(zAxis?.start, [-6, -1.3, -1.2]);
    assert.ok((xAxis?.end[2] ?? -Infinity) > -1.2, "X should point across container width");
    assert.ok((yAxis?.end[0] ?? -Infinity) > -6, "Y should point toward the container door");
    assert.ok((zAxis?.end[1] ?? -Infinity) > -1.3, "Z should point upward");
  });

  it("keeps selected cargo render options separate from loading progress", async () => {
    const module = (await import("../src/renderers/cargo3d")) as {
      getSelectedCargoPosition?: (
        positions: Array<{ sequenceIndex?: number }>,
        selectedLoadingSequence?: number,
      ) => { sequenceIndex?: number } | null;
    };

    assert.equal(typeof module.getSelectedCargoPosition, "function");
    assert.equal(module.getSelectedCargoPosition([{ sequenceIndex: 0 }, { sequenceIndex: 7 }], 8)?.sequenceIndex, 7);
    assert.equal(module.getSelectedCargoPosition([{ sequenceIndex: 0 }], 8), null);
    assert.equal(module.getSelectedCargoPosition([{ sequenceIndex: 0 }], undefined), null);
  });

  it("uses left drag for rotation and right or Shift-left drag for panning", async () => {
    const module = (await import("../src/renderers/cargo3d")) as {
      getCargoPointerDragMode?: (event: PointerModeInput) => "pan" | "rotate";
    };

    assert.equal(typeof module.getCargoPointerDragMode, "function");
    assert.equal(module.getCargoPointerDragMode({ button: 0, shiftKey: false }), "rotate");
    assert.equal(module.getCargoPointerDragMode({ button: 0, shiftKey: true }), "pan");
    assert.equal(module.getCargoPointerDragMode({ button: 2, shiftKey: false }), "pan");
  });

  it("rotates horizontally in the natural drag direction", async () => {
    const module = (await import("../src/renderers/cargo3d")) as {
      applyCargoCameraDrag?: (
        state: { yaw: number; pitch: number; panX: number; panY: number },
        mode: "pan" | "rotate",
        dx: number,
        dy: number,
      ) => { yaw: number; pitch: number; panX: number; panY: number };
    };

    assert.equal(typeof module.applyCargoCameraDrag, "function");

    const next = module.applyCargoCameraDrag({ yaw: 1, pitch: 0.7, panX: 0, panY: 0 }, "rotate", 30, 0);

    assert.ok(next.yaw < 1, "dragging right should rotate the cargo view to the right");
    assert.equal(next.panX, 0);
    assert.equal(next.panY, 0);
  });

  it("allows a wider vertical orbit without flipping upside down", async () => {
    const module = (await import("../src/renderers/cargo3d")) as {
      applyCargoCameraDrag?: (
        state: { yaw: number; pitch: number; panX: number; panY: number },
        mode: "pan" | "rotate",
        dx: number,
        dy: number,
      ) => { yaw: number; pitch: number; panX: number; panY: number };
    };

    assert.equal(typeof module.applyCargoCameraDrag, "function");

    const upperView = module.applyCargoCameraDrag({ yaw: 0, pitch: 0.7, panX: 0, panY: 0 }, "rotate", 0, 400);
    const lowerView = module.applyCargoCameraDrag({ yaw: 0, pitch: 0.7, panX: 0, panY: 0 }, "rotate", 0, -400);

    assert.equal(upperView.pitch, 1.48);
    assert.equal(lowerView.pitch, -1.48);
  });
});
