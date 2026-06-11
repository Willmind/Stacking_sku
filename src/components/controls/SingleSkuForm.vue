<script setup lang="ts">
import { computed } from "vue";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
const colorText = computed(() => store.singleColor.toUpperCase());
</script>

<template>
  <section class="field-group" aria-label="纸箱规格">
    <h2>纸箱规格</h2>
    <div class="triple-grid">
      <label>
        长 mm
        <input id="carton-length" v-model.number="store.singleCarton.length" type="number" min="1" step="1" @input="store.markDirty" />
      </label>
      <label>
        宽 mm
        <input id="carton-width" v-model.number="store.singleCarton.width" type="number" min="1" step="1" @input="store.markDirty" />
      </label>
      <label>
        高 mm
        <input id="carton-height" v-model.number="store.singleCarton.height" type="number" min="1" step="1" @input="store.markDirty" />
      </label>
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

input {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font-weight: 800;
  padding: 0 12px;
}

input[type="color"] {
  width: 48px;
  padding: 4px;
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
