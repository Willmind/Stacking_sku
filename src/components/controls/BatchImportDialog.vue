<script setup lang="ts">
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileSpreadsheet, Upload } from "@lucide/vue";
import { readSheet } from "read-excel-file/browser";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import templateFileUrl from "../../assets/batch-import-template.xlsx?url";
import { createBatchResultWorkbook, type BatchResultWorkbookOptions } from "../../core/batchExport";
import {
  BatchImportCancelledError,
  calculateBatchPackingAsync,
  type BatchImportStatus,
  type BatchPackingItem,
  type BatchPackingRow,
} from "../../core/batchImport";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseSelect, { type SelectOption } from "../ui/BaseSelect.vue";

type DifferenceFilter = "全部" | "负差值" | "零差值" | "正差值" | "非零差值";
type SortDirection = "asc" | "desc";
type SortKey = "manualCount" | "sizeText" | "containerType" | "totalBoxes" | "difference" | "status" | "error";

interface SortColumn {
  key: SortKey;
  label: string;
  kind: "number" | "text";
}

const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const isImporting = ref(false);
const fileName = ref("");
const results = ref<BatchPackingItem[]>([]);
const importError = ref("");
const MIN_IMPORT_LOADING_MS = 700;
const LONG_IMPORT_NOTICE_MS = 2500;
const isLongImporting = ref(false);
const importProgress = ref(0);
const importStage = ref("等待读取文件");
const processedRows = ref(0);
const totalRows = ref(0);
const statusFilter = ref<BatchImportStatus | "全部">("全部");
const errorFilter = ref("全部");
const differenceFilter = ref<DifferenceFilter>("全部");
const reviewOnly = ref(false);
const sortKey = ref<SortKey | "">("");
const sortDirection = ref<SortDirection>("asc");
let longImportTimer: number | null = null;
let abortController: AbortController | null = null;

const statusFilterOptions: SelectOption[] = [
  { value: "全部", label: "全部" },
  { value: "成功", label: "成功" },
  { value: "解析失败", label: "解析失败" },
  { value: "计算失败", label: "计算失败" },
  { value: "无法装载", label: "无法装载" },
];

const differenceFilterOptions: SelectOption[] = [
  { value: "全部", label: "全部" },
  { value: "负差值", label: "负差值" },
  { value: "零差值", label: "零差值" },
  { value: "正差值", label: "正差值" },
  { value: "非零差值", label: "非零差值" },
];

const sortColumns: SortColumn[] = [
  { key: "manualCount", label: "人工码垛数量（原始）", kind: "number" },
  { key: "sizeText", label: "尺寸（长宽高 mm）", kind: "text" },
  { key: "containerType", label: "柜型", kind: "text" },
  { key: "totalBoxes", label: "最大装载量", kind: "number" },
  { key: "difference", label: "差值", kind: "number" },
  { key: "status", label: "状态", kind: "text" },
  { key: "error", label: "失败原因", kind: "text" },
];

