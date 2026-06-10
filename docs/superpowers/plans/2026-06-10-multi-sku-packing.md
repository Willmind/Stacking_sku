# Multi-SKU Packing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-SKU maximum loading, multi-SKU target loading, confirmed corner-fitting avoidance, and true loading-order animation to the static container packing app.

**Architecture:** Keep the app as a no-build static site. Put all packing rules, corner avoidance, generated positions, and SKU allocation in `packing-core.js`; keep `app.js` responsible for DOM state, canvas drawing, Three.js rendering, and user interaction. Preserve the existing `calculatePacking(container, carton, options)` API for single-SKU callers, and add `calculateMultiSkuPacking(container, skus, options)` for multi-SKU mode.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Three.js from the existing CDN script tag, Node built-in `assert` tests.

---

## File Structure

- Modify `packing-core.js`: keep the UMD wrapper; add ordered position generation, explainable candidate scoring, local corner-fitting avoidance, and multi-SKU allocation.
- Modify `tests/packing-core.test.js`: add regression tests for the two real 40HQ cases, loading order, corner collisions, and both multi-SKU strategies.
- Modify `index.html`: add mode controls, multi-SKU strategy controls, dynamic SKU host elements, and SKU breakdown containers.
- Modify `styles.css`: style mode controls, SKU cards, drag handles, target/actual breakdown, swatches, and denser responsive layouts.
- Modify `app.js`: manage SKU UI state, drag sorting, calls to single or multi-SKU core APIs, 2D color rendering, 3D per-SKU colors, and updated progress behavior.

## Task 1: Add Single-SKU Regression Tests

**Files:**
- Modify: `tests/packing-core.test.js`

- [ ] **Step 1: Add helper assertions after `assertClose`.**

```js
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
```

- [ ] **Step 2: Add the two real-data regression blocks before the existing `assert.throws` block.**

```js
{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(488, 380, 291),
  );

  assert.equal(result.totalBoxes, 1340);
  assert.equal(result.container.id, "40HQ");
  assert.equal(result.usedHeight, 2619);
  assertStartsBottomToTop(result);
  assertNoCornerCollisions(result, Packing.generateBoxPositions(result, result.totalBoxes));
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
  assertNoCornerCollisions(result, Packing.generateBoxPositions(result, result.totalBoxes));
}
```

- [ ] **Step 3: Run the tests and confirm the new regression fails against the old algorithm.**

Run: `node tests/packing-core.test.js`

Expected: FAIL with an assertion near `1330 !== 1340` for the `488 x 380 x 291` case.

- [ ] **Step 4: Commit the failing regression tests.**

```bash
git add tests/packing-core.test.js
git commit -m "test: add real packing regressions"
```

## Task 2: Add Ordered Position Result Shape

**Files:**
- Modify: `packing-core.js`
- Modify: `tests/packing-core.test.js`

- [ ] **Step 1: Add a compatibility test that every generated position has sequence metadata.**

Insert this block before `assert.throws`:

```js
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
```

- [ ] **Step 2: Run the tests and confirm sequence metadata is missing.**

Run: `node tests/packing-core.test.js`

Expected: FAIL because current generated boxes do not include `sequenceIndex`, `faceIndex`, or `stackIndex`.

- [ ] **Step 3: Add ordered-position helpers in `packing-core.js` before `evaluateCandidate`.**

```js
function assignSequenceIndexes(positions) {
  return positions.map((position, sequenceIndex) => ({
    ...position,
    sequenceIndex,
  }));
}

function createStackedFacePositions(basePosition, faceIndex, layerCount, container, cornerBlock) {
  const positions = [];

  for (let stackIndex = 0; stackIndex < layerCount; stackIndex += 1) {
    const position = {
      ...basePosition,
      z: stackIndex * basePosition.dz,
      faceIndex,
      stackIndex,
    };

    if (!collidesCornerBlock(position, container, cornerBlock)) {
      positions.push(position);
    }
  }

  return positions;
}

function orderFloorPositionsForLoading(floorPositions) {
  return floorPositions.slice().sort((a, b) => a.x - b.x || a.y - b.y);
}

function createOrderedPositionsFromFloor(container, carton, cornerBlock, floorPositions) {
  const layerCount = Math.floor(container.height / carton.height);
  const orderedFloor = orderFloorPositionsForLoading(floorPositions);
  const positions = [];

  orderedFloor.forEach((basePosition, faceIndex) => {
    positions.push(
      ...createStackedFacePositions(basePosition, faceIndex, layerCount, container, cornerBlock),
    );
  });

  return assignSequenceIndexes(positions);
}
```

