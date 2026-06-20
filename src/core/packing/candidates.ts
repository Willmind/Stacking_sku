import { MIN_DOOR_SIDE_REMAINDER_CLEARANCE } from "./constants";
import {
  floorRectFromPosition,
  hasDoorSideRemainderClearance,
  overlapsAnyFloorRect,
  positionFitsFloor,
} from "./geometry";
import type { BoxPosition, CartonSpec, ContainerSpec } from "./types";

type OrientationId = "length" | "width";
type PatternFamily = "length-segments" | "width-lanes";
type CandidateOrder = "length-first" | "width-first";

interface Orientation {
  id: OrientationId;
  label: string;
  axisLabel: string;
  x: number;
  y: number;
}

type OrientationSet = Record<OrientationId, Orientation>;

interface CandidateUnit {
  family: PatternFamily;
  orientationId: OrientationId;
  label: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  acrossCount: number;
}

interface CandidateGroup {
  orientationId: OrientationId;
  label: string;
  axisLabel: string;
  count: number;
  occupiedLength: number;
  occupiedWidth: number;
  boxesPerUnit: number;
}

export type CandidateBoxPosition = BoxPosition & {
  orientationId?: OrientationId;
  label?: string;
  source?: string;
};

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
}

export function getOrientations(carton: CartonSpec): OrientationSet {
  return {
    length: {
      id: "length",
      label: "长向",
      axisLabel: "纸箱长度沿柜长",
      x: carton.length,
      y: carton.width,
    },
    width: {
      id: "width",
      label: "宽向",
      axisLabel: "纸箱宽度沿柜长",
      x: carton.width,
      y: carton.length,
    },
  };
}

function makeSequence(
  lengthCount: number,
  widthCount: number,
  order: CandidateOrder,
  orientations: OrientationSet,
): Orientation[] {
  const sequence: Orientation[] = [];
  const pushUnits = (orientation: Orientation, count: number) => {
    for (let index = 0; index < count; index += 1) {
      sequence.push(orientation);
    }
  };

  if (order === "width-first") {
    pushUnits(orientations.width, widthCount);
    pushUnits(orientations.length, lengthCount);
  } else {
    pushUnits(orientations.length, lengthCount);
    pushUnits(orientations.width, widthCount);
  }

  return sequence;
}

function summarizeGroups(sequence: Orientation[], family: PatternFamily, container: ContainerSpec): CandidateGroup[] {
  const groups: CandidateGroup[] = [];
  for (const orientation of sequence) {
    const previous = groups[groups.length - 1];
    if (previous && previous.orientationId === orientation.id) {
      previous.count += 1;
    } else {
      groups.push({
        orientationId: orientation.id,
        label: orientation.label,
        axisLabel: orientation.axisLabel,
        count: 1,
        occupiedLength: 0,
        occupiedWidth: 0,
        boxesPerUnit: 0,
      });
    }
  }

  for (const group of groups) {
    const orientation =
      group.orientationId === "length"
        ? sequence.find((item) => item.id === "length")
        : sequence.find((item) => item.id === "width");
    if (!orientation) continue;

    if (family === "length-segments") {
      group.occupiedLength = group.count * orientation.x;
      group.occupiedWidth = Math.floor(container.width / orientation.y) * orientation.y;
      group.boxesPerUnit = Math.floor(container.width / orientation.y);
    } else {
      group.occupiedLength = Math.floor(container.length / orientation.x) * orientation.x;
      group.occupiedWidth = group.count * orientation.y;
      group.boxesPerUnit = Math.floor(container.length / orientation.x);
    }
  }

  return groups;
}

function summarizeGroupsFromUnits(units: CandidateUnit[], orientations: OrientationSet): CandidateGroup[] {
  const groups: CandidateGroup[] = [];

  for (const unit of units) {
    const previous = groups[groups.length - 1];
    const orientation = orientations[unit.orientationId];
    const occupiedLength = unit.family === "length-segments" ? unit.dx : unit.acrossCount * unit.dx;
    const occupiedWidth = unit.family === "length-segments" ? unit.acrossCount * unit.dy : unit.dy;

    if (previous && previous.orientationId === unit.orientationId) {
      previous.count += 1;
      previous.occupiedLength += unit.family === "length-segments" ? occupiedLength : 0;
      previous.occupiedLength =
        unit.family === "width-lanes" ? Math.max(previous.occupiedLength, occupiedLength) : previous.occupiedLength;
      previous.occupiedWidth += unit.family === "width-lanes" ? occupiedWidth : 0;
      previous.occupiedWidth =
        unit.family === "length-segments" ? Math.max(previous.occupiedWidth, occupiedWidth) : previous.occupiedWidth;
      previous.boxesPerUnit = Math.max(previous.boxesPerUnit, unit.acrossCount);
    } else {
      groups.push({
        orientationId: unit.orientationId,
        label: unit.label,
        axisLabel: orientation ? orientation.axisLabel : "",
        count: 1,
        occupiedLength,
        occupiedWidth,
        boxesPerUnit: unit.acrossCount,
      });
    }
  }

  return groups;
}