const successCount = computed(() => results.value.filter((item) => item.status === "成功").length);
const failedResults = computed(() => results.value.filter((item) => item.status !== "成功"));
const negativeDifferenceResults = computed(() =>
  results.value.filter((item) => item.difference !== null && item.difference < 0),
);
const reviewResults = computed(() => {
  const negativeRows = new Set(negativeDifferenceResults.value);
  return results.value.filter((item) => item.status !== "成功" || negativeRows.has(item));
});
const failedCount = computed(() => failedResults.value.length);
const failureReasonOptions = computed(() => {
  const reasons = Array.from(new Set(failedResults.value.map((item) => item.error || item.status))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  return ["全部", ...reasons].map((reason) => ({ value: reason, label: reason }));
});
const filteredResults = computed(() =>
  results.value.filter((item) => {
    if (statusFilter.value !== "全部" && item.status !== statusFilter.value) return false;
    if (errorFilter.value !== "全部" && (item.error || item.status) !== errorFilter.value) return false;
    if (!matchesDifferenceFilter(item)) return false;
    if (reviewOnly.value && !isReviewItem(item)) return false;
    return true;
  }),
);
const sortedResults = computed(() => {
  if (!sortKey.value) return filteredResults.value;

  const column = sortColumns.find((item) => item.key === sortKey.value);
  if (!column) return filteredResults.value;

  return [...filteredResults.value].sort((first, second) => {
    const comparison = compareItems(first, second, column);
    if (comparison !== 0) return sortDirection.value === "asc" ? comparison : -comparison;
    return first.rowNumber - second.rowNumber;
  });
});
const summaryText = computed(() => {
  if (!results.value.length) return importError.value || "没有读取到可计算的数据";
  const filteredText = filteredResults.value.length === results.value.length ? "" : ` · 当前显示 ${filteredResults.value.length} 条`;
  return `共 ${results.value.length} 条 · 成功 ${successCount.value} 条 · 异常 ${failedCount.value} 条${filteredText}`;
});
const loadingDescription = computed(() =>
  isLongImporting.value ? `${importStage.value} · 文件较大，正在继续计算...` : importStage.value,
);
const progressPercent = computed(() => Math.max(0, Math.min(100, Math.round(importProgress.value))));
const progressStyle = computed(() => ({ width: `${progressPercent.value}%` }));
const hasActiveFilter = computed(
  () => statusFilter.value !== "全部" || errorFilter.value !== "全部" || differenceFilter.value !== "全部" || reviewOnly.value,
);

function clearLongImportTimer() {
  if (longImportTimer === null) return;
  window.clearTimeout(longImportTimer);
  longImportTimer = null;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("zh-CN");
}

function openFilePicker() {
  if (isImporting.value) return;
  inputRef.value?.click();
}

function resetFilters() {
  statusFilter.value = "全部";
  errorFilter.value = "全部";
  differenceFilter.value = "全部";
  reviewOnly.value = false;
}

function updateStatusFilter(value: string) {
  statusFilter.value = value as BatchImportStatus | "全部";
}

function updateErrorFilter(value: string) {
  errorFilter.value = value;
}

function updateDifferenceFilter(value: string) {
  differenceFilter.value = value as DifferenceFilter;
}

function resultFileName() {
  const baseName = fileName.value.replace(/\.[^.]+$/, "").trim() || "批量导入结果";
  return `${baseName}-装载结果.xlsx`;
}

function reviewFileName() {
  const baseName = fileName.value.replace(/\.[^.]+$/, "").trim() || "批量导入结果";
  return `${baseName}-需复核行.xlsx`;
}

function currentFilteredFileName() {
  const baseName = fileName.value.replace(/\.[^.]+$/, "").trim() || "批量导入结果";
  return `${baseName}-当前筛选结果.xlsx`;
}

function downloadWorkbook(items: BatchPackingItem[], downloadName: string, options: BatchResultWorkbookOptions = {}) {
  if (!items.length) return;

  const workbook = createBatchResultWorkbook(items, options);
  const workbookBuffer = new ArrayBuffer(workbook.byteLength);
  new Uint8Array(workbookBuffer).set(workbook);
  const blob = new Blob([workbookBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadResults() {
  downloadWorkbook(results.value, resultFileName(), { title: "批量导入结果" });
}

function downloadReviewResults() {
  downloadWorkbook(reviewResults.value, reviewFileName(), {
    title: "批量导入需复核行",
    includeErrorDetails: true,
  });
}

function downloadCurrentFilteredResults() {
  downloadWorkbook(sortedResults.value, currentFilteredFileName(), {
    title: "批量导入当前筛选结果",
    includeErrorDetails: true,
  });
}

function isReviewItem(item: BatchPackingItem) {
  return item.status !== "成功" || (item.difference !== null && item.difference < 0);
}

function matchesDifferenceFilter(item: BatchPackingItem) {
  if (differenceFilter.value === "全部") return true;
  if (item.difference === null) return false;
  if (differenceFilter.value === "负差值") return item.difference < 0;
  if (differenceFilter.value === "零差值") return item.difference === 0;
  if (differenceFilter.value === "正差值") return item.difference > 0;
  return item.difference !== 0;
}

function compareNullableNumbers(first: number | null, second: number | null) {
  const firstMissing = first === null;
  const secondMissing = second === null;
  if (firstMissing && secondMissing) return 0;
  if (firstMissing) return 1;
  if (secondMissing) return -1;
  return first - second;
}

function compareText(first: string, second: string) {
  const firstMissing = !first.trim();
  const secondMissing = !second.trim();
  if (firstMissing && secondMissing) return 0;
  if (firstMissing) return 1;
  if (secondMissing) return -1;
  return first.localeCompare(second, "zh-CN");
}

function compareItems(first: BatchPackingItem, second: BatchPackingItem, column: SortColumn) {
  if (column.kind === "number") {
    return compareNullableNumbers(first[column.key] as number | null, second[column.key] as number | null);
  }

  const firstValue = column.key === "error" ? first.error || "" : String(first[column.key] ?? "");
  const secondValue = column.key === "error" ? second.error || "" : String(second[column.key] ?? "");
  return compareText(firstValue, secondValue);
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }

  sortKey.value = key;
  sortDirection.value = "asc";
}

function sortAriaValue(key: SortKey) {
  if (sortKey.value !== key) return "none";
  return sortDirection.value === "asc" ? "ascending" : "descending";
}

function sortIconFor(key: SortKey) {
  if (sortKey.value !== key) return ArrowUpDown;
  return sortDirection.value === "asc" ? ArrowUp : ArrowDown;
}

function cancelImport() {
  if (!isImporting.value) return;
  importStage.value = "正在取消导入...";
  abortController?.abort();
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForLoadingPaint() {
  await nextTick();
  await nextFrame();
  await nextFrame();
  await wait(80);
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const controller = new AbortController();
  abortController = controller;
  fileName.value = file.name;
  importError.value = "";
  isLongImporting.value = false;
  isImporting.value = true;
  importProgress.value = 3;
  importStage.value = "正在读取 Excel";
  processedRows.value = 0;
  totalRows.value = 0;
  clearLongImportTimer();
  longImportTimer = window.setTimeout(() => {
    isLongImporting.value = true;
    longImportTimer = null;
  }, LONG_IMPORT_NOTICE_MS);
  const loadingStartedAt = performance.now();
  let shouldOpenDialog = true;
  await waitForLoadingPaint();

  try {
    const sheetRows = await readSheet(file);
    if (controller.signal.aborted) throw new BatchImportCancelledError();
    importProgress.value = 15;
    importStage.value = "正在整理表格";
    const [headerRow, ...dataRows] = sheetRows;
    if (!headerRow) {
      throw new Error("Excel 文件中没有可读取的工作表");
    }

    const headers = headerRow.map((cell) => String(cell ?? "").trim());
    const rows = dataRows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])) as BatchPackingRow,
    );
    totalRows.value = rows.length;
    importStage.value = rows.length ? `正在计算 0 / ${rows.length} 行` : "正在计算导入数据";
    results.value = await calculateBatchPackingAsync(rows, {
      signal: controller.signal,
      batchSize: 20,
      onProgress: ({ processed, total, progress }) => {
        processedRows.value = processed;
        totalRows.value = total;
        importProgress.value = 15 + progress * 75;
        importStage.value = `正在计算 ${processed} / ${total} 行`;
      },
      yieldToMain: nextFrame,
    });
    importProgress.value = 100;
    importStage.value = "正在生成结果";
    resetFilters();
    if (!results.value.length) {
      importError.value = "没有读取到可计算的数据";
    }
  } catch (caught) {
    results.value = [];
    if (caught instanceof BatchImportCancelledError || controller.signal.aborted) {
      importError.value = "已取消导入";
      shouldOpenDialog = false;
    } else {
      importError.value = caught instanceof Error ? caught.message : "Excel 解析失败";
    }
  } finally {
    clearLongImportTimer();
    const loadingElapsed = performance.now() - loadingStartedAt;
    if (loadingElapsed < MIN_IMPORT_LOADING_MS) {
      await wait(MIN_IMPORT_LOADING_MS - loadingElapsed);
    }
    isImporting.value = false;
    isLongImporting.value = false;
    abortController = null;
    input.value = "";
    if (shouldOpenDialog) {
      isOpen.value = true;
    }
  }
}

