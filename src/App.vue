<script setup lang="ts">
import { Boxes, Calculator, LoaderCircle } from "@lucide/vue";
import { computed, nextTick, ref } from "vue";
import BatchImportDialog from "./components/controls/BatchImportDialog.vue";
import ContainerForm from "./components/controls/ContainerForm.vue";
import PackingModeSwitch from "./components/controls/PackingModeSwitch.vue";
import ProgressControl from "./components/controls/ProgressControl.vue";
import SingleSkuForm from "./components/controls/SingleSkuForm.vue";
import SkuEditor from "./components/controls/SkuEditor.vue";
import Cargo3DView from "./components/visualizations/Cargo3DView.vue";
import Plan2DView from "./components/visualizations/Plan2DView.vue";
import ResultSummary from "./components/results/ResultSummary.vue";
import SkuBreakdown from "./components/results/SkuBreakdown.vue";
import { usePackingStore } from "./stores/packingStore";

const store = usePackingStore();
type StatusTone = "idle" | "dirty" | "success" | "empty" | "error";

const statusToneByLabel: Record<string, StatusTone> = {
  待计算: "idle",
  待重新计算: "dirty",
  已完成计算: "success",
  无法装载: "empty",
  计算失败: "error",
};

const statusChipClass = computed(() => `status-chip--${statusToneByLabel[store.status] ?? "idle"}`);
const isCalculating = ref(false);

async function handleCalculate() {
  if (isCalculating.value) return;
  isCalculating.value = true;
  await nextTick();
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  try {
    store.calculate();
  } finally {
    isCalculating.value = false;
  }
}
</script>

<template>
  <main class="app-shell">
    <aside class="control-panel">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">
          <Boxes :size="22" :stroke-width="2.25" />
        </span>
        <div>
          <h1>智能装柜助手</h1>
          <p>纸箱装载量与排布可视化</p>
        </div>
      </div>

      <ResultSummary section="overview" />
      <button
        class="calculate-button"
        :class="{ 'calculate-button--loading': isCalculating }"
        type="button"
        :disabled="isCalculating"
        :aria-busy="isCalculating"
        @click="handleCalculate"
      >
        <LoaderCircle
          v-if="isCalculating"
          class="calculate-button__spinner"
          :size="17"
          :stroke-width="2.45"
          aria-hidden="true"
        />
        <Calculator v-else :size="17" :stroke-width="2.35" aria-hidden="true" />
        {{ isCalculating ? "计算中" : "计算装载" }}
      </button>
      <p v-if="store.error" class="error">{{ store.error }}</p>

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
        <Cargo3DView />
      </div>
    </section>
  </main>
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
  border: 1px solid rgba(66, 214, 164, 0.54);
  border-radius: 8px;
  background: linear-gradient(180deg, #52e0b5, var(--accent-strong));
  color: #04110d;
  font-weight: 900;
  box-shadow: 0 16px 34px rgba(47, 189, 148, 0.2);
}

.calculate-button:not(:disabled):hover {
  border-color: rgba(92, 237, 193, 0.82);
  background: linear-gradient(180deg, #68e8c2, #35cba0);
  box-shadow: 0 18px 40px rgba(47, 189, 148, 0.26);
}

.calculate-button:not(:disabled):active {
  background: linear-gradient(180deg, #35cba0, #279e7d);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.24);
}

.calculate-button:disabled {
  cursor: wait;
}

.calculate-button--loading {
  border-color: rgba(92, 237, 193, 0.72);
  background: linear-gradient(180deg, #55dfb7, #31c59b);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    0 16px 34px rgba(47, 189, 148, 0.2);
}

.calculate-button__spinner {
  animation: calculate-spin 0.86s linear infinite;
}

@keyframes calculate-spin {
  to {
    transform: rotate(360deg);
  }
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
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.status-line {
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

#status-chip {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  justify-content: center;
  min-width: 96px;
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
  --status-chip-color: #f0bc68;
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
  --status-chip-color: #8dbdff;
  --status-chip-ring: rgba(104, 166, 255, 0.1);
}

.status-chip--error {
  --status-chip-bg: rgba(240, 120, 120, 0.13);
  --status-chip-border: rgba(240, 120, 120, 0.48);
  --status-chip-color: #ff8d8d;
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
</style>
