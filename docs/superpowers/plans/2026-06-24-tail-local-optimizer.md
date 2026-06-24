# 尾部局部优化器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单 SKU 最大装载算法升级到能达到 `488×380×291 -> 1349`、`509×418×338 -> 889`、`536×436×330 -> 927`，并保持坐标、角件避让、批量导入和渲染数据结构可用。

**Architecture:** 保留现有 `calculatePacking(...)` 等外部入口，在 `src/core/packing/candidates.ts` 的候选枚举流程中接入一个新的 `tailOptimizer.ts`。优化器只处理 `width-lanes` 单层尾部局部补位：先回退部分巷道纵深，再在释放出的柜门侧区域内做有限平面搜索，最终仍交给现有评估逻辑生成 3D 坐标和角件避让结果。

**Tech Stack:** Vue 3 + Vite + TypeScript + Vitest + Playwright；核心算法位于 `src/core/packing/`，测试位于 `tests/packing-core.test.ts` 和 `tests/batch-import.test.ts`。

---

## File Structure

- Modify: `tests/packing-core.test.ts`
  - 增加三条新最大装载基准。
  - 强化坐标不重叠、不过柜、角件避让断言。
- Modify: `tests/batch-import.test.ts`
  - 更新 `488*380*291` 的批量导入期望。
  - 增加 `509*418*338`、`536*436*330` 批量导入覆盖。
- Modify: `src/core/packing/candidates.ts`
  - 导出候选类型给优化器使用。
  - 在 `width-lanes` 候选生成后追加尾部优化候选。
  - 用脚位签名去重，避免重复候选拖慢评估。
- Create: `src/core/packing/tailOptimizer.ts`
  - 生成回退巷道方案。
  - 生成柜门侧尾部候选脚位。
  - 通过有限搜索选择最多不重叠补位。
  - 返回可被现有评估流程消费的 `CandidatePattern`。
- Modify: `src/core/packing/strategyDescription.ts`
  - 将 `source: "tail-optimized"` 识别为空位回填。

---

### Task 1: 锁定单 SKU 最大装载新基准

**Files:**
- Modify: `tests/packing-core.test.ts`

- [ ] **Step 1: 添加测试辅助函数**

在 `assertLoadsInnerFaceBeforeNextDepth` 后追加：

```ts
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
```

- [ ] **Step 2: 更新 `488 × 380 × 291` 期望**

找到现有 `488, 380, 291` 测试块，将数量从 `1340` 改成 `1349`，并把生成坐标断言替换为统一辅助函数：

```ts
{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(488, 380, 291),
  );

  assert.equal(result.totalBoxes, 1349);
  assert.equal(result.container.id, "40HQ");
  assert.equal(result.usedHeight, 2619);
  assertLoadsInnerFaceBeforeNextDepth(result);
  assertTailOptimizedSource(result);
  assertValidGeneratedPacking(result);
}
```

- [ ] **Step 3: 增加另外两条目标基准**

紧跟 `488 × 360 × 291` 测试块后追加：

```ts
{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(509, 418, 338),
  );

  assert.equal(result.totalBoxes, 889);
  assert.equal(result.container.id, "40HQ");
  assert.equal(result.usedHeight, 2366);
  assertLoadsInnerFaceBeforeNextDepth(result);
  assertTailOptimizedSource(result);
  assertValidGeneratedPacking(result);
}

{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(536, 436, 330),
  );

  assert.equal(result.totalBoxes, 927);
  assert.equal(result.container.id, "40HQ");
  assert.equal(result.usedHeight, 2640);
  assertLoadsInnerFaceBeforeNextDepth(result);
  assertTailOptimizedSource(result);
  assertValidGeneratedPacking(result);
}
```

- [ ] **Step 4: 运行测试确认失败**

Run:

```bash
npm run test:unit -- tests/packing-core.test.ts
```

Expected:

```text
FAIL tests/packing-core.test.ts
AssertionError: Expected values to be strictly equal:
1340 !== 1349
```

后续两条也会失败，当前结果应分别是 `875` 和 `919`。

- [ ] **Step 5: Commit**

```bash
git add tests/packing-core.test.ts
git commit -m "test(packing): 锁定尾部优化装载基准"
```

