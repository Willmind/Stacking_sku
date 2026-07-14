import { createLayerPositions, enumerateCandidates, type CandidatePattern } from "./candidates";
import { CONTAINERS, DEFAULT_CORNER_BLOCK, LOADING_STRATEGIES, type ContainerType } from "./constants";
import {
  boxesOverlap3d,
  collidesCornerBlock,
  collidesCornerObstruction,
  floorRectFromPosition,
  intersects,
  overlapsAnyFloorRect,
  positionFitsFloor,
  rectanglesOverlap,
  type FloorRect,
} from "./geometry";
import { getOrientations, normalizeAllowedOrientations, type CartonOrientationId } from "./orientations";
import type {
  BoxPosition,
  CartonSpec,
  ContainerSpec,
  CornerBlockSpec,
  EffectiveCornerBlockSpec,
  LoadingStrategy,
  NormalizedContainerClearance,
  PackingLayer,
  PackingOptions,
  PackingResult,
  PackingSummary,
  SkuInput,
  SkuSummary,
} from "./types";
import {
  createEffectiveContainer,
  hasSameSkuDimensions,
  normalizeCarton,
  normalizeContainer,
  normalizeContainerClearance,
  normalizeSkus,
} from "./validation";
export { describePackingStrategy } from "./strategyDescription";
export { CARTON_ORIENTATION_OPTIONS, DEFAULT_ALLOWED_ORIENTATION_IDS, getOrientations, normalizeAllowedOrientations } from "./orientations";
export type { CartonOrientationId } from "./orientations";

export type {
  BoxPosition,
  CartonSpec,
  ContainerClearanceSpec,
  ContainerSpec,
  CornerBlockSpec,
  LoadingStrategy,
  NormalizedContainerClearance,
  PackingLayer,
  PackingOptions,
  PackingPattern,
  PackingResult,
  PackingSummary,
  PackingStrategyNote,
  SkuInput,
  SkuSummary,
} from "./types";

type ContainerInput = ContainerType | ContainerSpec;
type NormalizedContainer = Required<ContainerSpec>;
interface AcceptedVerticalBand {
  start: number;
  end: number;
  positions: BoxPosition[];
}
interface AcceptedPositionIndex {
  bandsByKey: Map<string, AcceptedVerticalBand>;
  bands: AcceptedVerticalBand[];
  bandsAreDisjoint: boolean;
}
interface InternalPackingPattern {
  family: string;
  name?: string;
  occupiedLength: number;
  occupiedWidth: number;
  floorPositions?: BoxPosition[];
  [key: string]: unknown;
}
interface EvaluatedCandidatePattern extends CandidatePattern {
  floorPositions?: BoxPosition[];
  [key: string]: unknown;
}
type InternalPackingResult = Omit<PackingResult, "cornerBlock" | "effectiveContainer" | "clearance" | "pattern"> & {
  cornerBlock: EffectiveCornerBlockSpec;
  effectiveContainer?: NormalizedContainer;
  clearance?: NormalizedContainerClearance;
  pattern: InternalPackingPattern | null;
};
type EvaluatedCandidateResult = Omit<InternalPackingResult, "pattern"> & {
  pattern: EvaluatedCandidatePattern;
};

interface PackingSpace {
  container: NormalizedContainer;
  effectiveContainer: NormalizedContainer;
  clearance: NormalizedContainerClearance;
  cornerBlock: CornerBlockSpec;
  effectiveCornerBlock: EffectiveCornerBlockSpec;
}

interface CandidateTotal {
  totalBoxes: number;
  blockedByCornerTotal: number;
  perLayerBoxCount: number;
  layerPositions: BoxPosition[];
  usedHeight: number;
}

interface LoadingRowItem {
  basePosition: BoxPosition;
  faceIndex: number;
}

interface LoadingRow {
  key: string;
  items: LoadingRowItem[];
}

interface AxisInterval {
  start: number;
  end: number;
}

type PositionFace = BoxPosition[] & { assigned?: boolean };

function createPackingSpace(containerInput: ContainerInput, options: PackingOptions = {}): PackingSpace {
  const container = normalizeContainer(containerInput);
  const clearance = normalizeContainerClearance(options.clearance);
  const effectiveContainer = createEffectiveContainer(container, clearance);
  const cornerBlock = {
    ...DEFAULT_CORNER_BLOCK,
    ...(options.cornerBlock || {}),
  };
  const effectiveCornerBlock = {
    length: Math.max(0, cornerBlock.length - clearance.front),
    leftWidth: Math.max(0, cornerBlock.width - clearance.left),
    rightWidth: Math.max(0, cornerBlock.width - clearance.right),
    height: Math.max(0, cornerBlock.height - clearance.top),
  };

  return {
    container,
    effectiveContainer,
    clearance,
    cornerBlock,
    effectiveCornerBlock,
  };
}

function shiftPositionByClearance(position: BoxPosition, clearance: NormalizedContainerClearance): BoxPosition {
  const shiftedPosition = {
    ...position,
    x: position.x + clearance.front,
    y: position.y + clearance.left,
  };

  if (position.sourceFootprint) {
    shiftedPosition.sourceFootprint = {
      ...position.sourceFootprint,
      x: position.sourceFootprint.x + clearance.front,
      y: position.sourceFootprint.y + clearance.left,
    };
  }

  return shiftedPosition;
}

function applyPackingSpaceToResult(result: InternalPackingResult, packingSpace: PackingSpace): PackingResult {
  const shiftedLayerPositions = result.layerPositions.map((position) => shiftPositionByClearance(position, packingSpace.clearance));
  const shiftedOrderedPositions = result.orderedPositions.map((position) => shiftPositionByClearance(position, packingSpace.clearance));

  return {
    ...result,
    container: packingSpace.container,
    effectiveContainer: packingSpace.effectiveContainer,
    clearance: packingSpace.clearance,
    cornerBlock: packingSpace.cornerBlock,
    layerPositions: shiftedLayerPositions,
    orderedPositions: shiftedOrderedPositions,
    pattern: result.pattern
      ? {
          ...result.pattern,
          floorPositions: shiftedLayerPositions,
        }
      : null,
  };
}

function assignSequenceIndexes(positions: BoxPosition[]): BoxPosition[] {
  return positions.map((position, sequenceIndex) => ({
    ...position,
    sequenceIndex,
  }));
}

function groupPositionsByFace(positions: BoxPosition[]): PositionFace[] {
  const groups = new Map<number | undefined, PositionFace>();
  for (const position of positions) {
    if (!groups.has(position.faceIndex)) groups.set(position.faceIndex, []);
    groups.get(position.faceIndex)!.push(position);
  }
  return Array.from(groups.values()).map((group) => group.slice().sort((a, b) => a.stackIndex! - b.stackIndex! || b.y - a.y));
}

