import {
  floorRectFromPosition,
  overlapsAnyFloorRect,
  positionFitsFloor,
  rectanglesOverlap,
} from "./geometry";
import type { FloorRect } from "./geometry";
import type { CartonOrientation } from "./orientations";
import type { ContainerSpec } from "./types";
import type {
  CandidateBoxPosition,
  CandidateGroup,
  CandidatePattern,
  CandidateUnit,
} from "./candidates";

interface TailOptimizerOptions {
  maxReductionDepth?: number;
  maxSearchStates?: number;
}

interface ReductionPlan {
  unitReductions: number[];
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

function summarizeGroupsFromUnits(units: CandidateUnit[], orientations: CartonOrientation[]): CandidateGroup[] {
  const groups: CandidateGroup[] = [];

  for (const unit of units) {
    const previous = groups[groups.length - 1];
    const orientation = orientations.find((item) => item.id === unit.orientationId);
    const occupiedLength = unit.family === "length-segments" ? unit.dx : unit.acrossCount * unit.dx;
    const occupiedWidth = unit.family === "length-segments" ? unit.acrossCount * unit.dy : unit.dy;

    if (previous && previous.orientationId === unit.orientationId) {
      previous.count += 1;
      previous.occupiedLength =
        unit.family === "width-lanes"
          ? Math.max(previous.occupiedLength, occupiedLength)
          : previous.occupiedLength + occupiedLength;
      previous.occupiedWidth =
        unit.family === "length-segments"
          ? Math.max(previous.occupiedWidth, occupiedWidth)
          : previous.occupiedWidth + occupiedWidth;
      previous.occupiedHeight = Math.max(previous.occupiedHeight, unit.dz);
      previous.boxesPerUnit = Math.max(previous.boxesPerUnit, unit.acrossCount);
    } else {
      groups.push({
        orientationId: unit.orientationId,
        label: unit.label,
        axisLabel: orientation ? orientation.axisLabel : "",
        count: 1,
        occupiedLength,
        occupiedWidth,
        occupiedHeight: unit.dz,
        boxesPerUnit: unit.acrossCount,
      });
    }
  }

  return groups;
}

function createReductionPlans(units: CandidateUnit[], maxReductionDepth: number): ReductionPlan[] {
  const plans: ReductionPlan[] = [];
  const seen = new Set<string>();

  function addPlan(unitReductions: number[]) {
    if (!unitReductions.some((depth) => depth > 0)) return;
    const key = unitReductions.join(":");
    if (seen.has(key)) return;
    seen.add(key);
    plans.push({ unitReductions });
  }

  const orientationIds = Array.from(new Set(units.map((unit) => unit.orientationId)));
  const orientationDepths = orientationIds.map(() => 0);

  function visitOrientationPlans(index: number) {
    if (index >= orientationIds.length) {
      addPlan(units.map((unit) => {
        const orientationIndex = orientationIds.indexOf(unit.orientationId);
        return Math.min(orientationDepths[orientationIndex], unit.acrossCount - 1);
      }));
      return;
    }

    const orientationId = orientationIds[index];
    const maxDepth = Math.min(
      maxReductionDepth,
      ...units.filter((unit) => unit.orientationId === orientationId).map((unit) => unit.acrossCount - 1),
    );
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      orientationDepths[index] = depth;
      visitOrientationPlans(index + 1);
    }
    orientationDepths[index] = 0;
  }

  visitOrientationPlans(0);

  for (let start = 0; start < units.length; start += 1) {
    for (let end = start; end < units.length; end += 1) {
      const maxDepth = Math.min(
        maxReductionDepth,
        ...units.slice(start, end + 1).map((unit) => unit.acrossCount - 1),
      );
      for (let depth = 1; depth <= maxDepth; depth += 1) {
        const unitReductions = units.map(() => 0);
        for (let index = start; index <= end; index += 1) {
          unitReductions[index] = depth;
        }
        addPlan(unitReductions);
      }
    }
  }

  return plans;
}

function reduceUnits(units: CandidateUnit[], plan: ReductionPlan): CandidateUnit[] {
  return units.map((unit, index) => ({
    ...unit,
    acrossCount: Math.max(0, unit.acrossCount - (plan.unitReductions[index] || 0)),
  }));
}

function countReducedUnits(original: CandidateUnit[], reduced: CandidateUnit[]): number {
  return original.reduce((sum, unit, index) => {
    const reducedUnit = reduced[index];
    return sum + Math.max(0, unit.acrossCount - reducedUnit.acrossCount);
  }, 0);
}

