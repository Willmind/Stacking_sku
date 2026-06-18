<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { LoadingStrategy } from "../../core/packing";
import { usePackingStore } from "../../stores/packingStore";
import SkuCard from "./SkuCard.vue";
import BaseNumberField from "../ui/BaseNumberField.vue";
import BaseSelect, { type SelectOption } from "../ui/BaseSelect.vue";

const store = usePackingStore();
const draggedIndex = ref<number | null>(null);
const dropTargetIndex = ref<number | null>(null);
const dragPreview = ref<null | {
  label: string;
  target: number;
  x: number;
  y: number;
  width: number;
  offsetX: number;
  offsetY: number;
}>(null);
const skuCountMin = 2;
const skuCountMax = 5;
const skuCountProgressPercent = computed(() => {
  const range = skuCountMax - skuCountMin;
  if (range <= 0) return "0%";
  const percent = ((store.skuCount - skuCountMin) / range) * 100;
  return `${Math.min(100, Math.max(0, percent))}%`;
});

const strategyOptions: SelectOption[] = [
  { value: "multi-destination", label: "分客户/多卸货地", description: "按卸货顺序分段" },
  { value: "same-destination", label: "同卸货地/完整面优先", description: "优先铺满可视面" },
];

function getDropTargetIndex(clientX: number, clientY: number) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-sku-drop-index]"));
  const targetCard = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  });
  const index = Number(targetCard?.dataset.skuDropIndex);
  return Number.isInteger(index) ? index : null;
}

function finishDrag() {
  draggedIndex.value = null;
  dropTargetIndex.value = null;
  dragPreview.value = null;
  document.body.style.userSelect = "";
  document.body.classList.remove("sku-drag-active");
  document.removeEventListener("pointermove", onDocumentPointerMove);
  document.removeEventListener("pointerup", onDocumentPointerUp);
  document.removeEventListener("pointercancel", onDocumentPointerCancel);
  document.removeEventListener("mousemove", onDocumentMouseMove);
  document.removeEventListener("mouseup", onDocumentMouseUp);
}

function onDocumentPointerCancel() {
  finishDrag();
}

function updateDragPosition(clientX: number, clientY: number) {
  if (!dragPreview.value) return;
  dragPreview.value = {
    ...dragPreview.value,
    x: clientX - dragPreview.value.offsetX,
    y: clientY - dragPreview.value.offsetY,
  };
  dropTargetIndex.value = getDropTargetIndex(clientX, clientY);
}

function releaseDrag(clientX: number, clientY: number) {
  const sourceIndex = draggedIndex.value;
  const targetIndex = getDropTargetIndex(clientX, clientY);

  if (sourceIndex !== null && targetIndex !== null) {
    store.moveSku(sourceIndex, targetIndex);
  }
  finishDrag();
}

function onDocumentPointerMove(event: PointerEvent) {
  updateDragPosition(event.clientX, event.clientY);
}

function onDocumentMouseMove(event: MouseEvent) {
  updateDragPosition(event.clientX, event.clientY);
}

function onDocumentPointerUp(event: PointerEvent) {
  releaseDrag(event.clientX, event.clientY);
}

function onDocumentMouseUp(event: MouseEvent) {
  releaseDrag(event.clientX, event.clientY);
}

function onDragStart(index: number, event: PointerEvent) {
  const sourceCard = event.currentTarget instanceof HTMLElement
    ? event.currentTarget.closest<HTMLElement>("[data-sku-drop-index]")
    : null;
  const rect = sourceCard?.getBoundingClientRect();
  const sku = store.skus[index];
  if (!rect || !sku) return;

  draggedIndex.value = index;
  dropTargetIndex.value = index;
  dragPreview.value = {
    label: sku.label,
    target: sku.target,
    x: rect.left,
    y: rect.top,
    width: rect.width,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  document.body.style.userSelect = "none";
  document.body.classList.add("sku-drag-active");
  document.removeEventListener("pointermove", onDocumentPointerMove);
  document.removeEventListener("pointerup", onDocumentPointerUp);
  document.removeEventListener("pointercancel", onDocumentPointerCancel);
  document.removeEventListener("mousemove", onDocumentMouseMove);
  document.removeEventListener("mouseup", onDocumentMouseUp);
  document.addEventListener("pointermove", onDocumentPointerMove);
  document.addEventListener("pointerup", onDocumentPointerUp);
  document.addEventListener("pointercancel", onDocumentPointerCancel);
  document.addEventListener("mousemove", onDocumentMouseMove);
  document.addEventListener("mouseup", onDocumentMouseUp);
}

function updateStrategy(value: string) {
  store.strategy = value as LoadingStrategy;
  store.markDirty();
}

onBeforeUnmount(finishDrag);
</script>

<template>
  <section class="field-group" aria-label="多 SKU 纸箱规格">
    <h2>同尺寸多 SKU</h2>
    <div class="shared-carton-grid" aria-label="公共纸箱尺寸">
      <BaseNumberField
        id="sku-shared-length"
        label="纸箱长 mm"
        :model-value="store.multiCarton.length"
        :min="1"
        @update:model-value="store.updateMultiCarton({ length: $event })"
      />
      <BaseNumberField
        id="sku-shared-width"
        label="纸箱宽 mm"
        :model-value="store.multiCarton.width"
        :min="1"
        @update:model-value="store.updateMultiCarton({ width: $event })"
      />
      <BaseNumberField
        id="sku-shared-height"
        label="纸箱高 mm"
        :model-value="store.multiCarton.height"
        :min="1"
        @update:model-value="store.updateMultiCarton({ height: $event })"
      />
    </div>
    <label>
      SKU 个数
      <span class="slider-row">
        <span class="range-control" :style="{ '--range-progress': skuCountProgressPercent }">
          <span class="range-control__rail" aria-hidden="true">
            <span class="range-control__track">
              <span class="range-control__fill"></span>
            </span>
            <span class="range-control__thumb"></span>
          </span>
          <input
            id="sku-count"
            type="range"
            :min="skuCountMin"
            :max="skuCountMax"
            :value="store.skuCount"
            :style="{ '--range-progress': skuCountProgressPercent }"
            @input="store.setSkuCount(Number(($event.target as HTMLInputElement).value))"
          />
        </span>
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
        :is-dragging="draggedIndex === index"
        :is-drop-target="dropTargetIndex === index && draggedIndex !== index"
        @update="store.updateSku"
        @drag-start="onDragStart"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="dragPreview"
        class="sku-drag-preview"
        :style="{
          left: `${dragPreview.x}px`,
          top: `${dragPreview.y}px`,
          width: `${dragPreview.width}px`,
        }"
      >
        <div class="sku-drag-preview-header">
          <strong>{{ dragPreview.label }}</strong>
          <span>目标 {{ dragPreview.target.toLocaleString('zh-CN') }}</span>
        </div>
      </div>
    </Teleport>
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

.shared-carton-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sku-drag-preview {
  position: fixed;
  z-index: 120;
  pointer-events: none;
  transform: rotate(1deg) scale(1.02);
  border: 1px solid rgba(92, 237, 193, 0.64);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(26, 36, 49, 0.98), rgba(18, 27, 38, 0.98));
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38);
  padding: 12px;
}

.sku-drag-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sku-drag-preview strong {
  color: var(--accent);
  font-size: 13px;
  font-weight: 900;
}

.sku-drag-preview span {
  color: var(--text);
  font-size: 12px;
  font-weight: 850;
}

@media (max-width: 520px) {
  .shared-carton-grid,
  .sku-list {
    grid-template-columns: 1fr;
  }
}
</style>