function assignMultiDestinationSkus(positions: BoxPosition[], skus: SkuInput[]): BoxPosition[] {
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

function assignSameDestinationSkus(positions: BoxPosition[], skus: SkuInput[]): BoxPosition[] {
  const faces = groupPositionsByFace(positions);
  const fullFaceAssignments: BoxPosition[] = [];
  const remainderPositions: BoxPosition[] = [];
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

  const assignedRemainders: BoxPosition[] = [];
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

function createCornerAvoidanceNudges(
  box: BoxPosition,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
): BoxPosition[] {
  const candidates = [box];
  const yStarts = [0, cornerBlock.leftWidth, container.width - cornerBlock.rightWidth - box.dy, container.width - box.dy];

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
      positionFitsFloor(candidate, container) &&
      list.findIndex((item) => `${item.x}:${item.y}:${item.z}:${item.dx}:${item.dy}` === key) === index
    );
  });
}

function findCornerSafePosition(
  position: BoxPosition,
  acceptedInHeightBand: BoxPosition[],
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
): BoxPosition | null {
  const acceptedRects = acceptedInHeightBand.map(floorRectFromPosition);

  for (const candidate of createCornerAvoidanceNudges(position, container, cornerBlock)) {
    if (collidesCornerObstruction(candidate, container, cornerBlock)) continue;
    if (overlapsAnyFloorRect(candidate, acceptedRects)) continue;
    return candidate;
  }

  return null;
}

function matchesPositionFootprint(a: BoxPosition, b: BoxPosition): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.dx === b.dx && a.dy === b.dy;
}

function findCornerDisplacedPosition(
  position: BoxPosition,
  acceptedInHeightBand: BoxPosition[],
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
): BoxPosition | null {
  let candidate = position;
  let adjusted = false;

  while (positionFitsFloor(candidate, container) && !collidesCornerObstruction(candidate, container, cornerBlock)) {
    const overlapping = acceptedInHeightBand.filter((accepted) =>
      rectanglesOverlap(floorRectFromPosition(candidate), floorRectFromPosition(accepted)),
    );

    if (overlapping.length === 0) {
      return adjusted
        ? {
            ...candidate,
            adjustedForCorner: candidate.y !== position.y,
          }
        : candidate;
    }

    if (!overlapping.some((accepted) => accepted.adjustedForCorner)) {
      return null;
    }

    const y = Math.max(...overlapping.map((accepted) => accepted.y + accepted.dy));
    if (y === candidate.y) return null;
    candidate = {
      ...candidate,
      y,
    };
    adjusted = true;
  }

  return null;
}

function resolveAcceptedStackPosition(
  position: BoxPosition,
  acceptedInHeightBand: BoxPosition[],
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
): BoxPosition | null {
  const acceptedRects = acceptedInHeightBand.map(floorRectFromPosition);

  if (collidesCornerObstruction(position, container, cornerBlock)) {
    return findCornerSafePosition(position, acceptedInHeightBand, container, cornerBlock);
  }
  if (acceptedInHeightBand.some((accepted) => matchesPositionFootprint(position, accepted))) {
    return findCornerDisplacedPosition(position, acceptedInHeightBand, container, cornerBlock);
  }
  if (overlapsAnyFloorRect(position, acceptedRects)) {
    return findCornerDisplacedPosition(position, acceptedInHeightBand, container, cornerBlock);
  }
  return position;
}

function getAcceptedPositionsInHeightBand(position: BoxPosition, acceptedPositions: AcceptedPositionIndex): BoxPosition[] {
  const start = position.z;
  const end = position.z + position.dz;
  if (acceptedPositions.bandsAreDisjoint) {
    return acceptedPositions.bandsByKey.get(`${start}:${end}`)?.positions || [];
  }

  const overlappingPositions: BoxPosition[] = [];
  for (const band of acceptedPositions.bands) {
    if (band.start >= end) break;
    if (band.end <= start) continue;
    overlappingPositions.push(...band.positions);
  }
  return overlappingPositions;
}

function acceptStackPosition(
  position: BoxPosition,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
  acceptedPositions: AcceptedPositionIndex,
): BoxPosition | null {
  const acceptedInHeightBand = getAcceptedPositionsInHeightBand(position, acceptedPositions);
  const acceptedPosition = resolveAcceptedStackPosition(position, acceptedInHeightBand, container, cornerBlock);

  if (acceptedPosition) {
    addPositionsToAcceptedPositionIndex(acceptedPositions, [acceptedPosition]);
  }

  return acceptedPosition;
}

function createStackedFacePositions(
  basePosition: BoxPosition,
  faceIndex: number,
  layerCount: number,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
  acceptedPositions: AcceptedPositionIndex,
): BoxPosition[] {
  const positions: BoxPosition[] = [];

  for (let stackIndex = 0; stackIndex < layerCount; stackIndex += 1) {
    const acceptedPosition = acceptStackPosition(
      {
        ...basePosition,
        z: stackIndex * basePosition.dz,
        faceIndex,
        stackIndex,
      },
      container,
      cornerBlock,
      acceptedPositions,
    );

    if (acceptedPosition) positions.push(acceptedPosition);
  }

  return positions;
}

function orderFloorPositionsForPlacement(floorPositions: BoxPosition[]): BoxPosition[] {
  return floorPositions.slice().sort((a, b) => a.x - b.x || a.y - b.y || getLoadingRowSortValue(a) - getLoadingRowSortValue(b));
}

function getLoadingRowSortValue(position: BoxPosition): number {
  return Number.isFinite(position.loadingRowIndex) ? (position.loadingRowIndex as number) : position.x;
}

function getLoadingRowKey(position: BoxPosition): string {
  return `x:${position.x}`;
}

function groupFloorPositionsByLoadingRow(orderedFloor: LoadingRowItem[]): LoadingRow[] {
  const groups: LoadingRow[] = [];

  for (const item of orderedFloor) {
    const key = getLoadingRowKey(item.basePosition);
    const previous = groups[groups.length - 1];
    if (previous && previous.key === key) {
      previous.items.push(item);
    } else {
      groups.push({
        key,
        items: [item],
      });
    }
  }

  return groups;
}

