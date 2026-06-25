<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Crosshair, Download, MapPinned } from "@lucide/vue";
import {
  createBoxCoordinateCsv,
  createBoxCoordinateRows,
  type BoxCoordinateRow,
} from "../../core/boxCoordinates";
import { usePackingStore } from "../../stores/packingStore";
import BaseDialog from "../ui/BaseDialog.vue";
import Cargo3DSceneV2 from "../visualizations/Cargo3DSceneV2.vue";

const store = usePackingStore();
const isOpen = ref(false);
const selectedRow = ref<BoxCoordinateRow | null>(null);
const rows = computed(() => createBoxCoordinateRows(store.result));
const hasRows = computed(() => rows.value.length > 0);
const coordinateSummary = computed(() =>
  hasRows.value ? `共 ${rows.value.length.toLocaleString("zh-CN")} 个纸箱坐标，单位 mm` : "请先完成装载计算",
);
const selectedText = computed(() => {
  if (!selectedRow.value) return "当前选中：-";
  return `当前选中：#${selectedRow.value.sequence} · 装载顺序 ${selectedRow.value.loadingSequence}`;
});
const selectedLabel = computed(() => (selectedRow.value ? `#${selectedRow.value.sequence}` : ""));

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function openDialog() {
  if (!hasRows.value) return;
  const matchingRow = rows.value.find((row) => row.sequence === selectedRow.value?.sequence);
  selectedRow.value = matchingRow ?? rows.value[0];
  isOpen.value = true;
}

function downloadCsv() {
  if (!hasRows.value) return;
  const csv = createBoxCoordinateCsv(rows.value);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "纸箱坐标.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function selectRow(row: BoxCoordinateRow) {
  selectedRow.value = row;
}

function coordinateCells(row: BoxCoordinateRow) {
  return [
    row.sequence,
    row.loadingSequence,
    row.sku || "-",
    row.doorFaceX,
    row.doorFaceY,
    row.doorFaceZ,
    row.topFaceX,
    row.topFaceY,
    row.topFaceZ,
    row.centerX,
    row.centerY,
    row.centerZ,
    row.length,
    row.width,
    row.height,
    row.layer,
    row.row,
    row.column,
    row.orientation || "-",
  ];
}

watch(
  () => rows.value,
  (nextRows) => {
    if (!nextRows.length) {
      selectedRow.value = null;
      return;
    }
    const matchingRow = nextRows.find((row) => row.sequence === selectedRow.value?.sequence);
    selectedRow.value = matchingRow ?? nextRows[0];
  },
);
</script>