onBeforeUnmount(() => {
  clearLongImportTimer();
  abortController?.abort();
});
</script>

<template>
  <section class="batch-import" aria-label="批量导入">
    <button
      class="batch-import-button"
      type="button"
      :disabled="isImporting"
      :aria-busy="isImporting"
      @click="openFilePicker"
    >
      <span v-if="isImporting" class="batch-import-spinner" aria-hidden="true"></span>
      <Upload v-else :size="16" :stroke-width="2.35" aria-hidden="true" />
      {{ isImporting ? "解析中..." : "批量导入 Excel" }}
    </button>
    <a class="batch-import-button secondary" :href="templateFileUrl" download="模版文件.xlsx">
      <Download :size="16" :stroke-width="2.35" aria-hidden="true" />
      下载模版
    </a>
    <input
      id="batch-excel-input"
      ref="inputRef"
      class="batch-file-input"
      type="file"
      accept=".xlsx"
      @change="handleFileChange"
    />
  </section>

  <Teleport to="body">
    <Transition name="batch-import-loading">
      <div v-if="isImporting" class="batch-import-loading" role="status" aria-live="polite">
        <div class="batch-import-loading-card">
          <span class="batch-import-spinner batch-import-loading-spinner" aria-hidden="true"></span>
          <div class="batch-import-loading-content">
            <div class="batch-import-loading-copy">
              <strong>正在解析 Excel</strong>
              <span>{{ loadingDescription }}</span>
            </div>
            <span
              class="batch-import-progress"
              role="progressbar"
              aria-label="Excel 导入进度"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="progressPercent"
              :aria-valuetext="`${progressPercent}%`"
            >
              <span :style="progressStyle" aria-hidden="true"></span>
            </span>
            <div class="batch-import-loading-meta">
              <span>{{ progressPercent }}%</span>
              <span v-if="totalRows">第 {{ processedRows }} / {{ totalRows }} 行</span>
            </div>
            <button class="batch-import-cancel" type="button" @click="cancelImport">取消导入</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <BaseDialog v-model:open="isOpen" title="批量导入结果" :description="summaryText" body-variant="flush" stable-height>
    <template #icon>
      <span class="dialog-icon" aria-hidden="true">
        <FileSpreadsheet :size="18" :stroke-width="2.3" />
      </span>
    </template>

    <div class="batch-result-layout">
      <div class="batch-result-head">
        <div v-if="fileName" class="file-line">文件：{{ fileName }}</div>

        <div v-if="results.length" class="batch-result-toolbar">
          <BaseSelect
            id="batch-status-filter"
            label="状态"
            aria-label="按导入状态筛选"
            density="compact"
            :model-value="statusFilter"
            :options="statusFilterOptions"
            @update:model-value="updateStatusFilter"
          />
          <BaseSelect
            id="batch-error-filter"
            label="失败原因"
            aria-label="按失败原因筛选"
            density="compact"
            :model-value="errorFilter"
            :options="failureReasonOptions"
            :disabled="!failedResults.length"
            @update:model-value="updateErrorFilter"
          />
          <BaseSelect
            id="batch-difference-filter"
            label="差值"
            aria-label="按差值筛选"
            density="compact"
            :model-value="differenceFilter"
            :options="differenceFilterOptions"
            @update:model-value="updateDifferenceFilter"
          />
          <label class="review-only-toggle">
            <input v-model="reviewOnly" type="checkbox" />
            <span>只看需复核</span>
          </label>
          <button v-if="hasActiveFilter" class="filter-reset-button" type="button" @click="resetFilters">清除筛选</button>
        </div>
      </div>

      <div class="batch-result-region">
        <div v-if="results.length && sortedResults.length" class="result-table-shell">
          <table>
            <thead>
              <tr>
                <th v-for="column in sortColumns" :key="column.key" :aria-sort="sortAriaValue(column.key)">
                  <button class="sort-header-button" type="button" :aria-label="`按${column.label}排序`" @click="toggleSort(column.key)">
                    <span>{{ column.label }}</span>
                    <component :is="sortIconFor(column.key)" :size="13" :stroke-width="2.45" aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sortedResults" :key="item.rowNumber" :class="{ failed: item.status !== '成功' }">
                <td>{{ formatNumber(item.manualCount) }}</td>
                <td>{{ item.sizeText || "-" }}</td>
                <td>{{ item.containerType || "-" }}</td>
                <td>{{ formatNumber(item.totalBoxes) }}</td>
                <td>
                  <span v-if="item.difference !== null && item.difference < 0" class="negative-difference-chip">
                    {{ formatNumber(item.difference) }}
                  </span>
                  <template v-else>{{ formatNumber(item.difference) }}</template>
                </td>
                <td>{{ item.status }}</td>
                <td>{{ item.error || "-" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="results.length" class="dialog-empty">当前筛选没有结果</p>

        <p v-else class="dialog-error">{{ importError || "没有读取到可计算的数据" }}</p>
      </div>
    </div>

    <template #footer>
      <button v-if="hasActiveFilter && sortedResults.length" class="dialog-action" type="button" @click="downloadCurrentFilteredResults">
        <Download :size="15" :stroke-width="2.35" aria-hidden="true" />
        导出当前筛选
      </button>
      <button v-if="reviewResults.length" class="dialog-action" type="button" @click="downloadReviewResults">
        <Download :size="15" :stroke-width="2.35" aria-hidden="true" />
        导出需复核行
      </button>
      <button v-if="results.length" class="dialog-action primary" type="button" @click="downloadResults">
        <Download :size="15" :stroke-width="2.35" aria-hidden="true" />
        下载结果
      </button>
      <button class="dialog-action" type="button" @click="isOpen = false">关闭</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.batch-import {
  display: grid;
  gap: 10px;
}

.batch-import-button {
  display: inline-flex;
  gap: 8px;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.032));
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.batch-import-button:hover {
  border-color: var(--control-border-hover);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.046));
  color: var(--accent);
}

