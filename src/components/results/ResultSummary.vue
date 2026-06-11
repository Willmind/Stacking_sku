<script setup lang="ts">
import { computed } from "vue";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();

const layersWithBoxes = computed(() => store.result?.layers.filter((layer) => layer.boxCount > 0).length ?? 0);
const patternName = computed(() => {
  const pattern = store.result?.pattern;
  if (!pattern) return "-";
  return pattern.family === "width-lanes" ? "按柜宽分区混排" : "按柜长分区混排";
});

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatMm(value: number) {
  return `${formatNumber(value)} mm`;
}
</script>

<template>
  <section class="result-stack" aria-label="装载结果">
    <div class="summary-card">
      <span>最大装载量</span>
      <strong id="total-boxes">{{ store.totalBoxesText }}</strong>
      <small>cartons</small>
    </div>
    <dl class="metric-grid">
      <div>
        <dt>每层数量</dt>
        <dd id="per-layer-count">{{ formatNumber(store.result?.perLayerBoxCount ?? 0) }}</dd>
      </div>
      <div>
        <dt>层数</dt>
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
    <dl class="detail-list">
      <div>
        <dt>排布模式</dt>
        <dd id="pattern-name">{{ patternName }}</dd>
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
  </section>
</template>

<style scoped>
.result-stack {
  display: grid;
  gap: 10px;
}

.summary-card {
  display: grid;
  gap: 4px;
  padding: 16px;
  border: 1px solid rgba(66, 214, 164, 0.35);
  border-radius: 8px;
  background: rgba(66, 214, 164, 0.1);
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
  font-size: 58px;
  line-height: 0.95;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.metric-grid div,
.detail-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(16, 24, 33, 0.72);
}

.detail-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

dd {
  margin: 0;
  color: var(--text);
  font-weight: 900;
  text-align: right;
}
</style>