function createTailFreeRects(container: ContainerSpec, reducedUnits: CandidateUnit[]): FloorRect[] {
  return reducedUnits
    .filter((unit) => unit.family === "width-lanes")
    .map((unit) => {
      const x = unit.acrossCount * unit.dx;
      return {
        x,
        y: unit.y,
        dx: container.length - x,
        dy: unit.dy,
      };
    })
    .filter((rect) => rect.dx > 0 && rect.dy > 0);
}

function subtractRect(rect: FloorRect, cutter: FloorRect): FloorRect[] {
  if (!rectanglesOverlap(rect, cutter)) return [rect];

  const rectRight = rect.x + rect.dx;
  const rectTop = rect.y + rect.dy;
  const cutLeft = Math.max(rect.x, cutter.x);
  const cutRight = Math.min(rectRight, cutter.x + cutter.dx);
  const cutBottom = Math.max(rect.y, cutter.y);
  const cutTop = Math.min(rectTop, cutter.y + cutter.dy);
  const remaining: FloorRect[] = [];

  if (rect.x < cutLeft) {
    remaining.push({
      x: rect.x,
      y: rect.y,
      dx: cutLeft - rect.x,
      dy: rect.dy,
    });
  }

  if (cutRight < rectRight) {
    remaining.push({
      x: cutRight,
      y: rect.y,
      dx: rectRight - cutRight,
      dy: rect.dy,
    });
  }

  if (rect.y < cutBottom) {
    remaining.push({
      x: cutLeft,
      y: rect.y,
      dx: cutRight - cutLeft,
      dy: cutBottom - rect.y,
    });
  }

  if (cutTop < rectTop) {
    remaining.push({
      x: cutLeft,
      y: cutTop,
      dx: cutRight - cutLeft,
      dy: rectTop - cutTop,
    });
  }

  return remaining.filter((item) => item.dx > 0 && item.dy > 0);
}

function isRectCoveredByFreeRects(rect: FloorRect, freeRects: FloorRect[]): boolean {
  let pending = [rect];

  for (const freeRect of freeRects) {
    pending = pending.flatMap((item) => subtractRect(item, freeRect));
    if (pending.length === 0) return true;
  }

  return false;
}

function expandStarts(seedStarts: Iterable<number>, stepSizes: Iterable<number>, limit: number): number[] {
  const starts = new Set<number>();
  const queue: number[] = [];
  const steps = Array.from(new Set(Array.from(stepSizes).filter((step) => step > 0))).sort((a, b) => a - b);

  for (const seed of seedStarts) {
    if (seed < 0 || seed > limit || starts.has(seed)) continue;
    starts.add(seed);
    queue.push(seed);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const step of steps) {
      const next = current + step;
      if (next > limit) break;
      if (starts.has(next)) continue;
      starts.add(next);
      queue.push(next);
    }
  }

  return Array.from(starts).sort((a, b) => a - b);
}

function createCandidateStarts(
  container: ContainerSpec,
  orientation: CartonOrientation,
  orientations: CartonOrientation[],
  freeRects: FloorRect[],
) {
  const xSeeds = new Set(freeRects.map((rect) => rect.x));
  const ySeeds = new Set(freeRects.flatMap((rect) => [rect.y, rect.y + rect.dy]));
  const xStarts = expandStarts(xSeeds, orientations.map((item) => item.x), container.length - orientation.x);
  const yStarts = expandStarts(ySeeds, orientations.map((item) => item.y), container.width - orientation.y);

  return {
    xStarts,
    yStarts,
  };
}

function createTailCandidates(
  container: ContainerSpec,
  orientations: CartonOrientation[],
  occupied: CandidateBoxPosition[],
  freeRects: FloorRect[],
): CandidateBoxPosition[] {
  const occupiedRects = occupied.map(floorRectFromPosition);
  const candidates: CandidateBoxPosition[] = [];
  const seen = new Set<string>();

  for (const orientation of orientations) {
    const { xStarts, yStarts } = createCandidateStarts(container, orientation, orientations, freeRects);

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
        if (!isRectCoveredByFreeRects(floorRectFromPosition(candidate), freeRects)) continue;
        if (overlapsAnyFloorRect(candidate, occupiedRects)) continue;
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }

  return candidates.sort((a, b) => a.x - b.x || a.y - b.y || a.dx - b.dx || a.dy - b.dy);
}

function compareCandidateStable(left: CandidateBoxPosition, right: CandidateBoxPosition): number {
  return (
    left.x - right.x ||
    left.y - right.y ||
    left.dx - right.dx ||
    left.dy - right.dy ||
    left.dz - right.dz ||
    (left.orientationId || "").localeCompare(right.orientationId || "")
  );
}

