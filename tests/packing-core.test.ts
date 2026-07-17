import assert from "node:assert/strict";
import { describe, it } from "vitest";
import * as Packing from "../src/core/packing";

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

function footprintKey(position) {
  return `${position.x}:${position.y}:${position.dx}:${position.dy}`;
}

function assertClose(actual, expected, tolerance = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
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

function boxesOverlap3d(a, b) {
  return a.x < b.x + b.dx && a.x + a.dx > b.x && a.y < b.y + b.dy && a.y + a.dy > b.y && a.z < b.z + b.dz && a.z + a.dz > b.z;
}

function assertPositionsFitContainer(result, positions) {
  for (const position of positions) {
    assert.ok(position.x >= 0, "box x should be inside the container");
    assert.ok(position.y >= 0, "box y should be inside the container");
    assert.ok(position.z >= 0, "box z should be inside the container");
    assert.ok(position.x + position.dx <= result.container.length, "box length should fit the container");
    assert.ok(position.y + position.dy <= result.container.width, "box width should fit the container");
    assert.ok(position.z + position.dz <= result.container.height, "box height should fit the container");
  }
}

function assertPositionsRespectClearance(result, positions) {
  const clearance = result.clearance;
  assert.ok(clearance, "result should expose normalized container clearance");
  for (const position of positions) {
    assert.ok(position.x >= clearance.front, "box should respect front clearance");
    assert.ok(position.y >= clearance.left, "box should respect left clearance");
    assert.ok(position.x + position.dx <= result.container.length - clearance.rear, "box should respect rear clearance");
    assert.ok(position.y + position.dy <= result.container.width - clearance.right, "box should respect right clearance");
    assert.ok(position.z + position.dz <= result.container.height - clearance.top, "box should respect top clearance");
  }
}

function assertNoPositionOverlaps(positions) {
  for (let index = 0; index < positions.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < positions.length; nextIndex += 1) {
      assert.equal(boxesOverlap3d(positions[index], positions[nextIndex]), false, `positions ${index} and ${nextIndex} should not overlap`);
    }
  }
}

function assertLoadsFirstLayerBeforeNextLayer(result) {
  const positions = Packing.generateBoxPositions(result, result.totalBoxes);
  const rowGroups = new Map();
  let checkedRows = 0;

  for (const position of positions) {
    const key = `x:${position.x}`;
    if (!rowGroups.has(key)) rowGroups.set(key, []);
    rowGroups.get(key).push(position);
  }

  for (const rowPositions of rowGroups.values()) {
    const firstLayerCount = rowPositions.filter((position) => position.stackIndex === 0).length;
    const firstNextLayerIndex = rowPositions.findIndex((position) => position.stackIndex > 0);
    if (firstNextLayerIndex < 0) continue;
    if (firstLayerCount <= 1) continue;
    checkedRows += 1;

    assert.equal(
      firstNextLayerIndex,
      firstLayerCount,
      "all cartons in a row first layer should load before any carton in that row second layer",
    );
    assert.ok(
      rowPositions.slice(0, firstLayerCount).every((position) => position.stackIndex === 0),
      "each row first loading block should contain only first-layer cartons",
    );
  }

  assert.ok(checkedRows > 0, "expected at least one multi-layer loading row");
}

function assertLoadsCompleteFaceBeforeNextFace(result) {
  const positions = Packing.generateBoxPositions(result, result.totalBoxes);
  const faceGroups = new Map();

  for (const position of positions) {
    const key = `x:${position.x}`;
    if (!faceGroups.has(key)) faceGroups.set(key, []);
    faceGroups.get(key).push(position);
  }

  const faces = Array.from(faceGroups.entries())
    .map(([key, facePositions]) => ({
      key,
      firstSequence: Math.min(...facePositions.map((position) => position.sequenceIndex)),
      lastSequence: Math.max(...facePositions.map((position) => position.sequenceIndex)),
      count: facePositions.length,
    }))
    .sort((first, second) => first.firstSequence - second.firstSequence);

  for (let index = 0; index < faces.length - 1; index += 1) {
    const currentFace = faces[index];
    const nextFace = faces[index + 1];

    assert.equal(
      currentFace.lastSequence - currentFace.firstSequence + 1,
      currentFace.count,
      `${currentFace.key} should be loaded contiguously before the next face`,
    );
    assert.ok(currentFace.lastSequence < nextFace.firstSequence, `${currentFace.key} should be fully stacked before ${nextFace.key}`);
  }
}

