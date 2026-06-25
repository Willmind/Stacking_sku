<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch, type CSSProperties } from "vue";
import { TresCanvas, type TresContext } from "@tresjs/core";
import { OrbitControls } from "@tresjs/cientos";
import * as THREE from "three";
import { generateBoxPositions, type BoxPosition, type PackingResult } from "../../core/packing";
import { getCargoCoordinateAxes, getSelectedCargoPosition } from "../../renderers/cargo3d";
import { toSceneBox, toSceneContainer, type SceneLabelModel } from "../../renderers/cargoSceneModel";

const props = withDefaults(defineProps<{
  result: PackingResult | null;
  visibleCount: number;
  canvasId?: string;
  selectedLoadingSequence?: number | null;
  selectedLabel?: string;
  showCoordinateAxes?: boolean;
}>(), {
  canvasId: "scene-canvas",
  selectedLoadingSequence: null,
  selectedLabel: "",
  showCoordinateAxes: false,
});

const DoubleSide = THREE.DoubleSide;
const floorRotation: [number, number, number] = [-Math.PI / 2, 0, 0];
const overlayGroup = shallowRef(new THREE.Group());
const sceneRootRef = ref<HTMLElement | null>(null);
const tresContext = shallowRef<TresContext | null>(null);
let projectionAnimationFrame = 0;

interface ProjectionLabelAnchor {
  key: string;
  text: string;
  color: string;
  position: [number, number, number];
  variant: "endpoint" | "axis" | "selected";
}

interface ProjectionLabelViewModel extends ProjectionLabelAnchor {
  style: CSSProperties;
  visible: boolean;
}

const visiblePositions = computed(() => {
  const result = props.result;
  if (!result?.pattern) return [];
  const visibleCount = Math.min(props.visibleCount, result.totalBoxes);
  return generateBoxPositions(result, visibleCount) as BoxPosition[];
});

const sceneBoxes = computed(() => {
  const result = props.result;
  if (!result?.pattern) return [];
  return visiblePositions.value.map((box) => toSceneBox(box, result.container));
});

const sceneContainer = computed(() => {
  const result = props.result;
  if (!result?.pattern) return null;
  return toSceneContainer(result);
});

const selectedSceneBox = computed(() => {
  const result = props.result;
  if (!result?.pattern) return null;
  const selectedBox = getSelectedCargoPosition(visiblePositions.value, props.selectedLoadingSequence);
  return selectedBox ? toSceneBox(selectedBox, result.container) : null;
});

const selectedHighlight = computed(() => {
  const box = selectedSceneBox.value;
  if (!box) return null;
  return {
    ...box,
    scale: box.scale.map((value) => Math.max(value * 1.018, 0.001)) as [number, number, number],
  };
});

const coordinateAxisLabels = computed<ProjectionLabelAnchor[]>(() => {
  if (!props.showCoordinateAxes || !props.result?.pattern) return [];
  return getCargoCoordinateAxes(props.result.container).map((axis) => ({
    key: `coordinate-axis-${axis.label}-label`,
    text: axis.label,
    color: axis.color,
    position: axis.labelPosition,
    variant: "axis",
  }));
});

const selectedProjectionLabel = computed<ProjectionLabelAnchor | null>(() => {
  const box = selectedSceneBox.value;
  if (!box || !props.selectedLabel) return null;
  return {
    key: "selected-box-label",
    text: props.selectedLabel,
    color: "#6efcff",
    position: [box.position[0], box.position[1] + box.scale[1] / 2 + 0.26, box.position[2]],
    variant: "selected",
  };
});

function toProjectionAnchor(label: SceneLabelModel): ProjectionLabelAnchor {
  return {
    key: label.key,
    text: label.text,
    color: label.color,
    position: label.position,
    variant: "endpoint",
  };
}

