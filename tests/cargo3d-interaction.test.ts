import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { getCargoCoordinateAxes, getSelectedCargoPosition } from "../src/renderers/cargo3d";

describe("3D cargo interaction controls", () => {
  it("maps robot coordinate axes from the corner-end right-bottom origin", () => {
    const axes = getCargoCoordinateAxes({ length: 12000, width: 2400, height: 2600 });
    const xAxis = axes.find((axis) => axis.label === "X");
    const yAxis = axes.find((axis) => axis.label === "Y");
    const zAxis = axes.find((axis) => axis.label === "Z");

    assert.deepEqual(xAxis?.start, [-6, -1.3, 1.2]);
    assert.deepEqual(yAxis?.start, [-6, -1.3, 1.2]);
    assert.deepEqual(zAxis?.start, [-6, -1.3, 1.2]);
    assert.ok((xAxis?.end[2] ?? Infinity) < 1.2, "X should point across container width from right to left");
    assert.ok((yAxis?.end[0] ?? -Infinity) > -6, "Y should point toward the container door");
    assert.ok((zAxis?.end[1] ?? -Infinity) > -1.3, "Z should point upward");
  });

  it("keeps selected cargo lookup separate from loading progress", () => {
    assert.equal(getSelectedCargoPosition([{ sequenceIndex: 0 }, { sequenceIndex: 7 }], 8)?.sequenceIndex, 7);
    assert.equal(getSelectedCargoPosition([{ sequenceIndex: 0 }], 8), null);
    assert.equal(getSelectedCargoPosition([{ sequenceIndex: 0 }], undefined), null);
  });
});