---

### Task 2: 更新批量导入基准

**Files:**
- Modify: `tests/batch-import.test.ts`

- [ ] **Step 1: 更新现有批量导入期望**

在 `calculates packing totals from the current Excel row format` 测试中，将 `488*380*291` 对应的期望从 `1340` 更新为 `1349`：

```ts
assert.deepEqual(
  results.map((result) => result.totalBoxes),
  [1493, 1403, 1200, 1349],
);
```

同时更新差值：

```ts
assert.deepEqual(
  results.map((result) => result.difference),
  [-247, 0, 2, 9],
);
```

- [ ] **Step 2: 增加尾部优化批量导入覆盖**

在第一个测试后追加：

```ts
it("uses tail-optimized maximum loads in batch calculations", () => {
  const results = calculateBatchPacking([
    { "人工码垛数量（原始）": 1349, "尺寸（长宽高 mm）": "488*380*291", 柜型: "40HQ" },
    { "人工码垛数量（原始）": 889, "尺寸（长宽高 mm）": "509*418*338", 柜型: "40HQ" },
    { "人工码垛数量（原始）": 927, "尺寸（长宽高 mm）": "536*436*330", 柜型: "40HQ" },
  ]);

  assert.deepEqual(
    results.map((result) => result.totalBoxes),
    [1349, 889, 927],
  );
  assert.deepEqual(
    results.map((result) => result.difference),
    [0, 0, 0],
  );
  assert.deepEqual(
    results.map((result) => result.status),
    ["成功", "成功", "成功"],
  );
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
npm run test:unit -- tests/batch-import.test.ts
```

Expected:

```text
FAIL tests/batch-import.test.ts
AssertionError: Expected values to be strictly deep-equal
```

失败值应显示当前算法仍返回 `1340`、`875`、`919`。

- [ ] **Step 4: Commit**

```bash
git add tests/batch-import.test.ts
git commit -m "test(packing): 补充批量导入尾部优化基准"
```

---

### Task 3: 导出候选类型并准备候选去重

**Files:**
- Modify: `src/core/packing/candidates.ts`

- [ ] **Step 1: 导出候选类型**

将文件顶部的类型声明改为导出：

```ts
export type PatternFamily = "length-segments" | "width-lanes";
export type CandidateOrder = "length-first" | "width-first";

export interface CandidateUnit {
  family: PatternFamily;
  orientationId: CartonOrientationId;
  label: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  dz: number;
  acrossCount: number;
}

export interface CandidateGroup {
  orientationId: CartonOrientationId;
  label: string;
  axisLabel: string;
  count: number;
  occupiedLength: number;
  occupiedWidth: number;
  occupiedHeight: number;
  boxesPerUnit: number;
}
```

- [ ] **Step 2: 扩展 `CandidatePattern` 元数据**

将 `CandidatePattern` 补充两个可选字段：

```ts
export interface CandidatePattern {
  family: PatternFamily;
  order: CandidateOrder;
  units: CandidateUnit[];
  groups: CandidateGroup[];
  lengthFacingCount: number;
  widthFacingCount: number;
  occupiedLength: number;
  occupiedWidth: number;
  perLayerBoxCount: number;
  extraLayerPositions?: CandidateBoxPosition[];
  remainderCount?: number;
  source?: "base" | "door-remainder" | "tail-optimized";
  tailOptimization?: {
    reducedUnits: number;
    extraPositions: number;
    exploredStates: number;
  };
}
```

- [ ] **Step 3: 增加脚位签名函数**

在 `getFloorOccupiedLength` 后追加：

```ts
function patternLayerPositions(pattern: CandidatePattern): CandidateBoxPosition[] {
  return [
    ...createLayerPositions(pattern),
    ...(pattern.extraLayerPositions || []),
  ].sort((a, b) => a.x - b.x || a.y - b.y || a.dx - b.dx || a.dy - b.dy);
}

function candidateLayerKey(candidate: CandidatePattern): string {
  return patternLayerPositions(candidate)
    .map((position) =>
      [
        position.x,
        position.y,
        position.dx,
        position.dy,
        position.dz,
        position.orientationId || "",
        position.source || "",
      ].join(":"),
    )
    .join("|");
}

function pushLayerCandidate(candidates: CandidatePattern[], candidate: CandidatePattern) {
  const key = candidateLayerKey(candidate);
  if (candidates.some((item) => candidateLayerKey(item) === key)) return;
  candidates.push(candidate);
}
```

