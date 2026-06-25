import * as THREE from "three";
import { generateBoxPositions, type BoxPosition, type PackingResult } from "../core/packing";
import { makeSpriteLabel } from "./labels";

export interface CargoScene {
  dispose(): void;
  render(result: PackingResult | null, visibleCount: number, options?: CargoRenderOptions): void;
  resize(): void;
}

export interface CargoRenderOptions {
  selectedLoadingSequence?: number | null;
  selectedLabel?: string;
  showCoordinateAxes?: boolean;
}

export interface CargoCoordinateAxis {
  label: "X" | "Y" | "Z";
  start: [number, number, number];
  end: [number, number, number];
  labelPosition: [number, number, number];
  color: string;
  colorHex: number;
}

export type CargoPointerDragMode = "pan" | "rotate";

export type CargoCameraDragState = {
  yaw: number;
  pitch: number;
  panX: number;
  panY: number;
};

const MAX_3D_BOXES = 4200;
const CARGO_YAW_DRAG_SPEED = 0.01;
const CARGO_PITCH_DRAG_SPEED = 0.006;
const CARGO_MIN_PITCH = -1.48;
const CARGO_MAX_PITCH = 1.48;
const CARGO_DEFAULT_YAW = -0.72;
const CARGO_DEFAULT_PITCH = 0.66;
const CARGO_DEFAULT_ZOOM = 0.9;
const CARGO_DEFAULT_PAN_Y = -8;
const CARGO_CAMERA_DISTANCE_FACTOR = 2;
const CARGO_CAMERA_PAN_SCALE_DIVISOR = 780;
const AXIS_MIN_LENGTH = 0.7;
const AXIS_MAX_LENGTH = 2.4;
const AXIS_LENGTH_RATIO = 0.36;

export function getCargoPointerDragMode(event: Pick<PointerEvent, "button" | "shiftKey">): CargoPointerDragMode {
  if (event.button === 2 || (event.button === 0 && event.shiftKey)) return "pan";
  return "rotate";
}

export function applyCargoCameraDrag(
  state: CargoCameraDragState,
  mode: CargoPointerDragMode,
  dx: number,
  dy: number,
): CargoCameraDragState {
  if (mode === "rotate") {
    return {
      ...state,
      yaw: state.yaw - dx * CARGO_YAW_DRAG_SPEED,
      pitch: Math.max(CARGO_MIN_PITCH, Math.min(CARGO_MAX_PITCH, state.pitch + dy * CARGO_PITCH_DRAG_SPEED)),
    };
  }
  return {
    ...state,
    panX: state.panX + dx,
    panY: state.panY + dy,
  };
}

export function getSelectedCargoPosition(
  positions: BoxPosition[],
  selectedLoadingSequence?: number | null,
): BoxPosition | null;
export function getSelectedCargoPosition<T extends Pick<BoxPosition, "sequenceIndex">>(
  positions: T[],
  selectedLoadingSequence?: number | null,
): T | null;
export function getSelectedCargoPosition<T extends Pick<BoxPosition, "sequenceIndex">>(
  positions: T[],
  selectedLoadingSequence?: number | null,
): T | null {
  if (!Number.isFinite(selectedLoadingSequence)) return null;
  return (
    positions.find((position) => {
      if (!Number.isFinite(position.sequenceIndex)) return false;
      return (position.sequenceIndex ?? -1) + 1 === selectedLoadingSequence;
    }) || null
  );
}

function roundSceneUnit(value: number) {
  return Math.round(value * 1000) / 1000;
}

function visibleAxisLength(sizeMm: number) {
  return roundSceneUnit(Math.min(AXIS_MAX_LENGTH, Math.max(AXIS_MIN_LENGTH, sizeMm * 0.001 * AXIS_LENGTH_RATIO)));
}

export function getCargoCoordinateAxes(container: Pick<PackingResult["container"], "length" | "width" | "height">) {
  const origin: [number, number, number] = [
    roundSceneUnit(-container.length * 0.0005),
    roundSceneUnit(-container.height * 0.0005),
    roundSceneUnit(-container.width * 0.0005),
  ];
  const xLength = visibleAxisLength(container.width);
  const yLength = visibleAxisLength(container.length);
  const zLength = visibleAxisLength(container.height);

  return [
    {
      label: "X",
      start: origin,
      end: [origin[0], origin[1], roundSceneUnit(origin[2] + xLength)] as [number, number, number],
      labelPosition: [origin[0], origin[1], roundSceneUnit(origin[2] + xLength + 0.18)] as [number, number, number],
      color: "#ff5b5b",
      colorHex: 0xff5b5b,
    },
    {
      label: "Y",
      start: origin,
      end: [roundSceneUnit(origin[0] + yLength), origin[1], origin[2]] as [number, number, number],
      labelPosition: [roundSceneUnit(origin[0] + yLength + 0.18), origin[1], origin[2]] as [number, number, number],
      color: "#42d6a4",
      colorHex: 0x42d6a4,
    },
    {
      label: "Z",
      start: origin,
      end: [origin[0], roundSceneUnit(origin[1] + zLength), origin[2]] as [number, number, number],
      labelPosition: [origin[0], roundSceneUnit(origin[1] + zLength + 0.18), origin[2]] as [number, number, number],
      color: "#68a6ff",
      colorHex: 0x68a6ff,
    },
  ] satisfies CargoCoordinateAxis[];
}

