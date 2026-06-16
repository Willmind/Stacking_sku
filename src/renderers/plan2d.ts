// @ts-nocheck
import {
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

export interface Plan2DAxisGuideMetric {
  count: number;
  countLabel: string;
  axisLabel: string;
  occupied: number;
  remaining: number;
}

export interface Plan2DAxisGuideMetrics {
  x: Plan2DAxisGuideMetric;
  y: Plan2DAxisGuideMetric;
}

interface ProjectedRect {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface AxisGuideModel extends Plan2DAxisGuideMetrics {
  bounds: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  };
}

export interface Plan2DGuideLabelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Plan2DVerticalGuideLabelLayoutOptions {
  lines: string[];
  yGuideX: number;
  yStart: number;
  yEnd: number;
  canvasWidth: number;
  canvasHeight: number;
  measureText: (text: string) => number;
}

const STACKED_GUIDE_LABEL_FONT = "800 10.5px Inter, sans-serif";
const STACKED_GUIDE_LABEL_LINE_HEIGHT = 14;
const STACKED_GUIDE_LABEL_PADDING_X = 8;
const STACKED_GUIDE_LABEL_PADDING_Y = 7;
const GUIDE_LABEL_CANVAS_GUTTER = 8;
const VERTICAL_GUIDE_LABEL_GAP = 12;

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

function drawCanvasMessage(ctx: CanvasRenderingContext2D, width: number, height: number, message: string) {
  ctx.save();
  ctx.fillStyle = "rgba(245, 247, 251, 0.78)";
  ctx.font = "700 16px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
  ctx.restore();
}

function drawContainerFill(
  ctx: CanvasRenderingContext2D,
  plane: ReturnType<typeof getPlan2DPlaneConfig>,
  scale: number,
) {
  ctx.fillStyle = "rgba(20, 28, 37, 0.92)";
  ctx.fillRect(0, 0, plane.width * scale, plane.height * scale);
}

function drawContainerOutline(
  ctx: CanvasRenderingContext2D,
  plane: ReturnType<typeof getPlan2DPlaneConfig>,
  scale: number,
) {
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, plane.width * scale, plane.height * scale);
}

export function getTopViewFootprintProgress(result: PackingResult, visibleCount: number) {
  const normalizedVisibleCount = Math.max(0, Math.min(result.totalBoxes, Math.floor(visibleCount)));
  const visibleFaceIndexes = new Set(
    generateBoxPositions(result, normalizedVisibleCount)
      .map((position) => position.faceIndex)
      .filter((faceIndex) => Number.isFinite(faceIndex)),
  );

  return {
    visibleFootprints: visibleFaceIndexes.size,
    totalFootprints: result.layerPositions.length,
  };
}

function keyForPosition(position: BoxPosition) {
  return `${position.x}:${position.y}:${position.dx}:${position.dy}`;
}

function isCompactCanvas(width: number, height: number) {
  return height < 320 || width < 520;
}

function axisNameForLabel(axisLabel: string) {
  return axisLabel.replace("柜", "");
}

function countLabelForAxis(axisLabel: string, axis: "x" | "y") {
  if (axisLabel === "柜高") return "层";
  if (axisLabel === "柜宽") return "排";
  return axis === "x" ? "列" : "排";
}

function uniqueProjectedCount(rects: ProjectedRect[], axis: "x" | "y") {
  const keys = rects.map((rect) => {
    if (axis === "x") return `${Math.round(rect.x)}:${Math.round(rect.dx)}`;
    return `${Math.round(rect.y)}:${Math.round(rect.dy)}`;
  });
  return new Set(keys).size;
}

function getVisibleProjectedRects(
  result: PackingResult,
  visibleCount: number,
  viewMode: Plan2DViewMode,
) {
  const normalizedVisibleCount = Math.max(0, Math.min(result.totalBoxes, Math.floor(visibleCount)));
  const container = result.container;

  if (viewMode === "top") {
    const visibleFaceIndexes = new Set(
      generateBoxPositions(result, normalizedVisibleCount)
        .map((position) => position.faceIndex)
        .filter((faceIndex) => Number.isFinite(faceIndex)),
    );

    return result.layerPositions
      .map((position, faceIndex) => (visibleFaceIndexes.has(faceIndex) ? projectBox(position, container, viewMode) : null))
      .filter((rect): rect is ProjectedRect => Boolean(rect));
  }

  return generateBoxPositions(result, normalizedVisibleCount).map((position) =>
    projectBox(position, container, viewMode),
  );
}

