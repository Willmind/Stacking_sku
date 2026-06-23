import { MIN_DOOR_SIDE_REMAINDER_CLEARANCE } from "./constants";
import {
  floorRectFromPosition,
  hasDoorSideRemainderClearance,
  overlapsAnyFloorRect,
  positionFitsFloor,
} from "./geometry";
import { getOrientations, type CartonOrientation, type CartonOrientationId } from "./orientations";
import type { BoxPosition, CartonSpec, ContainerSpec } from "./types";

type PatternFamily = "length-segments" | "width-lanes";
type CandidateOrder = "length-first" | "width-first";

interface CandidateUnit {
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

interface CandidateGroup {
  orientationId: CartonOrientationId;
  label: string;
  axisLabel: string;
  count: number;
  occupiedLength: number;
  occupiedWidth: number;
  occupiedHeight: number;
  boxesPerUnit: number;
}

export type CandidateBoxPosition = BoxPosition & {
  orientationId?: CartonOrientationId;
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

function makeSequence(
  primaryCount: number,
  secondaryCount: number,
  order: CandidateOrder,
  primaryOrientation: CartonOrientation,
  secondaryOrientation?: CartonOrientation,
): CartonOrientation[] {
  const sequence: CartonOrientation[] = [];
  const pushUnits = (orientation: CartonOrientation, count: number) => {
    for (let index = 0; index < count; index += 1) {
      sequence.push(orientation);
    }
  };

  if (order === "width-first" && secondaryOrientation) {
    pushUnits(secondaryOrientation, secondaryCount);
    pushUnits(primaryOrientation, primaryCount);
  } else {
    pushUnits(primaryOrientation, primaryCount);
    if (secondaryOrientation) pushUnits(secondaryOrientation, secondaryCount);
  }

  return sequence;
}

function summarizeGroups(sequence: CartonOrientation[], family: PatternFamily, container: ContainerSpec): CandidateGroup[] {
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
        occupiedHeight: orientation.z,
        boxesPerUnit: 0,
      });
    }
  }

  for (const group of groups) {
    const orientation = sequence.find((item) => item.id === group.orientationId);
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
    group.occupiedHeight = orientation.z;
  }

  return groups;
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
      previous.occupiedLength += unit.family === "length-segments" ? occupiedLength : 0;
      previous.occupiedLength =
        unit.family === "width-lanes" ? Math.max(previous.occupiedLength, occupiedLength) : previous.occupiedLength;
      previous.occupiedWidth += unit.family === "width-lanes" ? occupiedWidth : 0;
      previous.occupiedWidth =
        unit.family === "length-segments" ? Math.max(previous.occupiedWidth, occupiedWidth) : previous.occupiedWidth;
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

function createLengthCandidate(
  container: ContainerSpec,
  primaryOrientation: CartonOrientation,
  secondaryOrientation: CartonOrientation | undefined,
  primaryCount: number,
  secondaryCount: number,
  order: CandidateOrder,
): CandidatePattern {
  const sequence = makeSequence(primaryCount, secondaryCount, order, primaryOrientation, secondaryOrientation);
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
      dz: orientation.z,
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
    lengthFacingCount: primaryCount,
    widthFacingCount: secondaryCount,
    occupiedLength: x,
    occupiedWidth,
    perLayerBoxCount,
  };
}