function colorForBox(box: BoxPosition) {
  return box.skuColor || "#d8923a";
}

function disposeThreeObject(object: THREE.Object3D) {
  object.children.forEach(disposeThreeObject);
  const mesh = object as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  const material = mesh.material;
  if (material) {
    const disposeMaterial = (item: THREE.Material) => {
      const maybeMapped = item as THREE.Material & { map?: THREE.Texture };
      maybeMapped.map?.dispose();
      item.dispose();
    };
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else disposeMaterial(material);
  }
}

function clearGroup(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child) disposeThreeObject(child);
  }
}

function addDoorMarker(group: THREE.Group, length: number, height: number, width: number) {
  const doorGeometry = new THREE.PlaneGeometry(width, height);
  const doorPlane = new THREE.Mesh(
    doorGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x42d6a4,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  doorPlane.rotation.y = Math.PI / 2;
  doorPlane.position.x = length / 2 + 0.006;
  doorPlane.renderOrder = 4;

  const doorEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(doorGeometry),
    new THREE.LineBasicMaterial({
      color: 0x57e3bc,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
    }),
  );
  doorEdges.rotation.copy(doorPlane.rotation);
  doorEdges.position.copy(doorPlane.position);
  doorEdges.renderOrder = 31;
  group.add(doorPlane, doorEdges);
}

function hasActiveClearance(result: PackingResult) {
  const clearance = result.clearance;
  return Boolean(
    clearance &&
      (clearance.front > 0 || clearance.rear > 0 || clearance.left > 0 || clearance.right > 0 || clearance.top > 0),
  );
}

function createEffectiveSpaceFrame(result: PackingResult) {
  if (!hasActiveClearance(result)) return null;
  const { container, clearance, effectiveContainer } = result;
  const length = effectiveContainer.length * 0.001;
  const height = effectiveContainer.height * 0.001;
  const width = effectiveContainer.width * 0.001;
  const frameGeometry = new THREE.BoxGeometry(length, height, width);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(frameGeometry),
    new THREE.LineBasicMaterial({
      color: 0x42d6a4,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    }),
  );

  frame.position.set(
    (clearance.front + effectiveContainer.length / 2 - container.length / 2) * 0.001,
    (effectiveContainer.height / 2 - container.height / 2) * 0.001,
    (clearance.left + effectiveContainer.width / 2 - container.width / 2) * 0.001,
  );
  frame.renderOrder = 32;

  const labelWidth = Math.min(1.6, Math.max(0.58, length * 0.2));
  const labelHeight = Math.min(0.36, Math.max(0.18, labelWidth * 0.24));
  const label = makeSpriteLabel("有效装载空间", "#42d6a4", labelWidth, labelHeight);
  label.position.set(frame.position.x, container.height * 0.0005 + labelHeight * 1.35, frame.position.z);

  const wrapper = new THREE.Group();
  wrapper.add(frame, label);
  return wrapper;
}

