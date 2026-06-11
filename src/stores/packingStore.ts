import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  CONTAINERS,
  calculateMultiSkuPacking,
  calculatePacking,
  type CartonSpec,
  type ContainerSpec,
  type LoadingStrategy,
  type PackingResult,
  type SkuInput,
} from "../core/packing";

export type PackingMode = "single" | "multi";

const SKU_COLORS = ["#d8923a", "#42d6a4", "#6e8bff", "#ff7066", "#b7e35f"];
type ContainerType = keyof typeof CONTAINERS;

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

function createSku(index: number): SkuInput {
  return {
    label: String.fromCharCode(65 + index),
    length: 480,
    width: 320,
    height: 260,
    target: 100,
    color: SKU_COLORS[index % SKU_COLORS.length],
  };
}

export const usePackingStore = defineStore("packing", () => {
  const containerType = ref<ContainerType>("20GP");
  const container = ref<Required<ContainerSpec>>(cloneContainer("20GP"));
  const mode = ref<PackingMode>("single");
  const singleCarton = ref<CartonSpec>({ length: 480, width: 320, height: 260 });
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

  function relabelSkus() {
    skus.value = skus.value.map((sku, index) => ({
      ...sku,
      label: String.fromCharCode(65 + index),
    }));
  }

  function markDirty() {
    status.value = result.value ? "待重新计算" : "待计算";
  }

  function setContainerType(type: string) {
    if (!isContainerType(type)) return;
    containerType.value = type;
    container.value = cloneContainer(type);
    markDirty();
  }

  function setMode(nextMode: PackingMode) {
    mode.value = nextMode;
    markDirty();
  }

  function setSkuCount(nextCount: number) {
    const count = Math.max(2, Math.min(10, Math.round(nextCount)));
    skuCount.value = count;
    while (skus.value.length < count) {
      skus.value.push(createSku(skus.value.length));
    }
    skus.value = skus.value.slice(0, count);
    relabelSkus();
    markDirty();
  }

  function updateSku(index: number, patch: Partial<SkuInput>) {
    const current = skus.value[index];
    if (!current) return;
    skus.value[index] = { ...current, ...patch };
    relabelSkus();
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
    relabelSkus();
    markDirty();
  }

  function calculate() {
    error.value = "";
    try {
      const next =
        mode.value === "single"
          ? calculatePacking(container.value, singleCarton.value)
          : calculateMultiSkuPacking(container.value, skus.value, { strategy: strategy.value });
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
    relabelSkus,
    setContainerType,
    setMode,
    setSkuCount,
    updateSku,
  };
});