const TAIL_CANDIDATE_SORTERS = [
  compareCandidateStable,
  (left: CandidateBoxPosition, right: CandidateBoxPosition) =>
    left.y - right.y || left.x - right.x || compareCandidateStable(left, right),
  (left: CandidateBoxPosition, right: CandidateBoxPosition) =>
    left.x - right.x || right.y - left.y || compareCandidateStable(left, right),
  (left: CandidateBoxPosition, right: CandidateBoxPosition) =>
    left.y - right.y || right.x - left.x || compareCandidateStable(left, right),
  (left: CandidateBoxPosition, right: CandidateBoxPosition) =>
    (left.orientationId || "").localeCompare(right.orientationId || "") || compareCandidateStable(left, right),
  (left: CandidateBoxPosition, right: CandidateBoxPosition) =>
    (right.orientationId || "").localeCompare(left.orientationId || "") || compareCandidateStable(left, right),
];

function selectGreedyTailPositions(
  tailCandidates: CandidateBoxPosition[],
  compare: (left: CandidateBoxPosition, right: CandidateBoxPosition) => number,
  maxSearchStates: number,
): SearchResult {
  const positions: CandidateBoxPosition[] = [];
  const positionRects: FloorRect[] = [];
  let exploredStates = 0;

  for (const candidate of [...tailCandidates].sort(compare)) {
    exploredStates += 1;
    if (exploredStates > maxSearchStates) {
      return {
        positions,
        exploredStates,
        stoppedByLimit: true,
      };
    }

    if (!overlapsAnyFloorRect(candidate, positionRects)) {
      positions.push(candidate);
      positionRects.push(floorRectFromPosition(candidate));
    }
  }

  return {
    positions,
    exploredStates,
    stoppedByLimit: false,
  };
}

function selectBestTailPositions(
  tailCandidates: CandidateBoxPosition[],
  maxSearchStates: number,
): SearchResult {
  if (tailCandidates.length === 0) {
    return { positions: [], exploredStates: 0, stoppedByLimit: false };
  }

  let exploredStates = 0;
  let stoppedByLimit = false;
  let selectedPositions: CandidateBoxPosition[] = [];

  for (const compare of TAIL_CANDIDATE_SORTERS) {
    const remainingSearchStates = maxSearchStates - exploredStates;
    if (remainingSearchStates <= 0) {
      stoppedByLimit = true;
      break;
    }

    const result = selectGreedyTailPositions(tailCandidates, compare, remainingSearchStates);
    exploredStates += result.exploredStates;
    stoppedByLimit = stoppedByLimit || result.stoppedByLimit;

    if (result.positions.length > selectedPositions.length) {
      selectedPositions = result.positions;
    }
  }

  return {
    positions: selectedPositions.sort(compareCandidateStable),
    exploredStates,
    stoppedByLimit,
  };
}

function createPatternFromReducedUnits(
  sourcePattern: CandidatePattern,
  orientations: CartonOrientation[],
  reducedUnits: CandidateUnit[],
  extraPositions: CandidateBoxPosition[],
  exploredStates: number,
): CandidatePattern {
  const basePositions = createLayerPositionsFromUnits(reducedUnits);
  const layerPositions = [...basePositions, ...extraPositions];

  return {
    ...sourcePattern,
    units: reducedUnits,
    groups: summarizeGroupsFromUnits(reducedUnits, orientations),
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
  const originalBaseCount = createLayerPositionsFromUnits(pattern.units).length;
  const plans = createReductionPlans(pattern.units, maxReductionDepth);
  const optimizedPatterns: CandidatePattern[] = [];

  for (const plan of plans) {
    const reducedUnits = reduceUnits(pattern.units, plan);
    if (reducedUnits.some((unit) => unit.acrossCount <= 0)) continue;

    const basePositions = createLayerPositionsFromUnits(reducedUnits);
    const freeRects = createTailFreeRects(container, reducedUnits);
    if (freeRects.length === 0) continue;

    const tailCandidates = createTailCandidates(container, orientations, basePositions, freeRects);
    const searchResult = selectBestTailPositions(tailCandidates, maxSearchStates);
    if (searchResult.positions.length === 0) continue;

    const optimizedCount = basePositions.length + searchResult.positions.length;
    if (optimizedCount <= originalBaseCount) continue;

    optimizedPatterns.push(
      createPatternFromReducedUnits(
        pattern,
        orientations,
        reducedUnits,
        searchResult.positions,
        searchResult.exploredStates,
      ),
    );
  }

  return optimizedPatterns;
}