- [ ] **Step 4: 保持现有行为不变**

暂时不替换所有 `candidates.push(...)`，只保留新增 helper。运行现有测试确认类型导出没有破坏行为。

Run:

```bash
npm run test:unit -- tests/packing-core.test.ts
```

Expected: 仍因 Task 1 的新基准失败，但没有 TypeScript/Vitest 导入错误。

- [ ] **Step 5: Commit**

```bash
git add src/core/packing/candidates.ts
git commit -m "refactor(packing): 导出候选类型并增加脚位签名"
```

---

### Task 4: 新增尾部局部优化器模块

**Files:**
- Create: `src/core/packing/tailOptimizer.ts`

- [ ] **Step 1: 创建完整模块**

创建 `src/core/packing/tailOptimizer.ts`：

```ts
import {
  floorRectFromPosition,
  overlapsAnyFloorRect,
  positionFitsFloor,
  rectanglesOverlap,
} from "./geometry";
import type { CartonOrientation } from "./orientations";
import type { ContainerSpec } from "./types";
import type {
  CandidateBoxPosition,
  CandidatePattern,
  CandidateUnit,
} from "./candidates";

interface TailOptimizerOptions {
  maxReductionDepth?: number;
  maxSearchStates?: number;
}

interface ReductionPlan {
  [orientationId: string]: number;
}

interface SearchResult {
  positions: CandidateBoxPosition[];
  exploredStates: number;
  stoppedByLimit: boolean;
}

const DEFAULT_MAX_REDUCTION_DEPTH = 4;
const DEFAULT_MAX_SEARCH_STATES = 20000;

function createLayerPositionsFromUnits(units: CandidateUnit[]): CandidateBoxPosition[] {
  const positions: CandidateBoxPosition[] = [];

  for (const unit of units) {
    for (let index = 0; index < unit.acrossCount; index += 1) {
      positions.push({
        x: unit.family === "width-lanes" ? index * unit.dx : unit.x,
        y: unit.family === "width-lanes" ? unit.y : index * unit.dy,
        z: 0,
        dx: unit.dx,
        dy: unit.dy,
        dz: unit.dz,
        orientationId: unit.orientationId,
        label: unit.label,
      });
    }
  }

  return positions.sort((a, b) => a.x - b.x || a.y - b.y);
}

function getOccupiedLength(positions: CandidateBoxPosition[]): number {
  return positions.reduce((max, position) => Math.max(max, position.x + position.dx), 0);
}

function getDistinctOrientationIds(units: CandidateUnit[]): string[] {
  return Array.from(new Set(units.map((unit) => unit.orientationId)));
}

function createReductionPlans(orientationIds: string[], maxReductionDepth: number): ReductionPlan[] {
  const plans: ReductionPlan[] = [];

  function visit(index: number, current: ReductionPlan) {
    if (index >= orientationIds.length) {
      if (Object.values(current).some((depth) => depth > 0)) {
        plans.push({ ...current });
      }
      return;
    }

    const orientationId = orientationIds[index];
    for (let depth = 0; depth <= maxReductionDepth; depth += 1) {
      current[orientationId] = depth;
      visit(index + 1, current);
    }
    delete current[orientationId];
  }

  visit(0, {});
  return plans;
}

function reduceUnits(units: CandidateUnit[], plan: ReductionPlan): CandidateUnit[] {
  return units.map((unit) => ({
    ...unit,
    acrossCount: Math.max(0, unit.acrossCount - (plan[unit.orientationId] || 0)),
  }));
}

function countReducedUnits(original: CandidateUnit[], reduced: CandidateUnit[]): number {
  return original.reduce((sum, unit, index) => sum + Math.max(0, unit.acrossCount - reduced[index].acrossCount), 0);
}

function addSteppedStarts(starts: Set<number>, start: number, step: number, limit: number) {
  if (step <= 0) return;
  for (let value = start; value + step <= limit; value += step) {
    if (value >= 0) starts.add(value);
  }
}

function createCandidateStarts(
  container: ContainerSpec,
  orientation: CartonOrientation,
  occupied: CandidateBoxPosition[],
) {
  const xStarts = new Set<number>([0, Math.max(0, container.length - orientation.x)]);
  const yStarts = new Set<number>([0, Math.max(0, container.width - orientation.y)]);

  for (const position of occupied) {
    xStarts.add(position.x);
    xStarts.add(position.x + position.dx);
    yStarts.add(position.y);
    yStarts.add(position.y + position.dy);
    addSteppedStarts(xStarts, position.x + position.dx, orientation.x, container.length);
    addSteppedStarts(yStarts, position.y, orientation.y, container.width);
    addSteppedStarts(yStarts, position.y + position.dy, orientation.y, container.width);
  }

  addSteppedStarts(yStarts, 0, orientation.y, container.width);

  return {
    xStarts: Array.from(xStarts).filter((x) => x >= 0 && x + orientation.x <= container.length).sort((a, b) => a - b),
    yStarts: Array.from(yStarts).filter((y) => y >= 0 && y + orientation.y <= container.width).sort((a, b) => a - b),
  };
}

function createTailCandidates(
  container: ContainerSpec,
  orientations: CartonOrientation[],
  occupied: CandidateBoxPosition[],
): CandidateBoxPosition[] {
  const occupiedRects = occupied.map(floorRectFromPosition);
  const candidates: CandidateBoxPosition[] = [];
  const seen = new Set<string>();

  for (const orientation of orientations) {
    const { xStarts, yStarts } = createCandidateStarts(container, orientation, occupied);

    for (const x of xStarts) {
      for (const y of yStarts) {
        const candidate: CandidateBoxPosition = {
          x,
          y,
          z: 0,
          dx: orientation.x,
          dy: orientation.y,
          dz: orientation.z,
          orientationId: orientation.id,
          label: orientation.label,
          source: "tail-optimized",
        };
        const key = `${candidate.x}:${candidate.y}:${candidate.dx}:${candidate.dy}:${candidate.orientationId}`;
        if (seen.has(key)) continue;
        if (!positionFitsFloor(candidate, container)) continue;
        if (overlapsAnyFloorRect(candidate, occupiedRects)) continue;
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }

  return candidates.sort((a, b) => a.x - b.x || a.y - b.y || a.dx - b.dx || a.dy - b.dy);
}

function buildConflictMasks(candidates: CandidateBoxPosition[]): number[] {
  const masks = candidates.map(() => 0);
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      if (rectanglesOverlap(floorRectFromPosition(candidates[left]), floorRectFromPosition(candidates[right]))) {
        masks[left] |= 1 << right;
        masks[right] |= 1 << left;
      }
    }
  }
  return masks;
}

function choosePivot(mask: number, conflictMasks: number[]): number {
  let bestIndex = 0;
  let bestDegree = -1;
  for (let index = 0; index < conflictMasks.length; index += 1) {
    if ((mask & (1 << index)) === 0) continue;
    const degree = (conflictMasks[index] & mask).toString(2).replaceAll("0", "").length;
    if (degree > bestDegree) {
      bestDegree = degree;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function maskToPositions(mask: number, candidates: CandidateBoxPosition[]): CandidateBoxPosition[] {
  return candidates.filter((_, index) => (mask & (1 << index)) !== 0);
}

function selectBestTailPositions(candidates: CandidateBoxPosition[], maxSearchStates: number): SearchResult {
  if (candidates.length === 0) {
    return { positions: [], exploredStates: 0, stoppedByLimit: false };
  }
  if (candidates.length > 30) {
    candidates = candidates.slice(0, 30);
  }

  const conflictMasks = buildConflictMasks(candidates);
  const memo = new Map<number, number>();
  let exploredStates = 0;
  let stoppedByLimit = false;

  function solve(mask: number): number {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask)!;
    exploredStates += 1;
    if (exploredStates > maxSearchStates) {
      stoppedByLimit = true;
      return 0;
    }

    const pivot = choosePivot(mask, conflictMasks);
    const withoutPivot = solve(mask & ~(1 << pivot));
    const withPivot = (1 << pivot) | solve(mask & ~(1 << pivot) & ~conflictMasks[pivot]);
    const best = maskToPositions(withPivot, candidates).length > maskToPositions(withoutPivot, candidates).length
      ? withPivot
      : withoutPivot;
    memo.set(mask, best);
    return best;
  }

  const selectedMask = solve((1 << candidates.length) - 1);
  return {
    positions: maskToPositions(selectedMask, candidates),
    exploredStates,
    stoppedByLimit,
  };
}

function createPatternFromReducedUnits(
  sourcePattern: CandidatePattern,
  reducedUnits: CandidateUnit[],
  extraPositions: CandidateBoxPosition[],
  exploredStates: number,
): CandidatePattern {
  const basePositions = createLayerPositionsFromUnits(reducedUnits);
  const layerPositions = [...basePositions, ...extraPositions];

  return {
    ...sourcePattern,
    units: reducedUnits,
    extraLayerPositions: extraPositions,
    remainderCount: extraPositions.length,
    perLayerBoxCount: layerPositions.length,
    occupiedLength: getOccupiedLength(layerPositions),
    source: "tail-optimized",
    tailOptimization: {
      reducedUnits: countReducedUnits(sourcePattern.units, reducedUnits),
      extraPositions: extraPositions.length,
      exploredStates,
    },
  };
}

export function createTailOptimizedPatterns(
  container: ContainerSpec,
  pattern: CandidatePattern,
  orientations: CartonOrientation[],
  options: TailOptimizerOptions = {},
): CandidatePattern[] {
  if (pattern.family !== "width-lanes") return [];
  if (pattern.units.length === 0) return [];

  const maxReductionDepth = options.maxReductionDepth ?? DEFAULT_MAX_REDUCTION_DEPTH;
  const maxSearchStates = options.maxSearchStates ?? DEFAULT_MAX_SEARCH_STATES;
  const orientationIds = getDistinctOrientationIds(pattern.units);
  const plans = createReductionPlans(orientationIds, maxReductionDepth);
  const optimizedPatterns: CandidatePattern[] = [];

  for (const plan of plans) {
    const reducedUnits = reduceUnits(pattern.units, plan);
    if (reducedUnits.some((unit) => unit.acrossCount <= 0)) continue;

    const basePositions = createLayerPositionsFromUnits(reducedUnits);
    const tailCandidates = createTailCandidates(container, orientations, basePositions);
    const searchResult = selectBestTailPositions(tailCandidates, maxSearchStates);
    if (searchResult.positions.length === 0) continue;

    const originalBaseCount = createLayerPositionsFromUnits(pattern.units).length;
    const optimizedCount = basePositions.length + searchResult.positions.length;
    if (optimizedCount <= originalBaseCount) continue;

    optimizedPatterns.push(
      createPatternFromReducedUnits(
        pattern,
        reducedUnits,
        searchResult.positions,
        searchResult.exploredStates,
      ),
    );
  }

  return optimizedPatterns;
}
```

