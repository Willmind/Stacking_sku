<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { PackingResult } from "../../core/packing";
import {
  createPlan2DSceneModel,
  getPlan2DAxisGuideMetrics,
  type Plan2DAxisGuideMetric,
  type Plan2DFrontViewSide,
  type Plan2DSceneRectModel,
  type Plan2DViewMode,
} from "../../renderers/plan2d";

const props = withDefaults(
  defineProps<{
    stageId: string;
    stageClass?: string;
    result: PackingResult | null;
    visibleCount: number;
    viewMode: Plan2DViewMode;
    frontViewSide?: Plan2DFrontViewSide;
    showLabels?: boolean;
  }>(),
  {
    stageClass: "",
    showLabels: false,
  },
);

const stageHostRef = ref<HTMLElement | null>(null);
const stageSize = ref({ width: 360, height: 280 });
let resizeObserver: ResizeObserver | null = null;
const GUIDE_LABEL_PADDING_X = 10;
const GUIDE_LABEL_PADDING_Y = 8;
const GUIDE_LABEL_LINE_HEIGHT = 17;
const VERTICAL_GUIDE_LABEL_GAP = 22;

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function updateStageSize() {
  const element = stageHostRef.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(280, Math.floor(rect.height));
  if (stageSize.value.width !== width || stageSize.value.height !== height) {
    stageSize.value = { width, height };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function axisNameForLabel(axisLabel: string) {
  return axisLabel.replace("柜", "");
}

function estimateTextWidth(text: string) {
  return Array.from(text).reduce((width, character) => {
    if (/[\u4e00-\u9fff]/.test(character)) return width + 11;
    if (/\d/.test(character)) return width + 7;
    if (character === " ") return width + 4;
    return width + 6.5;
  }, 0);
}

function formatAxisGuideCountText(metric: Plan2DAxisGuideMetric, axis: "x" | "y") {
  if (!metric.countLabel) return "";
  const directionLabel = axis === "x" ? "横向" : "竖向";
  return `${directionLabel} ${formatNumber(metric.count)}${metric.countLabel}`;
}

function formatAxisGuideText(metric: Plan2DAxisGuideMetric, axis: "x" | "y") {
  const axisName = axisNameForLabel(metric.axisLabel);
  const countText = formatAxisGuideCountText(metric, axis);
  const countPrefix = countText ? `${countText} · ` : "";
  return `${countPrefix}占${axisName} ${formatNumber(metric.occupied)}mm · 余量 ${formatNumber(metric.remaining)}mm`;
}

function formatAxisGuideLines(metric: Plan2DAxisGuideMetric, axis: "x" | "y") {
  const axisName = axisNameForLabel(metric.axisLabel);
  const lines = [`占${axisName} ${formatNumber(metric.occupied)}mm`, `余量 ${formatNumber(metric.remaining)}mm`];
  const countText = formatAxisGuideCountText(metric, axis);
  return countText ? [countText, ...lines] : lines;
}

function getStackedGuideLabelSize(lines: string[]) {
  return {
    width: Math.max(...lines.map((line) => estimateTextWidth(line))) + GUIDE_LABEL_PADDING_X * 2,
    height: lines.length * GUIDE_LABEL_LINE_HEIGHT + GUIDE_LABEL_PADDING_Y * 2,
  };
}

const sceneOffsetX = computed(() => {
  if (stageSize.value.width >= 520) return 76;
  if (stageSize.value.width >= 380) return 58;
  return 0;
});

const sceneModel = computed(() =>
  createPlan2DSceneModel({
    result: props.result,
    visibleCount: props.visibleCount,
    viewMode: props.viewMode,
    frontViewSide: props.frontViewSide,
    width: Math.max(260, stageSize.value.width - sceneOffsetX.value),
    height: stageSize.value.height,
    showLabels: props.showLabels,
  }),
);

const stageConfig = computed(() => ({
  width: stageSize.value.width,
  height: stageSize.value.height,
}));

const sceneGroupConfig = computed(() => ({
  x: sceneOffsetX.value,
  y: 0,
  listening: false,
}));

const axisGuideConfig = computed(() => {
  const model = sceneModel.value;
  if (!props.result || !props.result.pattern || !model.plane || model.emptyMessage) return null;
  const metrics = getPlan2DAxisGuideMetrics(props.result, props.visibleCount, props.viewMode, {
    frontViewSide: model.frontViewSide,
  });
  const xStart = model.origin.x + sceneOffsetX.value;
  const xEnd = model.origin.x + model.container.width + sceneOffsetX.value;
  const yStart = model.origin.y;
  const yEnd = model.origin.y + model.container.height;
  const compact = model.compactCanvas;
  const tick = 5;
  const xGuideY = Math.min(model.height - 48, yEnd + (compact ? 14 : 18));
  const yGuideX = Math.max(34, xStart - (compact ? 12 : 16));
  const xLabelText = formatAxisGuideText(metrics.x, "x");
  const xLabelWidth = Math.min(estimateTextWidth(xLabelText) + GUIDE_LABEL_PADDING_X * 2, stageSize.value.width - 16);
  const xLabelHeight = 25;
  const xLabelCenterX = clamp((xStart + xEnd) / 2, 8 + xLabelWidth / 2, stageSize.value.width - xLabelWidth / 2 - 8);
  const xLabelY = clamp(xGuideY + 13, 8, model.height - xLabelHeight - 8);
  const yLabelLines = formatAxisGuideLines(metrics.y, "y");
  const yLabelSize = getStackedGuideLabelSize(yLabelLines);
  const yLabelX = clamp(
    yGuideX - yLabelSize.width - VERTICAL_GUIDE_LABEL_GAP,
    8,
    stageSize.value.width - yLabelSize.width - 8,
  );
  const yLabelY = clamp((yStart + yEnd) / 2 - yLabelSize.height / 2, 8, model.height - yLabelSize.height - 8);
  return {
    xLine: [xStart, xGuideY, xEnd, xGuideY],
    xStartTick: [xStart, xGuideY - tick, xStart, xGuideY + tick],
    xEndTick: [xEnd, xGuideY - tick, xEnd, xGuideY + tick],
    yLine: [yGuideX, yStart, yGuideX, yEnd],
    yStartTick: [yGuideX - tick, yStart, yGuideX + tick, yStart],
    yEndTick: [yGuideX - tick, yEnd, yGuideX + tick, yEnd],
    xLabel: {
      text: xLabelText,
      centerX: xLabelCenterX,
      y: xLabelY,
    },
    yLabel: {
      lines: yLabelLines,
      x: yLabelX,
      y: yLabelY,
    },
  };
});

function rectConfig(rect: Plan2DSceneRectModel) {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
    fill: rect.fillStyle,
    stroke: rect.strokeStyle,
    strokeWidth: rect.lineWidth ?? 0,
    dash: rect.lineDash,
    listening: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  };
}

function lineConfig(points: number[], options: { dash?: number[]; stroke?: string; strokeWidth?: number } = {}) {
  return {
    points,
    stroke: options.stroke ?? "rgba(245, 247, 251, 0.64)",
    strokeWidth: options.strokeWidth ?? 1,
    dash: options.dash ?? [5, 4],
    listening: false,
    perfectDrawEnabled: false,
  };
}

function horizontalGuideLabelStyle(label: { centerX: number; y: number }) {
  return {
    left: `${Math.round(label.centerX)}px`,
    top: `${Math.round(label.y)}px`,
    transform: "translateX(-50%)",
  };
}

function verticalGuideLabelStyle(label: { x: number; y: number }) {
  return {
    left: `${Math.round(label.x)}px`,
    top: `${Math.round(label.y)}px`,
  };
}

const emptyTextConfig = computed(() => ({
  x: 0,
  y: sceneModel.value.height / 2 - 12,
  width: sceneModel.value.width,
  text: sceneModel.value.emptyMessage ?? "",
  align: "center",
  fill: "rgba(245, 247, 251, 0.78)",
  fontFamily: "Inter, sans-serif",
  fontSize: 16,
  fontStyle: "700",
  listening: false,
}));

const effectiveSpaceTextConfig = computed(() => {
  const label = sceneModel.value.effectiveSpaceBoundary?.label;
  return {
    x: label?.x ?? 0,
    y: (label?.y ?? 0) - 13,
    text: label?.text ?? "",
    fill: "rgba(66, 214, 164, 0.92)",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontStyle: "800",
    listening: false,
  };
});

onMounted(() => {
  void nextTick(updateStageSize);
  resizeObserver = new ResizeObserver(updateStageSize);
  if (stageHostRef.value) resizeObserver.observe(stageHostRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div :id="stageId" ref="stageHostRef" class="plan-konva-stage" :class="stageClass">
    <v-stage :config="stageConfig">
      <v-layer>
        <v-text v-if="sceneModel.emptyMessage" :config="emptyTextConfig" />
        <template v-else>
          <v-group :config="sceneGroupConfig">
            <v-rect :config="rectConfig(sceneModel.container)" />
            <v-rect v-for="box in sceneModel.boxes" :key="box.key" :config="rectConfig(box)" />
            <v-rect
              v-if="sceneModel.effectiveSpaceBoundary"
              :config="rectConfig(sceneModel.effectiveSpaceBoundary)"
            />
            <v-text v-if="sceneModel.effectiveSpaceBoundary?.label" :config="effectiveSpaceTextConfig" />
            <v-rect :config="rectConfig(sceneModel.containerOutline)" />
          </v-group>
          <template v-if="axisGuideConfig">
            <v-line :config="lineConfig(axisGuideConfig.xLine)" />
            <v-line :config="lineConfig(axisGuideConfig.xStartTick)" />
            <v-line :config="lineConfig(axisGuideConfig.xEndTick)" />
            <v-line :config="lineConfig(axisGuideConfig.yLine)" />
            <v-line :config="lineConfig(axisGuideConfig.yStartTick)" />
            <v-line :config="lineConfig(axisGuideConfig.yEndTick)" />
          </template>
        </template>
      </v-layer>
    </v-stage>
    <template v-if="axisGuideConfig && !sceneModel.emptyMessage">
      <div class="plan-guide-label plan-guide-label--x" :style="horizontalGuideLabelStyle(axisGuideConfig.xLabel)">
        {{ axisGuideConfig.xLabel.text }}
      </div>
      <div class="plan-guide-label plan-guide-label--y" :style="verticalGuideLabelStyle(axisGuideConfig.yLabel)">
        <span
          v-for="(line, index) in axisGuideConfig.yLabel.lines"
          :key="`${line}-${index}`"
          class="plan-guide-label__line"
          :class="{ 'plan-guide-label__line--count': index === 0 }"
        >
          {{ line }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.plan-konva-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.plan-guide-label {
  position: absolute;
  z-index: 3;
  display: inline-grid;
  width: max-content;
  max-width: calc(100% - 16px);
  padding: 6px 10px;
  border: 1px solid rgba(142, 156, 172, 0.42);
  border-radius: 7px;
  background: rgba(5, 14, 17, 0.88);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.18);
  color: rgba(245, 247, 251, 0.96);
  font-family: Inter, sans-serif;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
  pointer-events: none;
  white-space: nowrap;
}

.plan-guide-label--y {
  gap: 3px;
  align-items: start;
  justify-items: start;
  padding: 8px 10px;
}

.plan-guide-label__line {
  display: block;
}

.plan-guide-label__line--count {
  color: rgba(66, 214, 164, 0.98);
}

.plan-canvas-shell {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(66, 214, 164, 0.1), transparent 34%),
    radial-gradient(circle at 86% 78%, rgba(104, 166, 255, 0.09), transparent 30%),
    linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px),
    rgba(3, 8, 14, 0.72);
  background-size:
    auto,
    auto,
    36px 36px,
    36px 36px,
    auto;
}

.plan-canvas-shell::before,
.plan-canvas-shell::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  content: "";
}

.plan-canvas-shell::before {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.plan-canvas-shell::after {
  background:
    linear-gradient(90deg, rgba(66, 214, 164, 0.18), transparent 18%, transparent 82%, rgba(104, 166, 255, 0.12)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%);
  opacity: 0.42;
  mix-blend-mode: screen;
}

.plan-canvas-shell--expanded {
  width: 100%;
  height: 100%;
}

:deep(.konvajs-content) {
  position: relative;
  z-index: 1;
  width: 100% !important;
  height: 100% !important;
}

:deep(canvas) {
  display: block;
}
</style>