function getPlan2DAxisGuideModel(
  result: PackingResult,
  visibleCount: number,
  viewMode: Plan2DViewMode,
): AxisGuideModel {
  const plane = getPlan2DPlaneConfig(result, viewMode);
  const rects = getVisibleProjectedRects(result, visibleCount, viewMode);
  const emptyMetric = (axisLabel: string, axis: "x" | "y"): Plan2DAxisGuideMetric => ({
    count: 0,
    countLabel: countLabelForAxis(axisLabel, axis),
    axisLabel,
    occupied: 0,
    remaining: axis === "x" ? plane.width : plane.height,
  });

  if (rects.length === 0) {
    return {
      x: emptyMetric(plane.xLabel, "x"),
      y: emptyMetric(plane.yLabel, "y"),
      bounds: {
        xStart: 0,
        xEnd: 0,
        yStart: plane.height,
        yEnd: plane.height,
      },
    };
  }

  const xStart = Math.min(...rects.map((rect) => rect.x));
  const xEnd = Math.max(...rects.map((rect) => rect.x + rect.dx));
  const yStart = Math.min(...rects.map((rect) => rect.y));
  const yEnd = Math.max(...rects.map((rect) => rect.y + rect.dy));
  const occupiedX = Math.max(0, xEnd - xStart);
  const occupiedY = Math.max(0, yEnd - yStart);

  return {
    x: {
      count: uniqueProjectedCount(rects, "x"),
      countLabel: countLabelForAxis(plane.xLabel, "x"),
      axisLabel: plane.xLabel,
      occupied: occupiedX,
      remaining: Math.max(0, plane.width - occupiedX),
    },
    y: {
      count: uniqueProjectedCount(rects, "y"),
      countLabel: countLabelForAxis(plane.yLabel, "y"),
      axisLabel: plane.yLabel,
      occupied: occupiedY,
      remaining: Math.max(0, plane.height - occupiedY),
    },
    bounds: {
      xStart,
      xEnd,
      yStart,
      yEnd,
    },
  };
}

