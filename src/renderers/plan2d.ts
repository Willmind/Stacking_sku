// @ts-nocheck
import {
  collidesCornerBlock,
  generateBoxPositions,
  type BoxPosition,
  type PackingResult,
} from "../core/packing";

export interface Plan2DRenderOptions {
  canvas: HTMLCanvasElement;
  result: PackingResult | null;
  visibleCount: number;
  viewMode?: Plan2DViewMode;
  devicePixelRatio?: number;
  showLabels?: boolean;
}

export type Plan2DViewMode = "top" | "side" | "front";

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const number = Number.parseInt(normalized, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function colorForBox(box?: BoxPosition) {
  return box?.skuColor || "#d8923a";
}

function resizeCanvas(canvas: HTMLCanvasElement, devicePixelRatio = window.devicePixelRatio || 1) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, devicePixelRatio);
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(280, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {
    ctx,
    width: width / dpr,
    height: height / dpr,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCanvasMessage(ctx: CanvasRenderingContext2D, width: number, height: number, message: string) {
  ctx.save();
  ctx.fillStyle = "rgba(245, 247, 251, 0.78)";
  ctx.font = "700 16px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
  ctx.restore();
}

function findCurrentLayer(result: PackingResult, visibleCount: number) {
  const visiblePositions = result.orderedPositions.slice(0, visibleCount);
  const lastPosition = visiblePositions[visiblePositions.length - 1];
  if (lastPosition) {
    const layer =
      result.layers.find((item) => item.index === lastPosition.stackIndex) ||
      result.layers[lastPosition.stackIndex || 0] ||
      { index: 0, boxCount: 0, z: 0 };
    return {
      layer,
      countInLayer: visiblePositions.filter((position) => position.stackIndex === lastPosition.stackIndex).length,
    };
  }

  const fallback = result.layers[0] || { index: 0, boxCount: 0, z: 0 };
  return { layer: fallback, countInLayer: 0 };
}

function keyForPosition(position: BoxPosition) {
  return `${position.x}:${position.y}:${position.dx}:${position.dy}`;
}

function isCompactCanvas(width: number, height: number) {
  return height < 320 || width < 520;
}

function drawOuterPlanLabels(
  ctx: CanvasRenderingContext2D,
  result: PackingResult,
  boxX: number,
  boxY: number,
  scale: number,
  width: number,
  height: number,
  currentLayer: ReturnType<typeof findCurrentLayer>,
  viewMode: Plan2DViewMode,
  visibleCount: number,
) {
  const plane = getPlan2DPlaneConfig(result, viewMode);
  const planWidth = plane.width * scale;
  const planHeight = plane.height * scale;
  const compactCanvas = isCompactCanvas(width, height);
  const showMeasurementLabels = !compactCanvas;
  const showDirectionLabel = !compactCanvas || width >= 560;
  const showCornerLegend = !compactCanvas;
  ctx.save();
  ctx.font = "700 12px Inter, sans-serif";
  ctx.fillStyle = "rgba(245, 247, 251, 0.92)";
  ctx.strokeStyle = "rgba(255,255,255,0.48)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(boxX, boxY + planHeight + 22);
  ctx.lineTo(boxX + planWidth, boxY + planHeight + 22);
  ctx.stroke();
  ctx.textAlign = "center";
  if (showMeasurementLabels) {
    ctx.fillText(
      `${plane.xLabel} ${formatNumber(plane.width)}mm · 占用 ${formatNumber(plane.occupiedWidth)}mm`,
      boxX + planWidth / 2,
      boxY + planHeight + 42,
    );
  }

  ctx.beginPath();
  ctx.moveTo(boxX - 22, boxY);
  ctx.lineTo(boxX - 22, boxY + planHeight);
  ctx.stroke();
  if (showMeasurementLabels) {
    ctx.save();
    ctx.translate(Math.max(16, boxX - 38), boxY + planHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${plane.yLabel} ${formatNumber(plane.height)}mm · 占用 ${formatNumber(plane.occupiedHeight)}mm`, 0, 0);
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(66, 214, 164, 0.96)";
  const statusText =
    viewMode === "top"
      ? `第 ${(currentLayer.layer.index || 0) + 1} 层：${formatNumber(currentLayer.countInLayer)} / ${formatNumber(currentLayer.layer.boxCount || 0)} 箱`
      : `当前显示：${formatNumber(Math.min(result.totalBoxes, visibleCount))} / ${formatNumber(result.totalBoxes)} 箱`;
  ctx.fillText(statusText, 18, 24);
  if (showCornerLegend) {
    ctx.fillStyle = "rgba(255, 112, 102, 0.9)";
    ctx.fillText("红色区域为顶部角件避让区", 18, height - 20);
  }
  if (showDirectionLabel) {
    ctx.fillStyle = "rgba(174, 184, 201, 0.9)";
    ctx.textAlign = "right";
    ctx.fillText(plane.directionLabel, width - 18, 24);
  }
  ctx.restore();
}

export function getPlan2DPlaneConfig(result: PackingResult, viewMode: Plan2DViewMode) {
  const { container, pattern } = result;
  if (viewMode === "side") {
    return {
      width: container.length,
      height: container.height,
      occupiedWidth: pattern?.occupiedLength || 0,
      occupiedHeight: result.usedHeight,
      xLabel: "柜长",
      yLabel: "柜高",
      directionLabel: "左侧为柜内最里面，右侧为柜门方向",
    };
  }
  if (viewMode === "front") {
    return {
      width: container.width,
      height: container.height,
      occupiedWidth: pattern?.occupiedWidth || 0,
      occupiedHeight: result.usedHeight,
      xLabel: "柜宽",
      yLabel: "柜高",
      directionLabel: "左右为柜宽方向，上方为柜顶角件",
    };
  }
  return {
    width: container.length,
    height: container.width,
    occupiedWidth: pattern?.occupiedLength || 0,
    occupiedHeight: pattern?.occupiedWidth || 0,
    xLabel: "柜长",
    yLabel: "柜宽",
    directionLabel: "左侧为柜内最里面，右侧为柜门方向",
  };
}

function projectBox(box: BoxPosition, container: PackingResult["container"], viewMode: Plan2DViewMode) {
  if (viewMode === "side") {
    return {
      x: box.x,
      y: container.height - (box.z + box.dz),
      dx: box.dx,
      dy: box.dz,
    };
  }
  if (viewMode === "front") {
    return {
      x: box.y,
      y: container.height - (box.z + box.dz),
      dx: box.dy,
      dy: box.dz,
    };
  }
  return {
    x: box.x,
    y: box.y,
    dx: box.dx,
    dy: box.dy,
  };
}

function getCornerProjectionRects(result: PackingResult, viewMode: Plan2DViewMode) {
  const { container, cornerBlock } = result;
  if (viewMode === "side") {
    return [
      {
        x: 0,
        y: container.height - cornerBlock.height,
        dx: cornerBlock.length,
        dy: cornerBlock.height,
      },
    ];
  }
  if (viewMode === "front") {
    return [
      {
        x: 0,
        y: container.height - cornerBlock.height,
        dx: cornerBlock.width,
        dy: cornerBlock.height,
      },
      {
        x: container.width - cornerBlock.width,
        y: container.height - cornerBlock.height,
        dx: cornerBlock.width,
        dy: cornerBlock.height,
      },
    ];
  }
  return [
    {
      x: 0,
      y: 0,
      dx: cornerBlock.length,
      dy: cornerBlock.width,
    },
    {
      x: 0,
      y: container.width - cornerBlock.width,
      dx: cornerBlock.length,
      dy: cornerBlock.width,
    },
  ];
}

function getTopViewDrawingPositions(result: PackingResult, visibleCount: number, currentLayer: ReturnType<typeof findCurrentLayer>) {
  const orderedLayerPositions = result.orderedPositions.filter((position) => position.stackIndex === currentLayer.layer.index);
  const orderedLayerKeys = new Set(orderedLayerPositions.map(keyForPosition));
  const visiblePositionByKey = generateBoxPositions(result, visibleCount)
    .filter((position) => position.stackIndex === currentLayer.layer.index)
    .reduce((positions, position) => {
      positions.set(keyForPosition(position), position);
      return positions;
    }, new Map<string, BoxPosition>());

  return [
    ...result.layerPositions
      .filter((position) => !orderedLayerKeys.has(keyForPosition(position)))
      .map((position) => ({ box: position, visibleBox: null, baseMarker: true })),
    ...orderedLayerPositions.map((position) => ({
      box: position,
      visibleBox: visiblePositionByKey.get(keyForPosition(position)) || null,
      baseMarker: false,
    })),
  ];
}

function getElevationDrawingPositions(result: PackingResult, visibleCount: number) {
  const visiblePositions = generateBoxPositions(result, visibleCount);
  const visibleKeys = new Set(visiblePositions.map((position) => `${position.sequenceIndex}:${keyForPosition(position)}:${position.z}`));
  return [
    ...result.orderedPositions.map((position) => ({
      box: position,
      visibleBox: visibleKeys.has(`${position.sequenceIndex}:${keyForPosition(position)}:${position.z}`) ? position : null,
      baseMarker: true,
    })),
  ];
}

export function renderPlan2D({
  canvas,
  result,
  visibleCount,
  viewMode = "top",
  devicePixelRatio,
  showLabels = true,
}: Plan2DRenderOptions): void {
  const { ctx, width, height } = resizeCanvas(canvas, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);

  if (!result || !result.pattern) {
    drawCanvasMessage(ctx, width, height, "请输入可装载的纸箱尺寸");
    return;
  }

  const compactCanvas = isCompactCanvas(width, height);
  const pad = showLabels ? (compactCanvas ? 34 : 48) : 18;
  const container = result.container;
  const plane = getPlan2DPlaneConfig(result, viewMode);
  const scale = Math.min((width - pad * 2) / plane.width, (height - pad * 2) / plane.height);
  const boxX = (width - plane.width * scale) / 2;
  const boxY = (height - plane.height * scale) / 2 + (showLabels ? (compactCanvas ? 4 : 10) : 0);
  const currentLayer = findCurrentLayer(result, visibleCount);

  ctx.save();
  ctx.translate(boxX, boxY);
  ctx.fillStyle = "rgba(20, 28, 37, 0.92)";
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 0, 0, plane.width * scale, plane.height * scale, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 112, 102, 0.22)";
  ctx.strokeStyle = "rgba(255, 112, 102, 0.8)";
  ctx.lineWidth = 1;
  for (const corner of getCornerProjectionRects(result, viewMode)) {
    ctx.fillRect(corner.x * scale, corner.y * scale, corner.dx * scale, corner.dy * scale);
    ctx.strokeRect(corner.x * scale, corner.y * scale, corner.dx * scale, corner.dy * scale);
  }

  const drawingPositions =
    viewMode === "top" ? getTopViewDrawingPositions(result, visibleCount, currentLayer) : getElevationDrawingPositions(result, visibleCount);
  const sortedDrawingPositions = drawingPositions
    .slice()
    .sort((a, b) => Number(Boolean(a.visibleBox)) - Number(Boolean(b.visibleBox)));

  for (const { box, visibleBox, baseMarker } of sortedDrawingPositions) {
    const blocked = collidesCornerBlock(
      viewMode === "top" ? { ...box, z: currentLayer.layer.z || 0 } : box,
      result.container,
      result.cornerBlock,
    );
    const isVisible = viewMode === "top" ? !baseMarker && !blocked && Boolean(visibleBox) : Boolean(visibleBox);
    const boxRgb = hexToRgb(colorForBox(visibleBox || box));
    const rect = projectBox(box, container, viewMode);

    ctx.fillStyle = isVisible
      ? `rgba(${boxRgb.r}, ${boxRgb.g}, ${boxRgb.b}, 0.82)`
      : blocked
        ? "rgba(255, 112, 102, 0.08)"
        : "rgba(255, 255, 255, 0.06)";
    ctx.strokeStyle = blocked ? "rgba(255, 112, 102, 0.55)" : "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = Math.max(0.65, Math.min(1.2, scale * 14));
    ctx.fillRect(rect.x * scale, rect.y * scale, rect.dx * scale, rect.dy * scale);
    ctx.strokeRect(rect.x * scale, rect.y * scale, rect.dx * scale, rect.dy * scale);
  }

  ctx.strokeStyle = "rgba(66, 214, 164, 0.95)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, plane.occupiedWidth * scale, plane.occupiedHeight * scale);
  ctx.restore();

  if (showLabels) {
    drawOuterPlanLabels(ctx, result, boxX, boxY, scale, width, height, currentLayer, viewMode, visibleCount);
  }
}
