const assert = require("node:assert/strict");
const Packing = require("../packing-core.js");

function carton(length, width, height) {
  return { length, width, height };
}

function customContainer(length, width, height) {
  return { id: "CUSTOM", name: "Custom", length, width, height };
}

function sku(label, length, width, height, target, color = "#d8923a") {
  return { label, length, width, height, target, color };
}

function summarizeSkuCounts(result) {
  return Object.fromEntries(result.skuSummary.map((item) => [item.label, item.loaded]));
}

function assertClose(actual, expected, tolerance = 0.0001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function assertNoCornerCollisions(result, positions) {
  for (const position of positions) {
    assert.equal(
      Packing.collidesCornerBlock(position, result.container, result.cornerBlock),
      false,
      `position ${position.sequenceIndex ?? "unknown"} intersects a corner fitting`,
    );
  }
}

function assertStartsBottomToTop(result) {
  const positions = Packing.generateBoxPositions(result, 3);
  assert.ok(positions.length >= 3, "expected at least three generated positions");
  assert.equal(positions[0].x, 0);
  assert.equal(positions[0].z, 0);
  assert.equal(positions[1].x, positions[0].x);
  assert.equal(positions[1].y, positions[0].y);
  assert.equal(positions[1].z, result.carton.height);
  assert.equal(positions[2].x, positions[0].x);
  assert.equal(positions[2].y, positions[0].y);
  assert.equal(positions[2].z, result.carton.height * 2);
}

assert.deepEqual(Packing.CONTAINERS["20GP"], {
  id: "20GP",
  name: "20GP",
  length: 5898,
  width: 2352,
  height: 2393,
});

{
  const result = Packing.calculatePacking(
    customContainer(1000, 500, 500),
    carton(200, 100, 100),
    { cornerBlock: { length: 0, width: 0, height: 0 } },
  );

  assert.equal(result.totalBoxes, 125);
  assert.equal(result.layers.length, 5);
  assert.equal(result.perLayerBoxCount, 25);
  assert.equal(result.pattern.family, "length-segments");
  assert.equal(result.pattern.occupiedLength, 1000);
  assert.equal(result.pattern.occupiedWidth, 500);
  assertClose(result.utilizationRatio, 1);
}

{
  const result = Packing.calculatePacking(
    customContainer(1000, 500, 100),
    carton(360, 140, 100),
    { cornerBlock: { length: 0, width: 0, height: 0 } },
  );

  assert.equal(result.totalBoxes, 9);
  assert.equal(result.pattern.family, "width-lanes");
  assert.equal(result.pattern.lengthFacingCount, 1);
  assert.equal(result.pattern.widthFacingCount, 1);
  assert.equal(result.pattern.occupiedWidth, 500);
}

{
  const result = Packing.calculatePacking(
    customContainer(500, 330, 250),
    carton(120, 110, 100),
  );

  assert.equal(result.perLayerBoxCount, 12);
  assert.equal(result.layers.length, 2);
  assert.equal(result.layers[0].boxCount, 12);
  assert.equal(result.layers[1].boxCount, 10);
  assert.equal(result.blockedByCornerTotal, 2);
  assert.equal(result.totalBoxes, 22);

  const positions = Packing.generateBoxPositions(result, result.totalBoxes);
  assert.equal(positions.length, 22);
  assert.equal(
    positions.some((box) => box.blocked),
    false,
    "Generated positions should exclude blocked cartons",
  );
}

{
  const result = Packing.calculatePacking(
    customContainer(300, 220, 200),
    carton(100, 110, 100),
    { cornerBlock: { length: 0, width: 0, height: 0 } },
  );
  const positions = Packing.generateBoxPositions(result, 4);

  assert.deepEqual(
    positions.map((box) => [box.x, box.y, box.z]),
    [
      [0, 0, 0],
      [0, 0, 100],
      [0, 110, 0],
      [0, 110, 100],
    ],
  );
}

{
  const result = Packing.calculatePacking(
    customContainer(300, 220, 200),
    carton(100, 110, 100),
    { cornerBlock: { length: 0, width: 0, height: 0 } },
  );
  const positions = Packing.generateBoxPositions(result, 4);

  assert.deepEqual(
    positions.map((box) => [box.sequenceIndex, box.faceIndex, box.stackIndex]),
    [
      [0, 0, 0],
      [1, 0, 1],
      [2, 1, 0],
      [3, 1, 1],
    ],
  );
}

{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(488, 380, 291),
  );

  assert.equal(result.totalBoxes, 1340);
  assert.equal(result.container.id, "40HQ");
  assert.equal(result.usedHeight, 2619);
  assertStartsBottomToTop(result);
  const positions = Packing.generateBoxPositions(result, result.totalBoxes);
  assert.equal(positions.length, result.totalBoxes);
  assertNoCornerCollisions(result, positions);
}

{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(488, 360, 291),
  );

  assert.equal(result.totalBoxes, 1403);
  assert.equal(result.container.id, "40HQ");
  assert.equal(result.usedHeight, 2619);
  assertStartsBottomToTop(result);
  const positions = Packing.generateBoxPositions(result, result.totalBoxes);
  assert.equal(positions.length, result.totalBoxes);
  assertNoCornerCollisions(result, positions);
}

{
  const result = Packing.calculateMultiSkuPacking(
    customContainer(1000, 500, 500),
    [
      sku("A", 200, 100, 100, 12, "#d8923a"),
      sku("B", 200, 100, 100, 8, "#42d6a4"),
      sku("C", 200, 100, 100, 200, "#6e8bff"),
    ],
    {
      strategy: "multi-destination",
      cornerBlock: { length: 0, width: 0, height: 0 },
    },
  );

  assert.deepEqual(summarizeSkuCounts(result), { A: 12, B: 8, C: 105 });
  assert.equal(result.skuSummary[2].shortfall, 95);
  assert.equal(result.orderedPositions[0].skuLabel, "A");
  assert.equal(result.orderedPositions[11].skuLabel, "A");
  assert.equal(result.orderedPositions[12].skuLabel, "B");
  assert.equal(result.orderedPositions[20].skuLabel, "C");
}

{
  const result = Packing.calculateMultiSkuPacking(
    customContainer(600, 200, 200),
    [
      sku("A", 100, 100, 100, 5, "#d8923a"),
      sku("B", 100, 100, 100, 4, "#42d6a4"),
    ],
    {
      strategy: "same-destination",
      cornerBlock: { length: 0, width: 0, height: 0 },
    },
  );

  assert.deepEqual(summarizeSkuCounts(result), { A: 5, B: 4 });

  const face0 = result.orderedPositions.filter((position) => position.faceIndex === 0);
  assert.equal(new Set(face0.map((position) => position.skuLabel)).size, 1);
  assert.equal(face0[0].skuLabel, "A");

  const fullFacesThenTail = result.orderedPositions.slice(4, 9);
  assert.deepEqual(fullFacesThenTail.map((position) => position.skuLabel), ["B", "B", "B", "B", "A"]);
}

assert.throws(
  () =>
    Packing.calculatePacking(
      customContainer(500, 330, 250),
      carton(0, 100, 100),
    ),
  /positive number/,
);

console.log("packing-core tests passed");