- [ ] **Step 2: 运行类型检查**

Run:

```bash
npm run build
```

Expected: 当前可能仍因未接入模块而通过；如果 TypeScript 报 `Big integer literals are not available` 或位运算相关问题，确认候选裁剪保持 `<= 30` 并使用普通 `number` 位掩码。

- [ ] **Step 3: Commit**

```bash
git add src/core/packing/tailOptimizer.ts
git commit -m "feat(packing): 新增尾部局部优化器"
```

---

### Task 5: 接入候选枚举流程

**Files:**
- Modify: `src/core/packing/candidates.ts`

- [ ] **Step 1: 导入优化器**

在 imports 中加入：

```ts
import { createTailOptimizedPatterns } from "./tailOptimizer";
```

- [ ] **Step 2: 用去重 helper 写入候选**

将 `addWidthLaneCandidateVariants` 内的两个 `candidates.push(...)` 替换为 `pushLayerCandidate(...)`：

```ts
pushLayerCandidate(candidates, normalizedCandidate);
```

以及：

```ts
pushLayerCandidate(candidates, {
  ...normalizedCandidate,
  extraLayerPositions: extraPositions,
  remainderCount: extraPositions.length,
  perLayerBoxCount: layerPositions.length,
  occupiedLength: getFloorOccupiedLength(layerPositions),
  source: "door-remainder",
});
```

