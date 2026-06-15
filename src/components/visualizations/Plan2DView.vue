<script setup lang="ts">
import { LayoutPanelTop, PanelBottom, PanelLeft } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Component, ComponentPublicInstance } from "vue";
import { getPlan2DPlaneConfig, renderPlan2D, type Plan2DViewMode } from "../../renderers/plan2d";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
let resizeObserver: ResizeObserver | null = null;

const planViews: Array<{
  id: Plan2DViewMode;
  title: string;
  axisLabel: string;
  canvasId: string;
  className: string;
  icon: Component;
}> = [
  {
    id: "top",
    title: "俯视图",
    axisLabel: "长 × 宽",
    canvasId: "plan-canvas-top",
    className: "plan-view-card--top",
    icon: LayoutPanelTop,
  },
  {
    id: "side",
    title: "侧视图",
    axisLabel: "长 × 高",
    canvasId: "plan-canvas-side",
    className: "plan-view-card--side",
    icon: PanelLeft,
  },
  {
    id: "front",
    title: "端视图",
    axisLabel: "宽 × 高",
    canvasId: "plan-canvas-front",
    className: "plan-view-card--front",
    icon: PanelBottom,
  },
];

const canvasRefs = ref<Record<Plan2DViewMode, HTMLCanvasElement | null>>({
  top: null,
  side: null,
  front: null,
});

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

function getViewStatus() {
  const result = store.result;
  if (!result?.pattern) return "等待计算";
  return `当前显示 · ${formatNumber(Math.min(result.totalBoxes, store.visibleCount))} / ${formatNumber(result.totalBoxes)} 箱`;
}

function getViewMeasure(mode: Plan2DViewMode) {
  const result = store.result;
  if (!result?.pattern) return "等待尺寸";
  const plane = getPlan2DPlaneConfig(result, mode);
  return `${plane.xLabel} ${formatNumber(plane.width)}mm · 占用 ${formatNumber(plane.occupiedWidth)}mm`;
}

function setCanvasRef(mode: Plan2DViewMode, element: Element | ComponentPublicInstance | null) {
  canvasRefs.value[mode] = element instanceof HTMLCanvasElement ? element : null;
}

function drawView(mode: Plan2DViewMode) {
  const canvas = canvasRefs.value[mode];
  if (!canvas) return;
  renderPlan2D({
    canvas,
    result: store.result,
    visibleCount: store.visibleCount,
    viewMode: mode,
    showLabels: false,
  });
}

function draw() {
  planViews.forEach((item) => drawView(item.id));
}

onMounted(() => {
  draw();
  resizeObserver = new ResizeObserver(draw);
  planViews.forEach((item) => {
    const canvas = canvasRefs.value[item.id];
    if (canvas) resizeObserver?.observe(canvas);
  });
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
    <header class="panel-header">
      <div>
        <h2>2D 平面排布</h2>
        <span>俯视 / 侧视 / 端视</span>
      </div>
      <span>三视图</span>
    </header>
    <div class="plan-view-grid">
      <section v-for="item in planViews" :key="item.id" class="plan-view-card" :class="item.className">
        <header class="plan-view-card-header">
          <span class="plan-view-card-title">
            <component :is="item.icon" :size="14" :stroke-width="2.35" aria-hidden="true" />
            {{ item.title }}
          </span>
          <span class="plan-view-axis">{{ item.axisLabel }}</span>
          <span class="plan-view-status">{{ getViewStatus() }}</span>
          <span class="plan-view-measure">{{ getViewMeasure(item.id) }}</span>
        </header>
        <canvas :id="item.canvasId" :ref="(element) => setCanvasRef(item.id, element)" width="980" height="620"></canvas>
      </section>
    </div>
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

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}

.panel-header div {
  display: grid;
  gap: 4px;
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

.plan-view-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(220px, 0.9fr);
  grid-template-rows: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  padding: 12px;
}

.plan-view-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(174, 184, 201, 0.16);
  border-radius: 8px;
  background: rgba(3, 8, 14, 0.52);
}

.plan-view-card--top {
  grid-column: 1 / -1;
}

.plan-view-card--side {
  grid-column: 1;
}

.plan-view-card--front {
  grid-column: 2;
}

.plan-view-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 10px;
  padding: 8px 10px 7px;
  border-bottom: 1px solid rgba(174, 184, 201, 0.14);
}

.plan-view-card-title {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
}

.plan-view-axis {
  color: var(--muted);
  white-space: nowrap;
}

.plan-view-status {
  grid-column: 1 / -1;
  min-width: 0;
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  line-height: 1.2;
}

.plan-view-measure {
  grid-column: 1 / -1;
  min-width: 0;
  max-width: 100%;
  color: rgba(245, 247, 251, 0.78);
  font-size: 11px;
  line-height: 1.2;
}

canvas {
  display: block;
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

@media (max-width: 980px) {
  .plan-view-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, minmax(220px, 1fr));
  }

  .plan-view-card--top,
  .plan-view-card--side,
  .plan-view-card--front {
    grid-column: 1;
  }
}
</style>
