<script setup lang="ts">
import { ref } from "vue";
import type { LoadingStrategy } from "../../core/packing";
import { usePackingStore } from "../../stores/packingStore";
import SkuCard from "./SkuCard.vue";
import BaseSelect, { type SelectOption } from "../ui/BaseSelect.vue";

const store = usePackingStore();
const draggedIndex = ref<number | null>(null);

const strategyOptions: SelectOption[] = [
  { value: "multi-destination", label: "分客户/多卸货地", description: "按卸货顺序分段" },
  { value: "same-destination", label: "同卸货地/完整面优先", description: "优先铺满可视面" },
];

function onDragStart(index: number) {
  draggedIndex.value = index;
}

function onDrop(index: number) {
  if (draggedIndex.value === null) return;
  store.moveSku(draggedIndex.value, index);
  draggedIndex.value = null;
}

function updateStrategy(value: string) {
  store.strategy = value as LoadingStrategy;
  store.markDirty();
}
</script>

<template>
  <section class="field-group" aria-label="多 SKU 纸箱规格">
    <h2>纸箱规格</h2>
    <label>
      SKU 个数
      <span class="slider-row">
        <input id="sku-count" type="range" min="2" max="10" :value="store.skuCount" @input="store.setSkuCount(Number(($event.target as HTMLInputElement).value))" />
        <strong id="sku-count-value">{{ store.skuCount }}</strong>
      </span>
    </label>
    <BaseSelect id="sku-strategy" label="装载策略" :model-value="store.strategy" :options="strategyOptions" @update:model-value="updateStrategy" />
    <div id="sku-list" class="sku-list">
      <SkuCard
        v-for="(skuItem, index) in store.skus"
        :key="`${skuItem.label}-${index}`"
        :sku="skuItem"
        :index="index"
        @update="store.updateSku"
        @drag-start="onDragStart"
        @drop-on="onDrop"
      />
    </div>
  </section>
</template>

<style scoped>
.field-group {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.042), rgba(255, 255, 255, 0.022));
  box-shadow: var(--control-inner-shadow);
}

h2 {
  margin: 0;
  color: var(--accent);
  font-size: 14px;
}

label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

input[type="range"] {
  width: 100%;
}

.slider-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 10px;
  align-items: center;
}

#sku-count-value {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(66, 214, 164, 0.32);
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}

.sku-list {
  display: grid;
  gap: 10px;
}
</style>
