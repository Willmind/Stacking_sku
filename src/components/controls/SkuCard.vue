<script setup lang="ts">
import type { SkuInput } from "../../core/packing";

const props = defineProps<{
  sku: SkuInput;
  index: number;
}>();

const emit = defineEmits<{
  update: [index: number, patch: Partial<SkuInput>];
  dragStart: [index: number];
  dropOn: [index: number];
}>();

function numberValue(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}
</script>

<template>
  <article
    class="sku-card"
    draggable="true"
    @dragstart="emit('dragStart', props.index)"
    @dragover.prevent
    @drop="emit('dropOn', props.index)"
  >
    <div class="sku-card-header">
      <button class="drag-handle" type="button" aria-label="拖动 SKU">☰</button>
      <strong>SKU {{ sku.label }}</strong>
      <input class="sku-color" type="color" :value="sku.color" @input="emit('update', index, { color: ($event.target as HTMLInputElement).value })" />
    </div>
    <div class="sku-fields">
      <label>长 mm<input class="sku-length" type="number" min="1" step="1" :value="sku.length" @input="emit('update', index, { length: numberValue($event) })" /></label>
      <label>宽 mm<input class="sku-width" type="number" min="1" step="1" :value="sku.width" @input="emit('update', index, { width: numberValue($event) })" /></label>
      <label>高 mm<input class="sku-height" type="number" min="1" step="1" :value="sku.height" @input="emit('update', index, { height: numberValue($event) })" /></label>
      <label>目标<input class="sku-target" type="number" min="1" step="1" :value="sku.target" @input="emit('update', index, { target: numberValue($event) })" /></label>
    </div>
  </article>
</template>

<style scoped>
.sku-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.sku-card-header {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
}

.drag-handle {
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font-weight: 900;
}

.sku-color {
  width: 48px;
  height: 36px;
  padding: 4px;
}

.sku-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

input {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font-weight: 800;
  padding: 0 10px;
}
</style>
