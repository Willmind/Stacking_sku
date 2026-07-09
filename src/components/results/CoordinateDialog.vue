<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { FlexRender, getCoreRowModel, useVueTable, type ColumnDef } from "@tanstack/vue-table";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { Crosshair, Download, MapPinned } from "@lucide/vue";
import {
  BOX_COORDINATE_HEADERS,
  createBoxCoordinateCsv,
  createBoxCoordinateRows,
  type BoxCoordinateRow,
} from "../../core/boxCoordinates";
import { usePackingStore } from "../../stores/packingStore";
import BaseDialog from "../ui/BaseDialog.vue";
import Cargo3DSceneV2 from "../visualizations/Cargo3DSceneV2.vue";

const COORDINATE_ROW_HEIGHT = 37;
const COORDINATE_TABLE_OVERSCAN = 10;

type CoordinateColumnKey = Extract<keyof BoxCoordinateRow, string>;

const coordinateColumnSpecs: Array<{ key: CoordinateColumnKey; header: (typeof BOX_COORDINATE_HEADERS)[number] }> = [
  { key: "sequence", header: "序号" },
  { key: "loadingSequence", header: "装载顺序" },
  { key: "sku", header: "SKU" },
  { key: "centerX", header: "中心点X" },
  { key: "centerY", header: "中心点Y" },
  { key: "centerZ", header: "中心点Z" },
  { key: "eulerX", header: "欧拉角X" },
  { key: "eulerY", header: "欧拉角Y" },
  { key: "eulerZ", header: "欧拉角Z" },
  { key: "length", header: "长" },
  { key: "width", header: "宽" },
  { key: "height", header: "高" },
  { key: "layer", header: "层" },
  { key: "row", header: "排" },
  { key: "column", header: "列" },
  { key: "orientation", header: "朝向" },
];

const coordinateColumns: ColumnDef<BoxCoordinateRow>[] = coordinateColumnSpecs.map(({ key, header }) => ({
  accessorKey: key,
  header,
  cell: ({ getValue }) => formatCellValue(getValue()),
}));

const store = usePackingStore();
const isOpen = ref(false);
const selectedRow = ref<BoxCoordinateRow | null>(null);
const coordinateTableShellRef = ref<HTMLDivElement | null>(null);
const rows = computed(() => createBoxCoordinateRows(store.result));
const hasRows = computed(() => rows.value.length > 0);
const coordinateSummary = computed(() =>
  hasRows.value ? `共 ${rows.value.length.toLocaleString("zh-CN")} 个纸箱坐标，单位 mm` : "请先完成装载计算",
);
const selectedText = computed(() => {
  if (!selectedRow.value) return "当前选中：-";
  return `当前选中：#${selectedRow.value.sequence} · 装载顺序 ${selectedRow.value.loadingSequence}`;
});
const selectedLabel = computed(() =>
  selectedRow.value ? `#${selectedRow.value.sequence} · 顺序 ${selectedRow.value.loadingSequence}` : "",
);
const selectedCenterText = computed(() => {
  const row = selectedRow.value;
  if (!row) return "-";
  return `(${formatNumber(row.centerX)}, ${formatNumber(row.centerY)}, ${formatNumber(row.centerZ)})`;
});
const selectedEulerText = computed(() => {
  const row = selectedRow.value;
  if (!row) return "-";
  return `(${formatNumber(row.eulerX)}°, ${formatNumber(row.eulerY)}°, ${formatNumber(row.eulerZ)}°)`;
});

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatCellValue(value: unknown) {
  if (typeof value === "number") return formatNumber(value);
  return value ? String(value) : "-";
}

