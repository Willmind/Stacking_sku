import * as THREE from "three";
import { generateBoxPositions, type BoxPosition, type PackingResult } from "../core/packing";
import { makeSpriteLabel } from "./labels";

export interface CargoScene {
  dispose(): void;
  render(result: PackingResult | null, visibleCount: number): void;
  resize(): void;
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

  function render(result: PackingResult | null, visibleCount: number) {
    clearGroup(model);
    if (!result || !result.pattern) {
      draw();
      return;
    }
    const positions = samplePositions(generateBoxPositions(result, Math.min(visibleCount, MAX_3D_BOXES)));
    addContainer(model, result);
    addBoxes(model, result, positions);
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
