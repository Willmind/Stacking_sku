<script setup lang="ts">
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
</script>

<template>
  <main class="app-shell">
    <aside class="control-panel">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">▣</span>
        <div>
          <h1>智能装柜助手</h1>
          <p>纸箱装载量与排布可视化</p>
        </div>
      </div>

      <ContainerForm />
      <PackingModeSwitch />
      <SingleSkuForm v-if="store.mode === 'single'" />
      <SkuEditor v-else />

      <button class="calculate-button" type="button" @click="store.calculate">计算装载</button>
      <p v-if="store.error" class="error">{{ store.error }}</p>

      <ResultSummary />
      <SkuBreakdown />
    </aside>

    <section class="workbench" aria-label="装柜可视化">
      <header class="top-strip">
        <div class="status-line">
          <span id="status-chip">{{ store.status }}</span>
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
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  background: linear-gradient(135deg, var(--accent), var(--warning));
  color: #071016;
  font-weight: 900;
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
  min-height: 48px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--warning));
  color: #071016;
  font-weight: 900;
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
  min-width: 90px;
  padding: 8px 12px;
  border: 1px solid rgba(66, 214, 164, 0.45);
  border-radius: 6px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}

.views-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  height: 100%;
  min-height: 0;
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
    min-height: 760px;
  }

  .views-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(520px, 1fr);
  }
}
</style>
