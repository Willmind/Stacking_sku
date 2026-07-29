<script setup lang="ts">
import { Boxes, Calculator, X } from "@lucide/vue";
import { computed, defineAsyncComponent } from "vue";
import ContainerForm from "./components/controls/ContainerForm.vue";
import PackingModeSwitch from "./components/controls/PackingModeSwitch.vue";
import ProgressControl from "./components/controls/ProgressControl.vue";
import SingleSkuForm from "./components/controls/SingleSkuForm.vue";
import SkuEditor from "./components/controls/SkuEditor.vue";
import Cargo3DPlaceholder from "./components/visualizations/Cargo3DPlaceholder.vue";
import Plan2DView from "./components/visualizations/Plan2DView.vue";
import ResultSummary from "./components/results/ResultSummary.vue";
import SkuBreakdown from "./components/results/SkuBreakdown.vue";
import BlockingTaskOverlay from "./components/ui/BlockingTaskOverlay.vue";
import ThemeModeControl from "./components/ui/ThemeModeControl.vue";
import { usePackingStore } from "./stores/packingStore";

const BatchImportDialog = defineAsyncComponent(() => import("./components/controls/BatchImportDialog.vue"));
const Cargo3DView = defineAsyncComponent({
  loader: () => import("./components/visualizations/Cargo3DView.vue"),
  loadingComponent: Cargo3DPlaceholder,
  delay: 0,
});

const store = usePackingStore();
type StatusTone = "idle" | "dirty" | "success" | "empty" | "error";

const statusToneByLabel: Record<string, StatusTone> = {
  待计算: "idle",
  待重新计算: "dirty",
  已取消计算: "dirty",
  已完成计算: "success",
  无法装载: "empty",
  计算失败: "error",
};

const statusChipClass = computed(() => `status-chip--${statusToneByLabel[store.status] ?? "idle"}`);
const calculationDescription = computed(() =>
  store.mode === "single" ? "正在计算单 SKU 的最大装载量与排布。" : "正在计算多 SKU 的装载顺序与排布。",
);

async function handleCalculate() {
  if (store.isCalculating) {
    store.cancelCalculation();
    return;
  }
  await store.calculate();
}
</script>

<template>
  <main class="app-shell" :aria-busy="store.isCalculating">
    <aside class="control-panel">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">
          <Boxes :size="22" :stroke-width="2.25" />
        </span>
        <div>
          <h1>智能装柜助手</h1>
          <p>纸箱装载量与排布可视化</p>
        </div>
        <ThemeModeControl />
      </div>

      <ResultSummary section="overview" />
      <button
        class="calculate-button"
        :class="{ 'calculate-button--loading': store.isCalculating }"
        type="button"
        :aria-busy="store.isCalculating"
        @click="handleCalculate"
      >
        <X v-if="store.isCalculating" :size="17" :stroke-width="2.45" aria-hidden="true" />
        <Calculator v-else :size="17" :stroke-width="2.35" aria-hidden="true" />
        {{ store.isCalculating ? "取消计算" : "计算装载" }}
      </button>
      <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>

      <ContainerForm />
      <PackingModeSwitch />
      <SingleSkuForm v-if="store.mode === 'single'" />
      <SkuEditor v-else />

      <ResultSummary section="details" />
      <BatchImportDialog />
      <SkuBreakdown />
    </aside>

    <section class="workbench" aria-label="装柜可视化">
      <header class="top-strip">
        <div class="status-line">
          <span id="status-chip" :class="statusChipClass" aria-live="polite">{{ store.status }}</span>
          <strong id="progress-text">{{ store.progressText }}</strong>
        </div>
        <ProgressControl />
      </header>
      <div class="views-grid">
        <Plan2DView />
        <Cargo3DView v-if="store.result" />
        <Cargo3DPlaceholder v-else />
      </div>
    </section>
  </main>

  <BlockingTaskOverlay
    :open="store.isCalculating"
    title="正在计算装载方案"
    :description="calculationDescription"
    status-label="正在生成最优排布"
    status-detail="算法正在尝试可用朝向与装载组合，请稍候。"
    cancel-label="取消计算"
    @cancel="store.cancelCalculation"
  />
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
  gap: 18px;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  padding: 18px;
}

.control-panel,
.workbench {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--panel-shadow);
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  contain: layout paint;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px;
  scrollbar-gutter: stable;
}

.brand-lockup {
  display: flex;
  gap: 12px;
  align-items: center;
}

