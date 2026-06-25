<script setup lang="ts">
import { Maximize2 } from "@lucide/vue";
import { computed, ref } from "vue";
import { usePackingStore } from "../../stores/packingStore";
import CoordinateDialog from "../results/CoordinateDialog.vue";
import Cargo3DSceneV2 from "./Cargo3DSceneV2.vue";
import VisualizationDialog from "./VisualizationDialog.vue";

const store = usePackingStore();
const isExpanded = ref(false);

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

const expandedSceneSubtitle = computed(() => {
  const result = store.result;
  if (!result?.pattern) return "等待计算";
  return `当前显示 · ${formatNumber(Math.min(result.totalBoxes, store.visibleCount))} / ${formatNumber(result.totalBoxes)} 箱`;
});

function openExpandedScene() {
  isExpanded.value = true;
}

function closeExpandedScene() {
  isExpanded.value = false;
}
</script>

<template>
  <article class="view-panel three-d-panel">
    <header>
      <div>
        <h2>3D 货柜渲染</h2>
        <span>透视图</span>
      </div>
      <div class="view-actions">
        <CoordinateDialog />
        <button
          class="view-expand-button"
          type="button"
          aria-label="放大 3D 货柜渲染"
          title="放大 3D 货柜渲染"
          @click="openExpandedScene"
        >
          <Maximize2 :size="15" :stroke-width="2.3" aria-hidden="true" />
        </button>
      </div>
    </header>
    <div class="cargo-scene-shell">
      <Cargo3DSceneV2 canvas-id="scene-canvas" :result="store.result" :visible-count="store.visibleCount" />
    </div>

    <VisualizationDialog
      :open="isExpanded"
      title="3D 货柜渲染"
      :subtitle="expandedSceneSubtitle"
      @close="closeExpandedScene"
    >
      <div class="expanded-scene-shell">
        <Cargo3DSceneV2
          canvas-id="expanded-scene-canvas"
          :result="store.result"
          :visible-count="store.visibleCount"
        />
      </div>
    </VisualizationDialog>
  </article>
</template>

<style scoped>
.view-panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--panel-strong);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}

header div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.view-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

h2 {
  margin: 0;
  color: var(--text);
  font-size: 17px;
}

span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.view-expand-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--muted);
}

.view-expand-button:hover {
  border-color: rgba(66, 214, 164, 0.45);
  background: rgba(66, 214, 164, 0.1);
  color: var(--accent);
}

.view-expand-button:active {
  transform: translateY(1px);
}

.view-expand-button:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.cargo-scene-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: rgba(3, 8, 14, 0.72);
}

canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: rgba(3, 8, 14, 0.72);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.expanded-scene-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
