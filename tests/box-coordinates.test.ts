import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { calculatePacking } from "../src/core/packing";
import { createBoxCoordinateCsv, createBoxCoordinateRows } from "../src/core/boxCoordinates";

function customContainer(length: number, width: number, height: number) {
  return { id: "CUSTOM", name: "Custom", length, width, height };
}

describe("box coordinate rows", () => {
  it("sorts coordinate rows by loading sequence and maps robot coordinates", () => {
    const result = calculatePacking(
      customContainer(400, 200, 200),
      { length: 200, width: 100, height: 100 },
      { cornerBlock: { length: 0, width: 0, height: 0 } },
    );

    const rows = createBoxCoordinateRows(result);

    assert.equal(rows.length, 8);
    assert.deepEqual(
      rows.slice(0, 4).map((row) => [
        row.sequence,
        row.loadingSequence,
        row.doorFaceX,
        row.doorFaceY,
        row.doorFaceZ,
        row.topFaceX,
        row.topFaceY,
        row.topFaceZ,
        row.layer,
        row.row,
        row.column,
      ]),
      [
        [1, 1, 150, 200, 50, 150, 100, 100, 1, 1, 2],
        [2, 2, 50, 200, 50, 50, 100, 100, 1, 1, 1],
        [3, 3, 150, 200, 150, 150, 100, 200, 2, 1, 2],
        [4, 4, 50, 200, 150, 50, 100, 200, 2, 1, 1],
      ],
    );
    assert.deepEqual(
      rows.at(-1),
      {
        sequence: 8,
        loadingSequence: 8,
        sku: "",
        doorFaceX: 50,
        doorFaceY: 400,
        doorFaceZ: 150,
        topFaceX: 50,
        topFaceY: 300,
        topFaceZ: 200,
        centerX: 50,
        centerY: 300,
        centerZ: 150,
        length: 200,
        width: 100,
        height: 100,
        layer: 2,
        row: 2,
        column: 1,
        orientation: "长×宽×高",
      },
    );
  });

  it("exports coordinate rows as an Excel-friendly CSV", () => {
    const result = calculatePacking(
      customContainer(400, 200, 100),
      { length: 200, width: 100, height: 100 },
      { cornerBlock: { length: 0, width: 0, height: 0 } },
    );
    const rows = createBoxCoordinateRows(result);

    const csv = createBoxCoordinateCsv(rows);

    assert.ok(csv.startsWith("\uFEFF序号,装载顺序,SKU,柜门面X,柜门面Y,柜门面Z,上表面X,上表面Y,上表面Z"));
    assert.match(csv, /1,1,,150,200,50,150,100,100,150,100,50,200,100,100,1,1,2/);
  });
});