const projectionLabelAnchors = computed<ProjectionLabelAnchor[]>(() => {
  const labels: ProjectionLabelAnchor[] = [];
  const container = sceneContainer.value;
  if (container) labels.push(...container.endpointLabels.map(toProjectionAnchor));
  labels.push(...coordinateAxisLabels.value);
  const selected = selectedProjectionLabel.value;
  if (selected) labels.push(selected);
  return labels;
});

const projectionLabels = shallowRef<ProjectionLabelViewModel[]>([]);

function disposeMaterial(material: THREE.Material) {
  const texture = "map" in material ? material.map : null;
  if (texture instanceof THREE.Texture) texture.dispose();
  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial);
    } else if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

function clearOverlayGroup() {
  while (overlayGroup.value.children.length) {
    const child = overlayGroup.value.children.pop();
    if (!child) continue;
    disposeObject(child);
  }
}

function addCoordinateAxes(group: THREE.Group, result: PackingResult) {
  const upVector = new THREE.Vector3(0, 1, 0);

  for (const axis of getCargoCoordinateAxes(result.container)) {
    const start = new THREE.Vector3(...axis.start);
    const end = new THREE.Vector3(...axis.end);
    const direction = end.clone().sub(start).normalize();
    const axisLength = start.distanceTo(end);
    const coneHeight = Math.min(0.22, Math.max(0.11, axisLength * 0.16));
    const coneRadius = coneHeight * 0.34;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, end]),
      new THREE.LineBasicMaterial({
        color: axis.colorHex,
        transparent: true,
        opacity: 1,
        depthTest: false,
      }),
    );
    line.name = `coordinate-axis-${axis.label}`;
    line.renderOrder = 41;

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 20),
      new THREE.MeshBasicMaterial({
        color: axis.colorHex,
        transparent: true,
        opacity: 0.96,
        depthTest: false,
        depthWrite: false,
      }),
    );
    cone.name = `coordinate-axis-${axis.label}-arrow`;
    cone.position.copy(end);
    cone.quaternion.setFromUnitVectors(upVector, direction);
    cone.renderOrder = 42;
    group.add(line, cone);
  }
}

function rebuildOverlayGroup() {
  clearOverlayGroup();
  const group = overlayGroup.value;
  if (props.showCoordinateAxes && props.result?.pattern) addCoordinateAxes(group, props.result);
}

function getProjectionSize() {
  const context = tresContext.value;
  const rootRect = sceneRootRef.value?.getBoundingClientRect();
  const width = context?.sizes.width.value || rootRect?.width || 0;
  const height = context?.sizes.height.value || rootRect?.height || 0;
  return { width, height };
}

function projectLabel(anchor: ProjectionLabelAnchor): ProjectionLabelViewModel {
  const context = tresContext.value;
  const camera = context?.camera.activeCamera.value;
  const { width, height } = getProjectionSize();
  if (!camera || width <= 0 || height <= 0) {
    return {
      ...anchor,
      visible: false,
      style: {
        "--projection-label-color": anchor.color,
        transform: "translate3d(-9999px, -9999px, 0)",
      } as CSSProperties,
    };
  }

  camera.updateMatrixWorld();
  const projected = new THREE.Vector3(...anchor.position).project(camera);
  const left = (projected.x * 0.5 + 0.5) * width;
  const top = (-projected.y * 0.5 + 0.5) * height;
  const visible = projected.z >= -1 && projected.z <= 1;

  return {
    ...anchor,
    visible,
    style: {
      "--projection-label-color": anchor.color,
      transform: `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) translate(-50%, -50%)`,
    } as CSSProperties,
  };
}

function updateProjectionLabels() {
  projectionLabels.value = projectionLabelAnchors.value.map(projectLabel);
}

function scheduleProjectionUpdate() {
  if (typeof window === "undefined" || projectionAnimationFrame) return;
  const tick = () => {
    updateProjectionLabels();
    projectionAnimationFrame = window.requestAnimationFrame(tick);
  };
  projectionAnimationFrame = window.requestAnimationFrame(tick);
}

