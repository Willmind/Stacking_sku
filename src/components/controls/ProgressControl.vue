<script setup lang="ts">
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
</script>

<template>
  <label class="progress-control">
    码垛进度
    <input
      id="stack-progress"
      v-model.number="store.visibleCount"
      type="range"
      min="0"
      :max="store.result?.totalBoxes ?? 0"
      step="1"
    />
  </label>
</template>

<style scoped>
.progress-control {
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr);
  gap: 12px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

input {
  accent-color: var(--accent);
}
</style>