.batch-import-button:disabled {
  cursor: wait;
  opacity: 0.86;
}

.batch-import-button:disabled:hover {
  border-color: rgba(174, 184, 201, 0.22);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.032));
  color: var(--text);
}

.batch-import-button:active {
  transform: translateY(1px);
}

.batch-import-button:disabled:active {
  transform: none;
}

.batch-import-button.secondary {
  border-color: rgba(66, 214, 164, 0.28);
  background: rgba(66, 214, 164, 0.09);
  color: var(--accent);
}

.batch-import-button.secondary:hover {
  border-color: rgba(92, 237, 193, 0.58);
  background: rgba(66, 214, 164, 0.14);
}

.batch-file-input {
  display: none;
}

.batch-import-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(66, 214, 164, 0.22);
  border-top-color: var(--accent);
  border-radius: 999px;
  animation: batch-import-spin 760ms linear infinite;
}

@keyframes batch-import-spin {
  to {
    transform: rotate(360deg);
  }
}

.batch-import-loading {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 6, 12, 0.68);
  backdrop-filter: blur(10px);
}

.batch-import-loading-card {
  display: grid;
  width: min(420px, calc(100vw - 48px));
  place-items: center;
  gap: 14px;
  border: 1px solid rgba(174, 184, 201, 0.24);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(26, 36, 49, 0.98), rgba(18, 27, 38, 0.98));
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.46), var(--panel-shadow);
  padding: 24px 28px;
  text-align: center;
}

