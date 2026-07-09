import {
  CARTON_ORIENTATION_OPTIONS,
  generateBoxPositions,
  type BoxPosition,
  type PackingResult,
} from "./packing";
import type { CartonDimensionKey } from "./packing/orientations";

export interface BoxCoordinateRow {
  sequence: number;
  loadingSequence: number;
  sku: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  eulerX: number;
  eulerY: number;
  eulerZ: number;
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
  "中心点X",
  "中心点Y",
  "中心点Z",
  "欧拉角X",
  "欧拉角Y",
  "欧拉角Z",
  "长",
  "宽",
  "高",
  "层",
  "排",
  "列",
  "朝向",
] as const;

type InternalAxisKey = "x" | "y" | "z";
type Vector3 = readonly [number, number, number];

const ORIENTATION_DEFINITION_BY_ID: ReadonlyMap<string, (typeof CARTON_ORIENTATION_OPTIONS)[number]> = new Map(
  CARTON_ORIENTATION_OPTIONS.map((orientation) => [orientation.id, orientation]),
);
const INTERNAL_AXIS_TO_ROBOT_VECTOR: Record<InternalAxisKey, Vector3> = {
  x: [0, 1, 0],
  y: [1, 0, 0],
  z: [0, 0, 1],
};

function roundMm(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundDegrees(value: number) {
  const rounded = Math.round((value * 180 * 1000) / Math.PI) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
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

function findInternalAxis(
  axes: Record<InternalAxisKey, CartonDimensionKey>,
  dimension: CartonDimensionKey,
): InternalAxisKey | null {
  for (const axis of ["x", "y", "z"] as const) {
    if (axes[axis] === dimension) return axis;
  }
  return null;
}

function cross(first: Vector3, second: Vector3): Vector3 {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

function dot(first: Vector3, second: Vector3) {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function negate(vector: Vector3): Vector3 {
  return [-vector[0], -vector[1], -vector[2]];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function matrixToEulerXYZ(localX: Vector3, localY: Vector3, localZ: Vector3) {
  const m11 = localX[0];
  const m12 = localY[0];
  const m13 = localZ[0];
  const m22 = localY[1];
  const m23 = localZ[1];
  const m32 = localY[2];
  const m33 = localZ[2];

  const y = Math.asin(clamp(m13, -1, 1));
  if (Math.abs(m13) < 0.9999999) {
    return {
      eulerX: roundDegrees(Math.atan2(-m23, m33)),
      eulerY: roundDegrees(y),
      eulerZ: roundDegrees(Math.atan2(-m12, m11)),
    };
  }

  return {
    eulerX: roundDegrees(Math.atan2(m32, m22)),
    eulerY: roundDegrees(y),
    eulerZ: 0,
  };
}

function createEulerAngles(box: BoxPosition) {
  const orientationDefinition = ORIENTATION_DEFINITION_BY_ID.get(box.orientationId ?? "");
  if (!orientationDefinition) return { eulerX: 0, eulerY: 0, eulerZ: 0 };

  const lengthAxis = findInternalAxis(orientationDefinition.axes, "length");
  const widthAxis = findInternalAxis(orientationDefinition.axes, "width");
  const heightAxis = findInternalAxis(orientationDefinition.axes, "height");
  if (!lengthAxis || !widthAxis || !heightAxis) return { eulerX: 0, eulerY: 0, eulerZ: 0 };

  const localX = INTERNAL_AXIS_TO_ROBOT_VECTOR[lengthAxis];
  let localY = INTERNAL_AXIS_TO_ROBOT_VECTOR[widthAxis];
  const heightVector = INTERNAL_AXIS_TO_ROBOT_VECTOR[heightAxis];

  if (dot(cross(localX, localY), heightVector) < 0) {
    localY = negate(localY);
  }

  return matrixToEulerXYZ(localX, localY, cross(localX, localY));
}

function createRow(
  box: BoxPosition,
  sequence: number,
  ranks: { rows: Map<number, number>; layers: Map<number, number>; columns: Map<number, number> },
  containerWidth: number,
): BoxCoordinateRow {
  const robotX = createRobotXCoordinate(box, containerWidth);
  const eulerAngles = createEulerAngles(box);
  return {
    sequence,
    loadingSequence: (box.sequenceIndex ?? sequence - 1) + 1,
    sku: box.skuLabel || "",
    centerX: robotX,
    centerY: roundMm(box.x + box.dx / 2),
    centerZ: roundMm(box.z + box.dz / 2),
    ...eulerAngles,
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
    row.centerX,
    row.centerY,
    row.centerZ,
    row.eulerX,
    row.eulerY,
    row.eulerZ,
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