function createLengthCandidate(
  container: ContainerSpec,
  orientations: OrientationSet,
  lengthCount: number,
  widthCount: number,
  order: CandidateOrder,
): CandidatePattern {
  const sequence = makeSequence(lengthCount, widthCount, order, orientations);
  let x = 0;
  let occupiedWidth = 0;
  let perLayerBoxCount = 0;
  const units: CandidateUnit[] = [];

  for (const orientation of sequence) {
    const acrossCount = Math.floor(container.width / orientation.y);
    units.push({
      family: "length-segments",
      orientationId: orientation.id,
      label: orientation.label,
      x,
      y: 0,
      dx: orientation.x,
      dy: orientation.y,
      acrossCount,
    });
    x += orientation.x;
    occupiedWidth = Math.max(occupiedWidth, acrossCount * orientation.y);
    perLayerBoxCount += acrossCount;
  }

  return {
    family: "length-segments",
    order,
    units,
    groups: summarizeGroups(sequence, "length-segments", container),
    lengthFacingCount: lengthCount,
    widthFacingCount: widthCount,
    occupiedLength: x,
    occupiedWidth,
    perLayerBoxCount,
  };
}

function createWidthCandidate(
  container: ContainerSpec,
  orientations: OrientationSet,
  lengthCount: number,
  widthCount: number,
  order: CandidateOrder,
): CandidatePattern {
  const sequence = makeSequence(lengthCount, widthCount, order, orientations);
  let y = 0;
  let occupiedLength = 0;
  let perLayerBoxCount = 0;
  const units: CandidateUnit[] = [];

  for (const orientation of sequence) {
    const acrossCount = Math.floor(container.length / orientation.x);
    units.push({
      family: "width-lanes",
      orientationId: orientation.id,
      label: orientation.label,
      x: 0,
      y,
      dx: orientation.x,
      dy: orientation.y,
      acrossCount,
    });
    y += orientation.y;
    occupiedLength = Math.max(occupiedLength, acrossCount * orientation.x);
    perLayerBoxCount += acrossCount;
  }

  return {
    family: "width-lanes",
    order,
    units,
    groups: summarizeGroups(sequence, "width-lanes", container),
    lengthFacingCount: lengthCount,
    widthFacingCount: widthCount,
    occupiedLength,
    occupiedWidth: y,
    perLayerBoxCount,
  };
}

function getFloorOccupiedLength(positions: CandidateBoxPosition[]): number {
  return positions.reduce((maxLength, position) => Math.max(maxLength, position.x + position.dx), 0);
}

function addWidthLaneCandidateVariants(
  candidates: CandidatePattern[],
  container: ContainerSpec,
  carton: CartonSpec,
  orientations: OrientationSet,
  candidate: CandidatePattern,
  minDoorSideClearance = 0,
) {
  const basePositions = createLayerPositions(candidate, carton.height);
  const normalizedCandidate: CandidatePattern = {
    ...candidate,
    groups: summarizeGroupsFromUnits(candidate.units, orientations),
    perLayerBoxCount: basePositions.length,
    occupiedLength: getFloorOccupiedLength(basePositions),
  };
  candidates.push(normalizedCandidate);

  const extraPositions = createDoorSideRemainderPositions(
    container,
    carton,
    basePositions,
    minDoorSideClearance,
  );
  if (extraPositions.length === 0) {
    return;
  }

  const layerPositions = [...basePositions, ...extraPositions];
  candidates.push({
    ...normalizedCandidate,
    extraLayerPositions: extraPositions,
    remainderCount: extraPositions.length,
    perLayerBoxCount: layerPositions.length,
    occupiedLength: getFloorOccupiedLength(layerPositions),
  });
}