function stopProjectionUpdate() {
  if (typeof window === "undefined" || !projectionAnimationFrame) return;
  window.cancelAnimationFrame(projectionAnimationFrame);
  projectionAnimationFrame = 0;
}

function onTresReady(context: TresContext) {
  tresContext.value = context;
  updateProjectionLabels();
  scheduleProjectionUpdate();
}

watch(
  [() => props.showCoordinateAxes, () => props.result],
  () => rebuildOverlayGroup(),
  { immediate: true },
);

watch(projectionLabelAnchors, updateProjectionLabels, { immediate: true });

onBeforeUnmount(() => {
  stopProjectionUpdate();
  clearOverlayGroup();
});
</script>

<template>
  <div ref="sceneRootRef" class="cargo-scene-v2">
    <TresCanvas
      :id="canvasId"
      class="cargo-scene-v2-canvas"
      clear-color="#071016"
      :window-size="false"
      @ready="onTresReady"
    >
      <TresPerspectiveCamera :position="[9.8, 5.7, 9.6]" :look-at="[0, -0.2, 0]" :fov="48" />
      <OrbitControls :enable-zoom="true" :zoom-speed="0.84" />
      <TresAmbientLight :intensity="0.72" />
      <TresDirectionalLight :position="[5, 8, 6]" :intensity="1.18" />
      <TresDirectionalLight :position="[-4, 3, -5]" :intensity="0.4" color="#42d6a4" />

      <template v-if="sceneContainer">
        <TresMesh name="container-floor" :position="sceneContainer.floorPosition" :rotation="floorRotation">
          <TresPlaneGeometry :args="sceneContainer.floorSize" />
          <TresMeshBasicMaterial color="#172a30" :transparent="true" :opacity="0.78" :side="DoubleSide" />
        </TresMesh>

        <TresMesh
          v-for="surface in sceneContainer.endpointSurfaces"
          :key="`${surface.key}-face`"
          name="endpoint-surface"
          :position="surface.position"
          :rotation="surface.rotation"
        >
          <TresPlaneGeometry :args="surface.size" />
          <TresMeshBasicMaterial
            :color="surface.color"
            :transparent="true"
            :opacity="surface.opacity"
            :side="DoubleSide"
            :depth-write="false"
          />
        </TresMesh>

        <TresMesh
          v-for="surface in sceneContainer.endpointSurfaces"
          :key="`${surface.key}-edge`"
          name="endpoint-surface-edge"
          :position="surface.position"
          :rotation="surface.rotation"
        >
          <TresPlaneGeometry :args="surface.size" />
          <TresMeshBasicMaterial
            :color="surface.color"
            :wireframe="true"
            :transparent="true"
            :opacity="0.95"
            :depth-test="false"
            :depth-write="false"
          />
        </TresMesh>

        <TresMesh name="container-shell" :scale="sceneContainer.scale">
          <TresBoxGeometry />
          <TresMeshBasicMaterial
            color="#42d6a4"
            :transparent="true"
            :opacity="0.015"
            :side="DoubleSide"
            :depth-write="false"
          />
        </TresMesh>

        <TresMesh name="container-shell-edge" :scale="sceneContainer.scale">
          <TresBoxGeometry />
          <TresMeshBasicMaterial color="#e7f8f5" :wireframe="true" :transparent="true" :opacity="0.72" />
        </TresMesh>

        <TresMesh
          v-if="sceneContainer.effectiveFrame"
          name="effective-space-frame"
          :position="sceneContainer.effectiveFrame.position"
          :scale="sceneContainer.effectiveFrame.scale"
        >
          <TresBoxGeometry />
          <TresMeshBasicMaterial
            color="#42d6a4"
            :wireframe="true"
            :transparent="true"
            :opacity="0.92"
            :depth-test="false"
            :depth-write="false"
          />
        </TresMesh>

        <template v-for="block in sceneContainer.cornerBlocks" :key="block.key">
          <TresMesh name="corner-block" :position="block.position" :scale="block.scale">
            <TresBoxGeometry />
            <TresMeshBasicMaterial color="#ff7066" :transparent="true" :opacity="0.58" />
          </TresMesh>
          <TresMesh name="corner-block-edge" :position="block.position" :scale="block.scale">
            <TresBoxGeometry />
            <TresMeshBasicMaterial color="#050505" :wireframe="true" />
          </TresMesh>
        </template>
      </template>

      <TresMesh
        v-for="box in sceneBoxes"
        :key="`${box.key}-face`"
        name="cargo-box"
        :position="box.position"
        :scale="box.scale"
      >
        <TresBoxGeometry />
        <TresMeshBasicMaterial :color="box.color" :side="DoubleSide" />
      </TresMesh>

      <TresMesh
        v-if="selectedHighlight"
        name="selected-box-highlight"
        :position="selectedHighlight.position"
        :scale="selectedHighlight.scale"
      >
        <TresBoxGeometry />
        <TresMeshBasicMaterial
          color="#6efcff"
          :transparent="true"
          :opacity="0.22"
          :depth-write="false"
        />
      </TresMesh>

      <TresMesh
        v-if="selectedHighlight"
        name="selected-box-edge"
        :position="selectedHighlight.position"
        :scale="selectedHighlight.scale"
      >
        <TresBoxGeometry />
        <TresMeshBasicMaterial
          color="#6efcff"
          :wireframe="true"
          :transparent="true"
          :opacity="1"
          :depth-test="false"
        />
      </TresMesh>

      <TresMesh
        v-for="box in sceneBoxes"
        :key="`${box.key}-edge`"
        name="box-edge"
        :position="box.position"
        :scale="box.scale"
      >
        <TresBoxGeometry />
        <TresMeshBasicMaterial
          color="#b8fff0"
          :wireframe="true"
          :transparent="true"
          :opacity="0.08"
          :depth-write="false"
        />
      </TresMesh>

      <primitive :object="overlayGroup" />
    </TresCanvas>

    <div class="projection-label-layer" aria-hidden="true">
      <span
        v-for="label in projectionLabels"
        :key="label.key"
        class="projection-label"
        :class="`projection-label--${label.variant}`"
        :data-visible="label.visible"
        :style="label.style"
      >
        {{ label.text }}
      </span>
    </div>

    <div v-if="sceneContainer" class="endpoint-legend" aria-label="3D 货柜端点图例">
      <span v-for="item in sceneContainer.endpointLegend" :key="item.key" class="endpoint-legend__item">
        <span class="endpoint-legend__swatch" :style="{ backgroundColor: item.color }"></span>
        <span>{{ item.label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cargo-scene-v2 {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: rgba(3, 8, 14, 0.72);
}

.cargo-scene-v2-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: rgba(3, 8, 14, 0.72);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.projection-label-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.projection-label {
  position: absolute;
  left: 0;
  top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--projection-label-color) 86%, transparent);
  border-radius: 6px;
  background: rgba(6, 11, 17, 0.76);
  color: var(--projection-label-color);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
  white-space: nowrap;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.26);
  will-change: transform;
}

.projection-label[data-visible="false"] {
  display: none;
}

.projection-label--axis {
  min-width: 24px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 999px;
  background: rgba(6, 11, 17, 0.82);
  font-size: 12px;
}

.projection-label--selected {
  min-width: 32px;
  border-color: rgba(110, 252, 255, 0.92);
  background: rgba(2, 38, 46, 0.84);
  color: #d9ffff;
}

.endpoint-legend {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 4;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 7px 9px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 7px;
  background: rgba(7, 13, 20, 0.78);
  color: #d8e3ec;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.endpoint-legend__item {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  white-space: nowrap;
}

.endpoint-legend__swatch {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 2px;
}
</style>
