import {
  CONTAINERS,
  calculatePacking,
  type CartonSpec,
  type ContainerSpec,
  type PackingResult,
} from "./packing";

export const BATCH_SIZE_COLUMN = "尺寸（长宽高 mm）";
export const BATCH_CONTAINER_COLUMN = "柜型";
export const BATCH_MANUAL_COLUMN = "人工码垛数量（原始）";

const CONTAINER_TYPES = ["20GP", "40GP", "40HQ"] as const;

export type BatchContainerType = (typeof CONTAINER_TYPES)[number];
export type BatchImportStatus = "成功" | "解析失败" | "计算失败" | "无法装载";

export interface BatchPackingRow {
  [key: string]: unknown;
}

export interface BatchPackingItem {
  rowNumber: number;
  sizeText: string;
  containerType: BatchContainerType | "";
  manualCount: number | null;
  difference: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  totalBoxes: number | null;
  status: BatchImportStatus;
  error?: string;
}

function readCell(row: BatchPackingRow, columnName: string) {
  const entry = Object.entries(row).find(([key]) => key.trim() === columnName);
  return entry?.[1];
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function parseDimension(value: unknown): CartonSpec {
  if (isBlank(value)) {
    throw new Error(`尺寸不能为空，请填写 ${BATCH_SIZE_COLUMN}`);
  }

  const parts = String(value)
    .trim()
    .split(/[xX*×]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 3) {
    throw new Error("尺寸格式应为 长*宽*高，例如 465*360*291");
  }

  const [length, width, height] = parts.map(Number);
  if ([length, width, height].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("尺寸必须为正数，单位默认为 mm");
  }

  return { length, width, height };
}

function parseContainerType(value: unknown): BatchContainerType {
  if (isBlank(value)) {
    throw new Error(`柜型不能为空，请填写 ${BATCH_CONTAINER_COLUMN}`);
  }

  const containerType = String(value).trim().toUpperCase();
  if (!CONTAINER_TYPES.includes(containerType as BatchContainerType)) {
    throw new Error("柜型只支持 20GP、40GP、40HQ");
  }

  return containerType as BatchContainerType;
}

function parseManualCount(value: unknown): number {
  if (isBlank(value)) {
    throw new Error(`人工码垛数量不能为空，请填写 ${BATCH_MANUAL_COLUMN}`);
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("人工码垛数量必须为数字");
  }

  return number;
}

function formatSize({ length, width, height }: CartonSpec) {
  return `${length}*${width}*${height}`;
}

function createFailedItem(rowNumber: number, row: BatchPackingRow, error: string): BatchPackingItem {
  return {
    rowNumber,
    sizeText: String(readCell(row, BATCH_SIZE_COLUMN) ?? "").trim(),
    containerType: "",
    manualCount: null,
    difference: null,
    length: null,
    width: null,
    height: null,
    totalBoxes: null,
    status: "解析失败",
    error,
  };
}

function createSuccessItem(
  rowNumber: number,
  carton: CartonSpec,
  containerType: BatchContainerType,
  manualCount: number,
  result: PackingResult,
): BatchPackingItem {
  const totalBoxes = result.totalBoxes;
  return {
    rowNumber,
    sizeText: formatSize(carton),
    containerType,
    manualCount,
    difference: totalBoxes - manualCount,
    length: carton.length,
    width: carton.width,
    height: carton.height,
    totalBoxes,
    status: totalBoxes > 0 ? "成功" : "无法装载",
  };
}

export function calculateBatchPacking(rows: BatchPackingRow[]): BatchPackingItem[] {
  return rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const manualValue = readCell(row, BATCH_MANUAL_COLUMN);
    const sizeValue = readCell(row, BATCH_SIZE_COLUMN);
    const containerValue = readCell(row, BATCH_CONTAINER_COLUMN);

    if (isBlank(manualValue) && isBlank(sizeValue) && isBlank(containerValue)) {
      return [];
    }

    try {
      const carton = parseDimension(sizeValue);
      const containerType = parseContainerType(containerValue);
      const manualCount = parseManualCount(manualValue);
      const container = CONTAINERS[containerType] as Required<ContainerSpec>;
      const result = calculatePacking(container, carton) as PackingResult;
      return [createSuccessItem(rowNumber, carton, containerType, manualCount, result)];
    } catch (caught) {
      return [createFailedItem(rowNumber, row, caught instanceof Error ? caught.message : "解析失败")];
    }
  });
}