function addWidthLaneCandidates(
  candidates: CandidatePattern[],
  container: ContainerSpec,
  carton: CartonSpec,
  orientations: OrientationSet,
  lengthCount: number,
  widthCount: number,
  order: CandidateOrder,
) {
  const baseCandidate = createWidthCandidate(container, orientations, lengthCount, widthCount, order);
  addWidthLaneCandidateVariants(candidates, container, carton, orientations, baseCandidate);

  if (!baseCandidate.units.some((unit) => unit.orientationId === "width" && unit.acrossCount > 0)) {
    return;
  }

  const seenReducedUnits = new Set<string>();
  for (let reduceWidthLaneDepth = 1; reduceWidthLaneDepth <= 2; reduceWidthLaneDepth += 1) {
    const reduced = createWidthCandidate(container, orientations, lengthCount, widthCount, order);
    let reducedAnyUnit = false;
    const reducedUnits = reduced.units.map((unit) => {
      if (unit.orientationId !== "width") return unit;
      const acrossCount = Math.max(0, unit.acrossCount - reduceWidthLaneDepth);
      reducedAnyUnit = reducedAnyUnit || acrossCount !== unit.acrossCount;
      return {
        ...unit,
        acrossCount,
      };
    });
    if (!reducedAnyUnit) continue;

    const reducedUnitKey = reducedUnits.map((unit) => `${unit.orientationId}:${unit.acrossCount}`).join("|");
    if (seenReducedUnits.has(reducedUnitKey)) continue;
    seenReducedUnits.add(reducedUnitKey);

    addWidthLaneCandidateVariants(candidates, container, carton, orientations, {
      ...reduced,
      units: reducedUnits,
    }, MIN_DOOR_SIDE_REMAINDER_CLEARANCE);
  }
}

export function enumerateCandidates(container: ContainerSpec, carton: CartonSpec): CandidatePattern[] {
  const orientations = getOrientations(carton);
  const candidates: CandidatePattern[] = [];
  const lengthMax = Math.floor(container.length / orientations.length.x);
  const widthByLengthMax = Math.floor(container.length / orientations.width.x);
  const widthLaneLengthMax = Math.floor(container.width / orientations.length.y);
  const widthLaneWidthMax = Math.floor(container.width / orientations.width.y);

  for (let lengthCount = 0; lengthCount <= lengthMax; lengthCount += 1) {
    const remaining = container.length - lengthCount * orientations.length.x;
    const widthCount = Math.floor(remaining / orientations.width.x);
    if (lengthCount + widthCount > 0 && widthCount <= widthByLengthMax) {
      candidates.push(createLengthCandidate(container, orientations, lengthCount, widthCount, "length-first"));
      if (lengthCount > 0 && widthCount > 0) {
        candidates.push(createLengthCandidate(container, orientations, lengthCount, widthCount, "width-first"));
      }
    }
  }

  for (let lengthCount = 0; lengthCount <= widthLaneLengthMax; lengthCount += 1) {
    const remaining = container.width - lengthCount * orientations.length.y;
    const widthCount = Math.floor(remaining / orientations.width.y);
    if (lengthCount + widthCount > 0 && widthCount <= widthLaneWidthMax) {
      addWidthLaneCandidates(candidates, container, carton, orientations, lengthCount, widthCount, "length-first");
      if (lengthCount > 0 && widthCount > 0) {
        addWidthLaneCandidates(candidates, container, carton, orientations, lengthCount, widthCount, "width-first");
      }
    }
  }

  return candidates.filter((candidate) => candidate.perLayerBoxCount > 0);
}

export function createLayerPositions(pattern: CandidatePattern, cartonHeight: number): CandidateBoxPosition[] {
  const positions: CandidateBoxPosition[] = [];

  for (const unit of pattern.units) {
    if (unit.family === "length-segments") {
      for (let index = 0; index < unit.acrossCount; index += 1) {
        positions.push({
          x: unit.x,
          y: index * unit.dy,
          z: 0,
          dx: unit.dx,
          dy: unit.dy,
          dz: cartonHeight,
          orientationId: unit.orientationId,
          label: unit.label,
        });
      }
    } else {
      for (let index = 0; index < unit.acrossCount; index += 1) {
        positions.push({
          x: index * unit.dx,
          y: unit.y,
          z: 0,
          dx: unit.dx,
          dy: unit.dy,
          dz: cartonHeight,
          orientationId: unit.orientationId,
          label: unit.label,
        });
      }
    }
  }

  return positions.sort((a, b) => a.y - b.y || a.x - b.x);
}

function createDoorSideRemainderPositions(
  container: ContainerSpec,
  carton: CartonSpec,
  occupiedPositions: CandidateBoxPosition[],
  minDoorSideClearance = 0,
): CandidateBoxPosition[] {
  const orientations = Object.values(getOrientations(carton));
  const occupiedRects = occupiedPositions.map(floorRectFromPosition);
  const candidates: CandidateBoxPosition[] = [];

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
        const position: CandidateBoxPosition = {
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

        if (
          positionFitsFloor(position, container) &&
          hasDoorSideRemainderClearance(position, container, minDoorSideClearance) &&
          !overlapsAnyFloorRect(position, occupiedRects)
        ) {
          candidates.push(position);
        }
      }
    }
  }

  return candidates
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .reduce<CandidateBoxPosition[]>((accepted, candidate) => {
      const acceptedRects = accepted.map(floorRectFromPosition);
      if (!overlapsAnyFloorRect(candidate, acceptedRects)) {
        accepted.push(candidate);
      }
      return accepted;
    }, []);
}
