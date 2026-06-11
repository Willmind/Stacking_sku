<script setup lang="ts">
import { ref } from "vue";
import { usePackingStore } from "../../stores/packingStore";
import SkuCard from "./SkuCard.vue";

const store = usePackingStore();
const draggedIndex = ref<number | null>(null);

function onDragStart(index: number) {
  draggedIndex.value = index;
}

function onDrop(index: number) {
  if (draggedIndex.value === null) return;
  store.moveSku(draggedIndex.value, index);
  draggedIndex.value = null;
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
    <label>
      装载策略
      <select id="sku-strategy" v-model="store.strategy" @change="store.markDirty">
        <option value="multi-destination">分客户/多卸货地</option>
        <option value="same-destination">同卸货地/完整面优先</option>
      </select>
    </label>
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
  background: rgba(255, 255, 255, 0.035);
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

select,
input[type="range"] {
  width: 100%;
}

select {
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font-weight: 800;
  padding: 0 12px;
}

.slider-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  gap: 10px;
  align-items: center;
}

.sku-list {
  display: grid;
  gap: 10px;
}
</style>
