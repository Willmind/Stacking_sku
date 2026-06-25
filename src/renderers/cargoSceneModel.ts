import type { BoxPosition, PackingResult } from "../core/packing";

export interface SceneBoxModel {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  label: string;
  loadingSequence: number;
}

export interface ScenePrimitiveModel {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
}

export interface SceneLabelModel {
  key: string;
  text: string;
  color: string;
  position: [number, number, number];
  scale: [number, number];
}

export interface SceneEndpointSurfaceModel {
  key: string;
  label: string;
  color: string;
  position: [number, number, number];
  size: [number, number];
  rotation: [number, number, number];
  opacity: number;
}

export interface SceneLegendItemModel {
  key: string;
  label: string;
  color: string;
}

export interface SceneContainerModel {
  scale: [number, number, number];
  floorSize: [number, number];
  floorPosition: [number, number, number];
  cornerBlocks: ScenePrimitiveModel[];
  endpointSurfaces: SceneEndpointSurfaceModel[];
  endpointLegend: SceneLegendItemModel[];
  endpointLabels: SceneLabelModel[];
  effectiveFrame: ScenePrimitiveModel | null;
}

export const DOOR_ENDPOINT_COLOR = "#42d6a4";
export const INNER_ENDPOINT_COLOR = "#ffb24a";

function roundSceneUnit(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function toSceneBox(
  box: BoxPosition,
  container: Pick<PackingResult["container"], "length" | "width" | "height">,
): SceneBoxModel {
  return {
    key: `${box.sequenceIndex ?? 0}-${box.x}-${box.y}-${box.z}`,
    position: [
      roundSceneUnit((box.x + box.dx / 2 - container.length / 2) * 0.001),
      roundSceneUnit((box.z + box.dz / 2 - container.height / 2) * 0.001),
      roundSceneUnit((box.y + box.dy / 2 - container.width / 2) * 0.001),
    ],
    scale: [
      roundSceneUnit(Math.max(box.dx * 0.001 * 0.992, 0.001)),
      roundSceneUnit(Math.max(box.dz * 0.001 * 0.992, 0.001)),
      roundSceneUnit(Math.max(box.dy * 0.001 * 0.992, 0.001)),
    ],
    color: box.skuColor || "#d8923a",
    label: box.skuLabel || "",
    loadingSequence: (box.sequenceIndex ?? 0) + 1,
  };
}

function hasActiveClearance(result: Pick<PackingResult, "clearance">) {
  const clearance = result.clearance;
  return clearance.front > 0 || clearance.rear > 0 || clearance.left > 0 || clearance.right > 0 || clearance.top > 0;
}

export function toSceneContainer(
  result: Pick<PackingResult, "container" | "effectiveContainer" | "clearance" | "cornerBlock">,
): SceneContainerModel {
  const { container, cornerBlock, effectiveContainer, clearance } = result;
  const length = roundSceneUnit(container.length * 0.001);
  const height = roundSceneUnit(container.height * 0.001);
  const width = roundSceneUnit(container.width * 0.001);
  const blockScale: [number, number, number] = [
    roundSceneUnit(cornerBlock.length * 0.001),
    roundSceneUnit(cornerBlock.height * 0.001),
    roundSceneUnit(cornerBlock.width * 0.001),
  ];
  const blockX = roundSceneUnit(-length / 2 + blockScale[0] / 2);
  const blockY = roundSceneUnit(height / 2 - blockScale[1] / 2);
  const blockZ = roundSceneUnit(width / 2 - blockScale[2] / 2);
  const labelWidth = roundSceneUnit(Math.min(3, Math.max(1.35, length * 0.34)));
  const labelHeight = roundSceneUnit(Math.min(0.64, Math.max(0.34, labelWidth * 0.26)));
  const labelOffset = roundSceneUnit(Math.max(0.28, labelWidth * 0.35));
  const labelY = roundSceneUnit(height / 2 + labelHeight * 0.7);
  const surfaceOffset = 0.004;
  const endpointSurfaceSize: [number, number] = [width, height];
  const endpointSurfaceRotation: [number, number, number] = [0, Math.PI / 2, 0];

  return {
    scale: [length, height, width],
    floorSize: [length, width],
    floorPosition: [0, roundSceneUnit(-height / 2), 0],
    cornerBlocks: [
      {
        key: "corner-block-left",
        position: [blockX, blockY, roundSceneUnit(-blockZ)],
        scale: blockScale,
      },
      {
        key: "corner-block-right",
        position: [blockX, blockY, blockZ],
        scale: blockScale,
      },
    ],
    endpointSurfaces: [
      {
        key: "inner-end-surface",
        label: "角件端",
        color: INNER_ENDPOINT_COLOR,
        position: [roundSceneUnit(-length / 2 - surfaceOffset), 0, 0],
        size: endpointSurfaceSize,
        rotation: endpointSurfaceRotation,
        opacity: 0.18,
      },
      {
        key: "door-end-surface",
        label: "柜门",
        color: DOOR_ENDPOINT_COLOR,
        position: [roundSceneUnit(length / 2 + surfaceOffset), 0, 0],
        size: endpointSurfaceSize,
        rotation: endpointSurfaceRotation,
        opacity: 0.18,
      },
    ],
    endpointLegend: [
      { key: "door-end", label: "柜门", color: DOOR_ENDPOINT_COLOR },
      { key: "inner-end", label: "角件端", color: INNER_ENDPOINT_COLOR },
    ],
    endpointLabels: [
      {
        key: "inner-end-label",
        text: "角件端",
        color: INNER_ENDPOINT_COLOR,
        position: [roundSceneUnit(-length / 2 - labelOffset), labelY, 0],
        scale: [labelWidth, labelHeight],
      },
      {
        key: "door-end-label",
        text: "柜门",
        color: DOOR_ENDPOINT_COLOR,
        position: [roundSceneUnit(length / 2 + labelOffset), labelY, 0],
        scale: [labelWidth, labelHeight],
      },
    ],
    effectiveFrame: hasActiveClearance(result)
      ? {
          key: "effective-space-frame",
          position: [
            roundSceneUnit((clearance.front + effectiveContainer.length / 2 - container.length / 2) * 0.001),
            roundSceneUnit((effectiveContainer.height / 2 - container.height / 2) * 0.001),
            roundSceneUnit((clearance.left + effectiveContainer.width / 2 - container.width / 2) * 0.001),
          ],
          scale: [
            roundSceneUnit(effectiveContainer.length * 0.001),
            roundSceneUnit(effectiveContainer.height * 0.001),
            roundSceneUnit(effectiveContainer.width * 0.001),
          ],
        }
      : null,
  };
}