- [ ] **Step 4: Update `evaluateCandidate` to store `orderedPositions` and derive counts from it.**

Replace the final result construction inside `evaluateCandidate` with this shape:

```js
const orderedPositions = createOrderedPositionsFromFloor(
  container,
  carton,
  cornerBlock,
  basePositions,
);
const totalBoxes = orderedPositions.length;
const blockedByCornerTotal = basePositions.length * layerCount - totalBoxes;
const layers = [];

for (let index = 0; index < layerCount; index += 1) {
  const z = index * carton.height;
  const boxCount = orderedPositions.filter((box) => box.stackIndex === index).length;
  layers.push({
    index,
    z,
    boxCount,
    blockedByCorner: basePositions.length - boxCount,
  });
}

const volumeLoaded = totalBoxes * carton.length * carton.width * carton.height;
const containerVolume = container.length * container.width * container.height;

return {
  container,
  carton,
  cornerBlock,
  pattern,
  layerPositions: basePositions,
  orderedPositions,
  perLayerBoxCount: basePositions.length,
  layers,
  totalBoxes,
  blockedByCornerTotal,
  usedHeight: layerCount * carton.height,
  utilizationRatio: containerVolume > 0 ? volumeLoaded / containerVolume : 0,
};
```

- [ ] **Step 5: Update `generateBoxPositions` to consume the ordered sequence.**

```js
function generateBoxPositions(result, visibleCount = result.totalBoxes) {
  const limit = Math.max(0, Math.min(result.totalBoxes, Math.floor(visibleCount)));
  if (!result.pattern || limit === 0) return [];
  if (Array.isArray(result.orderedPositions)) {
    return result.orderedPositions.slice(0, limit);
  }
  return [];
}
```

- [ ] **Step 6: Run tests and confirm metadata tests pass while the real count regression still fails.**

Run: `node tests/packing-core.test.js`

Expected: FAIL remains on the `488 x 380 x 291` total count assertion.

- [ ] **Step 7: Commit the ordered position shape.**

```bash
git add packing-core.js tests/packing-core.test.js
git commit -m "feat: add ordered packing positions"
```

## Task 3: Add Door-Side Remainder Candidate Search

**Files:**
- Modify: `packing-core.js`

- [ ] **Step 1: Add a small rectangle helper block before candidate creation functions.**

```js
function rectanglesOverlap(a, b) {
  return intersects(a.x, a.dx, b.x, b.dx) && intersects(a.y, a.dy, b.y, b.dy);
}

function floorRectFromPosition(position) {
  return {
    x: position.x,
    y: position.y,
    dx: position.dx,
    dy: position.dy,
  };
}

function positionFitsFloor(position, container) {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + position.dx <= container.length &&
    position.y + position.dy <= container.width
  );
}

function overlapsAnyFloorRect(position, occupiedRects) {
  const rect = floorRectFromPosition(position);
  return occupiedRects.some((occupied) => rectanglesOverlap(rect, occupied));
}
```

- [ ] **Step 2: Add a door-side remainder filler after `createLayerPositions`.**

```js
function createDoorSideRemainderPositions(container, carton, occupiedPositions) {
  const orientations = Object.values(getOrientations(carton));
  const occupiedRects = occupiedPositions.map(floorRectFromPosition);
  const candidates = [];

  for (const orientation of orientations) {
    const xStarts = Array.from(
      new Set(
        occupiedRects
          .map((rect) => rect.x + rect.dx)
          .filter((x) => x >= 0 && x + orientation.x <= container.length),
      ),
    ).sort((a, b) => a - b);

    for (const x of xStarts) {
      for (let y = 0; y + orientation.y <= container.width; y += orientation.y) {
        const position = {
          x,
          y,
          z: 0,
          dx: orientation.x,
          dy: orientation.y,
          dz: carton.height,
          orientationId: orientation.id,
          label: orientation.label,
          source: "door-remainder",
        };

        if (positionFitsFloor(position, container) && !overlapsAnyFloorRect(position, occupiedRects)) {
          candidates.push(position);
        }
      }
    }
  }

  return candidates
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .reduce((accepted, candidate) => {
      const acceptedRects = accepted.map(floorRectFromPosition);
      if (!overlapsAnyFloorRect(candidate, acceptedRects)) {
        accepted.push(candidate);
      }
      return accepted;
    }, []);
}
```