.batch-import-loading-content {
  display: grid;
  width: min(100%, 300px);
  min-width: 0;
  justify-items: center;
  gap: 12px;
}

.batch-import-loading-copy {
  display: grid;
  gap: 3px;
}

.batch-import-loading-card strong {
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
}

.batch-import-loading-card span:not(.batch-import-spinner) {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.batch-import-progress {
  position: relative;
  display: block;
  width: 100%;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(174, 184, 201, 0.16);
}

.batch-import-progress span {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(66, 214, 164, 0), rgba(66, 214, 164, 0.92), rgba(104, 166, 255, 0.88));
  transition: width 160ms ease;
}

.batch-import-loading-spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.batch-import-loading-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  justify-content: center;
}

.batch-import-cancel {
  justify-self: center;
  border: 1px solid rgba(255, 138, 128, 0.3);
  border-radius: 7px;
  background: rgba(255, 112, 102, 0.08);
  color: #ffb4ab;
  font-size: 12px;
  font-weight: 900;
}

.batch-import-cancel:hover {
  border-color: rgba(255, 138, 128, 0.54);
  background: rgba(255, 112, 102, 0.13);
}

.batch-import-loading-enter-active,
.batch-import-loading-leave-active {
  transition: opacity 140ms ease;
}

.batch-import-loading-enter-active .batch-import-loading-card,
.batch-import-loading-leave-active .batch-import-loading-card {
  transition: opacity 140ms ease, transform 140ms ease;
}

