<script setup lang="ts">
import { computed } from "vue";
import { describePackingStrategy } from "../../core/packing";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
const props = withDefaults(
  defineProps<{
    section?: "overview" | "details";
  }>(),
  {
    section: "overview",
  },
);

const layersWithBoxes = computed(() => store.result?.layers.filter((layer) => layer.boxCount > 0).length ?? 0);
const isHeterogeneousResult = computed(() => store.result?.pattern?.family === "heterogeneous-zones");
const perLayerMetricLabel = computed(() => (isHeterogeneousResult.value ? "最大层级箱数" : "每层数量"));
const layerMetricLabel = computed(() => (isHeterogeneousResult.value ? "堆叠层级" : "层数"));
const patternName = computed(() => {
  const pattern = store.result?.pattern;
  if (!pattern) return "-";
  if (pattern.family === "heterogeneous-zones") return "异尺寸按 SKU 顺序分区";
  return pattern.family === "width-lanes" ? "按柜宽分区混排" : "按柜长分区混排";
});
const strategyNotes = computed(() => describePackingStrategy(store.result));
const effectiveSizeText = computed(() => {
  const effectiveContainer = store.result?.effectiveContainer ?? store.container;
  return `${formatNumber(effectiveContainer.length)} × ${formatNumber(effectiveContainer.width)} × ${formatNumber(effectiveContainer.height)} mm`;
});

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatMm(value: number) {
  return `${formatNumber(value)} mm`;
}
</script>

<template>
  <section v-if="props.section === 'overview'" class="result-stack result-stack--overview" aria-label="装载结果总览">
    <div class="summary-card summary-card--primary">
      <span>最大装载量</span>
      <strong id="total-boxes">{{ store.totalBoxesText }}</strong>
      <small>cartons</small>
    </div>
    <dl class="metric-grid metric-grid--compact">
      <div>
        <dt>{{ perLayerMetricLabel }}</dt>
        <dd id="per-layer-count">{{ formatNumber(store.result?.perLayerBoxCount ?? 0) }}</dd>
      </div>
      <div>
        <dt>{{ layerMetricLabel }}</dt>
        <dd id="layer-count">{{ formatNumber(layersWithBoxes) }}</dd>
      </div>
      <div>
        <dt>已用高度</dt>
        <dd id="used-height">{{ formatMm(store.result?.usedHeight ?? 0) }}</dd>
      </div>
      <div>
        <dt>体积利用</dt>
        <dd id="utilization">{{ ((store.result?.utilizationRatio ?? 0) * 100).toFixed(1) }}%</dd>
      </div>
    </dl>
  </section>
  <section v-else class="result-details" aria-label="装载详情">
    <dl class="detail-list">
      <div>
        <dt>排布模式</dt>
        <dd id="pattern-name">{{ patternName }}</dd>
      </div>
      <div>
        <dt>有效尺寸</dt>
        <dd id="effective-size">{{ effectiveSizeText }}</dd>
      </div>
      <div>
        <dt>占用长度</dt>
        <dd id="occupied-length">{{ formatMm(store.result?.pattern?.occupiedLength ?? 0) }}</dd>
      </div>
      <div>
        <dt>占用宽度</dt>
        <dd id="occupied-width">{{ formatMm(store.result?.pattern?.occupiedWidth ?? 0) }}</dd>
      </div>
      <div>
        <dt>角件避让</dt>
        <dd id="blocked-count">{{ formatNumber(store.result?.blockedByCornerTotal ?? 0) }} 箱</dd>
      </div>
    </dl>
    <section v-if="strategyNotes.length" class="strategy-notes" aria-label="本次排布说明">
      <h2>本次排布说明</h2>
      <ul id="strategy-notes">
        <li v-for="note in strategyNotes" :key="note.id" :class="`strategy-note strategy-note--${note.tone}`">
          <strong>{{ note.label }}</strong>
          <span>{{ note.detail }}</span>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.result-stack {
  display: grid;
  gap: 10px;
}

.result-details {
  display: grid;
  gap: 10px;
}

.summary-card {
  display: grid;
  gap: 2px;
  padding: 14px 16px 13px;
  border: 1px solid rgba(66, 214, 164, 0.35);
  border-radius: 8px;
  background: rgba(66, 214, 164, 0.1);
}

.summary-card--primary {
  overflow: hidden;
  background: linear-gradient(180deg, rgba(66, 214, 164, 0.14), rgba(66, 214, 164, 0.075));
}

.summary-card span,
.summary-card small,
dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.summary-card strong {
  color: var(--accent);
  font-size: 52px;
  line-height: 0.95;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.metric-grid--compact {
  gap: 8px;
}

.metric-grid div,
.detail-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(16, 24, 33, 0.72);
}

.detail-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.strategy-notes {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(104, 166, 255, 0.24);
  border-radius: 8px;
  background: rgba(16, 24, 33, 0.68);
}

.strategy-notes h2 {
  margin: 0;
  color: var(--accent);
  font-size: 13px;
  font-weight: 900;
}

.strategy-notes ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.strategy-note {
  display: grid;
  grid-template-columns: minmax(64px, auto) minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 8px 9px;
  border: 1px solid var(--strategy-note-border);
  border-radius: 7px;
  background: var(--strategy-note-bg);
}

.strategy-note--neutral {
  --strategy-note-bg: rgba(161, 175, 192, 0.08);
  --strategy-note-border: rgba(161, 175, 192, 0.18);
}

.strategy-note--success {
  --strategy-note-bg: rgba(66, 214, 164, 0.09);
  --strategy-note-border: rgba(66, 214, 164, 0.24);
}

.strategy-note--warning {
  --strategy-note-bg: rgba(217, 166, 79, 0.1);
  --strategy-note-border: rgba(217, 166, 79, 0.28);
}

.strategy-note strong {
  color: var(--text);
  font-size: 12px;
}

.strategy-note span {
  min-width: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
}

dd {
  margin: 0;
  color: var(--text);
  font-weight: 900;
  text-align: right;
}
</style>
