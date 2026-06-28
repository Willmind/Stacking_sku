import { generateBoxPositions, type BoxPosition, type PackingResult } from "./packing";

export interface BoxCoordinateRow {
  sequence: number;
  loadingSequence: number;
  sku: string;
  doorFaceX: number;
  doorFaceY: number;
  doorFaceZ: number;
  topFaceX: number;
  topFaceY: number;
  topFaceZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  length: number;
  width: number;
  height: number;
  layer: number;
  row: number;
  column: number;
  orientation: string;
}

export const BOX_COORDINATE_HEADERS = [
  "序号",
  "装载顺序",
  "SKU",
  "柜门面X",
  "柜门面Y",
  "柜门面Z",
  "上表面X",
  "上表面Y",
  "上表面Z",
  "中心点X",
  "中心点Y",
  "中心点Z",
  "长",
  "宽",
  "高",
  "层",
  "排",
  "列",
  "朝向",
] as const;

function roundMm(value: number) {
  return Math.round(value * 1000) / 1000;
}

function rankBy(values: number[], direction: "asc" | "desc" = "asc") {
  const sortedValues = Array.from(new Set(values.map(roundMm))).sort((first, second) =>
    direction === "asc" ? first - second : second - first,
  );
  return new Map(sortedValues.map((value, index) => [value, index + 1]));
}

function rankOf(ranks: Map<number, number>, value: number) {
  return ranks.get(roundMm(value)) ?? 0;
}

function compareBoxesByLoadingSequence(first: BoxPosition, second: BoxPosition) {
  return (first.sequenceIndex ?? 0) - (second.sequenceIndex ?? 0);
}

function orientationLabel(box: BoxPosition) {
  return box.label || box.orientation || box.orientationId || "";
}

function createRobotXCoordinate(box: BoxPosition, containerWidth: number) {
  return roundMm(containerWidth - (box.y + box.dy / 2));
}

function createRow(
  box: BoxPosition,
  sequence: number,
  ranks: { rows: Map<number, number>; layers: Map<number, number>; columns: Map<number, number> },
  containerWidth: number,
): BoxCoordinateRow {
  const robotX = createRobotXCoordinate(box, containerWidth);
  return {
    sequence,
    loadingSequence: (box.sequenceIndex ?? sequence - 1) + 1,
    sku: box.skuLabel || "",
    doorFaceX: robotX,
    doorFaceY: roundMm(box.x + box.dx),
    doorFaceZ: roundMm(box.z + box.dz / 2),
    topFaceX: robotX,
    topFaceY: roundMm(box.x + box.dx / 2),
    topFaceZ: roundMm(box.z + box.dz),
    centerX: robotX,
    centerY: roundMm(box.x + box.dx / 2),
    centerZ: roundMm(box.z + box.dz / 2),
    length: roundMm(box.dx),
    width: roundMm(box.dy),
    height: roundMm(box.dz),
    layer: rankOf(ranks.layers, box.z),
    row: rankOf(ranks.rows, box.x),
    column: rankOf(ranks.columns, box.y),
    orientation: orientationLabel(box),
  };
}

export function createBoxCoordinateRows(result: PackingResult | null): BoxCoordinateRow[] {
  if (!result || result.totalBoxes <= 0) return [];

  const boxes = generateBoxPositions(result, result.totalBoxes) as BoxPosition[];
  const ranks = {
    rows: rankBy(boxes.map((box) => box.x)),
    layers: rankBy(boxes.map((box) => box.z)),
    columns: rankBy(boxes.map((box) => box.y), "desc"),
  };

  return boxes
    .slice()
    .sort(compareBoxesByLoadingSequence)
    .map((box, index) => createRow(box, index + 1, ranks, result.container.width));
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function rowToCsv(row: BoxCoordinateRow) {
  return [
    row.sequence,
    row.loadingSequence,
    row.sku,
    row.doorFaceX,
    row.doorFaceY,
    row.doorFaceZ,
    row.topFaceX,
    row.topFaceY,
    row.topFaceZ,
    row.centerX,
    row.centerY,
    row.centerZ,
    row.length,
    row.width,
    row.height,
    row.layer,
    row.row,
    row.column,
    row.orientation,
  ]
    .map(escapeCsvCell)
    .join(",");
}

export function createBoxCoordinateCsv(rows: BoxCoordinateRow[]) {
  return `\uFEFF${BOX_COORDINATE_HEADERS.join(",")}\n${rows.map(rowToCsv).join("\n")}`;
}