- [ ] **Step 3: 增加尾部优化候选追加函数**

在 `addWidthLaneCandidateVariants` 后追加：

```ts
function addTailOptimizedCandidateVariants(
  candidates: CandidatePattern[],
  container: ContainerSpec,
  orientations: CartonOrientation[],
  candidate: CandidatePattern,
) {
  const optimizedPatterns = createTailOptimizedPatterns(container, candidate, orientations);
  for (const optimizedPattern of optimizedPatterns) {
    pushLayerCandidate(candidates, {
      ...optimizedPattern,
      groups: summarizeGroupsFromUnits(optimizedPattern.units, orientations),
    });
  }
}
```

- [ ] **Step 4: 在 `addWidthLaneCandidates` 接入优化器**

在 `addWidthLaneCandidateVariants(candidates, container, carton, orientations, baseCandidate);` 后面追加：

```ts
addTailOptimizedCandidateVariants(candidates, container, orientations, baseCandidate);
```

在 reduced branch 中，先保留现有 `addWidthLaneCandidateVariants(...)`，再追加：

```ts
const reducedCandidate = {
  ...reduced,
  units: reducedUnits,
};
addWidthLaneCandidateVariants(candidates, container, carton, orientations, reducedCandidate, MIN_DOOR_SIDE_REMAINDER_CLEARANCE);
addTailOptimizedCandidateVariants(candidates, container, orientations, reducedCandidate);
```

