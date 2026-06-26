<script setup lang="ts">
import { computed } from "vue";
import { usePackingStore } from "../../stores/packingStore";

withDefaults(
  defineProps<{
    controlId?: string;
  }>(),
  {
    controlId: "stack-progress",
  },
);

const store = usePackingStore();

const progressPercent = computed(() => {
  const total = store.result?.totalBoxes ?? 0;
  if (total <= 0) return "0%";
  const percent = Math.min(100, Math.max(0, (store.visibleCount / total) * 100));
  return `${percent}%`;
});
</script>

<template>
  <label class="progress-control">
    码垛进度
    <span class="range-control" :style="{ '--range-progress': progressPercent }">
      <span class="range-control__rail" aria-hidden="true">
        <span class="range-control__track">
          <span class="range-control__fill"></span>
        </span>
        <span class="range-control__thumb"></span>
      </span>
      <input
        :key="store.result?.totalBoxes ?? 0"
        :id="controlId"
        :max="store.result?.totalBoxes ?? 0"
        v-model.number="store.visibleCount"
        type="range"
        min="0"
        step="1"
        :style="{ '--range-progress': progressPercent }"
      />
    </span>
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
  font-weight: 850;
}

input {
  accent-color: var(--accent);
}
</style>