export function getPlan2DAxisGuideMetrics(
  result: PackingResult,
  visibleCount: number,
  viewMode: Plan2DViewMode,
): Plan2DAxisGuideMetrics {
  const model = getPlan2DAxisGuideModel(result, visibleCount, viewMode);
  return {
    x: model.x,
    y: model.y,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function drawGuideLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = "800 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  const labelWidth = metrics.width + 14;
  const labelHeight = 21;
  const radius = 5;

  ctx.fillStyle = "rgba(7, 13, 19, 0.82)";
  ctx.strokeStyle = "rgba(245, 247, 251, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-labelWidth / 2 + radius, -labelHeight / 2);
  ctx.lineTo(labelWidth / 2 - radius, -labelHeight / 2);
  ctx.quadraticCurveTo(labelWidth / 2, -labelHeight / 2, labelWidth / 2, -labelHeight / 2 + radius);
  ctx.lineTo(labelWidth / 2, labelHeight / 2 - radius);
  ctx.quadraticCurveTo(labelWidth / 2, labelHeight / 2, labelWidth / 2 - radius, labelHeight / 2);
  ctx.lineTo(-labelWidth / 2 + radius, labelHeight / 2);
  ctx.quadraticCurveTo(-labelWidth / 2, labelHeight / 2, -labelWidth / 2, labelHeight / 2 - radius);
  ctx.lineTo(-labelWidth / 2, -labelHeight / 2 + radius);
  ctx.quadraticCurveTo(-labelWidth / 2, -labelHeight / 2, -labelWidth / 2 + radius, -labelHeight / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(245, 247, 251, 0.94)";
  ctx.fillText(text, 0, 0.5);
  ctx.restore();
}

function formatAxisGuideText(metric: Plan2DAxisGuideMetric) {
  const axisName = axisNameForLabel(metric.axisLabel);
  return `${formatNumber(metric.count)}${metric.countLabel} · 占${axisName} ${formatNumber(metric.occupied)}mm · 余量 ${formatNumber(metric.remaining)}mm`;
}

function formatAxisGuideLines(metric: Plan2DAxisGuideMetric) {
  const axisName = axisNameForLabel(metric.axisLabel);
  return [
    `${formatNumber(metric.count)}${metric.countLabel}`,
    `占${axisName} ${formatNumber(metric.occupied)}mm`,
    `余量 ${formatNumber(metric.remaining)}mm`,
  ];
}

function getStackedGuideLabelSize(lines: string[], measureText: (text: string) => number) {
  return {
    width: Math.max(...lines.map((line) => measureText(line))) + STACKED_GUIDE_LABEL_PADDING_X * 2,
    height: lines.length * STACKED_GUIDE_LABEL_LINE_HEIGHT + STACKED_GUIDE_LABEL_PADDING_Y * 2,
  };
}

export function getPlan2DVerticalGuideLabelLayout({
  lines,
  yGuideX,
  yStart,
  yEnd,
  canvasWidth,
  canvasHeight,
  measureText,
}: Plan2DVerticalGuideLabelLayoutOptions): Plan2DGuideLabelLayout {
  const size = getStackedGuideLabelSize(lines, measureText);
  const maxX = Math.max(GUIDE_LABEL_CANVAS_GUTTER, canvasWidth - size.width - GUIDE_LABEL_CANVAS_GUTTER);
  const maxY = Math.max(GUIDE_LABEL_CANVAS_GUTTER, canvasHeight - size.height - GUIDE_LABEL_CANVAS_GUTTER);
  const preferredX = yGuideX - size.width - VERTICAL_GUIDE_LABEL_GAP;
  const preferredY = (yStart + yEnd) / 2 - size.height / 2;

  return {
    x: clamp(preferredX, GUIDE_LABEL_CANVAS_GUTTER, maxX),
    y: clamp(preferredY, GUIDE_LABEL_CANVAS_GUTTER, maxY),
    ...size,
  };
}

function drawStackedGuideLabel(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  layout: Plan2DGuideLabelLayout,
) {
  ctx.save();
  ctx.font = STACKED_GUIDE_LABEL_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const labelX = layout.x;
  const labelY = layout.y;
  const labelWidth = layout.width;
  const labelHeight = layout.height;
  const radius = 5;

  ctx.fillStyle = "rgba(7, 13, 19, 0.82)";
  ctx.strokeStyle = "rgba(245, 247, 251, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(labelX + radius, labelY);
  ctx.lineTo(labelX + labelWidth - radius, labelY);
  ctx.quadraticCurveTo(labelX + labelWidth, labelY, labelX + labelWidth, labelY + radius);
  ctx.lineTo(labelX + labelWidth, labelY + labelHeight - radius);
  ctx.quadraticCurveTo(labelX + labelWidth, labelY + labelHeight, labelX + labelWidth - radius, labelY + labelHeight);
  ctx.lineTo(labelX + radius, labelY + labelHeight);
  ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + labelHeight - radius);
  ctx.lineTo(labelX, labelY + radius);
  ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "rgba(66, 214, 164, 0.96)" : "rgba(245, 247, 251, 0.9)";
    ctx.fillText(
      line,
      labelX + STACKED_GUIDE_LABEL_PADDING_X,
      labelY + STACKED_GUIDE_LABEL_PADDING_Y + STACKED_GUIDE_LABEL_LINE_HEIGHT * index + STACKED_GUIDE_LABEL_LINE_HEIGHT / 2,
    );
  });
  ctx.restore();
}

function drawOuterAxisGuides(
  ctx: CanvasRenderingContext2D,
  result: PackingResult,
  visibleCount: number,
  viewMode: Plan2DViewMode,
  plane: ReturnType<typeof getPlan2DPlaneConfig>,
  scale: number,
  boxX: number,
  boxY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const model = getPlan2DAxisGuideModel(result, visibleCount, viewMode);
  if (model.x.occupied <= 0 || model.y.occupied <= 0) return;

  const planWidth = plane.width * scale;
  const planHeight = plane.height * scale;
  const tick = 5;
  const x1 = clamp(boxX + model.bounds.xStart * scale, boxX, boxX + planWidth);
  const x2 = clamp(boxX + model.bounds.xEnd * scale, boxX, boxX + planWidth);
  const y1 = clamp(boxY + model.bounds.yStart * scale, boxY, boxY + planHeight);
  const y2 = clamp(boxY + model.bounds.yEnd * scale, boxY, boxY + planHeight);
  const xGuideY = clamp(boxY + planHeight + 16, boxY + planHeight + 10, canvasHeight - 30);
  const yGuideX = Math.max(34, boxX - 16);

  ctx.save();
  ctx.strokeStyle = "rgba(245, 247, 251, 0.64)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);

  ctx.beginPath();
  ctx.moveTo(x1, xGuideY);
  ctx.lineTo(x2, xGuideY);
  ctx.moveTo(x1, xGuideY - tick);
  ctx.lineTo(x1, xGuideY + tick);
  ctx.moveTo(x2, xGuideY - tick);
  ctx.lineTo(x2, xGuideY + tick);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(yGuideX, y1);
  ctx.lineTo(yGuideX, y2);
  ctx.moveTo(yGuideX - tick, y1);
  ctx.lineTo(yGuideX + tick, y1);
  ctx.moveTo(yGuideX - tick, y2);
  ctx.lineTo(yGuideX + tick, y2);
  ctx.stroke();

  ctx.setLineDash([]);
  drawGuideLabel(ctx, formatAxisGuideText(model.x), clamp((x1 + x2) / 2, 80, canvasWidth - 80), xGuideY + 17);
  const yGuideLines = formatAxisGuideLines(model.y);
  ctx.font = STACKED_GUIDE_LABEL_FONT;
  drawStackedGuideLabel(
    ctx,
    yGuideLines,
    getPlan2DVerticalGuideLabelLayout({
      lines: yGuideLines,
      yGuideX,
      yStart: y1,
      yEnd: y2,
      canvasWidth,
      canvasHeight,
      measureText: (line) => ctx.measureText(line).width,
    }),
  );
  ctx.restore();
}

