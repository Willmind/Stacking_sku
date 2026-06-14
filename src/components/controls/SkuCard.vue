<script setup lang="ts">
import { GripVertical } from "@lucide/vue";
import type { SkuInput } from "../../core/packing";
import BaseNumberField from "../ui/BaseNumberField.vue";

const props = defineProps<{
  sku: SkuInput;
  index: number;
}>();

const emit = defineEmits<{
  update: [index: number, patch: Partial<SkuInput>];
  dragStart: [index: number];
  dropOn: [index: number];
}>();

function updateSkuNumber(key: "length" | "width" | "height" | "target", value: number) {
  emit("update", props.index, { [key]: value });
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
      <button class="drag-handle" type="button" aria-label="拖动 SKU">
        <GripVertical :size="16" :stroke-width="2.35" aria-hidden="true" />
      </button>
      <strong>SKU {{ sku.label }}</strong>
      <input class="carton-color" type="color" :value="sku.color" @input="emit('update', index, { color: ($event.target as HTMLInputElement).value })" />
    </div>
    <div class="sku-fields">
      <BaseNumberField :id="`sku-${sku.label}-length`" label="长 mm" class="sku-length" :model-value="sku.length" :min="1" @update:model-value="updateSkuNumber('length', $event)" />
      <BaseNumberField :id="`sku-${sku.label}-width`" label="宽 mm" class="sku-width" :model-value="sku.width" :min="1" @update:model-value="updateSkuNumber('width', $event)" />
      <BaseNumberField :id="`sku-${sku.label}-height`" label="高 mm" class="sku-height" :model-value="sku.height" :min="1" @update:model-value="updateSkuNumber('height', $event)" />
      <BaseNumberField :id="`sku-${sku.label}-target`" label="目标" class="sku-target" :model-value="sku.target" :min="1" @update:model-value="updateSkuNumber('target', $event)" />
    </div>
  </article>
</template>

<style scoped>
.sku-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.048), rgba(255, 255, 255, 0.022));
  /* box-shadow: var(--control-inner-shadow); */
}

.sku-card-header {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--muted);
  font-weight: 900;
  /* box-shadow: var(--control-inner-shadow); */
}

.drag-handle:hover {
  border-color: var(--control-border-hover);
  color: var(--text);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
}

.carton-color {
  width: 48px;
  min-height: 40px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  padding: 4px;
  cursor: pointer;
}

.sku-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

</style>