- [ ] **Step 3: Add truncated width-lane candidates in `enumerateCandidates`.**

Inside the width-lane enumeration loop, after creating the normal max-count candidate, add reduced-row variants:

```js
const baseCandidate = createWidthCandidate(container, orientations, lengthCount, widthCount, "length-first");
candidates.push(baseCandidate);

for (let reduceWidthRows = 1; reduceWidthRows <= 2; reduceWidthRows += 1) {
  const reduced = createWidthCandidate(container, orientations, lengthCount, widthCount, "length-first");
  const reducedUnits = reduced.units.map((unit) => {
    if (unit.orientationId !== "width") return unit;
    return {
      ...unit,
      acrossCount: Math.max(0, unit.acrossCount - reduceWidthRows),
    };
  });
  const basePositions = createLayerPositions({ ...reduced, units: reducedUnits }, carton.height);
  const extraPositions = createDoorSideRemainderPositions(container, carton, basePositions);
  const combinedUnits = reducedUnits;

  candidates.push({
    ...reduced,
    units: combinedUnits,
    extraLayerPositions: extraPositions,
    perLayerBoxCount: basePositions.length + extraPositions.length,
    occupiedLength: container.length,
  });
}
```

Then update `evaluateCandidate` so base positions include `pattern.extraLayerPositions`:

```js
const basePositions = [
  ...createLayerPositions(pattern, carton.height),
  ...(pattern.extraLayerPositions || []),
].sort((a, b) => a.x - b.x || a.y - b.y);
```

- [ ] **Step 4: Remove duplicate normal candidate pushes created by the refactor.**

Run this search:

Run: `rg -n "createWidthCandidate|candidates.push\\(baseCandidate|candidates.push\\(createWidthCandidate" packing-core.js`

Expected: each width-lane branch pushes one normal candidate plus reduced variants; no identical normal candidate is pushed twice.

- [ ] **Step 5: Run tests and confirm the `488 x 380 x 291` result improves.**

Run: `node tests/packing-core.test.js`

Expected: FAIL with `1339 !== 1340` for the `488 x 380 x 291` case. This confirms the door-side remainder candidate added the missing floor position pattern, while the top corner-fitting adjustment still needs to recover one affected carton.

- [ ] **Step 6: Commit the remainder candidate search.**

```bash
git add packing-core.js
git commit -m "feat: search door-side packing remainders"
```

## Task 4: Add Local Corner-Fitting Adjustment

**Files:**
- Modify: `packing-core.js`

- [ ] **Step 1: Add a legal top-band nudge helper before `createStackedFacePositions`.**

```js
function createCornerAvoidanceNudges(box, container, cornerBlock) {
  const candidates = [box];
  const yStarts = [
    0,
    cornerBlock.width,
    container.width - cornerBlock.width - box.dy,
    container.width - box.dy,
  ];

  for (const y of yStarts) {
    candidates.push({
      ...box,
      y,
      adjustedForCorner: y !== box.y,
    });
  }

  return candidates.filter((candidate, index, list) => {
    const key = `${candidate.x}:${candidate.y}:${candidate.z}:${candidate.dx}:${candidate.dy}`;
    return (
      candidate.x >= 0 &&
      candidate.y >= 0 &&
      candidate.x + candidate.dx <= container.length &&
      candidate.y + candidate.dy <= container.width &&
      list.findIndex((item) => `${item.x}:${item.y}:${item.z}:${item.dx}:${item.dy}` === key) === index
    );
  });
}

function findCornerSafePosition(position, acceptedInStackBand, container, cornerBlock) {
  for (const candidate of createCornerAvoidanceNudges(position, container, cornerBlock)) {
    if (collidesCornerBlock(candidate, container, cornerBlock)) continue;
    if (overlapsAnyFloorRect(candidate, acceptedInStackBand.map(floorRectFromPosition))) continue;
    return candidate;
  }
  return null;
}
```

- [ ] **Step 2: Update `createStackedFacePositions` to nudge only the affected top stack positions.**

Use this body:

```js
function createStackedFacePositions(basePosition, faceIndex, layerCount, container, cornerBlock) {
  const positions = [];
  const acceptedByStack = new Map();

  for (let stackIndex = 0; stackIndex < layerCount; stackIndex += 1) {
    const position = {
      ...basePosition,
      z: stackIndex * basePosition.dz,
      faceIndex,
      stackIndex,
    };
    const stackPositions = acceptedByStack.get(stackIndex) || [];
    const safePosition = findCornerSafePosition(position, stackPositions, container, cornerBlock);

    if (safePosition) {
      stackPositions.push(safePosition);
      acceptedByStack.set(stackIndex, stackPositions);
      positions.push(safePosition);
    }
  }

  return positions;
}
```

- [ ] **Step 3: Run real-data tests.**

Run: `node tests/packing-core.test.js`

Expected: PASS for:

```text
40HQ + 488 x 380 x 291 = 1340
40HQ + 488 x 360 x 291 = 1403
```

If the `488 x 380 x 291` result is `1339`, inspect the chosen reduced width-lane candidate and allow `reduceWidthRows = 1` candidates to compete before max-row candidates in `compareResults` when `totalBoxes` is higher after corner adjustment.

- [ ] **Step 4: Commit corner adjustment.**

```bash
git add packing-core.js
git commit -m "feat: adjust top cartons around corner fittings"
```

## Task 5: Add Multi-SKU Allocation Tests

**Files:**
- Modify: `tests/packing-core.test.js`

- [ ] **Step 1: Add SKU helper functions after `customContainer`.**

```js
function sku(label, length, width, height, target, color = "#d8923a") {
  return { label, length, width, height, target, color };
}

function summarizeSkuCounts(result) {
  return Object.fromEntries(result.skuSummary.map((item) => [item.label, item.loaded]));
}
```

- [ ] **Step 2: Add multi-destination allocation tests before `assert.throws`.**

```js
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
```

- [ ] **Step 3: Add same-destination full-face allocation tests before `assert.throws`.**

```js
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

  const remainder = result.orderedPositions.slice(4, 9);
  assert.deepEqual(remainder.map((position) => position.skuLabel), ["A", "B", "B", "B", "B"]);
}
```

- [ ] **Step 4: Run tests and confirm the multi-SKU API is missing.**

Run: `node tests/packing-core.test.js`

Expected: FAIL with `Packing.calculateMultiSkuPacking is not a function`.

- [ ] **Step 5: Commit failing multi-SKU tests.**

```bash
git add tests/packing-core.test.js
git commit -m "test: add multi-sku allocation coverage"
```

## Task 6: Implement Multi-SKU Core API

**Files:**
- Modify: `packing-core.js`

- [ ] **Step 1: Add strategy constants and SKU normalization after `DEFAULT_CORNER_BLOCK`.**

```js
const LOADING_STRATEGIES = {
  MULTI_DESTINATION: "multi-destination",
  SAME_DESTINATION: "same-destination",
};

function normalizeSku(input, index) {
  const label = input.label || String.fromCharCode(65 + index);
  return {
    label,
    length: positiveNumber(input.length, `${label} carton length`),
    width: positiveNumber(input.width, `${label} carton width`),
    height: positiveNumber(input.height, `${label} carton height`),
    target: Math.floor(positiveNumber(input.target, `${label} target quantity`)),
    color: input.color || "#d8923a",
  };
}

function normalizeSkus(inputs) {
  if (!Array.isArray(inputs) || inputs.length < 2 || inputs.length > 10) {
    throw new Error("multi-SKU mode requires 2 to 10 SKUs");
  }
  return inputs.map(normalizeSku);
}
```

- [ ] **Step 2: Add SKU summary helper before `calculatePacking`.**

```js
function summarizeSkuAllocation(skus, positions) {
  return skus.map((sku) => {
    const loaded = positions.filter((position) => position.skuLabel === sku.label).length;
    return {
      label: sku.label,
      color: sku.color,
      target: sku.target,
      loaded,
      shortfall: Math.max(0, sku.target - loaded),
    };
  });
}
```

- [ ] **Step 3: Add multi-destination assignment.**

```js
function assignMultiDestinationSkus(positions, skus) {
  const assigned = positions.map((position) => ({ ...position }));
  let cursor = 0;

  for (const sku of skus) {
    let loaded = 0;
    while (cursor < assigned.length && loaded < sku.target) {
      assigned[cursor] = {
        ...assigned[cursor],
        skuLabel: sku.label,
        skuColor: sku.color,
      };
      cursor += 1;
      loaded += 1;
    }
  }

  return assigned.filter((position) => position.skuLabel);
}
```

- [ ] **Step 4: Add same-destination assignment.**

