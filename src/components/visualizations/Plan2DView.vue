<script setup lang="ts">
import { LayoutPanelTop, Maximize2, PanelBottom, PanelLeft } from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Component, ComponentPublicInstance } from "vue";
import {
  getPlan2DAxisGuideMetrics,
  getPlan2DPlaneConfig,
  renderPlan2D,
  type Plan2DFrontViewSide,
  type Plan2DViewMode,
} from "../../renderers/plan2d";
import { usePackingStore } from "../../stores/packingStore";
import VisualizationDialog from "./VisualizationDialog.vue";

const store = usePackingStore();
let resizeObserver: ResizeObserver | null = null;

type SwitchablePlanViewMode = "top" | "side";

interface PlanViewItem {
  id: Plan2DViewMode;
  title: string;
  axisLabel: string;
  canvasId: string;
  switchLabel?: string;
  icon: Component;
}

const switchablePlanViews: Array<PlanViewItem & { id: SwitchablePlanViewMode; switchLabel: string }> = [
  {
    id: "top",
    title: "俯视图",
    axisLabel: "长 × 宽",
    canvasId: "plan-canvas-top",
    switchLabel: "俯视",
    icon: LayoutPanelTop,
  },
  {
    id: "side",
    title: "侧视图",
    axisLabel: "长 × 高",
    canvasId: "plan-canvas-side",
    switchLabel: "侧视",
    icon: PanelLeft,
  },
];

const frontPlanView: PlanViewItem = {
  id: "front",
  title: "端视图",
  axisLabel: "宽 × 高",
  canvasId: "plan-canvas-front",
  icon: PanelBottom,
};

const frontViewSides: Array<{ id: Plan2DFrontViewSide; label: string }> = [
  { id: "corner", label: "角件端" },
  { id: "door", label: "柜门" },
];

const activePlanViewMode = ref<SwitchablePlanViewMode>("top");
const activeFrontViewSide = ref<Plan2DFrontViewSide>("corner");
const activePlanView = computed(() => {
  return switchablePlanViews.find((item) => item.id === activePlanViewMode.value) ?? switchablePlanViews[0];
});

const switchableCanvasRef = ref<HTMLCanvasElement | null>(null);
const frontCanvasRef = ref<HTMLCanvasElement | null>(null);
const expandedCanvasRef = ref<HTMLCanvasElement | null>(null);
const expandedPlanViewMode = ref<Plan2DViewMode | null>(null);
const showGroupSummary = false;

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

const allPlanViews = computed(() => [...switchablePlanViews, frontPlanView]);
const expandedPlanView = computed(() => allPlanViews.value.find((item) => item.id === expandedPlanViewMode.value) ?? null);

function getViewStatus() {
  const result = store.result;
  if (!result?.pattern) return "等待计算";
  return `当前显示 · ${formatNumber(Math.min(result.totalBoxes, store.visibleCount))} / ${formatNumber(result.totalBoxes)} 箱`;
}

function getViewMeasure(mode: Plan2DViewMode) {
  const result = store.result;
  if (!result?.pattern) return "等待尺寸";
  const frontViewSide = getFrontViewSideForMode(mode);
  const plane = getPlan2DPlaneConfig(result, mode, { frontViewSide });
  const metrics = getPlan2DAxisGuideMetrics(result, result.totalBoxes, mode, { frontViewSide });
  return `${plane.xLabel} ${formatNumber(plane.width)}mm · 占用 ${formatNumber(metrics.x.occupied)}mm`;
}

function setSwitchableCanvasRef(element: Element | ComponentPublicInstance | null) {
  switchableCanvasRef.value = element instanceof HTMLCanvasElement ? element : null;
}

function setFrontCanvasRef(element: Element | ComponentPublicInstance | null) {
  frontCanvasRef.value = element instanceof HTMLCanvasElement ? element : null;
}

