// @ts-nocheck
import {
  createLayerPositions,
  enumerateCandidates,
  getOrientations,
} from "./candidates";
import {
  CONTAINERS,
  DEFAULT_CORNER_BLOCK,
  LOADING_STRATEGIES,
} from "./constants";
import {
  boxesOverlap3d,
  collidesCornerBlock,
  floorRectFromPosition,
  intersects,
  overlapsAnyFloorRect,
  positionFitsFloor,
  rectanglesOverlap,
} from "./geometry";
import {
  createEffectiveContainer,
  hasSameSkuDimensions,
  normalizeCarton,
  normalizeContainer,
  normalizeContainerClearance,
  normalizeSkus,
} from "./validation";
export { describePackingStrategy } from "./strategyDescription";

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
  PackingStrategyNote,
  SkuInput,
  SkuSummary,
} from "./types";

  function createPackingSpace(containerInput, options = {}) {
    const container = normalizeContainer(containerInput);
    const clearance = normalizeContainerClearance(options.clearance);
    const effectiveContainer = createEffectiveContainer(container, clearance);
    const cornerBlock = {
      ...DEFAULT_CORNER_BLOCK,
      ...(options.cornerBlock || {}),
    };
    const effectiveCornerBlock = {
      length: Math.max(0, cornerBlock.length - clearance.front),
      width: Math.max(0, cornerBlock.width - Math.min(clearance.left, clearance.right)),
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

  function shiftPositionByClearance(position, clearance) {
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

  function applyPackingSpaceToResult(result, packingSpace) {
    const shiftedLayerPositions = result.layerPositions.map((position) =>
      shiftPositionByClearance(position, packingSpace.clearance),
    );
    const shiftedOrderedPositions = result.orderedPositions.map((position) =>
      shiftPositionByClearance(position, packingSpace.clearance),
    );

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

  function assignSequenceIndexes(positions) {
    return positions.map((position, sequenceIndex) => ({
      ...position,
      sequenceIndex,
    }));
  }

  function groupPositionsByFace(positions) {
    const groups = new Map();
    for (const position of positions) {
      if (!groups.has(position.faceIndex)) groups.set(position.faceIndex, []);
      groups.get(position.faceIndex).push(position);
    }
    return Array.from(groups.values()).map((group) =>
      group.slice().sort((a, b) => a.stackIndex - b.stackIndex || b.y - a.y),
    );
  }

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
        positionFitsFloor(candidate, container) &&
        list.findIndex((item) => `${item.x}:${item.y}:${item.z}:${item.dx}:${item.dy}` === key) === index
      );
    });
  }

  function findCornerSafePosition(position, acceptedInStackBand, container, cornerBlock) {
    const acceptedRects = acceptedInStackBand.map(floorRectFromPosition);

    for (const candidate of createCornerAvoidanceNudges(position, container, cornerBlock)) {
      if (collidesCornerBlock(candidate, container, cornerBlock)) continue;
      if (overlapsAnyFloorRect(candidate, acceptedRects)) continue;
      return candidate;
    }

    return null;
  }

  function matchesPositionFootprint(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z && a.dx === b.dx && a.dy === b.dy;
  }

  function findCornerDisplacedPosition(position, acceptedInStackBand, container, cornerBlock) {
    let candidate = position;
    let adjusted = false;

    while (positionFitsFloor(candidate, container) && !collidesCornerBlock(candidate, container, cornerBlock)) {
      const overlapping = acceptedInStackBand.filter((accepted) =>
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

  function resolveAcceptedStackPosition(position, acceptedInStackBand, container, cornerBlock) {
    const acceptedRects = acceptedInStackBand.map(floorRectFromPosition);

    if (collidesCornerBlock(position, container, cornerBlock)) {
      return findCornerSafePosition(position, acceptedInStackBand, container, cornerBlock);
    }
    if (acceptedInStackBand.some((accepted) => matchesPositionFootprint(position, accepted))) {
      return findCornerDisplacedPosition(position, acceptedInStackBand, container, cornerBlock);
    }
    if (overlapsAnyFloorRect(position, acceptedRects)) {
      return findCornerDisplacedPosition(position, acceptedInStackBand, container, cornerBlock);
    }
    return position;
  }

  function acceptStackPosition(position, container, cornerBlock, acceptedByStack) {
    const acceptedInStackBand = acceptedByStack.get(position.stackIndex) || [];
    const acceptedPosition = resolveAcceptedStackPosition(position, acceptedInStackBand, container, cornerBlock);

    if (acceptedPosition) {
      acceptedInStackBand.push(acceptedPosition);
      acceptedByStack.set(position.stackIndex, acceptedInStackBand);
    }

    return acceptedPosition;
  }

  function createStackedFacePositions(basePosition, faceIndex, layerCount, container, cornerBlock, acceptedByStack) {
    const positions = [];

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
        acceptedByStack,
      );

      if (acceptedPosition) positions.push(acceptedPosition);
    }

    return positions;
  }

  function orderFloorPositionsForPlacement(floorPositions) {
    return floorPositions.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  }

  function orderBoxPositionsForLoading(positions) {
    return positions.slice().sort((a, b) => a.x - b.x || a.z - b.z || b.y - a.y);
  }

  function groupFloorPositionsByLoadingDepth(orderedFloor) {
    const groups = [];

    for (const item of orderedFloor) {
      const previous = groups[groups.length - 1];
      if (previous && previous.x === item.basePosition.x) {
        previous.items.push(item);
      } else {
        groups.push({
          x: item.basePosition.x,
          items: [item],
        });
      }
    }

    return groups;
  }

  function createOrderedPositionsFromFloor(container, carton, cornerBlock, floorPositions) {
    const layerCount = Math.floor(container.height / carton.height);
    const orderedFloor = orderFloorPositionsForPlacement(floorPositions).map((basePosition, faceIndex) => ({
      basePosition,
      faceIndex,
    }));
    const depthGroups = groupFloorPositionsByLoadingDepth(orderedFloor);
    const positions = [];
    const acceptedByStack = new Map();

    for (const group of depthGroups) {
      for (let stackIndex = 0; stackIndex < layerCount; stackIndex += 1) {
        for (const { basePosition, faceIndex } of group.items) {
          const acceptedPosition = acceptStackPosition(
            {
              ...basePosition,
              z: stackIndex * basePosition.dz,
              faceIndex,
              stackIndex,
            },
            container,
            cornerBlock,
            acceptedByStack,
          );

          if (acceptedPosition) positions.push(acceptedPosition);
        }
      }
    }

    return assignSequenceIndexes(orderBoxPositionsForLoading(positions));
  }

  function evaluateCandidate(container, carton, pattern, cornerBlock) {
    const basePositions = [
      ...createLayerPositions(pattern, carton.height),
      ...(pattern.extraLayerPositions || []),
    ].sort((a, b) => a.x - b.x || a.y - b.y);
    const layerCount = Math.floor(container.height / carton.height);
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
  }

  function layerCollidesWithTopBand(stackIndex, cartonHeight, container, cornerBlock) {
    return intersects(
      stackIndex * cartonHeight,
      cartonHeight,
      container.height - cornerBlock.height,
      cornerBlock.height,
    );
  }

  function countAcceptedPositionsForStack(basePositions, stackIndex, container, cornerBlock) {
    const acceptedInStackBand = [];

    for (const basePosition of orderFloorPositionsForPlacement(basePositions)) {
      const position = {
        ...basePosition,
        z: stackIndex * basePosition.dz,
        stackIndex,
      };
      const acceptedRects = acceptedInStackBand.map(floorRectFromPosition);
      let acceptedPosition = null;

      if (collidesCornerBlock(position, container, cornerBlock)) {
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

  function evaluateCandidateTotal(container, carton, pattern, cornerBlock) {
    const basePositions = [
      ...createLayerPositions(pattern, carton.height),
      ...(pattern.extraLayerPositions || []),
    ].sort((a, b) => a.x - b.x || a.y - b.y);
    const layerCount = Math.floor(container.height / carton.height);
    const perLayerBoxCount = basePositions.length;
    const affectedStackIndexes = [];

    for (let index = 0; index < layerCount; index += 1) {
      if (layerCollidesWithTopBand(index, carton.height, container, cornerBlock)) {
        affectedStackIndexes.push(index);
      }
    }

    let totalBoxes = perLayerBoxCount * (layerCount - affectedStackIndexes.length);
    for (const stackIndex of affectedStackIndexes) {
      totalBoxes += countAcceptedPositionsForStack(basePositions, stackIndex, container, cornerBlock);
    }

    return {
      totalBoxes,
      blockedByCornerTotal: perLayerBoxCount * layerCount - totalBoxes,
      perLayerBoxCount,
    };
  }

  function compareResults(next, current) {
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

  function compareCandidateTotals(next, current) {
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

  function calculateUsedHeight(positions) {
    if (positions.length === 0) return 0;
    return Math.max(...positions.map((position) => position.z + position.dz));
  }

  function calculatePositionsVolume(positions) {
    return positions.reduce((sum, position) => sum + position.dx * position.dy * position.dz, 0);
  }

  function getOccupiedLength(positions) {
    if (positions.length === 0) return 0;
    return Math.max(...positions.map((position) => position.x + position.dx));
  }

  function getOccupiedWidth(positions) {
    if (positions.length === 0) return 0;
    return Math.max(...positions.map((position) => position.y + position.dy));
  }

  function getPositionFootprint(position) {
    return position.sourceFootprint || position;
  }

  function footprintRectFromPosition(position) {
    const footprint = getPositionFootprint(position);
    return {
      x: footprint.x,
      y: footprint.y,
      dx: footprint.dx,
      dy: footprint.dy,
    };
  }

  function uniqueFloorRectsFromPositions(positions) {
    const seen = new Set();
    const rects = [];

    for (const position of positions) {
      const rect = footprintRectFromPosition(position);
      const key = `${rect.x}:${rect.y}:${rect.dx}:${rect.dy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rects.push(rect);
    }

    return rects;
  }

  function groupPositionsBySourceFootprint(positions) {
    const groups = new Map();

    for (const position of positions) {
      const footprint = getPositionFootprint(position);
      const key = `${footprint.x}:${footprint.y}:${footprint.dx}:${footprint.dy}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(position);
    }

    return Array.from(groups.values());
  }

  function shiftHeterogeneousPosition(position, deltaX) {
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

  function canPlaceHeterogeneousGroup(group, deltaX, container, cornerBlock, occupiedPositions, occupiedRects) {
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
      if (collidesCornerBlock(position, container, cornerBlock)) return false;
      if (occupiedPositions.some((occupied) => boxesOverlap3d(position, occupied))) return false;
    }

    return true;
  }

  function createLeftCompactionCandidates(footprint, occupiedRects) {
    const candidates = new Set([0, footprint.x]);

    for (const rect of occupiedRects) {
      if (!intersects(footprint.y, footprint.dy, rect.y, rect.dy)) continue;
      candidates.add(rect.x + rect.dx);
    }

    return Array.from(candidates)
      .filter((x) => Number.isFinite(x) && x >= 0 && x <= footprint.x)
      .sort((a, b) => a - b);
  }

  function compactHeterogeneousPositionsLeft(container, positions, occupiedPositions, cornerBlock) {
    const compactedPositionByOriginal = new Map();
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

  function createLayersFromPositions(positions) {
    const layersByIndex = new Map();
    for (const position of positions) {
      const index = Number.isFinite(position.stackIndex) ? position.stackIndex : 0;
      if (!layersByIndex.has(index)) {
        layersByIndex.set(index, {
          index,
          z: position.z,
          boxCount: 0,
          blockedByCorner: 0,
        });
      }
      const layer = layersByIndex.get(index);
      layer.z = Math.min(layer.z, position.z);
      layer.boxCount += 1;
    }

    return Array.from(layersByIndex.values()).sort((a, b) => a.index - b.index);
  }

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

  function createZeroCornerBlock() {
    return {
      length: 0,
      width: 0,
      height: 0,
    };
  }

  function createZoneCornerBlock(cornerBlock, offsetX) {
    return {
      ...cornerBlock,
      length: Math.max(0, cornerBlock.length - offsetX),
    };
  }

  function reindexHeterogeneousPositions(positions) {
    const faceIndexByKey = new Map();
    const stackCountByKey = new Map();
    const layerPositions = [];

    const indexedPositions = positions.map((position, sequenceIndex) => {
      const { sourceFootprint, ...publicPosition } = position;
      const footprint = sourceFootprint || position;
      const faceKey = `${footprint.x}:${footprint.y}:${footprint.dx}:${footprint.dy}`;
      if (!faceIndexByKey.has(faceKey)) {
        faceIndexByKey.set(faceKey, layerPositions.length);
        const { adjustedForCorner: _adjustedForCorner, ...layerPosition } = publicPosition;
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

  function createHeterogeneousSourceFootprint(zoneResult, position, offsetX) {
    const source = zoneResult.layerPositions[position.faceIndex] || position;
    return {
      x: source.x + offsetX,
      y: source.y,
      dx: source.dx,
      dy: source.dy,
    };
  }

  function createAcceptedByStackFromPositions(positions) {
    const acceptedByStack = new Map();

    for (const position of positions) {
      const stackIndex = Number.isFinite(position.stackIndex) ? position.stackIndex : 0;
      if (!acceptedByStack.has(stackIndex)) acceptedByStack.set(stackIndex, []);
      acceptedByStack.get(stackIndex).push(position);
    }

    return acceptedByStack;
  }

  function cloneAcceptedByStack(acceptedByStack) {
    const cloned = new Map();
    for (const [stackIndex, positions] of acceptedByStack.entries()) {
      cloned.set(stackIndex, positions.slice());
    }
    return cloned;
  }

  function addPositionsToAcceptedByStack(acceptedByStack, positions) {
    for (const position of positions) {
      const stackIndex = Number.isFinite(position.stackIndex) ? position.stackIndex : 0;
      if (!acceptedByStack.has(stackIndex)) acceptedByStack.set(stackIndex, []);
      acceptedByStack.get(stackIndex).push(position);
    }
  }

  function isHeterogeneousPosition3dSafe(position, container, cornerBlock, occupiedPositions) {
    if (!positionFitsFloor(position, container)) return false;
    if (position.z < 0 || position.z + position.dz > container.height) return false;
    if (collidesCornerBlock(position, container, cornerBlock)) return false;
    return !occupiedPositions.some((occupied) => boxesOverlap3d(position, occupied));
  }

  function selectSafeHeterogeneousStackPositions(stackPositions, limit, container, cornerBlock, occupiedPositions) {
    const selected = [];

    for (const position of stackPositions.slice().sort((a, b) => a.z - b.z || a.stackIndex - b.stackIndex)) {
      if (selected.length >= limit) break;
      if (!isHeterogeneousPosition3dSafe(position, container, cornerBlock, [...occupiedPositions, ...selected])) {
        break;
      }
      selected.push(position);
    }

    return selected;
  }

  function createBackfillStartCandidates(occupiedRects, limit, size, boundary) {
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

  function createBackfillFootprintCandidates(container, sku, occupiedPositions, maxLength) {
    if (maxLength <= 0) return [];

    const occupiedRects = uniqueFloorRectsFromPositions(occupiedPositions);
    const orientations = Object.values(getOrientations(sku));
    const candidates = [];
    const seen = new Set();

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
            dz: sku.height,
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

  function createHeterogeneousBackfillPositions(container, sku, target, occupiedPositions, maxLength, cornerBlock) {
    if (target <= 0 || occupiedPositions.length === 0 || maxLength <= 0) return [];

    const layerCount = Math.floor(container.height / sku.height);
    const acceptedByStack = createAcceptedByStackFromPositions(occupiedPositions);
    const acceptedPositions = occupiedPositions.slice();
    const acceptedFloorRects = uniqueFloorRectsFromPositions(occupiedPositions);
    const candidates = createBackfillFootprintCandidates(container, sku, occupiedPositions, maxLength);
    const selectedPositions = [];

    candidates.forEach((candidate, candidateIndex) => {
      if (selectedPositions.length >= target) return;
      if (overlapsAnyFloorRect(candidate, acceptedFloorRects)) return;

      const candidateAcceptedByStack = cloneAcceptedByStack(acceptedByStack);
      const stackPositions = createStackedFacePositions(
        candidate,
        candidateIndex,
        layerCount,
        container,
        cornerBlock,
        candidateAcceptedByStack,
      );
      if (stackPositions.length === 0) return;

      const sourceFootprint = {
        x: candidate.x,
        y: candidate.y,
        dx: candidate.dx,
        dy: candidate.dy,
      };
      const remaining = target - selectedPositions.length;
      const safeStackPositions = selectSafeHeterogeneousStackPositions(
        stackPositions,
        remaining,
        container,
        cornerBlock,
        acceptedPositions,
      );
      if (safeStackPositions.length === 0) return;

      const acceptedStackPositions = safeStackPositions.map((position) => ({
          ...position,
          sourceFootprint,
          skuLabel: sku.label,
          skuColor: sku.color,
        }));
      selectedPositions.push(...acceptedStackPositions);
      acceptedPositions.push(...acceptedStackPositions);
      addPositionsToAcceptedByStack(acceptedByStack, acceptedStackPositions);
      acceptedFloorRects.push(footprintRectFromPosition(acceptedStackPositions[0]));
    });

    return selectedPositions;
  }

  function calculateSameDimensionMultiSkuPacking(containerInput, skus, options, strategy) {
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

  function calculateHeterogeneousMultiSkuPacking(containerInput, skus, options, strategy) {
    const packingSpace = createPackingSpace(containerInput, options);
    const container = packingSpace.effectiveContainer;
    const cornerBlock = packingSpace.effectiveCornerBlock;
    const assignedPositions = [];
    const groups = [];
    let cursorX = 0;
    let blockedByCornerTotal = 0;

    for (const sku of skus) {
      const skuPositions = [];
      let remainingTarget = sku.target;

      const backfillPositions = createHeterogeneousBackfillPositions(
        container,
        sku,
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
        const zoneCornerBlock = cursorX >= cornerBlock.length
          ? createZeroCornerBlock()
          : createZoneCornerBlock(cornerBlock, cursorX);
        const zoneResult = calculatePacking(
          zoneContainer,
          { length: sku.length, width: sku.width, height: sku.height },
          {
            ...options,
            cornerBlock: zoneCornerBlock,
          },
        );
        const selectedPositions = zoneResult.orderedPositions.slice(0, remainingTarget);
        const offsetPositions = selectedPositions.map((position) => ({
          ...position,
          x: position.x + cursorX,
          sourceFootprint: createHeterogeneousSourceFootprint(zoneResult, position, cursorX),
          skuLabel: sku.label,
          skuColor: sku.color,
        }));
        const compactedOffsetPositions = compactHeterogeneousPositionsLeft(
          container,
          offsetPositions,
          assignedPositions,
          cornerBlock,
        );

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

    return applyPackingSpaceToResult({
      container,
      effectiveContainer: container,
      clearance: packingSpace.clearance,
      carton: {
        length: skus[0].length,
        width: skus[0].width,
        height: skus[0].height,
      },
      cornerBlock,
      pattern: totalBoxes > 0
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
    }, packingSpace);
  }

  function calculatePacking(containerInput, cartonInput, options = {}) {
    const packingSpace = createPackingSpace(containerInput, options);
    const container = packingSpace.effectiveContainer;
    const carton = normalizeCarton(cartonInput);
    const cornerBlock = packingSpace.effectiveCornerBlock;

    const candidates = enumerateCandidates(container, carton);
    let best = null;

    for (const candidate of candidates) {
      const result = evaluateCandidate(container, carton, candidate, cornerBlock);
      if (compareResults(result, best)) {
        best = result;
      }
    }

    if (!best) {
      return applyPackingSpaceToResult({
        container,
        effectiveContainer: container,
        clearance: packingSpace.clearance,
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
      }, packingSpace);
    }

    return applyPackingSpaceToResult(best, packingSpace);
  }

  function calculatePackingTotalBoxes(containerInput, cartonInput, options = {}) {
    const packingSpace = createPackingSpace(containerInput, options);
    const container = packingSpace.effectiveContainer;
    const carton = normalizeCarton(cartonInput);
    const cornerBlock = packingSpace.effectiveCornerBlock;

    const candidates = enumerateCandidates(container, carton);
    let best = null;

    for (const candidate of candidates) {
      const result = evaluateCandidateTotal(container, carton, candidate, cornerBlock);
      if (compareCandidateTotals(result, best)) {
        best = result;
      }
    }

    return best ? best.totalBoxes : 0;
  }

  function calculateMultiSkuPacking(containerInput, skuInputs, options = {}) {
    const skus = normalizeSkus(skuInputs);
    const strategy = options.strategy || LOADING_STRATEGIES.MULTI_DESTINATION;
    if (!Object.values(LOADING_STRATEGIES).includes(strategy)) {
      throw new Error("装载策略必须为 multi-destination 或 same-destination");
    }

    return hasSameSkuDimensions(skus)
      ? calculateSameDimensionMultiSkuPacking(containerInput, skus, options, strategy)
      : calculateHeterogeneousMultiSkuPacking(containerInput, skus, options, strategy);
  }

  function generateBoxPositions(result, visibleCount = result.totalBoxes) {
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
  calculatePackingTotalBoxes,
  calculateMultiSkuPacking,
  generateBoxPositions,
  collidesCornerBlock,
};