```js
function groupPositionsByFace(positions) {
  const groups = new Map();
  for (const position of positions) {
    if (!groups.has(position.faceIndex)) groups.set(position.faceIndex, []);
    groups.get(position.faceIndex).push(position);
  }
  return Array.from(groups.values()).map((group) =>
    group.slice().sort((a, b) => a.stackIndex - b.stackIndex || a.y - b.y),
  );
}

function assignSameDestinationSkus(positions, skus) {
  const faces = groupPositionsByFace(positions);
  const fullFaceAssignments = [];
  const remainderPositions = [];
  const remainingBySku = skus.map((sku) => ({ ...sku, remaining: sku.target }));

  for (const skuState of remainingBySku) {
    for (const face of faces) {
      if (face.assigned) continue;
      if (skuState.remaining >= face.length) {
        face.assigned = true;
        skuState.remaining -= face.length;
        fullFaceAssignments.push(
          ...face.map((position) => ({
            ...position,
            skuLabel: skuState.label,
            skuColor: skuState.color,
          })),
        );
      }
    }
  }

  for (const face of faces) {
    if (!face.assigned) remainderPositions.push(...face);
  }

  const assignedRemainders = [];
  let cursor = 0;
  for (const skuState of remainingBySku) {
    while (cursor < remainderPositions.length && skuState.remaining > 0) {
      assignedRemainders.push({
        ...remainderPositions[cursor],
        skuLabel: skuState.label,
        skuColor: skuState.color,
      });
      cursor += 1;
      skuState.remaining -= 1;
    }
  }

  return assignSequenceIndexes([...fullFaceAssignments, ...assignedRemainders]);
}
```

- [ ] **Step 5: Add `calculateMultiSkuPacking`.**

```js
function calculateMultiSkuPacking(containerInput, skuInputs, options = {}) {
  const skus = normalizeSkus(skuInputs);
  const strategy = options.strategy || LOADING_STRATEGIES.MULTI_DESTINATION;
  if (!Object.values(LOADING_STRATEGIES).includes(strategy)) {
    throw new Error("strategy must be multi-destination or same-destination");
  }

  const firstSku = skus[0];
  const baseResult = calculatePacking(
    containerInput,
    { length: firstSku.length, width: firstSku.width, height: firstSku.height },
    options,
  );
  const sourcePositions = baseResult.orderedPositions || [];
  const assignedPositions =
    strategy === LOADING_STRATEGIES.SAME_DESTINATION
      ? assignSameDestinationSkus(sourcePositions, skus)
      : assignMultiDestinationSkus(sourcePositions, skus);
  const skuSummary = summarizeSkuAllocation(skus, assignedPositions);

  return {
    ...baseResult,
    mode: "multi",
    strategy,
    skus,
    orderedPositions: assignedPositions,
    totalBoxes: assignedPositions.length,
    skuSummary,
  };
}
```

- [ ] **Step 6: Export the new API.**

```js
return {
  CONTAINERS,
  DEFAULT_CORNER_BLOCK,
  LOADING_STRATEGIES,
  calculatePacking,
  calculateMultiSkuPacking,
  generateBoxPositions,
  collidesCornerBlock,
};
```

- [ ] **Step 7: Run tests.**

Run: `node tests/packing-core.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the multi-SKU core API.**

```bash
git add packing-core.js
git commit -m "feat: add multi-sku allocation"
```

## Task 7: Add Multi-SKU Form Controls

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] **Step 1: Add mode, strategy, and SKU host markup in `index.html`.**

Replace the single `纸箱规格` fieldset with:

```html
<fieldset>
  <legend>码垛模式</legend>
  <div class="segmented-control" role="radiogroup" aria-label="码垛模式">
    <label>
      <input type="radio" name="packing-mode" value="single" checked />
      单 SKU
    </label>
    <label>
      <input type="radio" name="packing-mode" value="multi" />
      多 SKU
    </label>
  </div>
  <label id="sku-count-row" class="range-row hidden">
    SKU 个数
    <input id="sku-count" type="range" min="2" max="10" value="2" />
    <strong id="sku-count-value">2</strong>
  </label>
  <label id="sku-strategy-row" class="hidden">
    装载策略
    <select id="sku-strategy">
      <option value="multi-destination">分客户/多卸货地</option>
      <option value="same-destination">同客户/同卸货地</option>
    </select>
  </label>
</fieldset>

