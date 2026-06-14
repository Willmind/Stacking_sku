<script setup lang="ts">
import { Download, FileSpreadsheet, Upload, X } from "@lucide/vue";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { readSheet } from "read-excel-file/browser";
import { computed, ref } from "vue";
import templateFileUrl from "../../assets/batch-import-template.xlsx?url";
import { createBatchResultWorkbook } from "../../core/batchExport";
import { calculateBatchPacking, type BatchPackingItem, type BatchPackingRow } from "../../core/batchImport";

const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const isImporting = ref(false);
const fileName = ref("");
const results = ref<BatchPackingItem[]>([]);
const importError = ref("");
const MIN_IMPORT_LOADING_MS = 260;

const successCount = computed(() => results.value.filter((item) => item.status === "成功").length);
const failedCount = computed(() => results.value.filter((item) => item.status !== "成功").length);
const summaryText = computed(() => {
  if (!results.value.length) return importError.value || "没有读取到可计算的数据";
  return `共 ${results.value.length} 条 · 成功 ${successCount.value} 条 · 异常 ${failedCount.value} 条`;
});

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("zh-CN");
}

function openFilePicker() {
  if (isImporting.value) return;
  inputRef.value?.click();
}

function resultFileName() {
  const baseName = fileName.value.replace(/\.[^.]+$/, "").trim() || "批量导入结果";
  return `${baseName}-装载结果.xlsx`;
}

function downloadResults() {
  if (!results.value.length) return;

  const workbook = createBatchResultWorkbook(results.value);
  const workbookBuffer = new ArrayBuffer(workbook.byteLength);
  new Uint8Array(workbookBuffer).set(workbook);
  const blob = new Blob([workbookBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = resultFileName();
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  fileName.value = file.name;
  importError.value = "";
  isImporting.value = true;
  const loadingStartedAt = performance.now();

  try {
    const sheetRows = await readSheet(file);
    const [headerRow, ...dataRows] = sheetRows;
    if (!headerRow) {
      throw new Error("Excel 文件中没有可读取的工作表");
    }

    const headers = headerRow.map((cell) => String(cell ?? "").trim());
    const rows = dataRows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])) as BatchPackingRow,
    );
    results.value = calculateBatchPacking(rows);
    if (!results.value.length) {
      importError.value = "没有读取到可计算的数据";
    }
  } catch (caught) {
    results.value = [];
    importError.value = caught instanceof Error ? caught.message : "Excel 解析失败";
  } finally {
    const loadingElapsed = performance.now() - loadingStartedAt;
    if (loadingElapsed < MIN_IMPORT_LOADING_MS) {
      await wait(MIN_IMPORT_LOADING_MS - loadingElapsed);
    }
    isImporting.value = false;
    input.value = "";
    isOpen.value = true;
  }
}
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
          <div>
            <strong>正在解析 Excel</strong>
            <span>请稍候，正在批量计算装载结果</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <Transition name="batch-dialog-overlay">
        <DialogOverlay class="batch-dialog-overlay" />
      </Transition>
      <Transition name="batch-dialog-content">
        <DialogContent class="batch-dialog-content" :aria-describedby="undefined">
          <header>
            <div class="dialog-title-row">
              <span class="dialog-icon" aria-hidden="true">
                <FileSpreadsheet :size="18" :stroke-width="2.3" />
              </span>
              <div>
                <DialogTitle class="dialog-title">批量导入结果</DialogTitle>
                <DialogDescription class="dialog-description">{{ summaryText }}</DialogDescription>
              </div>
            </div>
            <DialogClose class="dialog-close" aria-label="关闭弹框">
              <X :size="17" :stroke-width="2.35" aria-hidden="true" />
            </DialogClose>
          </header>

          <div v-if="fileName" class="file-line">文件：{{ fileName }}</div>

          <div v-if="results.length" class="result-table-shell">
            <table>
              <thead>
                <tr>
                  <th>人工码垛数量（原始）</th>
                  <th>尺寸（长宽高 mm）</th>
                  <th>柜型</th>
                  <th>最大装载量</th>
                  <th>差值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in results" :key="item.rowNumber" :class="{ failed: item.status !== '成功' }">
                  <td>{{ formatNumber(item.manualCount) }}</td>
                  <td>{{ item.sizeText || "-" }}</td>
                  <td>{{ item.containerType || "-" }}</td>
                  <td>{{ formatNumber(item.totalBoxes) }}</td>
                  <td>{{ formatNumber(item.difference) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-else class="dialog-error">{{ importError || "没有读取到可计算的数据" }}</p>

          <footer>
            <button v-if="results.length" class="dialog-action primary" type="button" @click="downloadResults">
              <Download :size="15" :stroke-width="2.35" aria-hidden="true" />
              下载结果
            </button>
            <DialogClose class="dialog-action">关闭</DialogClose>
          </footer>
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
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
  /* box-shadow: var(--control-inner-shadow); */
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
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 6, 12, 0.68);
  backdrop-filter: blur(10px);
}

.batch-import-loading-card {
  display: inline-flex;
  min-width: min(320px, calc(100vw - 48px));
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(174, 184, 201, 0.24);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(26, 36, 49, 0.98), rgba(18, 27, 38, 0.98));
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.46), var(--panel-shadow);
  padding: 16px 18px;
}

.batch-import-loading-card div {
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

.batch-import-loading-spinner {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-width: 3px;
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

.batch-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(2, 6, 12, 0.72);
  backdrop-filter: blur(12px);
}

.batch-dialog-content {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 41;
  display: grid;
  width: min(980px, calc(100vw - 36px));
  max-height: min(720px, calc(100dvh - 36px));
  transform: translate(-50%, -50%);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
  border: 1px solid rgba(174, 184, 201, 0.24);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.46), var(--panel-shadow);
  padding: 18px;
}

.batch-dialog-overlay-enter-active,
.batch-dialog-overlay-leave-active {
  transition: opacity 140ms ease;
}

.batch-dialog-overlay-enter-from,
.batch-dialog-overlay-leave-to {
  opacity: 0;
}

.batch-dialog-content-enter-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.batch-dialog-content-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.batch-dialog-content-enter-from,
.batch-dialog-content-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 6px)) scale(0.985);
}

.batch-dialog-content-enter-to,
.batch-dialog-content-leave-from {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.batch-dialog-content header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.dialog-title-row {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: flex-start;
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

.dialog-title {
  margin: 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
}

.dialog-description,
.file-line,
.dialog-error {
  margin: 4px 0 0;
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

.dialog-close,
.dialog-action {
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
  font-weight: 900;
}

.dialog-close {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
}

.dialog-close:hover,
.dialog-action:hover {
  border-color: var(--control-border-hover);
  background: rgba(255, 255, 255, 0.075);
}

.result-table-shell {
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(174, 184, 201, 0.18);
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 640px;
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

td {
  font-weight: 800;
}

tr:last-child td {
  border-bottom: 0;
}

tr.failed td {
  color: var(--danger);
}

.dialog-error {
  display: grid;
  min-height: 160px;
  place-items: center;
  border: 1px solid rgba(255, 112, 102, 0.22);
  border-radius: 8px;
  background: rgba(255, 112, 102, 0.08);
  color: var(--danger);
}

footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
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
  box-shadow: 0 12px 28px rgba(47, 189, 148, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.dialog-action.primary:hover {
  border-color: rgba(92, 237, 193, 0.78);
  background: linear-gradient(180deg, #68e8c2, #35cba0);
}
</style>