function createWidthCandidate(
  container: ContainerSpec,
  primaryOrientation: CartonOrientation,
  secondaryOrientation: CartonOrientation | undefined,
  primaryCount: number,
  secondaryCount: number,
  order: CandidateOrder,
): CandidatePattern {
  const sequence = makeSequence(primaryCount, secondaryCount, order, primaryOrientation, secondaryOrientation);
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
      dz: orientation.z,
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
    lengthFacingCount: primaryCount,
    widthFacingCount: secondaryCount,
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
  orientations: CartonOrientation[],
  candidate: CandidatePattern,
  minDoorSideClearance = 0,
) {
  const basePositions = createLayerPositions(candidate);
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
    orientations,
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
  orientations: CartonOrientation[],
  primaryOrientation: CartonOrientation,
  secondaryOrientation: CartonOrientation | undefined,
  primaryCount: number,
  secondaryCount: number,
  order: CandidateOrder,
) {
  const baseCandidate = createWidthCandidate(
    container,
    primaryOrientation,
    secondaryOrientation,
    primaryCount,
    secondaryCount,
    order,
  );
  addWidthLaneCandidateVariants(candidates, container, carton, orientations, baseCandidate);

  if (
    !secondaryOrientation ||
    !baseCandidate.units.some((unit) => unit.orientationId === secondaryOrientation.id && unit.acrossCount > 0)
  ) {
    return;
  }

  const seenReducedUnits = new Set<string>();
  for (let reduceWidthLaneDepth = 1; reduceWidthLaneDepth <= 2; reduceWidthLaneDepth += 1) {
    const reduced = createWidthCandidate(
      container,
      primaryOrientation,
      secondaryOrientation,
      primaryCount,
      secondaryCount,
      order,
    );
    let reducedAnyUnit = false;
    const reducedUnits = reduced.units.map((unit) => {
      if (unit.orientationId !== secondaryOrientation.id) return unit;
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

function pushCandidate(candidates: CandidatePattern[], candidate: CandidatePattern) {
  const key = candidate.units
    .map((unit) => `${unit.family}:${unit.orientationId}:${unit.x}:${unit.y}:${unit.dx}:${unit.dy}:${unit.dz}:${unit.acrossCount}`)
    .join("|");
  if (candidates.some((item) => item.units
    .map((unit) => `${unit.family}:${unit.orientationId}:${unit.x}:${unit.y}:${unit.dx}:${unit.dy}:${unit.dz}:${unit.acrossCount}`)
    .join("|") === key)) {
    return;
  }
  candidates.push(candidate);
}

function enumerateSingleOrientationCandidates(
  candidates: CandidatePattern[],
  container: ContainerSpec,
  carton: CartonSpec,
  orientations: CartonOrientation[],
  orientation: CartonOrientation,
) {
  const lengthMax = Math.floor(container.length / orientation.x);
  for (let count = 1; count <= lengthMax; count += 1) {
    pushCandidate(candidates, createLengthCandidate(container, orientation, undefined, count, 0, "length-first"));
  }

  const widthMax = Math.floor(container.width / orientation.y);
  for (let count = 1; count <= widthMax; count += 1) {
    addWidthLaneCandidates(candidates, container, carton, orientations, orientation, undefined, count, 0, "length-first");
  }
}

function enumerateMixedOrientationCandidates(
  candidates: CandidatePattern[],
  container: ContainerSpec,
  carton: CartonSpec,
  orientations: CartonOrientation[],
  primaryOrientation: CartonOrientation,
  secondaryOrientation: CartonOrientation,
) {
  const primaryLengthMax = Math.floor(container.length / primaryOrientation.x);
  const secondaryLengthMax = Math.floor(container.length / secondaryOrientation.x);
  for (let primaryCount = 0; primaryCount <= primaryLengthMax; primaryCount += 1) {
    const remaining = container.length - primaryCount * primaryOrientation.x;
    const secondaryCount = Math.floor(remaining / secondaryOrientation.x);
    if (primaryCount + secondaryCount > 0 && secondaryCount <= secondaryLengthMax) {
      pushCandidate(
        candidates,
        createLengthCandidate(
          container,
          primaryOrientation,
          secondaryOrientation,
          primaryCount,
          secondaryCount,
          "length-first",
        ),
      );
      if (primaryCount > 0 && secondaryCount > 0) {
        pushCandidate(
          candidates,
          createLengthCandidate(
            container,
            primaryOrientation,
            secondaryOrientation,
            primaryCount,
            secondaryCount,
            "width-first",
          ),
        );
      }
    }
  }

  const primaryWidthMax = Math.floor(container.width / primaryOrientation.y);
  const secondaryWidthMax = Math.floor(container.width / secondaryOrientation.y);
  for (let primaryCount = 0; primaryCount <= primaryWidthMax; primaryCount += 1) {
    const remaining = container.width - primaryCount * primaryOrientation.y;
    const secondaryCount = Math.floor(remaining / secondaryOrientation.y);
    if (primaryCount + secondaryCount > 0 && secondaryCount <= secondaryWidthMax) {
      addWidthLaneCandidates(
        candidates,
        container,
        carton,
        orientations,
        primaryOrientation,
        secondaryOrientation,
        primaryCount,
        secondaryCount,
        "length-first",
      );
      if (primaryCount > 0 && secondaryCount > 0) {
        addWidthLaneCandidates(
          candidates,
          container,
          carton,
          orientations,
          primaryOrientation,
          secondaryOrientation,
          primaryCount,
          secondaryCount,
          "width-first",
        );
      }
    }
  }
}

export function enumerateCandidates(
  container: ContainerSpec,
  carton: CartonSpec,
  allowedOrientations?: readonly unknown[] | null,
): CandidatePattern[] {
  const orientations = getOrientations(carton, allowedOrientations);
  const candidates: CandidatePattern[] = [];

  for (const orientation of orientations) {
    enumerateSingleOrientationCandidates(candidates, container, carton, orientations, orientation);
  }

  for (const primaryOrientation of orientations) {
    for (const secondaryOrientation of orientations) {
      if (primaryOrientation.id === secondaryOrientation.id) continue;
      enumerateMixedOrientationCandidates(
        candidates,
        container,
        carton,
        orientations,
        primaryOrientation,
        secondaryOrientation,
      );
    }
  }

  return candidates.filter((candidate) => candidate.perLayerBoxCount > 0);
}

export function createLayerPositions(pattern: CandidatePattern): CandidateBoxPosition[] {
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
          dz: unit.dz,
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
          dz: unit.dz,
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
  orientations: CartonOrientation[] = getOrientations(carton),
  minDoorSideClearance = 0,
): CandidateBoxPosition[] {
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
          dz: orientation.z,
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
