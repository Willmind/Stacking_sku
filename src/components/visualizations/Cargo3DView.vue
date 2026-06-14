<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createCargoScene, type CargoScene } from "../../renderers/cargo3d";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let cargoScene: CargoScene | null = null;
let resizeObserver: ResizeObserver | null = null;

function render() {
  cargoScene?.render(store.result, store.visibleCount);
}

onMounted(() => {
  if (!canvasRef.value) return;
  cargoScene = createCargoScene(canvasRef.value);
  cargoScene.render(store.result, store.visibleCount);
  resizeObserver = new ResizeObserver(() => cargoScene?.resize());
  resizeObserver.observe(canvasRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  cargoScene?.dispose();
  cargoScene = null;
});

watch(
  () => [store.result, store.visibleCount],
  () => render(),
  { deep: true },
);
</script>

<template>
  <article class="view-panel three-d-panel">
    <header>
      <h2>3D 货柜渲染</h2>
      <span>透视图</span>
    </header>
    <canvas id="scene-canvas" ref="canvasRef" width="980" height="620"></canvas>
    <span class="door-marker" aria-hidden="true">柜门</span>
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
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
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

canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: rgba(3, 8, 14, 0.72);
  cursor: grab;
}

.door-marker {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid rgba(87, 227, 188, 0.72);
  border-radius: 8px;
  background: rgba(3, 8, 14, 0.76);
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
  pointer-events: none;
}

.door-marker::before {
  content: "";
  width: 10px;
  height: 10px;
  border: 2px solid var(--accent);
  border-radius: 2px;
}
</style>
