<script setup lang="ts">
import { GripVertical } from "@lucide/vue";
import type { CartonOrientationId, SkuInput } from "../../core/packing";
import BaseColorPicker from "../ui/BaseColorPicker.vue";
import BaseNumberField from "../ui/BaseNumberField.vue";
import OrientationSelector from "./OrientationSelector.vue";

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

function updateSkuLength(value: number) {
  emit("update", props.index, { length: value });
}

function updateSkuWidth(value: number) {
  emit("update", props.index, { width: value });
}

function updateSkuHeight(value: number) {
  emit("update", props.index, { height: value });
}

function updateSkuOrientations(value: CartonOrientationId[]) {
  emit("update", props.index, { allowedOrientations: value });
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
      <button class="drag-handle" type="button" aria-label="拖动 SKU" @pointerdown="startDrag">
        <GripVertical :size="16" :stroke-width="2.45" aria-hidden="true" />
      </button>
      <strong>SKU {{ sku.label }}</strong>
      <details class="orientation-menu">
        <summary>朝向 {{ (sku.allowedOrientations || []).length }}/6</summary>
        <div class="orientation-menu-panel">
          <OrientationSelector
            :id-prefix="`sku-${sku.label}-orientation`"
            label="允许朝向"
            compact
            :model-value="sku.allowedOrientations || []"
            @update:model-value="updateSkuOrientations"
          />
        </div>
      </details>
      <BaseColorPicker
        :id="`sku-${sku.label}-color`"
        class="card-color-field"
        :model-value="sku.color"
        :aria-label="`SKU ${sku.label} 箱体颜色`"
        @update:model-value="emit('update', props.index, { color: $event })"
      />
    </div>
    <div class="sku-fields">
      <BaseNumberField
        :id="`sku-${sku.label}-length`"
        label="长 mm"
        class="sku-number-field"
        :model-value="sku.length"
        :min="1"
        @update:model-value="updateSkuLength"
      />
      <BaseNumberField
        :id="`sku-${sku.label}-width`"
        label="宽 mm"
        class="sku-number-field"
        :model-value="sku.width"
        :min="1"
        @update:model-value="updateSkuWidth"
      />
      <BaseNumberField
        :id="`sku-${sku.label}-height`"
        label="高 mm"
        class="sku-number-field"
        :model-value="sku.height"
        :min="1"
        @update:model-value="updateSkuHeight"
      />
      <BaseNumberField
        :id="`sku-${sku.label}-target`"
        label="目标"
        class="sku-number-field"
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
  gap: 16px;
  padding: 16px;
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
  grid-template-columns: 42px minmax(0, 1fr) 78px 54px;
  gap: 12px;
  align-items: center;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  min-height: 42px;
  border: 1px solid var(--control-border);
  border-radius: 8px;
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

.sku-card-header strong {
  min-width: 0;
  color: var(--text);
  font-size: 21px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.card-color-field {
  justify-self: end;
}

.orientation-menu {
  position: relative;
  min-width: 0;
}

.orientation-menu summary {
  display: inline-flex;
  width: 78px;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  list-style: none;
  cursor: pointer;
}

.orientation-menu summary::-webkit-details-marker {
  display: none;
}

.orientation-menu[open] summary {
  border-color: rgba(66, 214, 164, 0.58);
  color: var(--accent);
  background: rgba(66, 214, 164, 0.12);
}

.orientation-menu-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  width: 294px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(18, 27, 38, 0.98);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34);
}

.sku-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.sku-number-field {
  min-width: 0;
}

.sku-number-field :deep(.base-number-control) {
  min-height: 40px;
  border-radius: 6px;
}

.sku-number-field :deep(.base-number-input) {
  min-height: 38px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 850;
  text-align: center;
}

.sku-number-field :deep(.base-number-actions) {
  width: 24px;
}

@media (max-width: 520px) {
  .sku-card {
    padding: 14px;
  }

  .sku-card-header {
    grid-template-columns: 40px minmax(0, 1fr) 74px 50px;
  }

  .drag-handle {
    width: 40px;
    min-height: 40px;
  }

  .sku-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .orientation-menu summary {
    width: 74px;
  }

  .orientation-menu-panel {
    right: -62px;
    width: min(292px, calc(100vw - 34px));
  }
}
</style>
