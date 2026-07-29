import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { CARTON_ORIENTATION_OPTIONS, calculatePacking } from "../src/core/packing";
import { createBoxCoordinateCsv, createBoxCoordinateRows } from "../src/core/boxCoordinates";

function customContainer(length: number, width: number, height: number) {
  return { id: "CUSTOM", name: "Custom", length, width, height };
}

describe("box coordinate rows", () => {
  it("keeps the total ID order and maps the far-door left-bottom corner to negative robot coordinates", () => {
    const result = calculatePacking(
      customContainer(400, 200, 200),
      { length: 200, width: 100, height: 100 },
      { cornerBlock: { length: 0, width: 0, height: 0 } },
    );

    const rows = createBoxCoordinateRows(result);

    assert.equal(rows.length, 8);
    assert.deepEqual(
      rows
        .slice(0, 4)
        .map((row) => [
          row.totalId,
          row.length,
          row.width,
          row.height,
          row.x,
          row.y,
          row.z,
          row.a,
          row.b,
          row.c,
          row.layer,
          row.row,
          row.rowSequence,
        ]),
      [
        [1, 200, 100, 100, 0, -100, 0, 0, 0, 180, 1, 1, 1],
        [2, 200, 100, 100, 0, 0, 0, 0, 0, 180, 1, 1, 2],
        [3, 200, 100, 100, 0, -100, 100, 0, 0, 180, 2, 1, 3],
        [4, 200, 100, 100, 0, 0, 100, 0, 0, 180, 2, 1, 4],
      ],
    );
    assert.deepEqual([rows[4].totalId, rows[4].row, rows[4].rowSequence], [5, 2, 1]);
    assert.deepEqual(rows.at(-1), {
      totalId: 8,
      sku: "",
      length: 200,
      width: 100,
      height: 100,
      x: -200,
      y: 0,
      z: 100,
      a: 0,
      b: 0,
      c: 180,
      layer: 2,
      row: 2,
      rowSequence: 4,
      orientation: "长×宽×高",
    });
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
    assert.deepEqual(rows[0], {
      totalId: 1,
      sku: "",
      length: 200,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      z: 0,
      a: 0,
      b: 0,
      c: 90,
      layer: 1,
      row: 1,
      rowSequence: 1,
      orientation: "宽×长×高",
    });
  });

  it("keeps the original carton dimensions for every supported orientation", () => {
    for (const orientation of CARTON_ORIENTATION_OPTIONS) {
      const result = calculatePacking(
        customContainer(400, 400, 400),
        { length: 200, width: 150, height: 100 },
        {
          cornerBlock: { length: 0, width: 0, height: 0 },
          allowedOrientations: [orientation.id],
        },
      );

      const row = createBoxCoordinateRows(result)[0];
      assert.deepEqual([row.length, row.width, row.height], [200, 150, 100], `${orientation.id} should preserve the carton dimensions`);
      assert.ok([row.a, row.b, row.c].every(Number.isFinite), `${orientation.id} should export finite Euler angles`);
    }
  });

  it("exports coordinate rows as an Excel-friendly CSV", () => {
    const result = calculatePacking(
      customContainer(400, 200, 100),
      { length: 200, width: 100, height: 100 },
      { cornerBlock: { length: 0, width: 0, height: 0 } },
    );
    const rows = createBoxCoordinateRows(result);

    const csv = createBoxCoordinateCsv(rows);

    assert.ok(csv.startsWith("\uFEFF总ID,SKU,长,宽,高,X,Y,Z,A,B,C,所属层,所属排,排内ID"));
    assert.doesNotMatch(csv, /中心点|柜门面|上表面/);
    assert.match(csv, /1,,200,100,100,0,-100,0,0,0,180,1,1,1/);
  });
});
