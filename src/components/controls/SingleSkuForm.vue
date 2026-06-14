<script setup lang="ts">
import { computed } from "vue";
import { usePackingStore } from "../../stores/packingStore";
import BaseNumberField from "../ui/BaseNumberField.vue";

const store = usePackingStore();
const colorText = computed(() => store.singleColor.toUpperCase());
</script>

<template>
  <section class="field-group" aria-label="纸箱规格">
    <h2>纸箱规格</h2>
    <div class="triple-grid">
      <BaseNumberField id="carton-length" label="长 mm" v-model="store.singleCarton.length" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="carton-width" label="宽 mm" v-model="store.singleCarton.width" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="carton-height" label="高 mm" v-model="store.singleCarton.height" :min="1" @update:model-value="store.markDirty" />
    </div>
    <label>
      箱体颜色
      <span class="color-row">
        <input id="carton-color" v-model="store.singleColor" type="color" @input="store.markDirty" />
        <strong>{{ colorText }}</strong>
      </span>
    </label>
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

input[type="color"] {
  width: 48px;
  min-height: 40px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  padding: 4px;
  box-shadow: var(--control-inner-shadow);
  cursor: pointer;
}

.triple-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