<template>
  <section class="coordinate-entry" aria-label="纸箱坐标">
    <button class="coordinate-button" type="button" :disabled="!hasRows" @click="openDialog">
      <MapPinned :size="16" :stroke-width="2.35" aria-hidden="true" />
      查看坐标
    </button>
  </section>

  <BaseDialog
    v-model:open="isOpen"
    title="查看坐标"
    :description="coordinateSummary"
    size="fullscreen"
    body-variant="flush"
    stable-height
  >
    <template #icon>
      <span class="coordinate-dialog-icon" aria-hidden="true">
        <Crosshair :size="18" :stroke-width="2.3" />
      </span>
    </template>

    <div class="coordinate-layout">
      <p class="coordinate-system-note">
        坐标系：原点为柜内最里面左下角；X 向右，Y 向柜门，Z 向上；柜门面坐标为纸箱朝柜门面中心点，上表面坐标为纸箱顶面中心点。
      </p>

      <div class="coordinate-content">
        <div class="coordinate-table-shell">
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>装载顺序</th>
                <th>SKU</th>
                <th>柜门面X</th>
                <th>柜门面Y</th>
                <th>柜门面Z</th>
                <th>上表面X</th>
                <th>上表面Y</th>
                <th>上表面Z</th>
                <th>中心点X</th>
                <th>中心点Y</th>
                <th>中心点Z</th>
                <th>长</th>
                <th>宽</th>
                <th>高</th>
                <th>层</th>
                <th>排</th>
                <th>列</th>
                <th>朝向</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.sequence"
                :class="{ 'is-selected': selectedRow?.sequence === row.sequence }"
                tabindex="0"
                @click="selectRow(row)"
                @keydown.enter.prevent="selectRow(row)"
                @keydown.space.prevent="selectRow(row)"
              >
                <td v-for="(cell, cellIndex) in coordinateCells(row)" :key="`${row.sequence}-${cellIndex}`">
                  {{ typeof cell === "number" ? formatNumber(cell) : cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <aside class="coordinate-preview" aria-label="坐标 3D 预览">
          <div class="coordinate-preview-head">
            <strong>{{ selectedText }}</strong>
            <span>点击左侧任一行，高亮对应纸箱；XYZ 轴从原点伸出</span>
          </div>
          <Cargo3DSceneV2
            canvas-id="coordinate-preview-canvas"
            class="coordinate-preview-canvas"
            :result="store.result"
            :visible-count="store.result?.totalBoxes ?? 0"
            :selected-loading-sequence="selectedRow?.loadingSequence"
            :selected-label="selectedLabel"
            :camera-zoom="1.6"
            show-coordinate-axes
          />
        </aside>
      </div>
    </div>

    <template #footer>
      <button class="coordinate-action primary" type="button" :disabled="!hasRows" @click="downloadCsv">
        <Download :size="15" :stroke-width="2.35" aria-hidden="true" />
        导出 CSV
      </button>
      <button class="coordinate-action" type="button" @click="isOpen = false">关闭</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.coordinate-entry {
  display: grid;
}

.coordinate-button,
.coordinate-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
  font-weight: 900;
}

.coordinate-button {
  min-height: 32px;
  padding: 0 11px;
  font-size: 12px;
}

.coordinate-button:hover,
.coordinate-action:hover {
  border-color: var(--control-border-hover);
  background: rgba(255, 255, 255, 0.075);
  color: var(--accent);
}

.coordinate-button:disabled,
.coordinate-action:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.coordinate-dialog-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(104, 166, 255, 0.32);
  border-radius: 8px;
  background: rgba(104, 166, 255, 0.12);
  color: #8dbdff;
}

.coordinate-layout {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 14px 16px 0;
}

.coordinate-content {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(340px, 0.72fr) minmax(560px, 1.55fr);
  gap: 12px;
}

.coordinate-system-note {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(104, 166, 255, 0.22);
  border-radius: 8px;
  background: rgba(104, 166, 255, 0.08);
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.6;
}

.coordinate-table-shell {
  height: 100%;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 1380px;
  border-collapse: collapse;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid rgba(174, 184, 201, 0.12);
  color: var(--text);
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #17212c;
  color: var(--muted);
  font-weight: 900;
}

td {
  font-weight: 800;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover td {
  background: rgba(66, 214, 164, 0.06);
}

tbody tr:focus-visible {
  outline: 0;
}

tbody tr:focus-visible td,
tbody tr.is-selected td {
  background: rgba(66, 214, 164, 0.12);
  color: var(--accent);
}

tr:last-child td {
  border-bottom: 0;
}

.coordinate-preview {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 8px;
  background: rgba(3, 8, 14, 0.72);
}

.coordinate-preview-head {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(174, 184, 201, 0.14);
}

.coordinate-preview-head strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.coordinate-preview-head span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.coordinate-preview-canvas {
  width: 100%;
  height: 100%;
  min-height: 420px;
  background: rgba(3, 8, 14, 0.72);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.coordinate-action {
  min-width: 84px;
  min-height: 36px;
  padding: 0 14px;
}

.coordinate-action.primary {
  border-color: rgba(66, 214, 164, 0.48);
  background: linear-gradient(180deg, #52e0b5, var(--accent-strong));
  color: #04110d;
  box-shadow: 0 12px 28px rgba(47, 189, 148, 0.18);
}

.coordinate-action.primary:hover {
  border-color: rgba(92, 237, 193, 0.78);
  background: linear-gradient(180deg, #68e8c2, #35cba0);
  color: #04110d;
}

@media (max-width: 980px) {
  .coordinate-content {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(300px, 1fr) minmax(280px, 0.75fr);
  }

  .coordinate-preview-canvas {
    min-height: 320px;
  }
}
</style>