<fieldset>
  <legend>纸箱规格</legend>
  <div id="single-sku-fields" class="triple-grid">
    <label>
      长 mm
      <input id="carton-length" type="number" min="1" step="1" value="480" />
    </label>
    <label>
      宽 mm
      <input id="carton-width" type="number" min="1" step="1" value="320" />
    </label>
    <label>
      高 mm
      <input id="carton-height" type="number" min="1" step="1" value="260" />
    </label>
  </div>
  <div id="sku-list" class="sku-list hidden" aria-label="SKU 列表"></div>
</fieldset>
```

Add this inside `.summary-stack` after `.detail-list`:

```html
<section id="sku-breakdown" class="sku-breakdown hidden" aria-label="SKU 装载结果"></section>
```

- [ ] **Step 2: Add styles.**

Append this block near the form styles:

```css
.hidden {
  display: none !important;
}

.segmented-control {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.segmented-control label,
.range-row {
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--field);
  padding: 9px 10px;
}

.range-row {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  margin-top: 10px;
}

.sku-list {
  display: grid;
  gap: 10px;
}

.sku-card {
  display: grid;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 12px;
}

.sku-card-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
}

.drag-handle {
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.08);
  cursor: grab;
}

.sku-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.sku-breakdown {
  display: grid;
  gap: 8px;
}

.sku-breakdown-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
}

.sku-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.46);
}
```

- [ ] **Step 3: Add app state fields in `app.js`.**

Extend `elements`:

```js
packingMode: document.querySelectorAll("input[name='packing-mode']"),
skuCountRow: $("#sku-count-row"),
skuCount: $("#sku-count"),
skuCountValue: $("#sku-count-value"),
skuStrategyRow: $("#sku-strategy-row"),
skuStrategy: $("#sku-strategy"),
singleSkuFields: $("#single-sku-fields"),
skuList: $("#sku-list"),
skuBreakdown: $("#sku-breakdown"),
```

Extend `state`:

```js
mode: "single",
skus: [
  { id: crypto.randomUUID(), length: 480, width: 320, height: 260, target: 100, color: "#d8923a" },
  { id: crypto.randomUUID(), length: 480, width: 320, height: 260, target: 100, color: "#42d6a4" },
],
draggedSkuId: null,
```

- [ ] **Step 4: Add SKU rendering helpers in `app.js`.**

```js
function relabelSkus() {
  state.skus = state.skus.map((sku, index) => ({
    ...sku,
    label: String.fromCharCode(65 + index),
  }));
}

function renderSkuList() {
  relabelSkus();
  elements.skuList.innerHTML = state.skus
    .map(
      (sku) => `
        <article class="sku-card" draggable="true" data-sku-id="${sku.id}">
          <div class="sku-card-header">
            <button class="drag-handle" type="button" aria-label="拖动 SKU ${sku.label}">☰</button>
            <strong>SKU ${sku.label}</strong>
            <input class="sku-color" type="color" value="${sku.color}" aria-label="SKU ${sku.label} 颜色" />
          </div>
          <div class="sku-fields">
            <label>长 mm<input class="sku-length" type="number" min="1" step="1" value="${sku.length}" /></label>
            <label>宽 mm<input class="sku-width" type="number" min="1" step="1" value="${sku.width}" /></label>
            <label>高 mm<input class="sku-height" type="number" min="1" step="1" value="${sku.height}" /></label>
            <label>目标量<input class="sku-target" type="number" min="1" step="1" value="${sku.target}" /></label>
          </div>
        </article>
      `,
    )
    .join("");
}
```

- [ ] **Step 5: Wire mode switching and SKU count changes.**

```js
function setPackingMode(mode) {
  state.mode = mode;
  const multi = mode === "multi";
  elements.skuCountRow.classList.toggle("hidden", !multi);
  elements.skuStrategyRow.classList.toggle("hidden", !multi);
  elements.singleSkuFields.classList.toggle("hidden", multi);
  elements.skuList.classList.toggle("hidden", !multi);
  elements.skuBreakdown.classList.toggle("hidden", !multi);
  if (multi) renderSkuList();
  markNeedsCalculation();
}

