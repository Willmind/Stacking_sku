<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import { TresCanvas } from "@tresjs/core";
import { OrbitControls } from "@tresjs/cientos";
import * as THREE from "three";
import { generateBoxPositions, type BoxPosition, type PackingResult } from "../../core/packing";
import { getCargoCoordinateAxes, getSelectedCargoPosition } from "../../renderers/cargo3d";
import { toSceneBox, toSceneContainer, type SceneLabelModel } from "../../renderers/cargoSceneModel";
import { makeSpriteLabel } from "../../renderers/labels";

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

function addSpriteLabel(group: THREE.Group, label: SceneLabelModel) {
  if (typeof document === "undefined") return;
  const sprite = makeSpriteLabel(label.text, label.color, label.scale[0], label.scale[1]);
  sprite.name = label.key;
  sprite.position.set(...label.position);
  group.add(sprite);
}

function addSelectedSpriteLabel(group: THREE.Group) {
  const box = selectedSceneBox.value;
  if (!box || !props.selectedLabel || typeof document === "undefined") return;
  const labelWidth = Math.min(0.9, Math.max(0.34, box.scale[0] * 0.55));
  const labelHeight = Math.min(0.24, Math.max(0.14, labelWidth * 0.28));
  const sprite = makeSpriteLabel(props.selectedLabel, "#6efcff", labelWidth, labelHeight);
  sprite.name = "selected-box-label";
  sprite.position.set(box.position[0], box.position[1] + box.scale[1] / 2 + labelHeight * 1.2, box.position[2]);
  sprite.renderOrder = 34;
  group.add(sprite);
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

    if (typeof document !== "undefined") {
      const label = makeSpriteLabel(axis.label, axis.color, 0.26, 0.2);
      label.name = `coordinate-axis-${axis.label}-label`;
      label.position.set(...axis.labelPosition);
      label.renderOrder = 43;
      group.add(label);
    }
  }
}

function rebuildOverlayGroup() {
  clearOverlayGroup();
  const group = overlayGroup.value;
  const container = sceneContainer.value;
  if (container) container.endpointLabels.forEach((label) => addSpriteLabel(group, label));
  addSelectedSpriteLabel(group);
  if (props.showCoordinateAxes && props.result?.pattern) addCoordinateAxes(group, props.result);
}

watch(
  [sceneContainer, selectedSceneBox, () => props.selectedLabel, () => props.showCoordinateAxes],
  () => rebuildOverlayGroup(),
  { immediate: true },
);

onBeforeUnmount(clearOverlayGroup);
</script>

<template>
  <TresCanvas :id="canvasId" class="cargo-scene-v2-canvas" clear-color="#071016" :window-size="false">
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