function createOrderedPositionsFromFloor(
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
  floorPositions: BoxPosition[],
): BoxPosition[] {
  const maxStackCount = floorPositions.reduce((maxCount, position) => Math.max(maxCount, Math.floor(container.height / position.dz)), 0);
  const orderedFloor = orderFloorPositionsForPlacement(floorPositions).map((basePosition, faceIndex) => ({
    basePosition,
    faceIndex,
  }));
  const loadingRows = groupFloorPositionsByLoadingRow(orderedFloor);
  const positions: BoxPosition[] = [];
  const acceptedPositions = createAcceptedPositionIndex([], new Set(floorPositions.map((position) => position.dz)).size === 1);

  for (const row of loadingRows) {
    for (let stackIndex = 0; stackIndex < maxStackCount; stackIndex += 1) {
      for (const { basePosition, faceIndex } of row.items) {
        if (stackIndex * basePosition.dz + basePosition.dz > container.height) continue;
        const acceptedPosition = acceptStackPosition(
          {
            ...basePosition,
            z: stackIndex * basePosition.dz,
            faceIndex,
            stackIndex,
          },
          container,
          cornerBlock,
          acceptedPositions,
        );

        if (acceptedPosition) positions.push(acceptedPosition);
      }
    }
  }

  return assignSequenceIndexes(positions);
}

function evaluateCandidate(
  container: NormalizedContainer,
  carton: CartonSpec,
  pattern: CandidatePattern,
  cornerBlock: EffectiveCornerBlockSpec,
): EvaluatedCandidateResult {
  const basePositions = [...createLayerPositions(pattern), ...(pattern.extraLayerPositions || [])].sort((a, b) => a.x - b.x || a.y - b.y);
  const evaluatedPattern: EvaluatedCandidatePattern = {
    ...pattern,
    occupiedLength: getOccupiedLength(basePositions),
    occupiedWidth: getOccupiedWidth(basePositions),
  };
  const orderedPositions = createOrderedPositionsFromFloor(container, cornerBlock, basePositions);
  const totalBoxes = orderedPositions.length;
  const potentialBoxCount = basePositions.reduce((sum, position) => sum + Math.floor(container.height / position.dz), 0);
  const blockedByCornerTotal = potentialBoxCount - totalBoxes;
  const layers = createLayersFromPositions(orderedPositions);

  const volumeLoaded = totalBoxes * carton.length * carton.width * carton.height;
  const containerVolume = container.length * container.width * container.height;

  return {
    container,
    carton,
    cornerBlock,
    pattern: evaluatedPattern,
    layerPositions: basePositions,
    orderedPositions,
    perLayerBoxCount: basePositions.length,
    layers,
    totalBoxes,
    blockedByCornerTotal,
    usedHeight: calculateUsedHeight(orderedPositions),
    utilizationRatio: containerVolume > 0 ? volumeLoaded / containerVolume : 0,
  };
}

function layerCollidesWithTopBand(
  stackIndex: number,
  cartonHeight: number,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
): boolean {
  return intersects(stackIndex * cartonHeight, cartonHeight, container.height - cornerBlock.height, cornerBlock.height);
}

function countAcceptedPositionsForStack(
  orderedBasePositions: BoxPosition[],
  stackIndex: number,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
): number {
  const acceptedInStackBand: BoxPosition[] = [];

  for (const basePosition of orderedBasePositions) {
    const position = {
      ...basePosition,
      z: stackIndex * basePosition.dz,
      stackIndex,
    };
    const acceptedRects = acceptedInStackBand.map(floorRectFromPosition);
    let acceptedPosition: BoxPosition | null;

    if (collidesCornerObstruction(position, container, cornerBlock)) {
      acceptedPosition = findCornerSafePosition(position, acceptedInStackBand, container, cornerBlock);
    } else if (acceptedInStackBand.some((accepted) => matchesPositionFootprint(position, accepted))) {
      acceptedPosition = findCornerDisplacedPosition(position, acceptedInStackBand, container, cornerBlock);
    } else if (overlapsAnyFloorRect(position, acceptedRects)) {
      acceptedPosition = findCornerDisplacedPosition(position, acceptedInStackBand, container, cornerBlock);
    } else {
      acceptedPosition = position;
    }

    if (acceptedPosition) {
      acceptedInStackBand.push(acceptedPosition);
    }
  }

  return acceptedInStackBand.length;
}

function evaluateCandidateTotal(
  container: NormalizedContainer,
  _carton: CartonSpec,
  pattern: CandidatePattern,
  cornerBlock: EffectiveCornerBlockSpec,
): CandidateTotal {
  const basePositions = [...createLayerPositions(pattern), ...(pattern.extraLayerPositions || [])].sort((a, b) => a.x - b.x || a.y - b.y);
  const uniqueHeights = new Set(basePositions.map((position) => position.dz));

  if (uniqueHeights.size === 1) {
    const [cartonHeight] = Array.from(uniqueHeights);
    const layerCount = Math.floor(container.height / cartonHeight);
    const perLayerBoxCount = basePositions.length;
    const orderedBasePositions = orderFloorPositionsForPlacement(basePositions);
    let totalBoxes = 0;
    let highestAcceptedStackIndex = -1;

    for (let stackIndex = 0; stackIndex < layerCount; stackIndex += 1) {
      const acceptedCount = layerCollidesWithTopBand(stackIndex, cartonHeight, container, cornerBlock)
        ? countAcceptedPositionsForStack(orderedBasePositions, stackIndex, container, cornerBlock)
        : perLayerBoxCount;
      totalBoxes += acceptedCount;
      if (acceptedCount > 0) highestAcceptedStackIndex = stackIndex;
    }

    return {
      totalBoxes,
      blockedByCornerTotal: perLayerBoxCount * layerCount - totalBoxes,
      perLayerBoxCount,
      layerPositions: basePositions,
      usedHeight: highestAcceptedStackIndex >= 0 ? (highestAcceptedStackIndex + 1) * cartonHeight : 0,
    };
  }

  const orderedPositions = createOrderedPositionsFromFloor(container, cornerBlock, basePositions);
  const totalBoxes = orderedPositions.length;
  const potentialBoxCount = basePositions.reduce((sum, position) => sum + Math.floor(container.height / position.dz), 0);
  return {
    totalBoxes,
    blockedByCornerTotal: potentialBoxCount - totalBoxes,
    perLayerBoxCount: basePositions.length,
    layerPositions: basePositions,
    usedHeight: calculateUsedHeight(orderedPositions),
  };
}

function compareResults(next: EvaluatedCandidateResult, current: EvaluatedCandidateResult | null): boolean {
  if (!current) return true;
  if (next.totalBoxes !== current.totalBoxes) {
    return next.totalBoxes > current.totalBoxes;
  }
  if (next.blockedByCornerTotal !== current.blockedByCornerTotal) {
    return next.blockedByCornerTotal < current.blockedByCornerTotal;
  }
  if (next.pattern.perLayerBoxCount !== current.pattern.perLayerBoxCount) {
    return next.pattern.perLayerBoxCount > current.pattern.perLayerBoxCount;
  }
  return false;
}