function syncSkuCount() {
  const count = Number(elements.skuCount.value);
  elements.skuCountValue.textContent = String(count);
  while (state.skus.length < count) {
    const index = state.skus.length;
    state.skus.push({
      id: crypto.randomUUID(),
      label: String.fromCharCode(65 + index),
      length: 480,
      width: 320,
      height: 260,
      target: 100,
      color: ["#d8923a", "#42d6a4", "#6e8bff", "#ff7066", "#b7e35f"][index % 5],
    });
  }
  state.skus = state.skus.slice(0, count);
  renderSkuList();
  markNeedsCalculation();
}
```

- [ ] **Step 6: Commit the form controls.**

```bash
git add index.html styles.css app.js
git commit -m "feat: add multi-sku controls"
```

## Task 8: Wire Calculations, Drag Sorting, and SKU Results

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add SKU value collection helpers.**

```js
function updateSkuFromCard(card) {
  const sku = state.skus.find((item) => item.id === card.dataset.skuId);
  if (!sku) return;
  sku.length = Number(card.querySelector(".sku-length").value);
  sku.width = Number(card.querySelector(".sku-width").value);
  sku.height = Number(card.querySelector(".sku-height").value);
  sku.target = Number(card.querySelector(".sku-target").value);
  sku.color = card.querySelector(".sku-color").value;
}

function getSkuInputs() {
  elements.skuList.querySelectorAll(".sku-card").forEach(updateSkuFromCard);
  relabelSkus();
  return state.skus.map((sku) => ({
    label: sku.label,
    length: sku.length,
    width: sku.width,
    height: sku.height,
    target: sku.target,
    color: sku.color,
  }));
}
```

- [ ] **Step 2: Update `calculateAndRender`.**

Use this calculation branch:

```js
const result =
  state.mode === "multi"
    ? Packing.calculateMultiSkuPacking(getContainerInput(), getSkuInputs(), {
        strategy: elements.skuStrategy.value,
      })
    : Packing.calculatePacking(getContainerInput(), getCartonInput());
```

- [ ] **Step 3: Add SKU breakdown rendering.**

```js
function updateSkuBreakdown(result) {
  if (state.mode !== "multi" || !result.skuSummary) {
    elements.skuBreakdown.classList.add("hidden");
    elements.skuBreakdown.innerHTML = "";
    return;
  }

  elements.skuBreakdown.classList.remove("hidden");
  elements.skuBreakdown.innerHTML = result.skuSummary
    .map(
      (sku) => `
        <div class="sku-breakdown-row">
          <span class="sku-swatch" style="background:${sku.color}"></span>
          <strong>SKU ${sku.label}</strong>
          <span>${formatNumber(sku.loaded)} / ${formatNumber(sku.target)}${sku.shortfall ? ` · 差 ${formatNumber(sku.shortfall)}` : ""}</span>
        </div>
      `,
    )
    .join("");
}
```

Call `updateSkuBreakdown(result)` inside `calculateAndRender` after `updateSummary(result)`.

- [ ] **Step 4: Add event delegation for SKU edits and drag sorting.**

```js
elements.skuList.addEventListener("input", (event) => {
  const card = event.target.closest(".sku-card");
  if (card) updateSkuFromCard(card);
  markNeedsCalculation();
});

elements.skuList.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".sku-card");
  if (!card) return;
  state.draggedSkuId = card.dataset.skuId;
  event.dataTransfer.effectAllowed = "move";
});

elements.skuList.addEventListener("dragover", (event) => {
  event.preventDefault();
});

