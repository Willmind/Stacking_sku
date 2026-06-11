<script setup lang="ts">
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
          <p>Vue 迁移版保持旧版功能等价</p>
        </div>
      </div>

      <section class="field-group" aria-label="集装箱规格">
        <h2>集装箱规格</h2>
        <label>
          柜型
          <select
            id="container-type"
            :value="store.containerType"
            @change="store.setContainerType(($event.target as HTMLSelectElement).value)"
          >
            <option value="20GP">20GP</option>
            <option value="40GP">40GP</option>
            <option value="40HQ">40HQ</option>
          </select>
        </label>
        <div class="triple-grid">
          <label>
            长 mm
            <input v-model.number="store.container.length" type="number" min="1" step="1" @input="store.markDirty" />
          </label>
          <label>
            宽 mm
            <input v-model.number="store.container.width" type="number" min="1" step="1" @input="store.markDirty" />
          </label>
          <label>
            高 mm
            <input v-model.number="store.container.height" type="number" min="1" step="1" @input="store.markDirty" />
          </label>
        </div>
      </section>

      <section class="field-group" aria-label="纸箱规格">
        <h2>纸箱规格</h2>
        <div class="triple-grid">
          <label>
            长 mm
            <input
              id="carton-length"
              v-model.number="store.singleCarton.length"
              type="number"
              min="1"
              step="1"
              @input="store.markDirty"
            />
          </label>
          <label>
            宽 mm
            <input
              id="carton-width"
              v-model.number="store.singleCarton.width"
              type="number"
              min="1"
              step="1"
              @input="store.markDirty"
            />
          </label>
          <label>
            高 mm
            <input
              id="carton-height"
              v-model.number="store.singleCarton.height"
              type="number"
              min="1"
              step="1"
              @input="store.markDirty"
            />
          </label>
        </div>
      </section>

      <button class="calculate-button" type="button" @click="store.calculate">计算装载</button>
      <p v-if="store.error" class="error">{{ store.error }}</p>

      <section class="summary-card" aria-label="装载结果">
        <span>最大装载量</span>
        <strong id="total-boxes">{{ store.totalBoxesText }}</strong>
        <small>cartons</small>
      </section>
    </aside>

    <section class="workbench" aria-label="装柜可视化">
      <header class="top-strip">
        <span id="status-chip">{{ store.status }}</span>
        <strong id="progress-text">{{ store.progressText }}</strong>
      </header>
      <div class="views-grid">
        <article class="view-panel">
          <header>
            <h2>2D 平面排布</h2>
            <span>待迁移</span>
          </header>
        </article>
        <article class="view-panel">
          <header>
            <h2>3D 货柜渲染</h2>
            <span>待迁移</span>
          </header>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
}

.control-panel,
.workbench {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
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
h2,
p {
  margin: 0;
}

h1 {
  font-size: 26px;
  line-height: 1.1;
}

h2 {
  color: var(--accent);
  font-size: 14px;
}

p,
label,
small {
  color: var(--muted);
}

.field-group {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
}

label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
}

input,
select {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font-weight: 800;
  padding: 0 12px;
}

.triple-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
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

.summary-card {
  display: grid;
  gap: 4px;
  padding: 16px;
  border: 1px solid rgba(66, 214, 164, 0.35);
  border-radius: 8px;
  background: rgba(66, 214, 164, 0.1);
}

.summary-card strong {
  color: var(--accent);
  font-size: 58px;
  line-height: 0.95;
}

.workbench {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
}

.top-strip {
  display: flex;
  gap: 18px;
  align-items: center;
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
  min-height: 0;
}

.view-panel {
  min-height: 560px;
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
  }
}
</style>