function setExpandedCanvasRef(element: Element | ComponentPublicInstance | null) {
  expandedCanvasRef.value = element instanceof HTMLCanvasElement ? element : null;
}

function setActivePlanView(mode: SwitchablePlanViewMode) {
  activePlanViewMode.value = mode;
}

function setFrontViewSide(side: Plan2DFrontViewSide) {
  activeFrontViewSide.value = side;
}

function getFrontViewSideForMode(mode: Plan2DViewMode) {
  return mode === "front" ? activeFrontViewSide.value : undefined;
}

function getFrontViewSideLabel() {
  return frontViewSides.find((side) => side.id === activeFrontViewSide.value)?.label ?? frontViewSides[0].label;
}

function drawView(mode: Plan2DViewMode, canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  renderPlan2D({
    canvas,
    result: store.result,
    visibleCount: store.visibleCount,
    viewMode: mode,
    frontViewSide: getFrontViewSideForMode(mode),
    showLabels: false,
  });
}

function draw() {
  drawView(activePlanViewMode.value, switchableCanvasRef.value);
  drawView(frontPlanView.id, frontCanvasRef.value);
  drawExpandedView();
}

function drawExpandedView() {
  if (!expandedPlanViewMode.value) return;
  drawView(expandedPlanViewMode.value, expandedCanvasRef.value);
}

function openExpandedView(mode: Plan2DViewMode) {
  expandedPlanViewMode.value = mode;
  void nextTick(() => {
    drawExpandedView();
    if (expandedCanvasRef.value && resizeObserver) resizeObserver.observe(expandedCanvasRef.value);
  });
}

function closeExpandedView() {
  if (expandedCanvasRef.value && resizeObserver) resizeObserver.unobserve(expandedCanvasRef.value);
  expandedPlanViewMode.value = null;
}

function getExpandedSubtitle(mode: Plan2DViewMode) {
  return `${getViewStatus()} · ${getViewMeasure(mode)}`;
}

function getExpandedTitle(view: PlanViewItem) {
  return view.id === "front" ? `${view.title} · ${getFrontViewSideLabel()}` : view.title;
}

