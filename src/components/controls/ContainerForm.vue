<script setup lang="ts">
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
</script>

<template>
  <section class="field-group" aria-label="集装箱规格">
    <h2>集装箱规格</h2>
    <label>
      柜型
      <select
        id="container-type"
        :value="store.containerType"
        @change="store.setContainerType(($event.target as HTMLSelectElement).value)"
      >
        <option value="20GP">20GP</option>
        <option value="40GP">40GP</option>
        <option value="40HQ">40HQ</option>
      </select>
    </label>
    <div class="triple-grid">
      <label>
        长 mm
        <input id="container-length" v-model.number="store.container.length" type="number" min="1" step="1" @input="store.markDirty" />
      </label>
      <label>
        宽 mm
        <input id="container-width" v-model.number="store.container.width" type="number" min="1" step="1" @input="store.markDirty" />
      </label>
      <label>
        高 mm
        <input id="container-height" v-model.number="store.container.height" type="number" min="1" step="1" @input="store.markDirty" />
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

label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

input,
select {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font-weight: 800;
  padding: 0 12px;
}

.triple-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
</style>