function drawOuterPlanLabels(
  ctx: CanvasRenderingContext2D,
  result: PackingResult,
  boxX: number,
  boxY: number,
  scale: number,
  width: number,
  height: number,
  viewMode: Plan2DViewMode,
  visibleCount: number,
) {
  const plane = getPlan2DPlaneConfig(result, viewMode);
  const planWidth = plane.width * scale;
  const planHeight = plane.height * scale;
  const compactCanvas = isCompactCanvas(width, height);
  const showMeasurementLabels = !compactCanvas;
  const showDirectionLabel = !compactCanvas || width >= 560;
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
  ctx.fillText(`当前显示：${formatNumber(Math.min(result.totalBoxes, visibleCount))} / ${formatNumber(result.totalBoxes)} 箱`, 18, 24);
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

function getTopViewDrawingPositions(result: PackingResult, visibleCount: number) {
  const visiblePositionByFace = generateBoxPositions(result, visibleCount)
    .reduce((positions, position) => {
      if (Number.isFinite(position.faceIndex)) {
        positions.set(position.faceIndex, position);
      }
      return positions;
    }, new Map<number, BoxPosition>());

  return result.layerPositions.map((position, faceIndex) => ({
      box: position,
      visibleBox: visiblePositionByFace.get(faceIndex) || null,
    }));
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
  const pad = showLabels ? (compactCanvas ? 34 : 48) : (compactCanvas ? 54 : 68);
  const container = result.container;
  const plane = getPlan2DPlaneConfig(result, viewMode);
  const scale = Math.min((width - pad * 2) / plane.width, (height - pad * 2) / plane.height);
  const boxX = (width - plane.width * scale) / 2;
  const boxY = (height - plane.height * scale) / 2 + (showLabels ? (compactCanvas ? 4 : 10) : 0);

  ctx.save();
  ctx.translate(boxX, boxY);
  drawContainerFill(ctx, plane, scale);

  const drawingPositions =
    viewMode === "top" ? getTopViewDrawingPositions(result, visibleCount) : getElevationDrawingPositions(result, visibleCount);
  const sortedDrawingPositions = drawingPositions
    .slice()
    .sort((a, b) => Number(Boolean(a.visibleBox)) - Number(Boolean(b.visibleBox)));

  for (const { box, visibleBox } of sortedDrawingPositions) {
    const isVisible = Boolean(visibleBox);
    const boxRgb = hexToRgb(colorForBox(visibleBox || box));
    const rect = projectBox(box, container, viewMode);

    ctx.fillStyle = isVisible
      ? `rgba(${boxRgb.r}, ${boxRgb.g}, ${boxRgb.b}, 0.82)`
      : "rgba(255, 255, 255, 0.06)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = Math.max(0.65, Math.min(1.2, scale * 14));
    ctx.fillRect(rect.x * scale, rect.y * scale, rect.dx * scale, rect.dy * scale);
    ctx.strokeRect(rect.x * scale, rect.y * scale, rect.dx * scale, rect.dy * scale);
  }

  drawContainerOutline(ctx, plane, scale);
  ctx.restore();
  drawOuterAxisGuides(ctx, result, visibleCount, viewMode, plane, scale, boxX, boxY, width, height);

  if (showLabels) {
    drawOuterPlanLabels(ctx, result, boxX, boxY, scale, width, height, viewMode, visibleCount);
  }
}
