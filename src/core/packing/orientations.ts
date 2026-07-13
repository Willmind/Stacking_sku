import type { CartonSpec } from "./types";

export type CartonDimensionKey = "length" | "width" | "height";
export type CartonOrientationId =
  | "length-width-height"
  | "width-length-height"
  | "length-height-width"
  | "height-length-width"
  | "width-height-length"
  | "height-width-length";

export interface CartonOrientationDefinition {
  id: CartonOrientationId;
  label: string;
  axisLabel: string;
  axes: {
    x: CartonDimensionKey;
    y: CartonDimensionKey;
    z: CartonDimensionKey;
  };
}

export interface CartonOrientation extends CartonOrientationDefinition {
  x: number;
  y: number;
  z: number;
}

export const CARTON_ORIENTATION_OPTIONS: CartonOrientationDefinition[] = [
  {
    id: "length-width-height",
    label: "长×宽×高",
    axisLabel: "柜长=长，柜宽=宽，柜高=高",
    axes: { x: "length", y: "width", z: "height" },
  },
  {
    id: "width-length-height",
    label: "宽×长×高",
    axisLabel: "柜长=宽，柜宽=长，柜高=高",
    axes: { x: "width", y: "length", z: "height" },
  },
  {
    id: "length-height-width",
    label: "长×高×宽",
    axisLabel: "柜长=长，柜宽=高，柜高=宽",
    axes: { x: "length", y: "height", z: "width" },
  },
  {
    id: "height-length-width",
    label: "高×长×宽",
    axisLabel: "柜长=高，柜宽=长，柜高=宽",
    axes: { x: "height", y: "length", z: "width" },
  },
  {
    id: "width-height-length",
    label: "宽×高×长",
    axisLabel: "柜长=宽，柜宽=高，柜高=长",
    axes: { x: "width", y: "height", z: "length" },
  },
  {
    id: "height-width-length",
    label: "高×宽×长",
    axisLabel: "柜长=高，柜宽=宽，柜高=长",
    axes: { x: "height", y: "width", z: "length" },
  },
];

export const DEFAULT_ALLOWED_ORIENTATION_IDS: CartonOrientationId[] = ["length-width-height", "width-length-height"];

const ORIENTATION_DEFINITION_BY_ID = new Map(CARTON_ORIENTATION_OPTIONS.map((orientation) => [orientation.id, orientation]));

export function isCartonOrientationId(value: unknown): value is CartonOrientationId {
  return typeof value === "string" && ORIENTATION_DEFINITION_BY_ID.has(value as CartonOrientationId);
}

export function normalizeAllowedOrientations(input?: readonly unknown[] | null): CartonOrientationId[] {
  if (input == null) return [...DEFAULT_ALLOWED_ORIENTATION_IDS];
  if (!Array.isArray(input)) {
    throw new Error("纸箱朝向必须为数组");
  }
  if (input.length === 0) {
    throw new Error("至少选择一种纸箱朝向");
  }

  const ids: CartonOrientationId[] = [];
  for (const value of input) {
    if (!isCartonOrientationId(value)) {
      throw new Error(`纸箱朝向不支持：${String(value)}`);
    }
    if (!ids.includes(value)) ids.push(value);
  }

  if (ids.length === 0) {
    throw new Error("至少选择一种纸箱朝向");
  }

  return ids;
}

export function getOrientations(carton: CartonSpec, allowedOrientations?: readonly unknown[] | null): CartonOrientation[] {
  const allowedIds = normalizeAllowedOrientations(allowedOrientations);
  return allowedIds.map((id) => {
    const definition = ORIENTATION_DEFINITION_BY_ID.get(id)!;
    return {
      ...definition,
      x: carton[definition.axes.x],
      y: carton[definition.axes.y],
      z: carton[definition.axes.z],
    };
  });
}
