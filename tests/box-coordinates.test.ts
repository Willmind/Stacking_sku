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
        row.centerX,
        row.centerY,
        row.centerZ,
        row.eulerX,
        row.eulerY,
        row.eulerZ,
        row.layer,
        row.row,
        row.column,
      ]),
      [
        [1, 1, 150, 100, 50, 0, 0, 90, 1, 1, 2],
        [2, 2, 50, 100, 50, 0, 0, 90, 1, 1, 1],
        [3, 3, 150, 100, 150, 0, 0, 90, 2, 1, 2],
        [4, 4, 50, 100, 150, 0, 0, 90, 2, 1, 1],
      ],
    );
    assert.deepEqual(
      rows.at(-1),
      {
        sequence: 8,
        loadingSequence: 8,
        sku: "",
        centerX: 50,
        centerY: 300,
        centerZ: 150,
        eulerX: 0,
        eulerY: 0,
        eulerZ: 90,
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

  it("exports swapped carton orientation as XYZ Euler angles in degrees", () => {
    const result = calculatePacking(
      customContainer(400, 200, 100),
      { length: 200, width: 100, height: 100 },
      {
        cornerBlock: { length: 0, width: 0, height: 0 },
        allowedOrientations: ["width-length-height"],
      },
    );

    const rows = createBoxCoordinateRows(result);

    assert.ok(rows.length > 0);
    assert.deepEqual(
      rows[0],
      {
        sequence: 1,
        loadingSequence: 1,
        sku: "",
        centerX: 100,
        centerY: 50,
        centerZ: 50,
        eulerX: 0,
        eulerY: 0,
        eulerZ: 0,
        length: 100,
        width: 200,
        height: 100,
        layer: 1,
        row: 1,
        column: 1,
        orientation: "宽×长×高",
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

    assert.ok(csv.startsWith("\uFEFF序号,装载顺序,SKU,中心点X,中心点Y,中心点Z,欧拉角X,欧拉角Y,欧拉角Z"));
    assert.doesNotMatch(csv, /柜门面|上表面/);
    assert.match(csv, /1,1,,150,100,50,0,0,90,200,100,100,1,1,2/);
  });
});
