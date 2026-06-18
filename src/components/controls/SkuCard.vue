<script setup lang="ts">
import { GripVertical } from "@lucide/vue";
import type { SkuInput } from "../../core/packing";
import BaseColorPicker from "../ui/BaseColorPicker.vue";
import BaseNumberField from "../ui/BaseNumberField.vue";

const props = defineProps<{
  sku: SkuInput;
  index: number;
  isDragging?: boolean;
  isDropTarget?: boolean;
}>();

const emit = defineEmits<{
  update: [index: number, patch: Partial<SkuInput>];
  dragStart: [index: number, event: PointerEvent];
}>();

function updateSkuTarget(value: number) {
  emit("update", props.index, { target: value });
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  emit("dragStart", props.index, event);
}
</script>

<template>
  <article
    class="sku-card"
    :class="{ 'sku-card--dragging': props.isDragging, 'sku-card--drop-target': props.isDropTarget }"
    :data-sku-drop-index="props.index"
  >
    <div class="sku-card-header">
      <button
        class="drag-handle"
        type="button"
        aria-label="拖动 SKU"
        @pointerdown="startDrag"
      >
        <GripVertical :size="16" :stroke-width="2.35" aria-hidden="true" />
      </button>
      <strong>{{ sku.label }}</strong>
      <BaseColorPicker
        :id="`sku-${sku.label}-color`"
        :model-value="sku.color"
        :aria-label="`SKU ${sku.label} 箱体颜色`"
        compact
        @update:model-value="emit('update', props.index, { color: $event })"
      />
    </div>
    <div class="sku-fields">
      <BaseNumberField
        :id="`sku-${sku.label}-target`"
        label="目标数量"
        class="sku-target"
        :model-value="sku.target"
        :min="1"
        @update:model-value="updateSkuTarget"
      />
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
}

.sku-card--dragging {
  border-color: rgba(66, 214, 164, 0.58);
  opacity: 0.42;
}

.sku-card--drop-target {
  border-color: rgba(92, 237, 193, 0.78);
  background: rgba(66, 214, 164, 0.1);
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
  cursor: grab;
  font-weight: 900;
}

.drag-handle:hover {
  border-color: var(--control-border-hover);
  color: var(--text);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
}

.drag-handle:active {
  cursor: grabbing;
}

.sku-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

</style>
