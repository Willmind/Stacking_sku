import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  CONTAINERS,
  calculateMultiSkuPacking,
  calculatePacking,
  type BoxPosition,
  type CartonSpec,
  type ContainerClearanceSpec,
  type ContainerSpec,
  type LoadingStrategy,
  type PackingResult,
  type SkuInput,
} from "../core/packing";

export type PackingMode = "single" | "multi";

const SKU_COLORS = ["#d8923a", "#42d6a4", "#6e8bff", "#ff7066", "#b7e35f"];
const DEFAULT_CARTON: CartonSpec = { length: 480, width: 320, height: 260 };
const DEFAULT_CONTAINER_CLEARANCE = { front: 0, rear: 0, left: 0, right: 0, top: 0 };
const STACKING_SKU_CLEARANCE = "STACKING_SKU_CLEARANCE";
type ContainerType = keyof typeof CONTAINERS;
type ContainerClearanceKey = keyof typeof DEFAULT_CONTAINER_CLEARANCE;

function isContainerType(type: string): type is ContainerType {
  return Object.prototype.hasOwnProperty.call(CONTAINERS, type);
}

function cloneContainer(type: ContainerType): Required<ContainerSpec> {
  const preset = CONTAINERS[type];
  return {
    id: preset.id,
    name: preset.name,
    length: preset.length,
    width: preset.width,
    height: preset.height,
  };
}

function normalizeClearanceValue(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function normalizeContainerClearanceInput(input: Partial<ContainerClearanceSpec> = {}) {
  return {
    front: normalizeClearanceValue(input.front),
    rear: normalizeClearanceValue(input.rear),
    left: normalizeClearanceValue(input.left),
    right: normalizeClearanceValue(input.right),
    top: normalizeClearanceValue(input.top),
  };
}

function loadStoredContainerClearance() {
  if (typeof window === "undefined") return { ...DEFAULT_CONTAINER_CLEARANCE };
  try {
    const rawValue = window.localStorage.getItem(STACKING_SKU_CLEARANCE);
    if (!rawValue) return { ...DEFAULT_CONTAINER_CLEARANCE };
    return normalizeContainerClearanceInput(JSON.parse(rawValue) as Partial<ContainerClearanceSpec>);
  } catch {
    return { ...DEFAULT_CONTAINER_CLEARANCE };
  }
}

function persistContainerClearance(clearance: typeof DEFAULT_CONTAINER_CLEARANCE) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STACKING_SKU_CLEARANCE, JSON.stringify(clearance));
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }
}

function createSku(index: number, carton: CartonSpec = DEFAULT_CARTON): SkuInput {
  return {
    label: String.fromCharCode(65 + index),
    length: carton.length,
    width: carton.width,
    height: carton.height,
    target: 100,
    color: SKU_COLORS[index % SKU_COLORS.length],
  };
}

function getNextSkuIndex(skus: SkuInput[]) {
  const usedLabels = new Set(skus.map((sku) => sku.label));
  for (let index = 0; index < SKU_COLORS.length; index += 1) {
    if (!usedLabels.has(String.fromCharCode(65 + index))) return index;
  }
  return skus.length;
}

function applySingleColor(result: PackingResult, color: string): PackingResult {
  const withColor = (position: BoxPosition): BoxPosition => ({ ...position, skuColor: color });

  return {
    ...result,
    mode: "single",
    layerPositions: result.layerPositions.map(withColor),
    orderedPositions: result.orderedPositions.map(withColor),
  };
}

export const usePackingStore = defineStore("packing", () => {
  const containerType = ref<ContainerType>("20GP");
  const container = ref<Required<ContainerSpec>>(cloneContainer("20GP"));
  const mode = ref<PackingMode>("single");
  const containerClearance = ref(loadStoredContainerClearance());
  const singleCarton = ref<CartonSpec>({ ...DEFAULT_CARTON });
  const singleColor = ref("#d8923a");
  const skuCount = ref(2);
  const strategy = ref<LoadingStrategy>("multi-destination");
  const skus = ref<SkuInput[]>([createSku(0), createSku(1)]);
  const result = ref<PackingResult | null>(null);
  const visibleCount = ref(0);
  const status = ref("待计算");
  const error = ref("");

  const progressText = computed(() => {
    const total = result.value?.totalBoxes ?? 0;
    return `${visibleCount.value.toLocaleString("zh-CN")} / ${total.toLocaleString("zh-CN")}`;
  });

  const totalBoxesText = computed(() => (result.value?.totalBoxes ?? 0).toLocaleString("zh-CN"));

  function markDirty() {
    status.value = result.value ? "待重新计算" : "待计算";
  }

  function setContainerType(type: string) {
    if (!isContainerType(type)) return;
    containerType.value = type;
    container.value = cloneContainer(type);
    markDirty();
  }

  function updateContainerClearance(field: ContainerClearanceKey, value: number) {
    containerClearance.value = {
      ...containerClearance.value,
      [field]: normalizeClearanceValue(value),
    };
    persistContainerClearance(containerClearance.value);
    markDirty();
  }

  function setMode(nextMode: PackingMode) {
    mode.value = nextMode;
    markDirty();
  }

  function setSkuCount(nextCount: number) {
    const count = Math.max(2, Math.min(5, Math.round(nextCount)));
    skuCount.value = count;
    while (skus.value.length < count) {
      skus.value.push(createSku(getNextSkuIndex(skus.value)));
    }
    skus.value = skus.value.slice(0, count);
    markDirty();
  }

  function updateSku(index: number, patch: Partial<SkuInput>) {
    const current = skus.value[index];
    if (!current) return;
    skus.value[index] = { ...current, ...patch };
    markDirty();
  }

  function moveSku(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= skus.value.length) return;
    if (toIndex < 0 || toIndex >= skus.value.length) return;
    const next = skus.value.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    skus.value = next;
    markDirty();
  }

  function calculate() {
    error.value = "";
    try {
      const next: PackingResult =
        mode.value === "single"
          ? applySingleColor(
              calculatePacking(container.value, singleCarton.value, { clearance: containerClearance.value }),
              singleColor.value,
            )
          : (calculateMultiSkuPacking(container.value, skus.value, {
              strategy: strategy.value,
              clearance: containerClearance.value,
            }) as PackingResult);
      result.value = next;
      visibleCount.value = next.totalBoxes;
      status.value = next.totalBoxes > 0 ? "已完成计算" : "无法装载";
    } catch (caught) {
      result.value = null;
      visibleCount.value = 0;
      status.value = "计算失败";
      error.value = caught instanceof Error ? caught.message : "计算失败";
    }
  }

  return {
    containerType,
    container,
    containerClearance,
    mode,
    singleCarton,
    singleColor,
    skuCount,
    strategy,
    skus,
    result,
    visibleCount,
    status,
    error,
    progressText,
    totalBoxesText,
    calculate,
    markDirty,
    moveSku,
    setContainerType,
    setMode,
    setSkuCount,
    updateContainerClearance,
    updateSku,
  };
});