const coordinateTable = useVueTable({
  data: rows,
  columns: coordinateColumns,
  getCoreRowModel: getCoreRowModel(),
  getRowId: (row) => String(row.sequence),
});
const coordinateTableRows = computed(() => {
  const rowCount = rows.value.length;
  if (rowCount === 0) return [];
  return coordinateTable.getRowModel().rows;
});
const coordinateLeafColumnCount = computed(() => coordinateTable.getAllLeafColumns().length);
const coordinateVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>(
  computed(() => ({
    count: coordinateTableRows.value.length,
    getScrollElement: () => coordinateTableShellRef.value,
    estimateSize: () => COORDINATE_ROW_HEIGHT,
    overscan: COORDINATE_TABLE_OVERSCAN,
    getItemKey: (index) => coordinateTableRows.value[index]?.id ?? index,
  })),
);
const coordinateVirtualItems = computed(() => coordinateVirtualizer.value.getVirtualItems());
const coordinateVirtualRows = computed(() =>
  coordinateVirtualItems.value.flatMap((virtualRow) => {
    const row = coordinateTableRows.value[virtualRow.index];
    return row ? [{ row, virtualRow }] : [];
  }),
);
const topSpacerHeight = computed(() => coordinateVirtualItems.value[0]?.start ?? 0);
const bottomSpacerHeight = computed(() => {
  const virtualItems = coordinateVirtualItems.value;
  const lastVirtualRow = virtualItems[virtualItems.length - 1];
  if (!lastVirtualRow) return 0;
  return Math.max(0, coordinateVirtualizer.value.getTotalSize() - lastVirtualRow.end);
});

function openDialog() {
  if (!hasRows.value) return;
  const matchingRow = rows.value.find((row) => row.sequence === selectedRow.value?.sequence);
  selectedRow.value = matchingRow ?? rows.value[0];
  isOpen.value = true;
  void nextTick(() => coordinateVirtualizer.value.measure());
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

watch(
  () => coordinateTableRows.value.length,
  () => {
    void nextTick(() => coordinateVirtualizer.value.measure());
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
        坐标系：原点为角件端右下角；X 沿柜宽向左，Y 向柜门，Z 向上；位置使用纸箱中心点；欧拉角使用角度制，旋转顺序 XYZ。
      </p>

      <div class="coordinate-content">
        <div ref="coordinateTableShellRef" class="coordinate-table-shell">
          <table>
            <thead>
              <tr v-for="headerGroup in coordinateTable.getHeaderGroups()" :key="headerGroup.id">
                <th v-for="header in headerGroup.headers" :key="header.id">
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="topSpacerHeight > 0" class="coordinate-virtual-spacer" aria-hidden="true">
                <td :colspan="coordinateLeafColumnCount" :style="{ height: `${topSpacerHeight}px` }"></td>
              </tr>
              <tr
                v-for="{ row, virtualRow } in coordinateVirtualRows"
                :key="row.id"
                :data-index="virtualRow.index"
                :class="{ 'is-selected': selectedRow?.sequence === row.original.sequence }"
                tabindex="0"
                @click="selectRow(row.original)"
                @keydown.enter.prevent="selectRow(row.original)"
                @keydown.space.prevent="selectRow(row.original)"
              >
                <td v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </td>
              </tr>
              <tr v-if="bottomSpacerHeight > 0" class="coordinate-virtual-spacer" aria-hidden="true">
                <td :colspan="coordinateLeafColumnCount" :style="{ height: `${bottomSpacerHeight}px` }"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <aside class="coordinate-preview" aria-label="坐标 3D 预览">
          <div class="coordinate-preview-head">
            <strong>{{ selectedText }}</strong>
            <span>点击左侧任一行，高亮对应纸箱；XYZ 轴从原点伸出</span>
            <dl class="coordinate-preview-metrics" aria-label="当前选中坐标点">
              <div>
                <dt>中心点</dt>
                <dd>{{ selectedCenterText }}</dd>
              </div>
              <div>
                <dt>欧拉角 XYZ</dt>
                <dd>{{ selectedEulerText }}</dd>
              </div>
            </dl>
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
            dim-cargo-when-selected
            lightweight-coordinate-preview
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

tbody tr:not(.coordinate-virtual-spacer):hover td {
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

.coordinate-virtual-spacer {
  cursor: default;
  pointer-events: none;
}

.coordinate-virtual-spacer td {
  padding: 0;
  border-bottom: 0;
  background: transparent;
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

.coordinate-preview-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 5px 0 0;
}

.coordinate-preview-metrics div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(174, 184, 201, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
}

.coordinate-preview-metrics dt {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.coordinate-preview-metrics dd {
  margin: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
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

  .coordinate-preview-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
