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
  CandidateGroup,
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
}

const DEFAULT_MAX_REDUCTION_DEPTH = 4;
const DEFAULT_MAX_SEARCH_STATES = 20000;
const MAX_BITMASK_CANDIDATES = 30;

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
  return original.reduce((sum, unit, index) => {
    const reducedUnit = reduced[index];
    return sum + Math.max(0, unit.acrossCount - reducedUnit.acrossCount);
  }, 0);
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
    xStarts: Array.from(xStarts)
      .filter((x) => x >= 0 && x + orientation.x <= container.length)
      .sort((a, b) => a - b),
    yStarts: Array.from(yStarts)
      .filter((y) => y >= 0 && y + orientation.y <= container.width)
      .sort((a, b) => a - b),
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

function countMaskBits(mask: number): number {
  let count = 0;
  let remaining = mask;
  while (remaining !== 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

function choosePivot(mask: number, conflictMasks: number[]): number {
  let bestIndex = 0;
  let bestDegree = -1;
  for (let index = 0; index < conflictMasks.length; index += 1) {
    if ((mask & (1 << index)) === 0) continue;
    const degree = countMaskBits(conflictMasks[index] & mask);
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

function selectBestTailPositions(
  tailCandidates: CandidateBoxPosition[],
  maxSearchStates: number,
): SearchResult {
  const candidates = tailCandidates.slice(0, MAX_BITMASK_CANDIDATES);
  if (candidates.length === 0) {
    return { positions: [], exploredStates: 0 };
  }

  const conflictMasks = buildConflictMasks(candidates);
  const memo = new Map<number, number>();
  let exploredStates = 0;

  function solve(mask: number): number {
    if (mask === 0) return 0;
    const cached = memo.get(mask);
    if (cached !== undefined) return cached;
    exploredStates += 1;
    if (exploredStates > maxSearchStates) return 0;

    const pivot = choosePivot(mask, conflictMasks);
    const withoutPivot = solve(mask & ~(1 << pivot));
    const withPivot = (1 << pivot) | solve(mask & ~(1 << pivot) & ~conflictMasks[pivot]);
    const best = countMaskBits(withPivot) > countMaskBits(withoutPivot) ? withPivot : withoutPivot;
    memo.set(mask, best);
    return best;
  }

  return {
    positions: maskToPositions(solve((1 << candidates.length) - 1), candidates),
    exploredStates,
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
