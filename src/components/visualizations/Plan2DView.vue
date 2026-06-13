<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderPlan2D } from "../../renderers/plan2d";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

interface PlanGroup {
  label: string;
  count: number;
  occupiedLength: number;
  occupiedWidth: number;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

const groupSummary = computed(() => {
  const pattern = store.result?.pattern;
  const groups = Array.isArray(pattern?.groups) ? (pattern.groups as PlanGroup[]) : [];
  if (!pattern || !groups.length) return [];
  return groups.map((group) => {
    if (pattern.family === "length-segments") {
      return `${group.label} ${group.count}列 · 占长 ${formatNumber(group.occupiedLength)}mm`;
    }
    return `${group.label} ${group.count}排 · 占宽 ${formatNumber(group.occupiedWidth)}mm`;
  });
});

function draw() {
  if (!canvasRef.value) return;
  renderPlan2D({
    canvas: canvasRef.value,
    result: store.result,
    visibleCount: store.visibleCount,
  });
}

onMounted(() => {
  draw();
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvasRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => [store.result, store.visibleCount],
  () => draw(),
  { deep: true },
);
</script>

<template>
  <article class="view-panel two-d-panel">
    <header>
      <h2>2D 平面排布</h2>
      <span>俯视图</span>
    </header>
    <canvas id="plan-canvas" ref="canvasRef" width="980" height="620"></canvas>
    <div v-if="groupSummary.length" class="plan-group-summary" aria-label="2D 排布分区说明">
      <span v-for="item in groupSummary" :key="item">{{ item }}</span>
    </div>
  </article>
</template>

<style scoped>
.view-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 560px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--panel-strong);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}

h2 {
  margin: 0;
  color: var(--text);
  font-size: 17px;
}

span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    rgba(3, 8, 14, 0.72);
  background-size: 28px 28px;
}

.plan-group-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(3, 8, 14, 0.48);
}

.plan-group-summary span {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.055);
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
}
</style>