同时删除原来直接传对象给 `addWidthLaneCandidateVariants` 的那段调用，避免重复构造。

- [ ] **Step 5: 运行核心测试**

Run:

```bash
npm run test:unit -- tests/packing-core.test.ts
```

Expected:

```text
PASS tests/packing-core.test.ts
```

若 `488 × 380 × 291` 达不到 `1349`，打印候选 `pattern.tailOptimization` 诊断，检查 `createCandidateStarts(...)` 是否生成了第二列尾部补位的 `x` 起点。若 `509 × 418 × 338` 达不到 `889`，检查 reduction plan 是否允许两个朝向同时回退 `2` 排。

- [ ] **Step 6: Commit**

```bash
git add src/core/packing/candidates.ts src/core/packing/tailOptimizer.ts tests/packing-core.test.ts
git commit -m "feat(packing): 接入单 SKU 尾部局部优化"
```

---

### Task 6: 更新策略说明和批量导入结果

**Files:**
- Modify: `src/core/packing/strategyDescription.ts`
- Modify: `tests/batch-import.test.ts`

- [ ] **Step 1: 策略说明识别 `tail-optimized`**

在 `getBackfillNote` 中更新 `hasBackfill` 判断：

```ts
const hasBackfill = result.orderedPositions.some(
  (position) =>
    position.source === "heterogeneous-backfill" ||
    position.source === "door-remainder" ||
    position.source === "tail-optimized",
) || hasHeterogeneousFloorReuse;
```

- [ ] **Step 2: 运行批量导入测试**

Run:

```bash
npm run test:unit -- tests/batch-import.test.ts
```

Expected:

```text
PASS tests/batch-import.test.ts
```

- [ ] **Step 3: 运行策略相关核心测试**

Run:

```bash
npm run test:unit -- tests/packing-core.test.ts
```

Expected:

```text
PASS tests/packing-core.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/core/packing/strategyDescription.ts tests/batch-import.test.ts
git commit -m "fix(packing): 展示尾部优化回填说明"
```

---

### Task 7: 做性能和边界回归

**Files:**
- Modify: `tests/packing-core.test.ts`
- Modify: `tests/batch-import.test.ts`

- [ ] **Step 1: 增加重复计算性能回归**

在 `tests/batch-import.test.ts` 中 `reuses maximum-load calculations for repeated carton specs` 后追加：