function assertMixedWidthLanesPackContiguouslyFromSideWall(result) {
  assert.equal(result.pattern.family, "width-lanes");
  const labels = Array.from(new Set(result.layerPositions.map((position) => position.label)));
  assert.ok(labels.length > 1, "expected a mixed-orientation width-lane pattern");

  const rawLaneBounds = Array.from(
    new Map(
      result.layerPositions.map((position) => [`${position.y}:${position.y + position.dy}`, [position.y, position.y + position.dy]]),
    ).values(),
  ).sort((first, second) => first[0] - second[0]);
  const laneBounds = [];

  for (const bounds of rawLaneBounds) {
    const previous = laneBounds[laneBounds.length - 1];
    if (previous && bounds[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], bounds[1]);
    } else {
      laneBounds.push(bounds);
    }
  }

  assert.equal(laneBounds[0][0], 0, "mixed width lanes should start against one side wall");
  assert.equal(laneBounds.length, 1, "mixed width lanes should not leave internal width gaps");
  assert.equal(
    laneBounds[laneBounds.length - 1][1],
    result.pattern.occupiedWidth,
    "mixed width lane bounds should end at occupied width so remainder stays at the outer container side",
  );
}

function assertValidGeneratedPacking(result) {
  const positions = Packing.generateBoxPositions(result, result.totalBoxes);
  assert.equal(positions.length, result.totalBoxes);
  assertPositionsFitContainer(result, positions);
  assertNoPositionOverlaps(positions);
  assertNoCornerCollisions(result, positions);
  return positions;
}

function assertTailOptimizedSource(result) {
  assert.ok(
    result.layerPositions.some((position) => position.source === "tail-optimized"),
    "expected at least one tail-optimized floor position",
  );
}