function addContainer(group: THREE.Group, result: PackingResult) {
  const { container, cornerBlock } = result;
  const length = container.length * 0.001;
  const height = container.height * 0.001;
  const width = container.width * 0.001;

  const shellGeometry = new THREE.BoxGeometry(length, height, width);
  const shell = new THREE.Mesh(
    shellGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x42d6a4,
      transparent: true,
      opacity: 0.015,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const shellEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeometry),
    new THREE.LineBasicMaterial({ color: 0xe7f8f5, transparent: true, opacity: 0.72 }),
  );
  group.add(shell, shellEdges);
  const effectiveSpaceFrame = createEffectiveSpaceFrame(result);
  if (effectiveSpaceFrame) group.add(effectiveSpaceFrame);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    new THREE.MeshBasicMaterial({
      color: 0x172a30,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -height / 2;
  group.add(floor);

  const blockGeometry = new THREE.BoxGeometry(
    cornerBlock.length * 0.001,
    cornerBlock.height * 0.001,
    cornerBlock.width * 0.001,
  );
  const blockMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7066,
    transparent: true,
    opacity: 0.58,
  });
  const blockEdgeGeometry = new THREE.EdgesGeometry(blockGeometry);
  const blockEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x050505 });
  const zPositions = [
    -width / 2 + (cornerBlock.width * 0.001) / 2,
    width / 2 - (cornerBlock.width * 0.001) / 2,
  ];

  for (const z of zPositions) {
    const block = new THREE.Mesh(blockGeometry, blockMaterial.clone());
    block.position.set(
      -length / 2 + (cornerBlock.length * 0.001) / 2,
      height / 2 - (cornerBlock.height * 0.001) / 2,
      z,
    );
    const edges = new THREE.LineSegments(blockEdgeGeometry, blockEdgeMaterial.clone());
    edges.position.copy(block.position);
    group.add(block, edges);
  }

  addDoorMarker(group, length, height, width);

  const labelWidth = Math.min(1.5, Math.max(0.54, length * 0.18));
  const labelHeight = Math.min(0.38, Math.max(0.18, labelWidth * 0.26));
  const labelOffset = Math.max(0.14, labelWidth * 0.34);
  const labelY = height / 2 + labelHeight * 0.7;
  const doorLabel = makeSpriteLabel("柜门", "#f5f7fb", labelWidth, labelHeight);
  doorLabel.position.set(length / 2 + labelOffset, labelY, 0);
  const innerLabel = makeSpriteLabel("角件端", "#ffbe55", labelWidth, labelHeight);
  innerLabel.position.set(-length / 2 - labelOffset, labelY, 0);
  group.add(doorLabel, innerLabel);
}

function addBoxes(group: THREE.Group, result: PackingResult, positions: BoxPosition[]) {
  if (!positions.length) return;

  const { container } = result;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: 0xb8fff0,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const groups = new Map<string, BoxPosition[]>();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();

  positions.forEach((box) => {
    const color = colorForBox(box);
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color)?.push(box);
  });

  const applyBoxMatrix = (mesh: THREE.InstancedMesh, box: BoxPosition, index: number) => {
    const position = new THREE.Vector3(
      (box.x + box.dx / 2 - container.length / 2) * 0.001,
      (box.z + box.dz / 2 - container.height / 2) * 0.001,
      (box.y + box.dy / 2 - container.width / 2) * 0.001,
    );
    const scale = new THREE.Vector3(
      Math.max(box.dx * 0.001 * 0.992, 0.001),
      Math.max(box.dz * 0.001 * 0.992, 0.001),
      Math.max(box.dy * 0.001 * 0.992, 0.001),
    );
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  };

  groups.forEach((groupBoxes, color) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide,
    });
    const boxes = new THREE.InstancedMesh(geometry, material, groupBoxes.length);
    const wires = new THREE.InstancedMesh(geometry, edgeMaterial.clone(), groupBoxes.length);

    groupBoxes.forEach((box, index) => {
      applyBoxMatrix(boxes, box, index);
      applyBoxMatrix(wires, box, index);
    });

    boxes.instanceMatrix.needsUpdate = true;
    wires.instanceMatrix.needsUpdate = true;
    group.add(boxes, wires);
  });
}

function addSelectedBoxHighlight(
  group: THREE.Group,
  result: PackingResult,
  selectedBox: BoxPosition | null,
  labelText?: string,
) {
  if (!selectedBox) return;

  const { container } = result;
  const position = new THREE.Vector3(
    (selectedBox.x + selectedBox.dx / 2 - container.length / 2) * 0.001,
    (selectedBox.z + selectedBox.dz / 2 - container.height / 2) * 0.001,
    (selectedBox.y + selectedBox.dy / 2 - container.width / 2) * 0.001,
  );
  const scale = new THREE.Vector3(
    Math.max(selectedBox.dx * 0.001 * 1.018, 0.001),
    Math.max(selectedBox.dz * 0.001 * 1.018, 0.001),
    Math.max(selectedBox.dy * 0.001 * 1.018, 0.001),
  );
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const highlight = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x6efcff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  highlight.position.copy(position);
  highlight.scale.copy(scale);
  highlight.renderOrder = 20;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0x6efcff,
      transparent: true,
      opacity: 1,
      depthTest: false,
    }),
  );
  edges.position.copy(position);
  edges.scale.copy(scale);
  edges.renderOrder = 33;
  group.add(highlight, edges);

  if (labelText) {
    const labelWidth = Math.min(0.9, Math.max(0.34, selectedBox.dx * 0.001 * 0.55));
    const labelHeight = Math.min(0.24, Math.max(0.14, labelWidth * 0.28));
    const label = makeSpriteLabel(labelText, "#6efcff", labelWidth, labelHeight);
    label.position.set(position.x, position.y + scale.y / 2 + labelHeight * 1.2, position.z);
    label.renderOrder = 34;
    group.add(label);
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
    const material = new THREE.LineBasicMaterial({
      color: axis.colorHex,
      transparent: true,
      opacity: 1,
      depthTest: false,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material);
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
    cone.position.copy(end);
    cone.quaternion.setFromUnitVectors(upVector, direction);
    cone.renderOrder = 42;

    const label = makeSpriteLabel(axis.label, axis.color, 0.26, 0.2);
    label.position.set(...axis.labelPosition);
    label.renderOrder = 43;
    group.add(line, cone, label);
  }
}

