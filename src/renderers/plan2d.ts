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
  devicePixelRatio?: number;
}

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

function drawOuterPlanLabels(
  ctx: CanvasRenderingContext2D,
  result: PackingResult,
  boxX: number,
  boxY: number,
  scale: number,
  width: number,
  height: number,
  currentLayer: ReturnType<typeof findCurrentLayer>,
) {
  const container = result.container;
  const planWidth = container.length * scale;
  const planHeight = container.width * scale;
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
  ctx.fillText(
    `柜长 ${formatNumber(container.length)}mm · 占用 ${formatNumber(result.pattern?.occupiedLength || 0)}mm`,
    boxX + planWidth / 2,
    boxY + planHeight + 42,
  );

  ctx.beginPath();
  ctx.moveTo(boxX - 22, boxY);
  ctx.lineTo(boxX - 22, boxY + planHeight);
  ctx.stroke();
  ctx.save();
  ctx.translate(Math.max(16, boxX - 38), boxY + planHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`柜宽 ${formatNumber(container.width)}mm · 占用 ${formatNumber(result.pattern?.occupiedWidth || 0)}mm`, 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(66, 214, 164, 0.96)";
  ctx.fillText(
    `第 ${(currentLayer.layer.index || 0) + 1} 层：${formatNumber(currentLayer.countInLayer)} / ${formatNumber(currentLayer.layer.boxCount || 0)} 箱`,
    18,
    24,
  );
  ctx.fillStyle = "rgba(255, 112, 102, 0.9)";
  ctx.fillText("红色区域为顶部角件避让区", 18, height - 20);
  ctx.fillStyle = "rgba(174, 184, 201, 0.9)";
  ctx.textAlign = "right";
  ctx.fillText("左侧为柜内最里面，右侧为柜门方向", width - 18, 24);
  ctx.restore();
}

export function renderPlan2D({ canvas, result, visibleCount, devicePixelRatio }: Plan2DRenderOptions): void {
  const { ctx, width, height } = resizeCanvas(canvas, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);

  if (!result || !result.pattern) {
    drawCanvasMessage(ctx, width, height, "请输入可装载的纸箱尺寸");
    return;
  }

  const pad = 48;
  const container = result.container;
  const scale = Math.min((width - pad * 2) / container.length, (height - pad * 2) / container.width);
  const boxX = (width - container.length * scale) / 2;
  const boxY = (height - container.width * scale) / 2 + 10;
  const currentLayer = findCurrentLayer(result, visibleCount);

  ctx.save();
  ctx.translate(boxX, boxY);
  ctx.fillStyle = "rgba(20, 28, 37, 0.92)";
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 0, 0, container.length * scale, container.width * scale, 5);
  ctx.fill();
  ctx.stroke();

  const corner = result.cornerBlock;
  ctx.fillStyle = "rgba(255, 112, 102, 0.22)";
  ctx.strokeStyle = "rgba(255, 112, 102, 0.8)";
  ctx.lineWidth = 1;
  ctx.fillRect(0, 0, corner.length * scale, corner.width * scale);
  ctx.strokeRect(0, 0, corner.length * scale, corner.width * scale);
  ctx.fillRect(0, (container.width - corner.width) * scale, corner.length * scale, corner.width * scale);
  ctx.strokeRect(0, (container.width - corner.width) * scale, corner.length * scale, corner.width * scale);

  const layerPositions = result.layerPositions;
  const orderedLayerPositions = result.orderedPositions.filter((position) => position.stackIndex === currentLayer.layer.index);
  const orderedLayerKeys = new Set(orderedLayerPositions.map(keyForPosition));
  const visiblePositionByKey = generateBoxPositions(result, visibleCount)
    .filter((position) => position.stackIndex === currentLayer.layer.index)
    .reduce((positions, position) => {
      positions.set(keyForPosition(position), position);
      return positions;
    }, new Map<string, BoxPosition>());
  const drawingPositions = [
    ...layerPositions
      .filter((position) => !orderedLayerKeys.has(keyForPosition(position)))
      .map((position) => ({ box: position, baseMarker: true })),
    ...orderedLayerPositions.map((position) => ({ box: position, baseMarker: false })),
  ];

  for (const { box, baseMarker } of drawingPositions) {
    const blocked = collidesCornerBlock(
      { ...box, z: currentLayer.layer.z || 0 },
      result.container,
      result.cornerBlock,
    );
    const visibleBox = visiblePositionByKey.get(keyForPosition(box));
    const isVisible = !baseMarker && !blocked && Boolean(visibleBox);
    const boxRgb = hexToRgb(colorForBox(visibleBox || box));

    ctx.fillStyle = isVisible
      ? `rgba(${boxRgb.r}, ${boxRgb.g}, ${boxRgb.b}, 0.82)`
      : blocked
        ? "rgba(255, 112, 102, 0.08)"
        : "rgba(255, 255, 255, 0.06)";
    ctx.strokeStyle = blocked ? "rgba(255, 112, 102, 0.55)" : "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = Math.max(0.65, Math.min(1.2, scale * 14));
    ctx.fillRect(box.x * scale, box.y * scale, box.dx * scale, box.dy * scale);
    ctx.strokeRect(box.x * scale, box.y * scale, box.dx * scale, box.dy * scale);
  }

  ctx.strokeStyle = "rgba(66, 214, 164, 0.95)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, result.pattern.occupiedLength * scale, result.pattern.occupiedWidth * scale);
  ctx.restore();

  drawOuterPlanLabels(ctx, result, boxX, boxY, scale, width, height, currentLayer);
}
