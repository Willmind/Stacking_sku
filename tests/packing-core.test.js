const assert = require("node:assert/strict");
const Packing = require("../packing-core.js");

function carton(length, width, height) {
  return { length, width, height };
}

function customContainer(length, width, height) {
  return { id: "CUSTOM", name: "Custom", length, width, height };
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
      [100, 0, 0],
      [200, 0, 0],
      [0, 110, 0],
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

assert.throws(
  () =>
    Packing.calculatePacking(
      customContainer(500, 330, 250),
      carton(0, 100, 100),
    ),
  /positive number/,
);

console.log("packing-core tests passed");
