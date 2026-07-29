import { CARTON_ORIENTATION_OPTIONS, generateBoxPositions, type BoxPosition, type PackingResult } from "./packing";
import type { CartonDimensionKey } from "./packing/orientations";

export interface BoxCoordinateRow {
  totalId: number;
  sku: string;
  length: number;
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  a: number;
  b: number;
  c: number;
  layer: number;
  row: number;
  rowSequence: number;
  orientation: string;
}

export const BOX_COORDINATE_HEADERS = [
  "总ID",
  "SKU",
  "长",
  "宽",
  "高",
  "X",
  "Y",
  "Z",
  "A",
  "B",
  "C",
  "所属层",
  "所属排",
  "排内ID",
  "朝向",
] as const;

type InternalAxisKey = "x" | "y" | "z";
type Vector3 = readonly [number, number, number];

const ORIENTATION_DEFINITION_BY_ID: ReadonlyMap<string, (typeof CARTON_ORIENTATION_OPTIONS)[number]> = new Map(
  CARTON_ORIENTATION_OPTIONS.map((orientation) => [orientation.id, orientation]),
);
const INTERNAL_AXIS_TO_ROBOT_VECTOR: Record<InternalAxisKey, Vector3> = {
  x: [-1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

function roundMm(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundDegrees(value: number) {
  const rounded = Math.round((value * 180 * 1000) / Math.PI) / 1000;
  if (rounded === -180) return 180;
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

function findInternalAxis(axes: Record<InternalAxisKey, CartonDimensionKey>, dimension: CartonDimensionKey): InternalAxisKey | null {
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
      a: roundDegrees(Math.atan2(-m23, m33)),
      b: roundDegrees(y),
      c: roundDegrees(Math.atan2(-m12, m11)),
    };
  }

  return {
    a: roundDegrees(Math.atan2(m32, m22)),
    b: roundDegrees(y),
    c: 0,
  };
}

function createEulerAngles(box: BoxPosition) {
  const orientationDefinition = ORIENTATION_DEFINITION_BY_ID.get(box.orientationId ?? "");
  if (!orientationDefinition) return { a: 0, b: 0, c: 0 };

  const lengthAxis = findInternalAxis(orientationDefinition.axes, "length");
  const widthAxis = findInternalAxis(orientationDefinition.axes, "width");
  const heightAxis = findInternalAxis(orientationDefinition.axes, "height");
  if (!lengthAxis || !widthAxis || !heightAxis) return { a: 0, b: 0, c: 0 };

  const localX = INTERNAL_AXIS_TO_ROBOT_VECTOR[lengthAxis];
  let localY = INTERNAL_AXIS_TO_ROBOT_VECTOR[widthAxis];
  const heightVector = INTERNAL_AXIS_TO_ROBOT_VECTOR[heightAxis];

  if (dot(cross(localX, localY), heightVector) < 0) {
    localY = negate(localY);
  }

  return matrixToEulerXYZ(localX, localY, cross(localX, localY));
}

function createCartonDimensions(box: BoxPosition) {
  const orientationDefinition = ORIENTATION_DEFINITION_BY_ID.get(box.orientationId ?? "");
  if (!orientationDefinition) {
    return {
      length: roundMm(box.dx),
      width: roundMm(box.dy),
      height: roundMm(box.dz),
    };
  }

  const dimensions: Record<CartonDimensionKey, number> = {
    length: 0,
    width: 0,
    height: 0,
  };
  dimensions[orientationDefinition.axes.x] = box.dx;
  dimensions[orientationDefinition.axes.y] = box.dy;
  dimensions[orientationDefinition.axes.z] = box.dz;

  return {
    length: roundMm(dimensions.length),
    width: roundMm(dimensions.width),
    height: roundMm(dimensions.height),
  };
}

function createRow(
  box: BoxPosition,
  fallbackTotalId: number,
  ranks: { rows: Map<number, number>; layers: Map<number, number> },
  containerWidth: number,
  rowSequence: number,
): BoxCoordinateRow {
  const eulerAngles = createEulerAngles(box);
  const layer = rankOf(ranks.layers, box.z);
  const cartonDimensions = createCartonDimensions(box);
  return {
    totalId: (box.sequenceIndex ?? fallbackTotalId - 1) + 1,
    sku: box.skuLabel || "",
    ...cartonDimensions,
    x: roundMm(-box.x),
    y: roundMm(box.y + box.dy - containerWidth),
    z: roundMm(box.z),
    ...eulerAngles,
    layer: (box.stackIndex ?? layer - 1) + 1,
    row: rankOf(ranks.rows, box.x),
    rowSequence,
    orientation: orientationLabel(box),
  };
}

export function createBoxCoordinateRows(result: PackingResult | null): BoxCoordinateRow[] {
  if (!result || result.totalBoxes <= 0) return [];

  const boxes = generateBoxPositions(result, result.totalBoxes) as BoxPosition[];
  const ranks = {
    rows: rankBy(boxes.map((box) => box.x)),
    layers: rankBy(boxes.map((box) => box.z)),
  };
  const rowSequenceCounts = new Map<number, number>();

  return boxes
    .slice()
    .sort(compareBoxesByLoadingSequence)
    .map((box, index) => {
      const row = rankOf(ranks.rows, box.x);
      const rowSequence = (rowSequenceCounts.get(row) ?? 0) + 1;
      rowSequenceCounts.set(row, rowSequence);
      return createRow(box, index + 1, ranks, result.container.width, rowSequence);
    });
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function rowToCsv(row: BoxCoordinateRow) {
  return [
    row.totalId,
    row.sku,
    row.length,
    row.width,
    row.height,
    row.x,
    row.y,
    row.z,
    row.a,
    row.b,
    row.c,
    row.layer,
    row.row,
    row.rowSequence,
    row.orientation,
  ]
    .map(escapeCsvCell)
    .join(",");
}

export function createBoxCoordinateCsv(rows: BoxCoordinateRow[]) {
  return `\uFEFF${BOX_COORDINATE_HEADERS.join(",")}\n${rows.map(rowToCsv).join("\n")}`;
}
