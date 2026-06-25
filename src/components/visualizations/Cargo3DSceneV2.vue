<script setup lang="ts">
import { computed } from "vue";
import { TresCanvas } from "@tresjs/core";
import { OrbitControls } from "@tresjs/cientos";
import { generateBoxPositions, type BoxPosition, type PackingResult } from "../../core/packing";
import { toSceneBox } from "../../renderers/cargoSceneModel";

const props = defineProps<{
  result: PackingResult | null;
  visibleCount: number;
}>();

const sceneBoxes = computed(() => {
  const result = props.result;
  if (!result?.pattern) return [];
  const visibleCount = Math.min(props.visibleCount, result.totalBoxes);
  return (generateBoxPositions(result, visibleCount) as BoxPosition[]).map((box) => toSceneBox(box, result.container));
});
</script>

<template>
  <TresCanvas id="scene-canvas" class="cargo-scene-v2-canvas" clear-color="#071016" :window-size="false">
    <TresPerspectiveCamera :position="[9.8, 5.7, 9.6]" :look-at="[0, -0.2, 0]" :fov="48" />
    <OrbitControls :enable-zoom="false" />
    <TresAmbientLight :intensity="0.72" />
    <TresDirectionalLight :position="[5, 8, 6]" :intensity="1.18" />
    <TresDirectionalLight :position="[-4, 3, -5]" :intensity="0.4" color="#42d6a4" />

    <TresMesh
      v-for="box in sceneBoxes"
      :key="box.key"
      :position="box.position"
      :scale="box.scale"
    >
      <TresBoxGeometry />
      <TresMeshBasicMaterial :color="box.color" />
    </TresMesh>
  </TresCanvas>
</template>

<style scoped>
.cargo-scene-v2-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: rgba(3, 8, 14, 0.72);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
</style>