function compareCandidateTotals(next: CandidateTotal, current: CandidateTotal | null): boolean {
  if (!current) return true;
  if (next.totalBoxes !== current.totalBoxes) {
    return next.totalBoxes > current.totalBoxes;
  }
  if (next.blockedByCornerTotal !== current.blockedByCornerTotal) {
    return next.blockedByCornerTotal < current.blockedByCornerTotal;
  }
  if (next.perLayerBoxCount !== current.perLayerBoxCount) {
    return next.perLayerBoxCount > current.perLayerBoxCount;
  }
  return false;
}

function calculateUsedHeight(positions: BoxPosition[]): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions.map((position) => position.z + position.dz));
}

function calculatePositionsVolume(positions: BoxPosition[]): number {
  return positions.reduce((sum, position) => sum + position.dx * position.dy * position.dz, 0);
}

function getOccupiedLength(positions: BoxPosition[]): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions.map((position) => position.x + position.dx));
}

function getOccupiedWidth(positions: BoxPosition[]): number {
  if (positions.length === 0) return 0;
  return mergeOccupiedAxisIntervals(
    positions.map((position) => ({
      start: position.y,
      end: position.y + position.dy,
    })),
  );
}

function mergeOccupiedAxisIntervals(intervals: AxisInterval[]): number {
  const sortedIntervals = intervals
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (sortedIntervals.length === 0) return 0;

  let occupied = 0;
  let currentStart = sortedIntervals[0].start;
  let currentEnd = sortedIntervals[0].end;

  for (const interval of sortedIntervals.slice(1)) {
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
      continue;
    }

    occupied += currentEnd - currentStart;
    currentStart = interval.start;
    currentEnd = interval.end;
  }

  return occupied + currentEnd - currentStart;
}

function getPositionFootprint(position: BoxPosition): FloorRect {
  return position.sourceFootprint || position;
}

function footprintRectFromPosition(position: BoxPosition): FloorRect {
  const footprint = getPositionFootprint(position);
  return {
    x: footprint.x,
    y: footprint.y,
    dx: footprint.dx,
    dy: footprint.dy,
  };
}

function uniqueFloorRectsFromPositions(positions: BoxPosition[]): FloorRect[] {
  const seen = new Set<string>();
  const rects: FloorRect[] = [];

  for (const position of positions) {
    const rect = footprintRectFromPosition(position);
    const key = `${rect.x}:${rect.y}:${rect.dx}:${rect.dy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rects.push(rect);
  }

  return rects;
}

function groupPositionsBySourceFootprint(positions: BoxPosition[]): BoxPosition[][] {
  const groups = new Map<string, BoxPosition[]>();

  for (const position of positions) {
    const footprint = getPositionFootprint(position);
    const key = `${footprint.x}:${footprint.y}:${footprint.dx}:${footprint.dy}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(position);
  }

  return Array.from(groups.values());
}

function shiftHeterogeneousPosition(position: BoxPosition, deltaX: number): BoxPosition {
  const footprint = getPositionFootprint(position);
  return {
    ...position,
    x: position.x + deltaX,
    sourceFootprint: {
      ...footprint,
      x: footprint.x + deltaX,
    },
  };
}

function canPlaceHeterogeneousGroup(
  group: BoxPosition[],
  deltaX: number,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
  occupiedPositions: BoxPosition[],
  occupiedRects: FloorRect[],
): boolean {
  const shiftedGroup = group.map((position) => shiftHeterogeneousPosition(position, deltaX));
  const footprint = getPositionFootprint(shiftedGroup[0]);

  if (
    !positionFitsFloor(
      {
        x: footprint.x,
        y: footprint.y,
        dx: footprint.dx,
        dy: footprint.dy,
      },
      container,
    ) ||
    overlapsAnyFloorRect(footprint, occupiedRects)
  ) {
    return false;
  }

  for (const position of shiftedGroup) {
    if (!positionFitsFloor(position, container)) return false;
    if (position.z + position.dz > container.height) return false;
    if (collidesCornerObstruction(position, container, cornerBlock)) return false;
    if (occupiedPositions.some((occupied) => boxesOverlap3d(position, occupied))) return false;
  }

  return true;
}

function createLeftCompactionCandidates(footprint: FloorRect, occupiedRects: FloorRect[]): number[] {
  const candidates = new Set([0, footprint.x]);

  for (const rect of occupiedRects) {
    if (!intersects(footprint.y, footprint.dy, rect.y, rect.dy)) continue;
    candidates.add(rect.x + rect.dx);
  }

  return Array.from(candidates)
    .filter((x) => Number.isFinite(x) && x >= 0 && x <= footprint.x)
    .sort((a, b) => a - b);
}

function compactHeterogeneousPositionsLeft(
  container: NormalizedContainer,
  positions: BoxPosition[],
  occupiedPositions: BoxPosition[],
  cornerBlock: EffectiveCornerBlockSpec,
): BoxPosition[] {
  const compactedPositionByOriginal = new Map<BoxPosition, BoxPosition>();
  const acceptedPositions = occupiedPositions.slice();
  const acceptedRects = uniqueFloorRectsFromPositions(acceptedPositions);

  for (const group of groupPositionsBySourceFootprint(positions)) {
    const footprint = getPositionFootprint(group[0]);
    let compactedGroup = group;

    for (const candidateX of createLeftCompactionCandidates(footprint, acceptedRects)) {
      const deltaX = candidateX - footprint.x;
      if (!canPlaceHeterogeneousGroup(group, deltaX, container, cornerBlock, acceptedPositions, acceptedRects)) {
        continue;
      }
      compactedGroup = group.map((position) => shiftHeterogeneousPosition(position, deltaX));
      break;
    }

    group.forEach((position, index) => {
      compactedPositionByOriginal.set(position, compactedGroup[index]);
    });
    acceptedPositions.push(...compactedGroup);
    acceptedRects.push(footprintRectFromPosition(compactedGroup[0]));
  }

  return positions.map((position) => compactedPositionByOriginal.get(position) || position);
}

function createLayersFromPositions(positions: BoxPosition[]): PackingLayer[] {
  const layersByIndex = new Map<number, PackingLayer>();
  for (const position of positions) {
    const index = Number.isFinite(position.stackIndex) ? (position.stackIndex as number) : 0;
    if (!layersByIndex.has(index)) {
      layersByIndex.set(index, {
        index,
        z: position.z,
        boxCount: 0,
        blockedByCorner: 0,
      });
    }
    const layer = layersByIndex.get(index)!;
    layer.z = Math.min(layer.z, position.z);
    layer.boxCount += 1;
  }

  return Array.from(layersByIndex.values()).sort((a, b) => a.index - b.index);
}