elements.skuList.addEventListener("drop", (event) => {
  event.preventDefault();
  const targetCard = event.target.closest(".sku-card");
  if (!targetCard || !state.draggedSkuId) return;
  const fromIndex = state.skus.findIndex((sku) => sku.id === state.draggedSkuId);
  const toIndex = state.skus.findIndex((sku) => sku.id === targetCard.dataset.skuId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  const [moved] = state.skus.splice(fromIndex, 1);
  state.skus.splice(toIndex, 0, moved);
  state.draggedSkuId = null;
  renderSkuList();
  markNeedsCalculation();
});
```

- [ ] **Step 5: Wire mode and count events in the existing setup area.**

```js
elements.packingMode.forEach((input) => {
  input.addEventListener("change", () => setPackingMode(input.value));
});
elements.skuCount.addEventListener("input", syncSkuCount);
elements.skuStrategy.addEventListener("change", markNeedsCalculation);
renderSkuList();
```

- [ ] **Step 6: Run tests and do a syntax check.**

Run: `node tests/packing-core.test.js`

Expected: PASS.

Run: `node --check app.js`

Expected: no syntax errors.

- [ ] **Step 7: Commit calculation wiring.**

```bash
git add app.js
git commit -m "feat: wire multi-sku calculations"
```

## Task 9: Update 2D and 3D Rendering Colors and Labels

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

- [ ] **Step 1: Add a color resolver in `app.js`.**

```js
function colorForBox(box) {
  return box.skuColor || state.color;
}
```

- [ ] **Step 2: Update 2D drawing to use per-box colors.**

Inside `drawPlanView`, replace the single `rgb` usage for visible boxes with:

```js
const boxRgb = hexToRgb(colorForBox(box));
ctx.fillStyle = isVisible
  ? `rgba(${boxRgb.r}, ${boxRgb.g}, ${boxRgb.b}, 0.82)`
  : blocked
    ? "rgba(255, 112, 102, 0.08)"
    : "rgba(255, 255, 255, 0.06)";
```

- [ ] **Step 3: Update Three.js materials to support per-instance colors.**

In `addThreeBoxes`, change material creation:

```js
const material = new THREE.MeshLambertMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.92,
});
```

Inside the `positions.forEach` loop, after `setMatrixAt`:

```js
boxes.setColorAt(index, new THREE.Color(colorForBox(box)));
```

After the loop:

```js
if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
```

- [ ] **Step 4: Add clear 3D door and inner-end labels.**

In `addThreeContainer`, after corner blocks are added, create text sprites:

```js
function makeThreeLabel(text, color = "#f5f7fb") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(3, 8, 14, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = "700 28px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.38, 1);
  return sprite;
}
```

Then add:

```js
const doorLabel = makeThreeLabel("柜门");
doorLabel.position.set(length / 2 + 0.45, -height / 2 + 0.18, 0);
const innerLabel = makeThreeLabel("柜内最里面 / 角件端", "#ffbe55");
innerLabel.position.set(-length / 2 - 0.65, height / 2 - 0.22, 0);
state.three.model.add(doorLabel, innerLabel);
```

- [ ] **Step 5: Run tests and syntax check.**

Run: `node tests/packing-core.test.js`

Expected: PASS.

Run: `node --check app.js`

Expected: no syntax errors.

- [ ] **Step 6: Commit rendering updates.**

```bash
git add app.js styles.css
git commit -m "feat: color and label sku rendering"
```

## Task 10: Browser Verification and Final Polish

**Files:**
- Verify: `index.html`
- Verify: `app.js`
- Verify: `styles.css`
- Verify: `packing-core.js`
- Verify: `tests/packing-core.test.js`

- [ ] **Step 1: Run all automated checks.**

Run: `node tests/packing-core.test.js`

Expected: `packing-core tests passed`

Run: `node --check app.js`

Expected: no syntax errors.

Run: `node --check packing-core.js`

Expected: no syntax errors.

- [ ] **Step 2: Start a local static server.**

Run: `python3 -m http.server 4173`

Expected: server listens at `http://localhost:4173`.

- [ ] **Step 3: Open the app in the in-app browser or local browser.**

URL: `http://localhost:4173/index.html`

Expected:

- Initial single-SKU mode is visible.
- Target quantity fields are hidden in single-SKU mode.
- 3D canvas renders the container and boxes.
- Progress slider animates from empty to full.

- [ ] **Step 4: Verify real single-SKU cases manually.**

Use `40HQ`.

Case 1:

- Carton length: `488`
- Carton width: `380`
- Carton height: `291`
- Expected total: `1340`

Case 2:

- Carton length: `488`
- Carton width: `360`
- Carton height: `291`
- Expected total: `1403`

- [ ] **Step 5: Verify multi-SKU controls manually.**

Expected:

- Switching to multi-SKU mode shows the SKU count slider.
- Slider values from `2` to `10` create the matching number of SKU cards.
- Each SKU card has length, width, height, target, and color.
- Dragging cards changes order and relabels cards as `A`, `B`, `C`.
- Multi-destination strategy fills A before B.
- Same-destination strategy keeps full faces single-SKU before tail remainders.
- SKU breakdown shows target, actual loaded, and shortfall.
- Different SKUs render in different 2D and 3D colors.
- Door label is at the door end; corner-fitting label is at the far inner end.

- [ ] **Step 6: Stop the local server.**

If the server is running in the foreground, press `Ctrl-C`.

- [ ] **Step 7: Commit final polish if any verification edits were needed.**

```bash
git add index.html styles.css app.js packing-core.js tests/packing-core.test.js
git commit -m "fix: polish multi-sku packing experience"
```

If no verification edits were needed, skip this commit.
