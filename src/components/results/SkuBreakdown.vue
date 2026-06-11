<script setup lang="ts">
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
</script>

<template>
  <section v-if="store.mode === 'multi' && store.result?.skuSummary" id="sku-breakdown" class="sku-breakdown" aria-label="SKU 装载结果">
    <div v-for="summary in store.result.skuSummary" :key="summary.label" class="sku-breakdown-row">
      <span class="sku-swatch" :style="{ background: summary.color }"></span>
      <strong>SKU {{ summary.label }}</strong>
      <span>
        {{ summary.loaded.toLocaleString("zh-CN") }} / {{ summary.target.toLocaleString("zh-CN") }}
        <template v-if="summary.shortfall"> · 差 {{ summary.shortfall.toLocaleString("zh-CN") }}</template>
      </span>
    </div>
  </section>
</template>

<style scoped>
.sku-breakdown {
  display: grid;
  gap: 8px;
}

.sku-breakdown-row {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.sku-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
}

span {
  color: var(--text);
  font-weight: 800;
}
</style>