function summarizeSkuAllocation(skus: SkuInput[], positions: BoxPosition[]): SkuSummary[] {
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

function createZeroCornerBlock(): EffectiveCornerBlockSpec {
  return {
    length: 0,
    leftWidth: 0,
    rightWidth: 0,
    height: 0,
  };
}

function getEffectiveAllowedOrientations(sku: SkuInput, options: PackingOptions = {}): CartonOrientationId[] {
  return normalizeAllowedOrientations(sku.allowedOrientations || options.allowedOrientations);
}

function getSkuPackingOptions(sku: SkuInput, options: PackingOptions = {}): PackingOptions {
  return {
    ...options,
    allowedOrientations: getEffectiveAllowedOrientations(sku, options),
  };
}

function hasSameSkuOrientationRules(skus: SkuInput[], options: PackingOptions = {}): boolean {
  const first = getEffectiveAllowedOrientations(skus[0], options).join("|");
  return skus.every((sku) => getEffectiveAllowedOrientations(sku, options).join("|") === first);
}

function createZoneCornerBlock(cornerBlock: EffectiveCornerBlockSpec, offsetX: number): EffectiveCornerBlockSpec {
  return {
    ...cornerBlock,
    length: Math.max(0, cornerBlock.length - offsetX),
  };
}

function reindexHeterogeneousPositions(positions: BoxPosition[]): {
  orderedPositions: BoxPosition[];
  layerPositions: BoxPosition[];
} {
  const faceIndexByKey = new Map<string, number>();
  const stackCountByKey = new Map<string, number>();
  const layerPositions: BoxPosition[] = [];

  const indexedPositions = positions.map((position, sequenceIndex) => {
    const { sourceFootprint, ...publicPosition } = position;
    const footprint = sourceFootprint || position;
    const faceKey = `${footprint.x}:${footprint.y}:${footprint.dx}:${footprint.dy}`;
    if (!faceIndexByKey.has(faceKey)) {
      faceIndexByKey.set(faceKey, layerPositions.length);
      const layerPosition = { ...publicPosition };
      delete layerPosition.adjustedForCorner;
      layerPositions.push({
        ...layerPosition,
        x: footprint.x,
        y: footprint.y,
        dx: footprint.dx,
        dy: footprint.dy,
        z: 0,
        stackIndex: 0,
        sequenceIndex: layerPositions.length,
      });
    }

    const stackIndex = stackCountByKey.get(faceKey) || 0;
    stackCountByKey.set(faceKey, stackIndex + 1);

    return {
      ...publicPosition,
      faceIndex: faceIndexByKey.get(faceKey),
      stackIndex,
      sequenceIndex,
    };
  });

  return {
    orderedPositions: indexedPositions,
    layerPositions,
  };
}

function createHeterogeneousSourceFootprint(
  zoneResult: Pick<PackingResult, "layerPositions">,
  position: BoxPosition,
  offsetX: number,
): FloorRect {
  const source = zoneResult.layerPositions[position.faceIndex!] || position;
  return {
    x: source.x + offsetX,
    y: source.y,
    dx: source.dx,
    dy: source.dy,
  };
}

function createAcceptedPositionIndex(positions: BoxPosition[] = [], bandsAreDisjoint = false): AcceptedPositionIndex {
  const index: AcceptedPositionIndex = {
    bandsByKey: new Map(),
    bands: [],
    bandsAreDisjoint,
  };
  addPositionsToAcceptedPositionIndex(index, positions);
  return index;
}

function cloneAcceptedPositionIndex(index: AcceptedPositionIndex): AcceptedPositionIndex {
  const bands = index.bands.map((band) => ({
    ...band,
    positions: band.positions.slice(),
  }));
  return {
    bandsByKey: new Map(bands.map((band) => [`${band.start}:${band.end}`, band])),
    bands,
    bandsAreDisjoint: index.bandsAreDisjoint,
  };
}

function addPositionsToAcceptedPositionIndex(index: AcceptedPositionIndex, positions: BoxPosition[]): void {
  for (const position of positions) {
    const start = position.z;
    const end = position.z + position.dz;
    const key = `${start}:${end}`;
    let band = index.bandsByKey.get(key);
    if (!band) {
      band = { start, end, positions: [] };
      index.bandsByKey.set(key, band);
      const insertionIndex = index.bands.findIndex((item) => item.start > start || (item.start === start && item.end > end));
      if (insertionIndex < 0) index.bands.push(band);
      else index.bands.splice(insertionIndex, 0, band);
    }
    band.positions.push(position);
  }
}

function isHeterogeneousPosition3dSafe(
  position: BoxPosition,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
  occupiedPositions: BoxPosition[],
): boolean {
  if (!positionFitsFloor(position, container)) return false;
  if (position.z < 0 || position.z + position.dz > container.height) return false;
  if (collidesCornerObstruction(position, container, cornerBlock)) return false;
  return !occupiedPositions.some((occupied) => boxesOverlap3d(position, occupied));
}

function selectSafeHeterogeneousStackPositions(
  stackPositions: BoxPosition[],
  limit: number,
  container: NormalizedContainer,
  cornerBlock: EffectiveCornerBlockSpec,
  occupiedPositions: BoxPosition[],
): BoxPosition[] {
  const selected: BoxPosition[] = [];

  for (const position of stackPositions.slice().sort((a, b) => a.z - b.z || a.stackIndex! - b.stackIndex!)) {
    if (selected.length >= limit) break;
    if (!isHeterogeneousPosition3dSafe(position, container, cornerBlock, [...occupiedPositions, ...selected])) {
      break;
    }
    selected.push(position);
  }

  return selected;
}

function createBackfillStartCandidates(occupiedRects: FloorRect[], limit: number, size: number, boundary: "x" | "y"): number[] {
  const starts = new Set([0, Math.max(0, limit - size)]);
  const dimension = boundary === "x" ? "dx" : "dy";

  for (const rect of occupiedRects) {
    const start = rect[boundary];
    const end = start + rect[dimension];
    starts.add(start);
    starts.add(end);
    starts.add(start - size);
    starts.add(end - size);
  }

  return Array.from(starts)
    .filter((start) => Number.isFinite(start) && start >= 0 && start + size <= limit)
    .sort((a, b) => a - b);
}

function createBackfillFootprintCandidates(
  container: NormalizedContainer,
  sku: SkuInput,
  occupiedPositions: BoxPosition[],
  maxLength: number,
): BoxPosition[] {
  if (maxLength <= 0) return [];

  const occupiedRects = uniqueFloorRectsFromPositions(occupiedPositions);
  const orientations = getOrientations(sku, sku.allowedOrientations);
  const candidates: BoxPosition[] = [];
  const seen = new Set<string>();

  for (const orientation of orientations) {
    const xStarts = createBackfillStartCandidates(occupiedRects, maxLength, orientation.x, "x");
    const yStarts = createBackfillStartCandidates(occupiedRects, container.width, orientation.y, "y");

    for (const x of xStarts) {
      for (const y of yStarts) {
        const candidate = {
          x,
          y,
          z: 0,
          dx: orientation.x,
          dy: orientation.y,
          dz: orientation.z,
          orientationId: orientation.id,
          label: orientation.label,
          source: "heterogeneous-backfill",
        };
        const key = `${candidate.x}:${candidate.y}:${candidate.dx}:${candidate.dy}`;
        if (seen.has(key)) continue;
        if (!positionFitsFloor(candidate, container)) continue;
        if (candidate.x + candidate.dx > maxLength) continue;
        if (overlapsAnyFloorRect(candidate, occupiedRects)) continue;
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }

  return candidates.sort((a, b) => a.x - b.x || b.y - a.y || a.dx - b.dx || a.dy - b.dy);
}

function createHeterogeneousBackfillPositions(
  container: NormalizedContainer,
  sku: SkuInput,
  target: number,
  occupiedPositions: BoxPosition[],
  maxLength: number,
  cornerBlock: EffectiveCornerBlockSpec,
): BoxPosition[] {
  if (target <= 0 || occupiedPositions.length === 0 || maxLength <= 0) return [];

  const acceptedPositionIndex = createAcceptedPositionIndex(occupiedPositions);
  const acceptedPositions = occupiedPositions.slice();
  const acceptedFloorRects = uniqueFloorRectsFromPositions(occupiedPositions);
  const candidates = createBackfillFootprintCandidates(container, sku, occupiedPositions, maxLength);
  const selectedPositions: BoxPosition[] = [];

  candidates.forEach((candidate, candidateIndex) => {
    if (selectedPositions.length >= target) return;
    if (overlapsAnyFloorRect(candidate, acceptedFloorRects)) return;

    const candidateAcceptedPositionIndex = cloneAcceptedPositionIndex(acceptedPositionIndex);
    const layerCount = Math.floor(container.height / candidate.dz);
    const stackPositions = createStackedFacePositions(
      candidate,
      candidateIndex,
      layerCount,
      container,
      cornerBlock,
      candidateAcceptedPositionIndex,
    );
    if (stackPositions.length === 0) return;

    const sourceFootprint = {
      x: candidate.x,
      y: candidate.y,
      dx: candidate.dx,
      dy: candidate.dy,
    };
    const remaining = target - selectedPositions.length;
    const safeStackPositions = selectSafeHeterogeneousStackPositions(stackPositions, remaining, container, cornerBlock, acceptedPositions);
    if (safeStackPositions.length === 0) return;

    const acceptedStackPositions = safeStackPositions.map((position) => ({
      ...position,
      sourceFootprint,
      skuLabel: sku.label,
      skuColor: sku.color,
    }));
    selectedPositions.push(...acceptedStackPositions);
    acceptedPositions.push(...acceptedStackPositions);
    addPositionsToAcceptedPositionIndex(acceptedPositionIndex, acceptedStackPositions);
    acceptedFloorRects.push(footprintRectFromPosition(acceptedStackPositions[0]));
  });

  return selectedPositions;
}

function calculateSameDimensionMultiSkuPacking(
  containerInput: ContainerInput,
  skus: SkuInput[],
  options: PackingOptions,
  strategy: LoadingStrategy,
): PackingResult {
  const firstSku = skus[0];
  const firstSkuOptions = getSkuPackingOptions(firstSku, options);
  const baseResult = calculatePackingOnce(
    containerInput,
    { length: firstSku.length, width: firstSku.width, height: firstSku.height },
    firstSkuOptions,
  );
  const sourcePositions = baseResult.orderedPositions || [];
  const assignedPositions =
    strategy === LOADING_STRATEGIES.SAME_DESTINATION
      ? assignSameDestinationSkus(sourcePositions, skus)
      : assignMultiDestinationSkus(sourcePositions, skus);
  const skuSummary = summarizeSkuAllocation(skus, assignedPositions);
  const layers = baseResult.layers.map((layer) => ({
    ...layer,
    boxCount: assignedPositions.filter((position) => position.stackIndex === layer.index).length,
  }));
  const volumeContainer = baseResult.effectiveContainer || baseResult.container;
  const containerVolume = volumeContainer.length * volumeContainer.width * volumeContainer.height;
  const volumeLoaded = calculatePositionsVolume(assignedPositions);

  return {
    ...baseResult,
    mode: "multi",
    strategy,
    skus,
    orderedPositions: assignedPositions,
    layers,
    totalBoxes: assignedPositions.length,
    usedHeight: calculateUsedHeight(assignedPositions),
    utilizationRatio: containerVolume > 0 ? volumeLoaded / containerVolume : 0,
    skuSummary,
  };
}

function calculateHeterogeneousMultiSkuPacking(
  containerInput: ContainerInput,
  skus: SkuInput[],
  options: PackingOptions,
  strategy: LoadingStrategy,
): PackingResult {
  const packingSpace = createPackingSpace(containerInput, options);
  const container = packingSpace.effectiveContainer;
  const cornerBlock = packingSpace.effectiveCornerBlock;
  const assignedPositions: BoxPosition[] = [];
  const groups: Array<{ label: string; count: number; occupiedLength: number; occupiedWidth: number }> = [];
  let cursorX = 0;
  let blockedByCornerTotal = 0;

  for (const sku of skus) {
    const skuPackingOptions = getSkuPackingOptions(sku, options);
    const effectiveSku = {
      ...sku,
      allowedOrientations: skuPackingOptions.allowedOrientations,
    };
    const skuPositions: BoxPosition[] = [];
    let remainingTarget = sku.target;

    const backfillPositions = createHeterogeneousBackfillPositions(
      container,
      effectiveSku,
      remainingTarget,
      assignedPositions,
      cursorX,
      cornerBlock,
    );
    assignedPositions.push(...backfillPositions);
    skuPositions.push(...backfillPositions);
    remainingTarget -= backfillPositions.length;

    const remainingLength = container.length - cursorX;
    let zoneUsedLength = 0;
    if (remainingTarget > 0 && remainingLength > 0) {
      const zoneContainer = {
        ...container,
        id: "CUSTOM",
        name: `${sku.label} 装载分区`,
        length: remainingLength,
      };
      const zoneCornerBlock = cursorX >= cornerBlock.length ? createZeroCornerBlock() : createZoneCornerBlock(cornerBlock, cursorX);
      const zoneResult = calculatePackingInEffectiveSpaceOnce(
        zoneContainer,
        { length: sku.length, width: sku.width, height: sku.height },
        zoneCornerBlock,
        skuPackingOptions.allowedOrientations,
      );
      const selectedPositions = zoneResult.orderedPositions.slice(0, remainingTarget);
      const offsetPositions = selectedPositions.map((position) => ({
        ...position,
        x: position.x + cursorX,
        sourceFootprint: createHeterogeneousSourceFootprint(zoneResult, position, cursorX),
        skuLabel: sku.label,
        skuColor: sku.color,
      }));
      const compactedOffsetPositions = compactHeterogeneousPositionsLeft(container, offsetPositions, assignedPositions, cornerBlock);

      assignedPositions.push(...compactedOffsetPositions);
      skuPositions.push(...compactedOffsetPositions);
      blockedByCornerTotal += zoneResult.blockedByCornerTotal;
      zoneUsedLength = selectedPositions.length === 0 ? 0 : getOccupiedLength(selectedPositions);
    }
    groups.push({
      label: sku.label,
      count: skuPositions.length,
      occupiedLength: skuPositions.length === 0 ? 0 : getOccupiedLength(skuPositions),
      occupiedWidth: getOccupiedWidth(skuPositions),
    });
    if (zoneUsedLength > 0) {
      cursorX = Math.max(cursorX, getOccupiedLength(assignedPositions));
    }
  }

  const { orderedPositions, layerPositions } = reindexHeterogeneousPositions(assignedPositions);
  const layers = createLayersFromPositions(orderedPositions);
  const totalBoxes = orderedPositions.length;
  const usedHeight = calculateUsedHeight(orderedPositions);
  const occupiedLength = getOccupiedLength(orderedPositions);
  const occupiedWidth = getOccupiedWidth(orderedPositions);
  const containerVolume = container.length * container.width * container.height;
  const volumeLoaded = calculatePositionsVolume(orderedPositions);

  return applyPackingSpaceToResult(
    {
      container,
      effectiveContainer: container,
      clearance: packingSpace.clearance,
      carton: {
        length: skus[0].length,
        width: skus[0].width,
        height: skus[0].height,
      },
      cornerBlock,
      pattern:
        totalBoxes > 0
          ? {
              family: "heterogeneous-zones",
              name: "异尺寸按 SKU 顺序分区",
              occupiedLength,
              occupiedWidth,
              floorPositions: layerPositions,
              groups,
            }
          : null,
      layerPositions,
      orderedPositions,
      perLayerBoxCount: layers.reduce((max, layer) => Math.max(max, layer.boxCount), 0),
      layers,
      totalBoxes,
      blockedByCornerTotal,
      usedHeight,
      utilizationRatio: containerVolume > 0 ? volumeLoaded / containerVolume : 0,
      mode: "multi",
      strategy,
      skus,
      skuSummary: summarizeSkuAllocation(skus, orderedPositions),
    },
    packingSpace,
  );
}

function calculatePackingInEffectiveSpaceOnce(
  container: NormalizedContainer,
  cartonInput: CartonSpec,
  cornerBlock: EffectiveCornerBlockSpec,
  allowedOrientationIds?: CartonOrientationId[],
): InternalPackingResult {
  const carton = normalizeCarton(cartonInput);
  const allowedOrientations = normalizeAllowedOrientations(allowedOrientationIds);

  const candidates = enumerateCandidates(container, carton, allowedOrientations);
  let best: EvaluatedCandidateResult | null = null;

  for (const candidate of candidates) {
    const result = evaluateCandidate(container, carton, candidate, cornerBlock);
    if (compareResults(result, best)) {
      best = result;
    }
  }

  if (!best) {
    return {
      container,
      carton,
      cornerBlock,
      pattern: null,
      layerPositions: [],
      orderedPositions: [],
      perLayerBoxCount: 0,
      layers: [],
      totalBoxes: 0,
      blockedByCornerTotal: 0,
      usedHeight: 0,
      utilizationRatio: 0,
    };
  }

  return best;
}

function calculatePackingOnce(containerInput: ContainerInput, cartonInput: CartonSpec, options: PackingOptions = {}): PackingResult {
  const packingSpace = createPackingSpace(containerInput, options);
  const result = calculatePackingInEffectiveSpaceOnce(
    packingSpace.effectiveContainer,
    cartonInput,
    packingSpace.effectiveCornerBlock,
    options.allowedOrientations,
  );

  return applyPackingSpaceToResult(result, packingSpace);
}

function calculatePackingTotalBoxesOnce(containerInput: ContainerInput, cartonInput: CartonSpec, options: PackingOptions = {}): number {
  const packingSpace = createPackingSpace(containerInput, options);
  const container = packingSpace.effectiveContainer;
  const carton = normalizeCarton(cartonInput);
  const cornerBlock = packingSpace.effectiveCornerBlock;
  const allowedOrientations = normalizeAllowedOrientations(options.allowedOrientations);

  const candidates = enumerateCandidates(container, carton, allowedOrientations);
  let best: CandidateTotal | null = null;

  for (const candidate of candidates) {
    const result = evaluateCandidateTotal(container, carton, candidate, cornerBlock);
    if (compareCandidateTotals(result, best)) {
      best = result;
    }
  }

  return best ? best.totalBoxes : 0;
}

function calculatePackingSummaryOnce(
  containerInput: ContainerInput,
  cartonInput: CartonSpec,
  options: PackingOptions = {},
): PackingSummary {
  const packingSpace = createPackingSpace(containerInput, options);
  const container = packingSpace.effectiveContainer;
  const carton = normalizeCarton(cartonInput);
  const cornerBlock = packingSpace.effectiveCornerBlock;
  const allowedOrientations = normalizeAllowedOrientations(options.allowedOrientations);

  const candidates = enumerateCandidates(container, carton, allowedOrientations);
  let best: CandidateTotal | null = null;

  for (const candidate of candidates) {
    const result = evaluateCandidateTotal(container, carton, candidate, cornerBlock);
    if (compareCandidateTotals(result, best)) {
      best = result;
    }
  }

  return {
    container: packingSpace.container,
    effectiveContainer: packingSpace.effectiveContainer,
    clearance: packingSpace.clearance,
    totalBoxes: best ? best.totalBoxes : 0,
    blockedByCornerTotal: best ? best.blockedByCornerTotal : 0,
    perLayerBoxCount: best ? best.perLayerBoxCount : 0,
    occupiedLength: best ? getOccupiedLength(best.layerPositions) : 0,
    occupiedWidth: best ? getOccupiedWidth(best.layerPositions) : 0,
    usedHeight: best ? best.usedHeight : 0,
  };
}

function calculateMultiSkuPackingOnce(containerInput: ContainerInput, skuInputs: SkuInput[], options: PackingOptions = {}): PackingResult {
  const skus = normalizeSkus(skuInputs);
  const strategy = options.strategy || LOADING_STRATEGIES.MULTI_DESTINATION;
  if (!Object.values(LOADING_STRATEGIES).includes(strategy)) {
    throw new Error("装载策略必须为 multi-destination 或 same-destination");
  }

  return hasSameSkuDimensions(skus) && hasSameSkuOrientationRules(skus, options)
    ? calculateSameDimensionMultiSkuPacking(containerInput, skus, options, strategy)
    : calculateHeterogeneousMultiSkuPacking(containerInput, skus, options, strategy);
}

function hasAsymmetricActiveCorner(options: PackingOptions): boolean {
  const clearance = normalizeContainerClearance(options.clearance);
  const cornerBlock = {
    ...DEFAULT_CORNER_BLOCK,
    ...(options.cornerBlock || {}),
  };
  if (cornerBlock.length <= clearance.front || cornerBlock.height <= clearance.top) return false;

  const leftWidth = Math.max(0, cornerBlock.width - clearance.left);
  const rightWidth = Math.max(0, cornerBlock.width - clearance.right);
  return leftWidth !== rightWidth;
}

function swapSideClearance(options: PackingOptions): PackingOptions {
  const clearance = options.clearance || {};
  return {
    ...options,
    clearance: {
      ...clearance,
      left: clearance.right ?? 0,
      right: clearance.left ?? 0,
    },
  };
}

function mirrorPositionAcrossWidth(position: BoxPosition, width: number): BoxPosition {
  const mirroredPosition = {
    ...position,
    y: width - position.y - position.dy,
  };

  if (position.sourceFootprint) {
    mirroredPosition.sourceFootprint = {
      ...position.sourceFootprint,
      y: width - position.sourceFootprint.y - position.sourceFootprint.dy,
    };
  }

  return mirroredPosition;
}

function mirrorPackingResult(result: PackingResult, originalSpaceResult: PackingResult): PackingResult {
  const containerWidth = originalSpaceResult.container.width;
  const mirroredLayerPositions = result.layerPositions.map((position) => mirrorPositionAcrossWidth(position, containerWidth));
  const mirroredOrderedPositions = result.orderedPositions.map((position) => mirrorPositionAcrossWidth(position, containerWidth));
  const mirroredExtraLayerPositions = Array.isArray(result.pattern?.extraLayerPositions)
    ? (result.pattern.extraLayerPositions as BoxPosition[]).map((position) =>
        mirrorPositionAcrossWidth(position, originalSpaceResult.effectiveContainer.width),
      )
    : undefined;

  return {
    ...result,
    container: originalSpaceResult.container,
    effectiveContainer: originalSpaceResult.effectiveContainer,
    clearance: originalSpaceResult.clearance,
    cornerBlock: originalSpaceResult.cornerBlock,
    layerPositions: mirroredLayerPositions,
    orderedPositions: mirroredOrderedPositions,
    pattern: result.pattern
      ? {
          ...result.pattern,
          ...(mirroredExtraLayerPositions ? { extraLayerPositions: mirroredExtraLayerPositions } : {}),
          floorPositions: mirroredLayerPositions,
          mirroredY: true,
        }
      : null,
  };
}

function hasBetterPackingMetrics(
  next: Pick<PackingResult, "totalBoxes" | "blockedByCornerTotal" | "perLayerBoxCount">,
  current: Pick<PackingResult, "totalBoxes" | "blockedByCornerTotal" | "perLayerBoxCount">,
): boolean {
  if (next.totalBoxes !== current.totalBoxes) return next.totalBoxes > current.totalBoxes;
  if (next.blockedByCornerTotal !== current.blockedByCornerTotal) {
    return next.blockedByCornerTotal < current.blockedByCornerTotal;
  }
  return next.perLayerBoxCount > current.perLayerBoxCount;
}

function calculatePacking(containerInput: ContainerInput, cartonInput: CartonSpec, options: PackingOptions = {}): PackingResult {
  const directResult = calculatePackingOnce(containerInput, cartonInput, options);
  if (!hasAsymmetricActiveCorner(options)) return directResult;

  const mirroredResult = calculatePackingOnce(containerInput, cartonInput, swapSideClearance(options));
  return hasBetterPackingMetrics(mirroredResult, directResult) ? mirrorPackingResult(mirroredResult, directResult) : directResult;
}

function calculatePackingTotalBoxes(containerInput: ContainerInput, cartonInput: CartonSpec, options: PackingOptions = {}): number {
  const directTotal = calculatePackingTotalBoxesOnce(containerInput, cartonInput, options);
  if (!hasAsymmetricActiveCorner(options)) return directTotal;

  const mirroredTotal = calculatePackingTotalBoxesOnce(containerInput, cartonInput, swapSideClearance(options));
  return Math.max(directTotal, mirroredTotal);
}

function calculatePackingSummary(containerInput: ContainerInput, cartonInput: CartonSpec, options: PackingOptions = {}): PackingSummary {
  const directSummary = calculatePackingSummaryOnce(containerInput, cartonInput, options);
  if (!hasAsymmetricActiveCorner(options)) return directSummary;

  const mirroredSummary = calculatePackingSummaryOnce(containerInput, cartonInput, swapSideClearance(options));
  return hasBetterPackingMetrics(mirroredSummary, directSummary)
    ? {
        ...mirroredSummary,
        container: directSummary.container,
        effectiveContainer: directSummary.effectiveContainer,
        clearance: directSummary.clearance,
      }
    : directSummary;
}

function calculateMultiSkuPacking(containerInput: ContainerInput, skuInputs: SkuInput[], options: PackingOptions = {}): PackingResult {
  const directResult = calculateMultiSkuPackingOnce(containerInput, skuInputs, options);
  if (!hasAsymmetricActiveCorner(options)) return directResult;

  const mirroredResult = calculateMultiSkuPackingOnce(containerInput, skuInputs, swapSideClearance(options));
  return hasBetterPackingMetrics(mirroredResult, directResult) ? mirrorPackingResult(mirroredResult, directResult) : directResult;
}

function generateBoxPositions(result: PackingResult, visibleCount = result.totalBoxes): BoxPosition[] {
  const limit = Math.max(0, Math.min(result.totalBoxes, Math.floor(visibleCount)));
  if (!result.pattern || limit === 0) return [];
  if (Array.isArray(result.orderedPositions)) {
    return result.orderedPositions.slice(0, limit);
  }
  return [];
}

export {
  CONTAINERS,
  DEFAULT_CORNER_BLOCK,
  LOADING_STRATEGIES,
  calculatePacking,
  calculatePackingSummary,
  calculatePackingTotalBoxes,
  calculateMultiSkuPacking,
  generateBoxPositions,
  collidesCornerBlock,
};
