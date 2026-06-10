(function attachPackingCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ContainerPacking = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function packingFactory() {
  "use strict";

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

  function positiveNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new Error(`${name} must be a positive number`);
    }
    return number;
  }

  function normalizeContainer(input) {
    const source = typeof input === "string" ? CONTAINERS[input] : input;
    if (!source) {
      throw new Error("container must be one of 20GP, 40GP, 40HQ, or a dimension object");
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
        candidates.push(createWidthCandidate(container, orientations, lengthCount, widthCount, "length-first"));
        if (lengthCount > 0 && widthCount > 0) {
          candidates.push(createWidthCandidate(container, orientations, lengthCount, widthCount, "width-first"));
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

  function evaluateCandidate(container, carton, pattern, cornerBlock) {
    const basePositions = createLayerPositions(pattern, carton.height);
    const layerCount = Math.floor(container.height / carton.height);
    const layers = [];
    let totalBoxes = 0;
    let blockedByCornerTotal = 0;

    for (let index = 0; index < layerCount; index += 1) {
      const z = index * carton.height;
      let blockedByCorner = 0;

      for (const position of basePositions) {
        if (collidesCornerBlock({ ...position, z }, container, cornerBlock)) {
          blockedByCorner += 1;
        }
      }

      const boxCount = basePositions.length - blockedByCorner;
      layers.push({
        index,
        z,
        boxCount,
        blockedByCorner,
      });
      totalBoxes += boxCount;
      blockedByCornerTotal += blockedByCorner;
    }

    const volumeLoaded = totalBoxes * carton.length * carton.width * carton.height;
    const containerVolume = container.length * container.width * container.height;

    return {
      container,
      carton,
      cornerBlock,
      pattern,
      layerPositions: basePositions,
      perLayerBoxCount: basePositions.length,
      layers,
      totalBoxes,
      blockedByCornerTotal,
      usedHeight: layerCount * carton.height,
      utilizationRatio: containerVolume > 0 ? volumeLoaded / containerVolume : 0,
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

  function generateBoxPositions(result, visibleCount = result.totalBoxes) {
    const limit = Math.max(0, Math.min(result.totalBoxes, Math.floor(visibleCount)));
    const positions = [];
    if (!result.pattern || limit === 0) return positions;

    for (const layer of result.layers) {
      for (const basePosition of result.layerPositions) {
        const position = {
          ...basePosition,
          z: layer.z,
        };

        if (collidesCornerBlock(position, result.container, result.cornerBlock)) {
          continue;
        }

        positions.push(position);
        if (positions.length >= limit) {
          return positions;
        }
      }
    }

    return positions;
  }

  return {
    CONTAINERS,
    DEFAULT_CORNER_BLOCK,
    calculatePacking,
    generateBoxPositions,
    collidesCornerBlock,
  };
});