function samplePositions(positions: BoxPosition[]) {
  if (positions.length <= MAX_3D_BOXES) return positions;
  const step = positions.length / MAX_3D_BOXES;
  const sampled: BoxPosition[] = [];
  for (let index = 0; index < MAX_3D_BOXES; index += 1) {
    sampled.push(positions[Math.floor(index * step)]);
  }
  return sampled;
}

export function createCargoScene(canvas: HTMLCanvasElement): CargoScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071016);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const model = new THREE.Group();
  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  const key = new THREE.DirectionalLight(0xffffff, 1.18);
  const fill = new THREE.DirectionalLight(0x42d6a4, 0.4);
  key.position.set(5, 8, 6);
  fill.position.set(-4, 3, -5);
  scene.add(ambient, key, fill, model);

  const target = new THREE.Vector3();
  const cameraState = {
    yaw: CARGO_DEFAULT_YAW,
    pitch: CARGO_DEFAULT_PITCH,
    zoom: CARGO_DEFAULT_ZOOM,
    panX: 0,
    panY: CARGO_DEFAULT_PAN_Y,
    mode: null as null | CargoPointerDragMode,
    lastX: 0,
    lastY: 0,
    container: null as PackingResult["container"] | null,
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateCamera(container: PackingResult["container"]) {
    cameraState.container = container;
    const maxDimension = Math.max(container.length, container.width, container.height) * 0.001;
    const distance = Math.max(3, (maxDimension * CARGO_CAMERA_DISTANCE_FACTOR) / cameraState.zoom);
    const targetScale = maxDimension / CARGO_CAMERA_PAN_SCALE_DIVISOR;
    target.set(cameraState.panX * targetScale, cameraState.panY * targetScale, 0);
    const cosPitch = Math.cos(cameraState.pitch);
    camera.position.set(
      target.x + distance * Math.sin(cameraState.yaw) * cosPitch,
      target.y + distance * Math.sin(cameraState.pitch),
      target.z + distance * Math.cos(cameraState.yaw) * cosPitch,
    );
    camera.lookAt(target);
  }

  function draw() {
    resize();
    renderer.render(scene, camera);
  }

  function render(result: PackingResult | null, visibleCount: number, options: CargoRenderOptions = {}) {
    clearGroup(model);
    if (!result || !result.pattern) {
      draw();
      return;
    }
    const normalizedVisibleCount = Math.min(visibleCount, result.totalBoxes);
    const visiblePositions = generateBoxPositions(result, normalizedVisibleCount);
    const positions = samplePositions(visiblePositions);
    const selectedBox = getSelectedCargoPosition(visiblePositions, options.selectedLoadingSequence);
    addContainer(model, result);
    addBoxes(model, result, positions);
    addSelectedBoxHighlight(model, result, selectedBox, options.selectedLabel);
    if (options.showCoordinateAxes) addCoordinateAxes(model, result);
    updateCamera(result.container);
    draw();
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    cameraState.zoom = Math.max(0.28, Math.min(4.5, cameraState.zoom * factor));
    if (cameraState.container) {
      updateCamera(cameraState.container);
      draw();
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    cameraState.mode = getCargoPointerDragMode(event);
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;
    canvas.style.cursor = cameraState.mode === "pan" ? "move" : "grabbing";
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!cameraState.mode || !cameraState.container) return;
    const dx = event.clientX - cameraState.lastX;
    const dy = event.clientY - cameraState.lastY;
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;
    Object.assign(cameraState, applyCargoCameraDrag(cameraState, cameraState.mode, dx, dy));
    updateCamera(cameraState.container);
    draw();
  };
  const onPointerUp = (event: PointerEvent) => {
    cameraState.mode = null;
    canvas.style.cursor = "";
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);
  resize();
  draw();

  return {
    dispose() {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      clearGroup(model);
      renderer.dispose();
    },
    render,
    resize: draw,
  };
}