.batch-import-loading-enter-from,
.batch-import-loading-leave-to {
  opacity: 0;
}

.batch-import-loading-enter-from .batch-import-loading-card,
.batch-import-loading-leave-to .batch-import-loading-card {
  opacity: 0;
  transform: translateY(4px) scale(0.985);
}

.dialog-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(66, 214, 164, 0.3);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}

.file-line,
.dialog-error,
.dialog-empty {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.file-line {
  min-height: 28px;
  align-content: center;
  padding: 6px 9px;
  border: 1px solid rgba(174, 184, 201, 0.16);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}

.batch-result-layout {
  --batch-result-stable-height: clamp(260px, 42dvh, 420px);

  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
}

.batch-result-head {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.batch-result-region {
  min-width: 0;
  min-height: 0;
}

.batch-result-toolbar {
  display: grid;
  grid-template-columns: minmax(130px, 160px) minmax(170px, 230px) minmax(120px, 150px) auto auto;
  gap: 10px;
  align-items: end;
  justify-content: start;
}

.review-only-toggle {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  padding: 0 11px;
  white-space: nowrap;
}

.review-only-toggle:hover {
  border-color: rgba(66, 214, 164, 0.42);
}

.review-only-toggle input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--accent);
}

.review-only-toggle:has(input:focus-visible) {
  box-shadow: var(--focus-ring);
}

.review-only-toggle:has(input:checked) {
  border-color: rgba(66, 214, 164, 0.42);
  background: rgba(66, 214, 164, 0.1);
  color: var(--accent);
}

.filter-reset-button {
  min-height: 36px;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.filter-reset-button:hover {
  border-color: rgba(66, 214, 164, 0.42);
  color: var(--accent);
}

@media (max-width: 720px) {
  .batch-result-toolbar {
    grid-template-columns: 1fr;
  }
}

.dialog-action {
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
  font-weight: 900;
}

.dialog-action:hover {
  border-color: var(--control-border-hover);
  background: rgba(255, 255, 255, 0.075);
}

.result-table-shell {
  height: 100%;
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 8px;
}

.dialog-empty {
  display: grid;
  height: 100%;
  min-height: 0;
  place-items: center;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
}

table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

th,
td {
  padding: 10px 11px;
  border-bottom: 1px solid rgba(174, 184, 201, 0.12);
  color: var(--text);
  font-size: 12px;
  text-align: left;
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

.sort-header-button {
  display: inline-flex;
  width: 100%;
  min-height: 24px;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  padding: 0;
}

.sort-header-button:hover {
  color: var(--text);
}

.sort-header-button:focus-visible {
  border-radius: 5px;
  outline: 0;
  box-shadow: var(--focus-ring);
}

.sort-header-button svg {
  flex: 0 0 auto;
  opacity: 0.78;
}

td {
  font-weight: 800;
}

tr:last-child td {
  border-bottom: 0;
}

tr.failed td {
  color: var(--danger);
}

.negative-difference-chip {
  display: inline-flex;
  min-width: 46px;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 112, 102, 0.38);
  border-radius: 999px;
  background: rgba(255, 112, 102, 0.1);
  color: #ff8a80;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  padding: 0 9px;
}

.dialog-error {
  display: grid;
  height: 100%;
  min-height: 0;
  place-items: center;
  border: 1px solid rgba(255, 112, 102, 0.22);
  border-radius: 8px;
  background: rgba(255, 112, 102, 0.08);
  color: var(--danger);
}

.dialog-action {
  display: inline-flex;
  min-width: 84px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
}

.dialog-action.primary {
  border-color: rgba(66, 214, 164, 0.48);
  background: linear-gradient(180deg, #52e0b5, var(--accent-strong));
  color: #04110d;
  box-shadow: 0 12px 28px rgba(47, 189, 148, 0.18);
}

.dialog-action.primary:hover {
  border-color: rgba(92, 237, 193, 0.78);
  background: linear-gradient(180deg, #68e8c2, #35cba0);
}
</style>
