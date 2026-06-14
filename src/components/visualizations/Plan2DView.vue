<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderPlan2D, type Plan2DViewMode } from "../../renderers/plan2d";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const viewMode = ref<Plan2DViewMode>("top");
let resizeObserver: ResizeObserver | null = null;

const viewModes: Array<{ id: Plan2DViewMode; label: string; title: string }> = [
  { id: "top", label: "俯视", title: "俯视图" },
  { id: "side", label: "侧视", title: "侧视图" },
  { id: "front", label: "端视", title: "端视图" },
];

const currentViewTitle = computed(() => viewModes.find((item) => item.id === viewMode.value)?.title || "俯视图");

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
    viewMode: viewMode.value,
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
  () => [store.result, store.visibleCount, viewMode.value],
  () => draw(),
  { deep: true },
);
</script>

<template>
  <article class="view-panel two-d-panel">
    <header>
      <h2>2D 平面排布</h2>
      <div class="view-header-tools">
        <div class="view-mode-switch" aria-label="2D 视图切换">
          <button
            v-for="item in viewModes"
            :key="item.id"
            type="button"
            :aria-pressed="viewMode === item.id"
            @click="viewMode = item.id"
          >
            {{ item.label }}
          </button>
        </div>
        <span>{{ currentViewTitle }}</span>
      </div>
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
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--panel-strong);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.view-header-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.view-mode-switch {
  display: inline-grid;
  grid-template-columns: repeat(3, 44px);
  gap: 2px;
  padding: 2px;
  border: 1px solid rgba(174, 184, 201, 0.2);
  border-radius: 6px;
  background: rgba(3, 8, 14, 0.46);
}

.view-mode-switch button {
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.view-mode-switch button[aria-pressed="true"] {
  background: rgba(66, 214, 164, 0.18);
  color: var(--accent);
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