describe("packing core", () => {
  it("keeps the lightweight packing summary aligned with full packing results", () => {
    const cases = [
      {
        container: Packing.CONTAINERS["40HQ"],
        carton: carton(488, 380, 291),
      },
      {
        container: Packing.CONTAINERS["40HQ"],
        carton: carton(536, 436, 330),
      },
      {
        container: Packing.CONTAINERS["20GP"],
        carton: carton(2900, 1150, 1150),
        options: { clearance: { front: 100 } },
      },
    ];

    for (const item of cases) {
      const fullResult = Packing.calculatePacking(item.container, item.carton, item.options);
      const summary = Packing.calculatePackingSummary(item.container, item.carton, item.options);

      assert.equal(summary.totalBoxes, fullResult.totalBoxes);
      assert.equal(summary.occupiedLength, fullResult.pattern?.occupiedLength ?? 0);
      assert.equal(summary.occupiedWidth, fullResult.pattern?.occupiedWidth ?? 0);
      assert.equal(summary.usedHeight, fullResult.usedHeight);
    }
  });

  it("matches the static implementation regressions", () => {
    assert.deepEqual(Packing.CONTAINERS["20GP"], {
      id: "20GP",
      name: "20GP",
      length: 5898,
      width: 2352,
      height: 2393,
    });

    {
      const result = Packing.calculatePacking(customContainer(1000, 500, 500), carton(200, 100, 100), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });

      assert.equal(result.totalBoxes, 125);
      assert.equal(result.layers.length, 5);
      assert.equal(result.perLayerBoxCount, 25);
      assert.equal(result.pattern.family, "length-segments");
      assert.equal(result.pattern.occupiedLength, 1000);
      assert.equal(result.pattern.occupiedWidth, 500);
      assertClose(result.utilizationRatio, 1);
    }

    {
      const result = Packing.calculatePacking(customContainer(1000, 500, 100), carton(360, 140, 100), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });

      assert.equal(result.totalBoxes, 9);
      assert.equal(result.pattern.family, "width-lanes");
      assert.equal(result.pattern.lengthFacingCount, 1);
      assert.equal(result.pattern.widthFacingCount, 1);
      assert.equal(result.pattern.occupiedWidth, 500);
      assertMixedWidthLanesPackContiguouslyFromSideWall(result);
    }

    {
      const result = Packing.calculatePacking(customContainer(1000, 500, 200), carton(360, 140, 100), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });

      assert.equal(result.totalBoxes, 18);
      assert.equal(result.pattern.family, "width-lanes");
      assertLoadsFirstLayerBeforeNextLayer(result);
      assertMixedWidthLanesPackContiguouslyFromSideWall(result);
    }

    {
      const result = Packing.calculatePacking(customContainer(500, 330, 250), carton(120, 110, 100));

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
      const result = Packing.calculatePacking(customContainer(300, 220, 200), carton(100, 110, 100), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });
      const positions = Packing.generateBoxPositions(result, 4);

      assert.deepEqual(
        positions.map((box) => [box.x, box.y, box.z]),
        [
          [0, 0, 0],
          [0, 110, 0],
          [0, 0, 100],
          [0, 110, 100],
        ],
      );
    }

    {
      const result = Packing.calculatePacking(customContainer(300, 220, 200), carton(100, 110, 100), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });
      const positions = Packing.generateBoxPositions(result, 4);

      assert.deepEqual(
        positions.map((box) => [box.sequenceIndex, box.faceIndex, box.stackIndex]),
        [
          [0, 0, 0],
          [1, 1, 0],
          [2, 0, 1],
          [3, 1, 1],
        ],
      );
    }

    {
      const result = Packing.calculatePacking(customContainer(1020, 520, 510), carton(200, 100, 100), {
        cornerBlock: { length: 0, width: 0, height: 0 },
        clearance: { front: 10, rear: 10, left: 10, right: 10, top: 10 },
      });
      const positions = Packing.generateBoxPositions(result, result.totalBoxes);

      assert.equal(result.totalBoxes, 125);
      assert.deepEqual(result.clearance, { front: 10, rear: 10, left: 10, right: 10, top: 10 });
      assert.equal(result.container.length, 1020);
      assert.equal(result.effectiveContainer.length, 1000);
      assert.equal(result.effectiveContainer.width, 500);
      assert.equal(result.effectiveContainer.height, 500);
      assert.equal(result.pattern.occupiedLength, 1000);
      assert.equal(result.pattern.occupiedWidth, 500);
      assert.deepEqual(
        positions.slice(0, 2).map((position) => [position.x, position.y, position.z]),
        [
          [10, 10, 0],
          [10, 110, 0],
        ],
      );
      assertPositionsFitContainer(result, positions);
      assertPositionsRespectClearance(result, positions);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(1020, 520, 510),
        [sku("A", 200, 100, 100, 12, "#d8923a"), sku("B", 200, 100, 100, 8, "#42d6a4")],
        {
          strategy: "multi-destination",
          cornerBlock: { length: 0, width: 0, height: 0 },
          clearance: { front: 10, rear: 10, left: 10, right: 10, top: 10 },
        },
      );
      const positions = Packing.generateBoxPositions(result, result.totalBoxes);

      assert.equal(result.totalBoxes, 20);
      assert.deepEqual(summarizeSkuCounts(result), { A: 12, B: 8 });
      assertPositionsFitContainer(result, positions);
      assertPositionsRespectClearance(result, positions);
      assertNoPositionOverlaps(positions);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["40HQ"], carton(488, 380, 291));
      const summary = Packing.calculatePackingSummary(Packing.CONTAINERS["40HQ"], carton(488, 380, 291));

      assert.equal(result.totalBoxes, 1349);
      assert.equal(result.container.id, "40HQ");
      assert.equal(result.usedHeight, 2619);
      assert.equal(result.pattern.occupiedWidth, 2332);
      assert.equal(summary.occupiedWidth, 2332);
      assert.equal(summary.effectiveContainer.width - summary.occupiedWidth, 20);
      assertLoadsFirstLayerBeforeNextLayer(result);
      assertLoadsCompleteFaceBeforeNextFace(result);
      assertMixedWidthLanesPackContiguouslyFromSideWall(result);
      assertTailOptimizedSource(result);
      assertValidGeneratedPacking(result);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["40HQ"], carton(488, 360, 291));

      assert.equal(result.totalBoxes, 1403);
      assert.equal(result.container.id, "40HQ");
      assert.equal(result.usedHeight, 2619);
      assertLoadsFirstLayerBeforeNextLayer(result);
      assertMixedWidthLanesPackContiguouslyFromSideWall(result);
      assert.notEqual(result.pattern.source, "tail-optimized");
      assertValidGeneratedPacking(result);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["40HQ"], carton(509, 418, 338));

      assert.equal(result.totalBoxes, 889);
      assert.equal(result.container.id, "40HQ");
      assert.equal(result.usedHeight, 2366);
      assertLoadsFirstLayerBeforeNextLayer(result);
      assertValidGeneratedPacking(result);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["40HQ"], carton(536, 436, 330));

      assert.equal(result.totalBoxes, 927);
      assert.equal(result.container.id, "40HQ");
      assert.equal(result.usedHeight, 2640);
      assertLoadsFirstLayerBeforeNextLayer(result);
      assertTailOptimizedSource(result);
      assertValidGeneratedPacking(result);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["40HQ"], carton(488, 380, 291), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });

      assert.equal(result.totalBoxes, 1350);
      assertTailOptimizedSource(result);
      assertValidGeneratedPacking(result);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["40HQ"], carton(536, 436, 330), {
        cornerBlock: { length: 0, width: 0, height: 0 },
      });

      assert.equal(result.totalBoxes, 928);
      assertTailOptimizedSource(result);
      assertValidGeneratedPacking(result);
    }

    {
      const result = Packing.calculatePacking(Packing.CONTAINERS["20GP"], carton(495, 395, 310));

      assert.equal(result.totalBoxes, 462);
      assert.equal(result.perLayerBoxCount, 66);
      assert.equal(result.layers.length, 7);
      assert.equal(result.pattern.family, "width-lanes");
      assert.equal(result.pattern.lengthFacingCount, 2);
      assert.equal(result.pattern.widthFacingCount, 3);
      assert.equal(result.pattern.source, "tail-optimized");
      assert.equal(result.pattern.remainderCount, 5);

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);
      assert.equal(positions.length, result.totalBoxes);
      assertNoCornerCollisions(result, positions);
      assertNoPositionOverlaps(positions);

      const tailOptimizedStack = positions.filter((position) => position.source === "tail-optimized");
      assert.ok(tailOptimizedStack.length > 0);
      assert.deepEqual([...new Set(tailOptimizedStack.map((position) => position.stackIndex))], [0, 1, 2, 3, 4, 5, 6]);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(1000, 500, 500),
        [sku("A", 200, 100, 100, 12, "#d8923a"), sku("B", 200, 100, 100, 8, "#42d6a4"), sku("C", 200, 100, 100, 200, "#6e8bff")],
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
      assert.equal(
        result.layers.reduce((sum, layer) => sum + layer.boxCount, 0),
        result.totalBoxes,
      );
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(1000, 500, 500),
        [sku("A", 200, 100, 100, 12, "#d8923a"), sku("B", 200, 100, 100, 8, "#42d6a4")],
        {
          strategy: "multi-destination",
          cornerBlock: { length: 0, width: 0, height: 0 },
        },
      );

      assert.equal(result.totalBoxes, 20);
      assert.equal(
        result.layers.reduce((sum, layer) => sum + layer.boxCount, 0),
        result.totalBoxes,
      );
      assert.ok(result.utilizationRatio < 1);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(600, 200, 200),
        [sku("A", 100, 100, 100, 5, "#d8923a"), sku("B", 100, 100, 100, 4, "#42d6a4")],
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
      assert.deepEqual(
        fullFacesThenTail.map((position) => position.skuLabel),
        ["B", "B", "B", "B", "A"],
      );
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(700, 200, 200),
        [sku("A", 240, 100, 100, 4, "#d8923a"), sku("B", 120, 180, 100, 4, "#42d6a4")],
        {
          strategy: "multi-destination",
          cornerBlock: { length: 0, width: 0, height: 0 },
        },
      );

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);
      const aPositions = positions.filter((position) => position.skuLabel === "A");
      const bPositions = positions.filter((position) => position.skuLabel === "B");

      assert.equal(result.mode, "multi");
      assert.equal(result.totalBoxes, 8);
      assert.deepEqual(summarizeSkuCounts(result), { A: 4, B: 4 });
      assert.deepEqual(
        aPositions.map((position) => [position.dx, position.dy, position.dz]),
        [
          [240, 100, 100],
          [240, 100, 100],
          [240, 100, 100],
          [240, 100, 100],
        ],
      );
      assert.deepEqual(
        bPositions.map((position) => [[position.dx, position.dy].sort((a, b) => a - b), position.dz]),
        [
          [[120, 180], 100],
          [[120, 180], 100],
          [[120, 180], 100],
          [[120, 180], 100],
        ],
      );
      assertPositionsFitContainer(result, positions);
      assertNoPositionOverlaps(positions);
      assertClose(result.utilizationRatio, 0.6514285714);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(1000, 330, 250),
        [sku("A", 120, 110, 100, 22, "#d8923a"), sku("B", 200, 110, 100, 1, "#42d6a4")],
        {
          strategy: "multi-destination",
          cornerBlock: { length: 110, width: 110, height: 80 },
        },
      );

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);
      assert.equal(result.pattern.family, "heterogeneous-zones");
      assert.equal(result.blockedByCornerTotal, 2);
      assertNoCornerCollisions(result, positions);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        Packing.CONTAINERS["20GP"],
        [sku("A", 300, 320, 260, 100, "#d8923a"), sku("B", 500, 320, 260, 100, "#42d6a4")],
        {
          strategy: "multi-destination",
        },
      );

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);
      const aFootprints = result.layerPositions.filter((position) => position.skuLabel === "A");
      const bFootprints = result.layerPositions.filter((position) => position.skuLabel === "B");

      assert.equal(result.totalBoxes, 200);
      assert.deepEqual(summarizeSkuCounts(result), { A: 100, B: 100 });
      assert.equal(aFootprints.length, 14);
      assert.equal(bFootprints.length, 14);
      assert.equal(new Set(aFootprints.map(footprintKey)).size, aFootprints.length);
      assert.equal(new Set(bFootprints.map(footprintKey)).size, bFootprints.length);
      assert.equal(
        result.layerPositions.some((position) => position.adjustedForCorner),
        false,
        "heterogeneous top-view footprints should not be created from corner-avoidance offsets",
      );
      assertPositionsFitContainer(result, positions);
      assertNoPositionOverlaps(positions);
      assertNoCornerCollisions(result, positions);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(1000, 500, 500),
        [sku("A", 200, 100, 100, 12, "#d8923a"), sku("B", 250, 100, 100, 1, "#42d6a4")],
        {
          strategy: "multi-destination",
          cornerBlock: { length: 0, width: 0, height: 0 },
        },
      );
      const positions = Packing.generateBoxPositions(result, 6);

      assert.deepEqual(
        positions.map((position) => [position.skuLabel, position.x, position.y, position.z]),
        [
          ["A", 0, 0, 0],
          ["A", 0, 100, 0],
          ["A", 0, 200, 0],
          ["A", 0, 300, 0],
          ["A", 0, 400, 0],
          ["A", 0, 0, 100],
        ],
      );
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        customContainer(1200, 500, 300),
        [sku("A", 360, 140, 100, 11, "#d8923a"), sku("B", 200, 100, 100, 1, "#42d6a4")],
        {
          strategy: "multi-destination",
          cornerBlock: { length: 0, width: 0, height: 0 },
        },
      );

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);

      assert.equal(result.pattern.family, "heterogeneous-zones");
      assert.equal(result.totalBoxes, 12);
      assertLoadsCompleteFaceBeforeNextFace(result);
      assertPositionsFitContainer(result, positions);
      assertNoPositionOverlaps(positions);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        Packing.CONTAINERS["20GP"],
        [sku("A", 250, 320, 260, 100, "#d8923a"), sku("B", 500, 320, 260, 100, "#42d6a4")],
        {
          strategy: "multi-destination",
        },
      );

      const notes = Packing.describePackingStrategy(result);
      assert.deepEqual(
        notes.map((note) => note.label),
        ["朝向规则", "车厢间隙", "角件避让", "空位回填", "SKU 策略"],
      );
      assert.match(notes.find((note) => note.id === "backfill").detail, /复用/);
      assert.match(notes.find((note) => note.id === "sku").detail, /异尺寸按 SKU 顺序分区/);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        Packing.CONTAINERS["20GP"],
        [sku("A", 250, 320, 260, 100, "#d8923a"), sku("B", 500, 320, 260, 100, "#42d6a4")],
        {
          strategy: "multi-destination",
        },
      );

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);

      assert.equal(result.totalBoxes, 200);
      assert.deepEqual(summarizeSkuCounts(result), { A: 100, B: 100 });
      assertPositionsFitContainer(result, positions);
      assertNoPositionOverlaps(positions);
      assertNoCornerCollisions(result, positions);
    }

    {
      const result = Packing.calculateMultiSkuPacking(
        Packing.CONTAINERS["20GP"],
        [
          sku("A", 677, 443, 388, 80, "#d8923a"),
          sku("B", 491, 518, 332, 44, "#42d6a4"),
          sku("C", 265, 503, 275, 37, "#6e8bff"),
          sku("D", 411, 294, 339, 60, "#f87171"),
        ],
        {
          strategy: "multi-destination",
        },
      );

      const positions = Packing.generateBoxPositions(result, result.totalBoxes);

      assert.equal(result.totalBoxes, 221);
      assert.deepEqual(summarizeSkuCounts(result), { A: 80, B: 44, C: 37, D: 60 });
      assertPositionsFitContainer(result, positions);
      assertNoPositionOverlaps(positions);
      assertNoCornerCollisions(result, positions);
    }

    for (const target of [0.5, 1.5]) {
      assert.throws(
        () =>
          Packing.calculateMultiSkuPacking(
            customContainer(600, 200, 200),
            [sku("A", 100, 100, 100, target, "#d8923a"), sku("B", 100, 100, 100, 1, "#42d6a4")],
            { cornerBlock: { length: 0, width: 0, height: 0 } },
          ),
        /目标数量必须为整数/,
      );
    }

    assert.throws(
      () =>
        Packing.calculateMultiSkuPacking(
          customContainer(600, 300, 300),
          Array.from({ length: 6 }, (_, index) => sku(String.fromCharCode(65 + index), 100, 100, 100, 1, "#d8923a")),
          { cornerBlock: { length: 0, width: 0, height: 0 } },
        ),
      /2 到 5 个 SKU/,
    );

    assert.throws(
      () =>
        Packing.calculateMultiSkuPacking(
          customContainer(600, 200, 200),
          [sku("A", 100, 100, 100, 1, "#d8923a"), sku("A", 100, 100, 100, 1, "#42d6a4")],
          { cornerBlock: { length: 0, width: 0, height: 0 } },
        ),
      /SKU 名称.*不能重复/,
    );

    assert.throws(
      () =>
        Packing.calculateMultiSkuPacking(customContainer(600, 200, 200), [null, sku("B", 100, 100, 100, 1, "#42d6a4")], {
          cornerBlock: { length: 0, width: 0, height: 0 },
        }),
      /SKU.*对象/,
    );

    assert.throws(() => Packing.calculatePacking(customContainer(500, 330, 250), carton(0, 100, 100)), /纸箱长度必须为正数/);

    assert.throws(
      () => Packing.calculatePacking(customContainer(500, 330, 250), carton(100, 100, 100), { clearance: { front: -1 } }),
      /前间隙必须为非负数/,
    );

    assert.throws(
      () => Packing.calculatePacking(customContainer(500, 330, 250), carton(100, 100, 100), { clearance: { front: 300, rear: 200 } }),
      /间隙扣减后的有效柜体长度必须为正数/,
    );
  }, 45000);

  it("supports selected full-free carton orientations", () => {
    const container = customContainer(240, 120, 100);
    const sideOnlyCarton = carton(120, 80, 110);
    const defaultResult = Packing.calculatePacking(container, sideOnlyCarton, {
      cornerBlock: { length: 0, width: 0, height: 0 },
    });

    assert.equal(defaultResult.totalBoxes, 0);

    const sideFaceResult = Packing.calculatePacking(container, sideOnlyCarton, {
      allowedOrientations: ["length-height-width"],
      cornerBlock: { length: 0, width: 0, height: 0 },
    });

    assert.equal(sideFaceResult.totalBoxes, 2);
    assert.deepEqual(
      sideFaceResult.orderedPositions.map((position) => [position.dx, position.dy, position.dz]),
      [
        [120, 110, 80],
        [120, 110, 80],
      ],
    );
    assert.deepEqual([...new Set(sideFaceResult.orderedPositions.map((position) => position.orientationId))], ["length-height-width"]);
    assert.match(Packing.describePackingStrategy(sideFaceResult).find((note) => note.id === "orientation").detail, /长×高×宽/);
  });

  it("validates orientation selections", () => {
    assert.throws(
      () =>
        Packing.calculatePacking(customContainer(500, 330, 250), carton(100, 100, 100), {
          allowedOrientations: [],
        }),
      /至少选择一种纸箱朝向/,
    );

    assert.throws(
      () =>
        Packing.calculatePacking(customContainer(500, 330, 250), carton(100, 100, 100), {
          allowedOrientations: ["bad-orientation"],
        }),
      /纸箱朝向不支持/,
    );
  });
});
