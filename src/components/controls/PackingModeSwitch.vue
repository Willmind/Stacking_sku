<script setup lang="ts">
import { usePackingStore, type PackingMode } from "../../stores/packingStore";

const store = usePackingStore();

function setMode(mode: PackingMode) {
  store.setMode(mode);
}
</script>

<template>
  <section class="field-group" aria-label="码垛模式">
    <h2>码垛模式</h2>
    <div class="segmented">
      <label>
        <input name="packing-mode" type="radio" value="single" :checked="store.mode === 'single'" @change="setMode('single')" />
        单 SKU
      </label>
      <label>
        <input name="packing-mode" type="radio" value="multi" :checked="store.mode === 'multi'" @change="setMode('multi')" />
        多 SKU
      </label>
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

.segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}
</style>
