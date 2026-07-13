import type { CartonSpec, ContainerSpec, PackingOptions, SkuInput } from "./packing";

/**
 * 这是浏览器资源保护阈值，不参与装载策略选择，也不会截断计算结果。
 * 超过阈值时直接拒绝启动任务，避免构造数量失控的坐标数组。
 */
export const MAX_ESTIMATED_PACKING_POSITIONS = 50_000;

export class PackingWorkloadLimitError extends Error {
  readonly estimatedPositions: number;

  constructor(estimatedPositions: number) {
    const estimateText = Number.isFinite(estimatedPositions)
      ? Math.max(estimatedPositions, MAX_ESTIMATED_PACKING_POSITIONS + 1).toLocaleString("zh-CN")
      : "极大数量";
    super(`预计需要生成 ${estimateText} 个箱体位置，已超过浏览器安全上限，请检查货柜和纸箱尺寸`);
    this.name = "PackingWorkloadLimitError";
    this.estimatedPositions = estimatedPositions;
  }
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function effectiveContainerVolume(container: ContainerSpec, options: PackingOptions) {
  const clearance = options.clearance ?? {};
  const length = container.length - (clearance.front ?? 0) - (clearance.rear ?? 0);
  const width = container.width - (clearance.left ?? 0) - (clearance.right ?? 0);
  const height = container.height - (clearance.top ?? 0);
  if (![length, width, height].every(isPositiveFinite)) return null;
  return length * width * height;
}

export function estimatePackingPositions(container: ContainerSpec, carton: CartonSpec, options: PackingOptions = {}) {
  const containerVolume = effectiveContainerVolume(container, options);
  const cartonVolume = carton.length * carton.width * carton.height;
  if (containerVolume === null || !isPositiveFinite(cartonVolume)) return null;
  return Math.floor(containerVolume / cartonVolume);
}

export function assertPackingWorkload(container: ContainerSpec, carton: CartonSpec, options: PackingOptions = {}) {
  const estimatedPositions = estimatePackingPositions(container, carton, options);
  if (estimatedPositions !== null && estimatedPositions > MAX_ESTIMATED_PACKING_POSITIONS) {
    throw new PackingWorkloadLimitError(estimatedPositions);
  }
}

export function assertMultiSkuPackingWorkload(container: ContainerSpec, skus: SkuInput[], options: PackingOptions = {}) {
  for (const sku of skus) {
    assertPackingWorkload(container, sku, options);
  }
}