.brand-lockup > div {
  min-width: 0;
  margin-right: auto;
}

.brand-mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 8px;
  border: 1px solid rgba(66, 214, 164, 0.34);
  background: linear-gradient(180deg, rgba(66, 214, 164, 0.18), rgba(104, 166, 255, 0.08));
  color: var(--accent);
}

h1,
p {
  margin: 0;
}

h1 {
  font-size: 26px;
  line-height: 1.1;
  white-space: nowrap;
}

p {
  color: var(--muted);
}

.calculate-button {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border: 1px solid var(--primary-button-border);
  border-radius: 8px;
  background: var(--primary-button-bg);
  color: var(--primary-button-text);
  font-weight: 900;
  box-shadow: var(--primary-button-shadow);
}

.calculate-button:not(:disabled):hover {
  border-color: var(--primary-button-border-hover);
  background: var(--primary-button-bg-hover);
  box-shadow: var(--primary-button-shadow-hover);
}

.calculate-button:not(:disabled):active {
  background: var(--primary-button-bg-active);
  box-shadow: var(--primary-button-shadow-active);
}

.calculate-button--loading {
  border-color: var(--primary-button-border);
  background: var(--primary-button-bg);
  box-shadow: var(--primary-button-shadow);
}

.error {
  color: var(--danger);
  font-weight: 800;
}

.workbench {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  overflow: hidden;
  padding: 14px;
}

.top-strip {
  display: grid;
  grid-template-columns: 252px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.status-line {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  width: 252px;
  min-width: 0;
}

#status-chip {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  justify-content: center;
  width: 104px;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--status-chip-border);
  border-radius: 6px;
  background: var(--status-chip-bg);
  color: var(--status-chip-color);
  font-size: 13px;
  font-weight: 900;
  text-align: center;
  box-shadow: inset 0 0 0 1px var(--status-chip-ring);
}

#progress-text {
  min-width: 0;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

#status-chip::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 12px currentColor;
  opacity: 0.86;
}

.status-chip--idle {
  --status-chip-bg: rgba(161, 175, 192, 0.1);
  --status-chip-border: rgba(161, 175, 192, 0.28);
  --status-chip-color: var(--muted);
  --status-chip-ring: rgba(161, 175, 192, 0.08);
}

.status-chip--dirty {
  --status-chip-bg: rgba(217, 166, 79, 0.14);
  --status-chip-border: rgba(217, 166, 79, 0.46);
  --status-chip-color: var(--warning-text);
  --status-chip-ring: rgba(217, 166, 79, 0.1);
}

.status-chip--success {
  --status-chip-bg: rgba(66, 214, 164, 0.13);
  --status-chip-border: rgba(66, 214, 164, 0.5);
  --status-chip-color: var(--accent);
  --status-chip-ring: rgba(66, 214, 164, 0.12);
}

.status-chip--empty {
  --status-chip-bg: rgba(104, 166, 255, 0.12);
  --status-chip-border: rgba(104, 166, 255, 0.43);
  --status-chip-color: var(--blue-text);
  --status-chip-ring: rgba(104, 166, 255, 0.1);
}

.status-chip--error {
  --status-chip-bg: rgba(240, 120, 120, 0.13);
  --status-chip-border: rgba(240, 120, 120, 0.48);
  --status-chip-color: var(--danger-text);
  --status-chip-ring: rgba(240, 120, 120, 0.1);
}

.views-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: minmax(360px, 1.18fr) minmax(220px, 0.82fr);
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: contain;
}

.view-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--panel-strong);
}

.view-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}

.view-panel h2 {
  margin: 0;
  color: var(--text);
  font-size: 17px;
}

.view-panel span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 1180px) {
  .app-shell {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  .control-panel {
    overflow: visible;
  }

  .workbench {
    min-height: 0;
  }

  .views-grid {
    grid-template-columns: 1fr;
    grid-template-rows: clamp(420px, 58dvh, 640px) clamp(300px, 38dvh, 420px);
    height: auto;
    overflow: visible;
  }
}

@media (max-width: 560px) {
  .top-strip {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .status-line {
    width: 100%;
    grid-template-columns: 104px minmax(0, 1fr);
  }
}

@media (max-width: 460px) {
  .brand-lockup {
    gap: 9px;
  }

  .brand-mark {
    width: 38px;
    height: 38px;
  }

  h1 {
    font-size: 22px;
  }

  .brand-lockup :deep(.theme-mode-trigger span) {
    display: none;
  }
}
</style>
