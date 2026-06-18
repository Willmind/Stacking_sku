// @ts-nocheck
export type {
  BoxPosition,
  CartonSpec,
  ContainerSpec,
  CornerBlockSpec,
  LoadingStrategy,
  PackingLayer,
  PackingOptions,
  PackingPattern,
  PackingResult,
  SkuInput,
  SkuSummary,
} from "./types";

  const CONTAINERS = {
    "20GP": {
      id: "20GP",
      name: "20GP",
      length: 5898,
      width: 2352,
      height: 2393,
    },
    "40GP": {
      id: "40GP",
      name: "40GP",
      length: 12032,
      width: 2352,
      height: 2393,
    },
    "40HQ": {
      id: "40HQ",
      name: "40HQ",
      length: 12032,
      width: 2352,
      height: 2698,
    },
  };

  const DEFAULT_CORNER_BLOCK = {
    length: 110,
    width: 110,
    height: 80,
  };

  const LOADING_STRATEGIES = {
    MULTI_DESTINATION: "multi-destination",
    SAME_DESTINATION: "same-destination",
  };

  const MIN_DOOR_SIDE_REMAINDER_CLEARANCE = DEFAULT_CORNER_BLOCK.length;

  const POSITIVE_NUMBER_LABELS = {
    "container length": "柜体长度",
    "container width": "柜体宽度",
    "container height": "柜体高度",
    "carton length": "纸箱长度",
    "carton width": "纸箱宽度",
    "carton height": "纸箱高度",
    "target quantity": "目标数量",
  };

  function formatInputName(name) {
    const skuFieldMatch = name.match(/^(.*) (target quantity|carton length|carton width|carton height)$/);
    if (skuFieldMatch) {
      const [, label, key] = skuFieldMatch;
      return `${label} ${POSITIVE_NUMBER_LABELS[key] || key}`;
    }
    return POSITIVE_NUMBER_LABELS[name] || name;
  }

  function positiveNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new Error(`${formatInputName(name)}必须为正数`);
    }
    return number;
  }

  function normalizeContainer(input) {
    const source = typeof input === "string" ? CONTAINERS[input] : input;
    if (!source) {
      throw new Error("柜型必须为 20GP、40GP、40HQ，或传入自定义柜体尺寸对象");
    }

    return {
      id: source.id || "CUSTOM",
      name: source.name || source.id || "Custom",
      length: positiveNumber(source.length, "container length"),
      width: positiveNumber(source.width, "container width"),
      height: positiveNumber(source.height, "container height"),
    };
  }

  function normalizeCarton(input) {
    return {
      length: positiveNumber(input.length, "carton length"),
      width: positiveNumber(input.width, "carton width"),
      height: positiveNumber(input.height, "carton height"),
    };
  }

  function normalizeSku(input, index) {
    if (!input || typeof input !== "object") {
      throw new Error("SKU 条目必须为对象");
    }
    const label = input.label || String.fromCharCode(65 + index);
    const target = positiveNumber(input.target, `${label} target quantity`);
    if (!Number.isInteger(target)) {
      throw new Error(`${label} 目标数量必须为整数`);
    }
    return {
      label,
      length: positiveNumber(input.length, `${label} carton length`),
      width: positiveNumber(input.width, `${label} carton width`),
      height: positiveNumber(input.height, `${label} carton height`),
      target,
      color: input.color || "#d8923a",
    };
  }

  function normalizeSkus(inputs) {
    if (!Array.isArray(inputs) || inputs.length < 2 || inputs.length > 5) {
      throw new Error("多 SKU 模式只支持 2 到 5 个 SKU");
    }
    const skus = inputs.map(normalizeSku);
    const labels = new Set();
    for (const sku of skus) {
      if (labels.has(sku.label)) {
        throw new Error(`SKU 名称 "${sku.label}" 不能重复`);
      }
      labels.add(sku.label);
    }
    return skus;
  }

  function assertSameSkuDimensions(skus) {
    const [firstSku] = skus;
    const mismatched = skus.find(
      (sku) =>
        sku.length !== firstSku.length ||
        sku.width !== firstSku.width ||
        sku.height !== firstSku.height,
    );

    if (mismatched) {
      throw new Error("多 SKU 模式仅支持所有 SKU 使用同尺寸纸箱");
    }
  }

  function getOrientations(carton) {
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

  function hasDoorSideRemainderClearance(position, container, minClearance) {
    return container.length - (position.x + position.dx) >= minClearance;
  }

  function overlapsAnyFloorRect(position, occupiedRects) {
    const rect = floorRectFromPosition(position);
    return occupiedRects.some((occupied) => rectanglesOverlap(rect, occupied));
  }

  function makeSequence(lengthCount, widthCount, order, orientations) {
    const sequence = [];
    const pushUnits = (orientation, count) => {
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

  function summarizeGroups(sequence, family, container) {
    const groups = [];
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
      const orientation = group.orientationId === "length" ? sequence.find((item) => item.id === "length") : sequence.find((item) => item.id === "width");
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

  function summarizeGroupsFromUnits(units, orientations) {
    const groups = [];

    for (const unit of units) {
      const previous = groups[groups.length - 1];
      const orientation = orientations[unit.orientationId];
      const occupiedLength = unit.family === "length-segments" ? unit.dx : unit.acrossCount * unit.dx;
      const occupiedWidth = unit.family === "length-segments" ? unit.acrossCount * unit.dy : unit.dy;

      if (previous && previous.orientationId === unit.orientationId) {
        previous.count += 1;
        previous.occupiedLength += unit.family === "length-segments" ? occupiedLength : 0;
        previous.occupiedLength = unit.family === "width-lanes" ? Math.max(previous.occupiedLength, occupiedLength) : previous.occupiedLength;
        previous.occupiedWidth += unit.family === "width-lanes" ? occupiedWidth : 0;
        previous.occupiedWidth = unit.family === "length-segments" ? Math.max(previous.occupiedWidth, occupiedWidth) : previous.occupiedWidth;
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

  function createLengthCandidate(container, orientations, lengthCount, widthCount, order) {
    const sequence = makeSequence(lengthCount, widthCount, order, orientations);
    let x = 0;
    let occupiedWidth = 0;
    let perLayerBoxCount = 0;
    const units = [];

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

  function createWidthCandidate(container, orientations, lengthCount, widthCount, order) {
    const sequence = makeSequence(lengthCount, widthCount, order, orientations);
    let y = 0;
    let occupiedLength = 0;
    let perLayerBoxCount = 0;
    const units = [];

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

  function getFloorOccupiedLength(positions) {
    return positions.reduce((maxLength, position) => Math.max(maxLength, position.x + position.dx), 0);
  }

  function addWidthLaneCandidateVariants(
    candidates,
    container,
    carton,
    orientations,
    candidate,
    minDoorSideClearance = 0,
  ) {
    const basePositions = createLayerPositions(candidate, carton.height);
    const normalizedCandidate = {
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

  function addWidthLaneCandidates(candidates, container, carton, orientations, lengthCount, widthCount, order) {
    const baseCandidate = createWidthCandidate(container, orientations, lengthCount, widthCount, order);
    addWidthLaneCandidateVariants(candidates, container, carton, orientations, baseCandidate);

    if (!baseCandidate.units.some((unit) => unit.orientationId === "width" && unit.acrossCount > 0)) {
      return;
    }

    const seenReducedUnits = new Set();
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

  function enumerateCandidates(container, carton) {
    const orientations = getOrientations(carton);
    const candidates = [];
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

  function createLayerPositions(pattern, cartonHeight) {
    const positions = [];

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

  function createDoorSideRemainderPositions(container, carton, occupiedPositions, minDoorSideClearance = 0) {
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
      .reduce((accepted, candidate) => {
        const acceptedRects = accepted.map(floorRectFromPosition);
        if (!overlapsAnyFloorRect(candidate, acceptedRects)) {
          accepted.push(candidate);
        }
        return accepted;
      }, []);
  }

  function intersects(aStart, aSize, bStart, bSize) {
    return aStart < bStart + bSize && aStart + aSize > bStart;
  }

  function collidesCornerBlock(box, container, cornerBlock) {
    const entersTopBand = intersects(
      box.z,
      box.dz,
      container.height - cornerBlock.height,
      cornerBlock.height,
    );
    if (!entersTopBand) return false;

    const entersInnerLength = intersects(box.x, box.dx, 0, cornerBlock.length);
    if (!entersInnerLength) return false;

    const leftCorner = intersects(box.y, box.dy, 0, cornerBlock.width);
    const rightCorner = intersects(
      box.y,
      box.dy,
      container.width - cornerBlock.width,
      cornerBlock.width,
    );

    return leftCorner || rightCorner;
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
      group.slice().sort((a, b) => a.stackIndex - b.stackIndex || a.y - b.y),
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

  function createStackedFacePositions(basePosition, faceIndex, layerCount, container, cornerBlock, acceptedByStack) {
    const positions = [];

    for (let stackIndex = 0; stackIndex < layerCount; stackIndex += 1) {
      const position = {
        ...basePosition,
        z: stackIndex * basePosition.dz,
        faceIndex,
        stackIndex,
      };

      const acceptedInStackBand = acceptedByStack.get(stackIndex) || [];
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
        positions.push(acceptedPosition);
        acceptedInStackBand.push(acceptedPosition);
        acceptedByStack.set(stackIndex, acceptedInStackBand);
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
    const acceptedByStack = new Map();

    orderedFloor.forEach((basePosition, faceIndex) => {
      positions.push(
        ...createStackedFacePositions(basePosition, faceIndex, layerCount, container, cornerBlock, acceptedByStack),
      );
    });

    return assignSequenceIndexes(positions);
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

    for (const basePosition of orderFloorPositionsForLoading(basePositions)) {
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

  function calculatePacking(containerInput, cartonInput, options = {}) {
    const container = normalizeContainer(containerInput);
    const carton = normalizeCarton(cartonInput);
    const cornerBlock = {
      ...DEFAULT_CORNER_BLOCK,
      ...(options.cornerBlock || {}),
    };

    const candidates = enumerateCandidates(container, carton);
    let best = null;

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

  function calculatePackingTotalBoxes(containerInput, cartonInput, options = {}) {
    const container = normalizeContainer(containerInput);
    const carton = normalizeCarton(cartonInput);
    const cornerBlock = {
      ...DEFAULT_CORNER_BLOCK,
      ...(options.cornerBlock || {}),
    };

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
    assertSameSkuDimensions(skus);
    const strategy = options.strategy || LOADING_STRATEGIES.MULTI_DESTINATION;
    if (!Object.values(LOADING_STRATEGIES).includes(strategy)) {
      throw new Error("装载策略必须为 multi-destination 或 same-destination");
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
    const layers = baseResult.layers.map((layer) => ({
      ...layer,
      boxCount: assignedPositions.filter((position) => position.stackIndex === layer.index).length,
    }));
    const usedHeight =
      assignedPositions.length === 0
        ? 0
        : (Math.max(...assignedPositions.map((position) => position.stackIndex)) + 1) * baseResult.carton.height;
    const containerVolume = baseResult.container.length * baseResult.container.width * baseResult.container.height;
    const volumeLoaded = assignedPositions.length * firstSku.length * firstSku.width * firstSku.height;

    return {
      ...baseResult,
      mode: "multi",
      strategy,
      skus,
      orderedPositions: assignedPositions,
      layers,
      totalBoxes: assignedPositions.length,
      usedHeight,
      utilizationRatio: containerVolume > 0 ? volumeLoaded / containerVolume : 0,
      skuSummary,
    };
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
