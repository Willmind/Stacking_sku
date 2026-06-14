<script setup lang="ts">
import { Boxes, Package } from "@lucide/vue";
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
      <label :class="{ active: store.mode === 'single' }">
        <input name="packing-mode" type="radio" value="single" :checked="store.mode === 'single'" @change="setMode('single')" />
        <Package :size="15" :stroke-width="2.35" aria-hidden="true" />
        单 SKU
      </label>
      <label :class="{ active: store.mode === 'multi' }">
        <input name="packing-mode" type="radio" value="multi" :checked="store.mode === 'multi'" @change="setMode('multi')" />
        <Boxes :size="15" :stroke-width="2.35" aria-hidden="true" />
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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.042), rgba(255, 255, 255, 0.022));
  box-shadow: var(--control-inner-shadow);
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  box-shadow: var(--control-inner-shadow);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 110ms ease;
}

label:hover {
  border-color: var(--control-border-hover);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
  color: var(--text);
}

label:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring), var(--control-inner-shadow);
}

label:active {
  transform: translateY(1px);
}

label.active {
  border-color: rgba(66, 214, 164, 0.45);
  background: linear-gradient(180deg, rgba(66, 214, 164, 0.18), rgba(66, 214, 164, 0.07));
  color: var(--accent);
}

input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
