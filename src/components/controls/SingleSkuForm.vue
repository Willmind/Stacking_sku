<script setup lang="ts">
import { usePackingStore } from "../../stores/packingStore";
import BaseColorPicker from "../ui/BaseColorPicker.vue";
import BaseNumberField from "../ui/BaseNumberField.vue";
import OrientationSelector from "./OrientationSelector.vue";

const store = usePackingStore();
</script>

<template>
  <section class="field-group" aria-label="纸箱规格">
    <h2>纸箱规格</h2>
    <div class="triple-grid">
      <BaseNumberField id="carton-length" label="长 mm" v-model="store.singleCarton.length" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="carton-width" label="宽 mm" v-model="store.singleCarton.width" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="carton-height" label="高 mm" v-model="store.singleCarton.height" :min="1" @update:model-value="store.markDirty" />
    </div>
    <div class="color-field">
      <span id="carton-color-label" class="field-label">箱体颜色</span>
      <span class="color-row">
        <BaseColorPicker
          id="carton-color"
          v-model="store.singleColor"
          aria-labelledby="carton-color-label"
          show-value
          @change="store.markDirty"
        />
      </span>
    </div>
    <OrientationSelector
      class="single-orientation-selector"
      id-prefix="single-orientation"
      label="允许朝向"
      :model-value="store.singleAllowedOrientations"
      @update:model-value="store.updateSingleAllowedOrientations"
    />
  </section>
</template>

<style scoped>
.field-group {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.042), rgba(255, 255, 255, 0.022));
}

h2 {
  margin: 0;
  color: var(--accent);
  font-size: 14px;
}

.color-field {
  display: grid;
  gap: 9px;
}

.field-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.triple-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.single-orientation-selector {
  gap: 14px;
  margin-top: 2px;
}

.single-orientation-selector :deep(.orientation-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.single-orientation-selector :deep(.orientation-option) {
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 7px;
  min-height: 42px;
  padding: 8px 12px;
  font-size: 12px;
}

@media (max-width: 520px) {
  .single-orientation-selector :deep(.orientation-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