onMounted(() => {
  draw();
  resizeObserver = new ResizeObserver(draw);
  if (switchableCanvasRef.value) resizeObserver.observe(switchableCanvasRef.value);
  if (frontCanvasRef.value) resizeObserver.observe(frontCanvasRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => [store.result, store.visibleCount, activePlanViewMode.value, activeFrontViewSide.value],
  () => {
    void nextTick(draw);
  },
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
      <section class="plan-view-card plan-view-card--switchable">
        <header class="plan-view-card-header">
          <div class="plan-view-card-heading">
            <span class="plan-view-card-title">
              <component :is="activePlanView.icon" :size="14" :stroke-width="2.35" aria-hidden="true" />
              {{ activePlanView.title }}
            </span>
            <span class="plan-view-axis">{{ activePlanView.axisLabel }}</span>
          </div>
          <div class="plan-view-card-actions">
            <div class="plan-view-switch" role="group" aria-label="切换俯视图和侧视图">
              <button
                v-for="item in switchablePlanViews"
                :key="item.id"
                class="plan-view-switch-button"
                :class="{ 'is-active': activePlanViewMode === item.id }"
                type="button"
                :aria-pressed="activePlanViewMode === item.id"
                @click="setActivePlanView(item.id)"
              >
                {{ item.switchLabel }}
              </button>
            </div>
            <button
              class="view-expand-button"
              type="button"
              :aria-label="`放大${activePlanView.title}`"
              :title="`放大${activePlanView.title}`"
              @click="openExpandedView(activePlanView.id)"
            >
              <Maximize2 :size="15" :stroke-width="2.3" aria-hidden="true" />
            </button>
          </div>
          <span class="plan-view-status">{{ getViewStatus() }}</span>
          <span class="plan-view-measure">{{ getViewMeasure(activePlanView.id) }}</span>
        </header>
        <canvas
          :id="activePlanView.canvasId"
          :ref="(element) => setSwitchableCanvasRef(element)"
          width="980"
          height="620"
        ></canvas>
      </section>

      <section class="plan-view-card plan-view-card--front">
        <header class="plan-view-card-header">
          <div class="plan-view-card-heading">
            <span class="plan-view-card-title">
              <component :is="frontPlanView.icon" :size="14" :stroke-width="2.35" aria-hidden="true" />
              {{ frontPlanView.title }}
            </span>
            <span class="plan-view-axis">{{ frontPlanView.axisLabel }}</span>
          </div>
          <div class="plan-view-card-actions">
            <div class="plan-view-switch plan-view-switch--front" role="group" aria-label="切换端视图视角">
              <button
                v-for="side in frontViewSides"
                :key="side.id"
                class="plan-view-switch-button"
                :class="{ 'is-active': activeFrontViewSide === side.id }"
                type="button"
                :aria-pressed="activeFrontViewSide === side.id"
                @click="setFrontViewSide(side.id)"
              >
                {{ side.label }}
              </button>
            </div>
            <button
              class="view-expand-button"
              type="button"
              :aria-label="`放大${frontPlanView.title}`"
              :title="`放大${frontPlanView.title}`"
              @click="openExpandedView(frontPlanView.id)"
            >
              <Maximize2 :size="15" :stroke-width="2.3" aria-hidden="true" />
            </button>
          </div>
          <span class="plan-view-status">{{ getViewStatus() }}</span>
          <span class="plan-view-measure">{{ getViewMeasure(frontPlanView.id) }}</span>
        </header>
        <canvas
          :id="frontPlanView.canvasId"
          :ref="(element) => setFrontCanvasRef(element)"
          width="980"
          height="620"
        ></canvas>
      </section>
    </div>
    <div v-if="showGroupSummary && groupSummary.length" class="plan-group-summary" aria-label="2D 排布分区说明">
      <span v-for="item in groupSummary" :key="item">{{ item }}</span>
    </div>

    <VisualizationDialog
      :open="expandedPlanViewMode !== null"
      :title="expandedPlanView ? getExpandedTitle(expandedPlanView) : '2D 视图'"
      :subtitle="expandedPlanView ? getExpandedSubtitle(expandedPlanView.id) : ''"
      @close="closeExpandedView"
    >
      <canvas
        id="expanded-plan-canvas"
        class="expanded-plan-canvas"
        :ref="(element) => setExpandedCanvasRef(element)"
        width="1400"
        height="860"
      ></canvas>
    </VisualizationDialog>
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
  grid-template-columns: minmax(0, 1.42fr) minmax(230px, 0.88fr);
  grid-template-rows: minmax(0, 1fr);
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

.plan-view-card--switchable {
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

.plan-view-card-heading {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
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

.plan-view-card-actions {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 8px;
}

.plan-view-switch {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  justify-self: end;
  padding: 2px;
  border: 1px solid rgba(66, 214, 164, 0.34);
  border-radius: 999px;
  background: rgba(66, 214, 164, 0.08);
}

.plan-view-switch-button {
  min-height: 24px;
  padding: 3px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.plan-view-switch-button:hover {
  color: var(--text);
}

.plan-view-switch-button.is-active {
  background: rgba(66, 214, 164, 0.16);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(66, 214, 164, 0.22);
}

.view-expand-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--muted);
}

.view-expand-button:hover {
  border-color: rgba(66, 214, 164, 0.45);
  background: rgba(66, 214, 164, 0.1);
  color: var(--accent);
}

.view-expand-button:active {
  transform: translateY(1px);
}

.view-expand-button:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
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

.expanded-plan-canvas {
  height: 100%;
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

@media (max-width: 720px) {
  .plan-view-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .plan-view-card--switchable,
  .plan-view-card--front {
    grid-column: 1;
  }
}
</style>
