import { CONTAINERS, POSITIVE_NUMBER_LABELS, type ContainerType } from "./constants";
import { normalizeAllowedOrientations } from "./orientations";
import type { CartonSpec, ContainerClearanceSpec, ContainerSpec, NormalizedContainerClearance, SkuInput } from "./types";

type PositiveNumberLabel = keyof typeof POSITIVE_NUMBER_LABELS;

function formatInputName(name: string) {
  const skuFieldMatch = name.match(/^(.*) (target quantity|carton length|carton width|carton height)$/);
  if (skuFieldMatch) {
    const [, label, key] = skuFieldMatch;
    return `${label} ${POSITIVE_NUMBER_LABELS[key as PositiveNumberLabel] || key}`;
  }
  return POSITIVE_NUMBER_LABELS[name as PositiveNumberLabel] || name;
}

export function positiveNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${formatInputName(name)}必须为正数`);
  }
  return number;
}

export function nonNegativeNumber(value: unknown, name: string): number {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${formatInputName(name)}必须为非负数`);
  }
  return number;
}

export function normalizeContainer(input: ContainerType | ContainerSpec): Required<ContainerSpec> {
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

export function normalizeCarton(input: CartonSpec): CartonSpec {
  return {
    length: positiveNumber(input.length, "carton length"),
    width: positiveNumber(input.width, "carton width"),
    height: positiveNumber(input.height, "carton height"),
  };
}

export function normalizeContainerClearance(input: ContainerClearanceSpec = {}): NormalizedContainerClearance {
  return {
    front: nonNegativeNumber(input.front, "front clearance"),
    rear: nonNegativeNumber(input.rear, "rear clearance"),
    left: nonNegativeNumber(input.left, "left clearance"),
    right: nonNegativeNumber(input.right, "right clearance"),
    top: nonNegativeNumber(input.top, "top clearance"),
  };
}

export function createEffectiveContainer(
  container: Required<ContainerSpec>,
  clearance: NormalizedContainerClearance,
): Required<ContainerSpec> {
  return {
    id: container.id,
    name: `${container.name} 有效装载空间`,
    length: positiveNumber(container.length - clearance.front - clearance.rear, "effective container length"),
    width: positiveNumber(container.width - clearance.left - clearance.right, "effective container width"),
    height: positiveNumber(container.height - clearance.top, "effective container height"),
  };
}

function normalizeSku(input: unknown, index: number): SkuInput {
  if (!input || typeof input !== "object") {
    throw new Error("SKU 条目必须为对象");
  }

  const source = input as Partial<SkuInput>;
  const label = source.label || String.fromCharCode(65 + index);
  const target = positiveNumber(source.target, `${label} target quantity`);
  if (!Number.isInteger(target)) {
    throw new Error(`${label} 目标数量必须为整数`);
  }

  const allowedOrientations =
    source.allowedOrientations === undefined ? undefined : normalizeAllowedOrientations(source.allowedOrientations);

  return {
    label,
    length: positiveNumber(source.length, `${label} carton length`),
    width: positiveNumber(source.width, `${label} carton width`),
    height: positiveNumber(source.height, `${label} carton height`),
    target,
    color: source.color || "#d8923a",
    ...(allowedOrientations ? { allowedOrientations } : {}),
  };
}

export function normalizeSkus(inputs: unknown): SkuInput[] {
  if (!Array.isArray(inputs) || inputs.length < 2 || inputs.length > 5) {
    throw new Error("多 SKU 模式只支持 2 到 5 个 SKU");
  }

  const skus = inputs.map(normalizeSku);
  const labels = new Set<string>();
  for (const sku of skus) {
    if (labels.has(sku.label)) {
      throw new Error(`SKU 名称 "${sku.label}" 不能重复`);
    }
    labels.add(sku.label);
  }
  return skus;
}

export function hasSameSkuDimensions(skus: SkuInput[]): boolean {
  const [firstSku] = skus;
  return skus.every((sku) => sku.length === firstSku.length && sku.width === firstSku.width && sku.height === firstSku.height);
}