```ts
it("keeps tail-optimized repeated rows cached", () => {
  const repeatedRows = Array.from({ length: 30 }, (_, index) => ({
    "人工码垛数量（原始）": 900 + index,
    "尺寸（长宽高 mm）": "536*436*330",
    柜型: "40HQ",
  }));

  const startedAt = performance.now();
  const results = calculateBatchPacking(repeatedRows);
  const elapsed = performance.now() - startedAt;

  assert.equal(results.length, 30);
  assert.ok(results.every((result) => result.totalBoxes === 927));
  assert.ok(elapsed < 1000, `tail-optimized repeated batch calculation took ${elapsed.toFixed(1)}ms`);
});
```

- [ ] **Step 2: 增加无角件对照断言**

在 `tests/packing-core.test.ts` 的三条新基准后追加：

```ts
{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(488, 380, 291),
    { cornerBlock: { length: 0, width: 0, height: 0 } },
  );

  assert.equal(result.totalBoxes, 1350);
  assertValidGeneratedPacking(result);
}

{
  const result = Packing.calculatePacking(
    Packing.CONTAINERS["40HQ"],
    carton(536, 436, 330),
    { cornerBlock: { length: 0, width: 0, height: 0 } },
  );

  assert.equal(result.totalBoxes, 928);
  assertValidGeneratedPacking(result);
}
```

这些断言确认新算法在有角件时扣掉 `1` 箱，而不是因为尾部坐标本身少生成。

- [ ] **Step 3: 运行目标测试**

Run:

```bash
npm run test:unit -- tests/packing-core.test.ts tests/batch-import.test.ts
```

Expected:

```text
PASS tests/packing-core.test.ts
PASS tests/batch-import.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/packing-core.test.ts tests/batch-import.test.ts
git commit -m "test(packing): 补充尾部优化性能和角件回归"
```

---

### Task 8: 全量验证和最终整理

**Files:**
- Review: `src/core/packing/candidates.ts`
- Review: `src/core/packing/tailOptimizer.ts`
- Review: `src/core/packing/strategyDescription.ts`
- Review: `tests/packing-core.test.ts`
- Review: `tests/batch-import.test.ts`

- [ ] **Step 1: 运行单元测试**

Run:

```bash
npm run test:unit
```

Expected:

```text
Test Files  ... passed
Tests       ... passed
```

- [ ] **Step 2: 运行端到端测试**

Run:

```bash
npm run test:e2e
```

Expected:

```text
... passed
```

- [ ] **Step 3: 运行构建**

Run:

```bash
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 4: 检查 git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected:

```text
M src/core/packing/candidates.ts
M src/core/packing/strategyDescription.ts
A src/core/packing/tailOptimizer.ts
M tests/packing-core.test.ts
M tests/batch-import.test.ts
```

如果中间任务已经按计划提交，`git status --short` 应为空。

- [ ] **Step 5: 最终提交未提交整理**

若还有未提交修改：

```bash
git add src/core/packing/candidates.ts src/core/packing/tailOptimizer.ts src/core/packing/strategyDescription.ts tests/packing-core.test.ts tests/batch-import.test.ts
git commit -m "feat(packing): 完成尾部局部优化算法"
```

若没有未提交修改，记录当前分支已包含前面任务提交。

---

## Self-Review

### Spec Coverage

- 新基准 `1349 / 889 / 927`：Task 1、Task 2 覆盖。
- 保留公开 API：Task 5 只接入候选枚举，不改 `calculatePacking(...)` 等入口。
- 独立尾部优化器：Task 4 覆盖。
- 真实坐标、碰撞、角件校验：Task 1、Task 7 覆盖。
- 批量导入一致：Task 2、Task 6、Task 7 覆盖。
- 策略说明识别尾部回填：Task 6 覆盖。
- 全量验证：Task 8 覆盖。

### Type Consistency

- `CandidateUnit`、`CandidateGroup`、`CandidatePattern` 在 Task 3 导出，Task 4 只做 type import，避免 `candidates.ts` 与 `tailOptimizer.ts` 运行时循环依赖。
- `source: "tail-optimized"` 在 `CandidateBoxPosition.source` 已兼容为 string，Task 3 仅收窄 `CandidatePattern.source`。
- `createTailOptimizedPatterns(...)` 返回 `CandidatePattern[]`，由 Task 5 统一写回候选列表。
